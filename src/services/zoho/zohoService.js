const axios = require('axios');
const FormData = require('form-data');
const zohoConnectionRepository = require('../../models/zohoConnectionRepository');
const { decrypt } = require('../../utils/crypto');
const { refreshAccessToken } = require('./zohoOAuth');
const { AppError, notFound, badGateway, serviceUnavailable } = require('../../utils/errors');
const { logger } = require('../../config/logger');

// In-memory access-token cache, one entry per organization. Zoho access
// tokens last ~1 hour; refreshing on every record write would be both
// unnecessary API traffic (explicitly to avoid, per the sync design) and
// slower per-request. A multi-instance deployment would move this to
// Redis - noted in docs/DEPLOYMENT.md - but a single in-process cache is
// the right amount of machinery for the first version.
const tokenCache = new Map(); // organizationId -> { accessToken, expiresAt }

/**
 * One instance per request/job is fine - it's cheap and stateless aside
 * from the shared module-level token cache. Everything here is scoped to
 * a single organization's own Zoho Creator app; nothing about which app,
 * owner, or credentials to use is ever hard-coded.
 */
class ZohoService {
  constructor(organizationId) {
    this.organizationId = organizationId;
  }

  async _loadConnection() {
    const conn = await zohoConnectionRepository.findByOrganization(this.organizationId);
    if (!conn || conn.status === 'DISCONNECTED') {
      const err = notFound('This organization has not connected a Zoho Creator account');
      err.retriable = false; // retrying will never help until the org connects Zoho
      throw err;
    }
    return conn;
  }

  async getAccessToken({ forceRefresh = false } = {}) {
    const cached = tokenCache.get(this.organizationId);
    if (!forceRefresh && cached && cached.expiresAt > Date.now() + 30_000) {
      return cached.accessToken;
    }

    const conn = await this._loadConnection();
    const refreshToken = decrypt(conn.encryptedRefreshToken);

    try {
      const { accessToken, expiresInSeconds } = await refreshAccessToken(refreshToken, conn.dataCenter);
      tokenCache.set(this.organizationId, {
        accessToken,
        expiresAt: Date.now() + expiresInSeconds * 1000,
      });
      if (conn.status !== 'CONNECTED') {
        await zohoConnectionRepository.update(this.organizationId, { status: 'CONNECTED', lastError: null });
      }
      return accessToken;
    } catch (err) {
      await zohoConnectionRepository.markError(this.organizationId, err.message).catch(() => {});
      throw err;
    }
  }

  async _baseUrl() {
    const conn = await this._loadConnection();
    return {
      url: `https://www.zohoapis.${conn.dataCenter}/creator/v2.1/data/${conn.accountOwnerName}/${conn.appLinkName}`,
      conn,
    };
  }

