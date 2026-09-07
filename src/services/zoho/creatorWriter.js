const { forOrganization } = require('./zohoService');
const { FORMS, REPORTS } = require('./creatorSchema');
const { logger } = require('../../config/logger');

/**
 * Turns the mapper's output into actual Creator API calls.
 *
 * Three things the previous sync path got wrong and this fixes:
 *
 * 1. LOOKUP RESOLUTION. employee/device/session on every activity form are
 *    type-14 lookups. They need a Creator record ID ("416852000000172006"),
 *    not "EMP-001". The old code posted the business code and relied on an
 *    undocumented Deluge function to resolve it server-side.
 *
 * 2. UPSERT, NOT INSERT. Every form carries its own natural key
 *    (activity_id, session_id, metric_id...). Searching that key first and
 *    PATCHing when found is what makes a retry safe, and it is how a
 *    browser CLOSE event fills in end_time on the row its OPEN created.
 *
 * 3. FILE FIELDS. screenshot_file is a real Creator upload field; it cannot
 *    be populated in the create call. Create, then upload.
 *
 * Lookup IDs are cached per organization because employee and device sets
 * are small and change rarely, while activity volume is high. The cache is
 * keyed by organization so it can never leak a record ID across tenants.
 */

const LOOKUP_TTL_MS = 10 * 60 * 1000;
const lookupCache = new Map(); // `${orgId}:${form}:${code}` -> { id, at }

function cacheGet(orgId, form, code) {
  const hit = lookupCache.get(`${orgId}:${form}:${code}`);
  if (!hit) return null;
  if (Date.now() - hit.at > LOOKUP_TTL_MS) return null;
  return hit.id;
}

function cacheSet(orgId, form, code, id) {
  lookupCache.set(`${orgId}:${form}:${code}`, { id, at: Date.now() });
}

/** Creator criteria strings are injectable; only ever interpolate escaped values. */
function escapeCriteriaValue(v) {
  return String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

async function findRecordId(zoho, organizationId, form, keyField, keyValue) {
  if (!keyValue) return null;
  const cached = cacheGet(organizationId, form, keyValue);
  if (cached) return cached;

  const report = REPORTS[form];
  if (!report) return null;

  const criteria = `${keyField} == "${escapeCriteriaValue(keyValue)}"`;
  const res = await zoho.searchRecord(report, criteria, { maxRecords: 200 });
  const id = res?.data?.[0]?.ID ?? null;
  if (id) cacheSet(organizationId, form, keyValue, id);
  return id;
}

/**
 * Resolves the mapper's business codes into Creator record IDs.
 * A lookup that cannot be resolved is a hard, non-retriable failure: it
 * means the employee or device does not exist in Creator yet, and retrying
 * the same payload for eight attempts will never change that.
 */
async function resolveLookups(zoho, organizationId, spec) {
  const formSpec = FORMS[spec.form];
  if (!formSpec || !formSpec.lookups) return {};

  const resolved = {};
  for (const [fieldName, targetForm] of Object.entries(formSpec.lookups)) {
    const code = spec.lookups?.[fieldName];
    if (!code) continue;

    const keyField = FORMS[targetForm].idField;
    const id = await findRecordId(zoho, organizationId, targetForm, keyField, code);

    if (!id) {
      const err = new Error(
        `Cannot resolve ${spec.form}.${fieldName}: no ${targetForm} record with ${keyField}="${code}"`
      );
      err.code = 'CREATOR_LOOKUP_UNRESOLVED';
      err.retriable = false;
      throw err;
    }
    // Zoho Creator in this app configures lookup fields (employee, device, session)
    // as multi-select lookups which require an array of record IDs.
    resolved[fieldName] = [id];
  }
  return resolved;
}

/**
 * Writes one mapped event. Returns { recordId, action } where action is
 * 'created' or 'updated' - the caller records it so the sync log shows what
 * actually happened rather than a generic success.
 */
async function writeEvent(organizationId, spec) {
  const zoho = forOrganization(organizationId);
  const formSpec = FORMS[spec.form];

  const lookupIds = await resolveLookups(zoho, organizationId, spec);
  const payload = { ...spec.data, ...lookupIds };

  const existingId = spec.recordKey?.value
    ? await findRecordId(
      zoho, organizationId, spec.form, spec.recordKey.field, spec.recordKey.value
    )
    : null;

  let recordId;
  let action;

  if (existingId) {
    // Never overwrite the natural key on update, and never null a field
    // the mapper omitted - `compact()` has already dropped empties.
    const { [spec.recordKey.field]: _key, ...updatable } = payload;
    await zoho.updateRecord(REPORTS[spec.form], existingId, updatable);
    recordId = existingId;
    action = 'updated';
  } else {
    const res = await zoho.createRecord(spec.form, payload);
    recordId = res?.data?.ID ?? res?.result?.[0]?.data?.ID ?? null;
    action = 'created';
    if (recordId && spec.recordKey?.value) {
      cacheSet(organizationId, spec.form, spec.recordKey.value, recordId);
    }
  }

  // Deferred file uploads (screenshots). A failed upload does not
  // invalidate the record that was already written, so it is reported
  // separately rather than failing the whole event.
  if (recordId && Array.isArray(spec.files) && spec.files.length > 0) {
    for (const f of spec.files) {
      try {
        const buf = Buffer.from(f.base64, 'base64');
        await zoho.uploadFile(spec.form, recordId, f.field, buf, f.fileName);
      } catch (err) {
        logger.warn(
          { organizationId, form: spec.form, recordId, field: f.field, err: err.message },
          'creator file upload failed; record written without attachment'
        );
      }
    }
  }

  return { recordId, action };
}

/** Test seam and a way for an admin "resync" action to start from clean state. */
function clearLookupCache(organizationId) {
  if (!organizationId) return lookupCache.clear();
  for (const key of lookupCache.keys()) {
    if (key.startsWith(`${organizationId}:`)) lookupCache.delete(key);
  }
}

module.exports = { writeEvent, findRecordId, clearLookupCache };