  /**
   * Runs `fn(accessToken)`; on a 401 (expired/invalid token slipping past
   * the cache), forces exactly one refresh-and-retry before giving up.
   * Rate limits and 5xx are surfaced as retriable errors for the sync
   * layer's backoff to handle - never silently retried in a loop here.
   */
  async _withAuth(fn) {
    const token = await this.getAccessToken();
    try {
      return await fn(token);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401) {
        const fresh = await this.getAccessToken({ forceRefresh: true });
        return await fn(fresh);
      }
      throw this._translateError(err);
    }
  }

  _translateError(err) {
    const status = err.response?.status;
    const body = err.response?.data;
    if (status === 429) {
      const e = new AppError(429, 'ZOHO_RATE_LIMITED', 'Zoho Creator API rate limit reached', body);
      e.retriable = true;
      return e;
    }
    if (status >= 500 || !status) {
      const e = serviceUnavailable(`Zoho Creator is temporarily unavailable: ${err.message}`);
      e.retriable = true;
      return e;
    }
    const e = badGateway(`Zoho Creator rejected the request (${status}): ${JSON.stringify(body)}`);
    e.retriable = false;
    return e;
  }

  /** Creates one record. formName is the Creator form's link name. */
  async createRecord(formName, data) {
    const { url } = await this._baseUrl();
    return this._withAuth(async (token) => {
      const res = await axios.post(
        `${url}/form/${formName}`,
        { data },
        { headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/json' }, timeout: 20_000 }
      );
      if (res.data?.code && res.data.code !== 3000) {
        const msg = Array.isArray(res.data.error) ? res.data.error.join(', ') : (res.data.message || JSON.stringify(res.data));
        const err = new Error(`Zoho Creator error (${res.data.code}): ${msg}`);
        err.response = { status: 400, data: res.data };
        throw err;
      }
      return res.data;
    });
  }

  /** Updates one record by ID. reportName is the Creator report's link name. */
  async updateRecord(reportName, recordId, data) {
    const { url } = await this._baseUrl();
    return this._withAuth(async (token) => {
      const res = await axios.patch(
        `${url}/report/${reportName}/${recordId}`,
        { data },
        { headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/json' }, timeout: 20_000 }
      );
      if (res.data?.code && res.data.code !== 3000) {
        const msg = Array.isArray(res.data.error) ? res.data.error.join(', ') : (res.data.message || JSON.stringify(res.data));
        const err = new Error(`Zoho Creator error (${res.data.code}): ${msg}`);
        err.response = { status: 400, data: res.data };
        throw err;
      }
      return res.data;
    });
  }

  /** criteria uses Creator's own criteria syntax, e.g. `activity_id == "abc"`. */
  async searchRecord(reportName, criteria, { maxRecords = 200 } = {}) {
    const { url } = await this._baseUrl();
    return this._withAuth(async (token) => {
      try {
        const params = { max_records: maxRecords };
        if (criteria) params.criteria = criteria;
        const res = await axios.get(`${url}/report/${reportName}`, {
          headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/json' },
          params,
          timeout: 20_000,
        });
        return res.data;
      } catch (err) {
        // Zoho Creator returns HTTP 400 with code 9220 (empty report) or 9280 (no matches)
        const code = err.response?.data?.code;
        if (code === 9220 || code === 9280) {
          return { code: 3000, data: [] };
        }
        throw err;
      }
    });
  }

  /** records: array of plain field objects, max 200 per Zoho's own limit. */
  async batchCreateRecords(formName, records) {
    const { url } = await this._baseUrl();
    return this._withAuth(async (token) => {
      const res = await axios.post(
        `${url}/form/${formName}`,
        { data: records },
        { headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/json' }, timeout: 30_000 }
      );
      return res.data;
    });
  }

  /**
   * Calls a Zoho Creator custom API function (a Deluge function exposed
   * as its own endpoint, e.g. browser_activity, work_session,
   * keyboard_metrics) rather than a generic form/report primitive. Used
   * for the 8 activity event types this Bridge currently handles,
   * because the reference organization's Zoho Creator app already
   * implements them - including the employee_id/device_id -> lookup
   * field resolution - server-side in Deluge, exactly the way the Agent
   * used to call Zoho directly. New organizations only need the same
   * custom API functions published in their own account; see
   * docs/ZOHO_SETUP.md.
   */
  async callCustomFunction(functionName, params) {
    const conn = await this._loadConnection();
    const url = `https://www.zohoapis.${conn.dataCenter}/creator/custom/${conn.accountOwnerName}/${functionName}`;
    return this._withAuth(async (token) => {
      const res = await axios.post(url, params, {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 20_000,
      });
      return res.data;
    });
  }

  /** fileBuffer/fileName for a file-upload field on an existing record. */
  async uploadFile(formName, recordId, fieldName, fileBuffer, fileName) {
    const { url } = await this._baseUrl();
    return this._withAuth(async (token) => {
      const form = new FormData();
      form.append(fieldName, fileBuffer, fileName);
      const res = await axios.post(
        `${url}/form/${formName}/${recordId}/${fieldName}/upload`,
        form,
        {
          headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/json', ...form.getHeaders() },
          timeout: 60_000,
          maxBodyLength: Infinity,
        }
      );
      return res.data;
    });
  }
}

function forOrganization(organizationId) {
  return new ZohoService(organizationId);
}

module.exports = { ZohoService, forOrganization };
