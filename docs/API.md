# Bridge Backend - API Reference

Base URL: `{API_BASE_URL}` (e.g. `https://api.myproduct.com`)

## Response shape

Every response is one of:

```json
{ "success": true, "data": { ... } }
```
```json
{ "success": false, "error": { "code": "SOME_CODE", "message": "human readable", "details": [ ... ] } }
```

## Auth

Independent auth schemes, never interchangeable:

- **Admin auth** (`ORG_ADMIN` / `SUPER_ADMIN`): `Authorization: Bearer <jwt>` from `/api/organizations/login`. 12 hour expiry, stateless (not individually revocable before expiry - see "Known limitations" below).
- **Device auth** (`AGENT`): `Authorization: Bearer <device_token>` from `/api/agent/enroll`. Hashed (SHA-256) at rest; the raw token is only ever returned once, at enrollment.
- **Integration auth** (`CREATOR`): `X-TrackFlow-Integration-Key: <key>` for server-to-server integration calls (e.g. Zoho Creator workflows).

---

## Organizations

### `POST /api/organizations/register`
Public. Creates the organization and its first `ORG_ADMIN`.

Request:
```json
{ "organizationName": "Acme Workforce", "email": "admin@acme.com", "password": "min 8 chars" }
```
Response `201`: `{ organization: { id, organizationName, organizationCode, status }, admin: { id, email, role }, token }`

`organizationCode` is generated server-side (e.g. `ACME01-3F2A1B`) - this is what the Agent's operator enters during install.

### `POST /api/organizations/login`
Public.
```json
{ "email": "admin@acme.com", "password": "..." }
```
Response `200`: `{ admin: { id, email, role, organizationId }, token }`

---

## Zoho

All four require admin auth except `/callback`, which Zoho itself redirects the browser to.

### `GET /api/zoho/connect?account_owner_name=&app_link_name=&data_center=`
`ORG_ADMIN` only. `data_center` optional (`in`/`com`/`eu`/`com.au`, defaults to `ZOHO_DEFAULT_DC`). Returns `{ authorization_url }` - redirect the admin's browser there. The org id and the owner/app names travel through Zoho's redirect as a signed, 5-minute JWT in the `state` param; nothing is stored server-side between `/connect` and `/callback`.

### `GET /api/zoho/callback?code=&state=`
Public (Zoho calls this). Exchanges `code` for tokens, encrypts the refresh token (AES-256-GCM), stores the connection, returns a plain HTML success page (a human is looking at this tab, not a script).

### `GET /api/zoho/status`
`ORG_ADMIN` (own org) or `SUPER_ADMIN` (any org). Returns `{ connected, status, accountOwnerName, appLinkName, dataCenter, connectedAt, lastError }`. Never returns the refresh token.

### `DELETE /api/zoho/disconnect`
`ORG_ADMIN` only. Clears the stored refresh token and sets status to `DISCONNECTED`.

---

## Employees

All require `ORG_ADMIN` auth, always scoped to the caller's own organization.

### `POST /api/employees`
```json
{ "employeeCode": "EMP-001", "fullName": "Vignesh", "email": "...", "department": "IT", "designation": "Developer" }
```
`employeeCode` is what the employee enters into the Agent installer as "Employee ID." `409` if it already exists in this organization (unique per-organization, not globally - the same code can exist in two different organizations without conflict).

### `GET /api/employees?skip=0&take=50`
Response: `{ items: [...], total, skip, take }`.

### `GET /api/employees/:id`
`404` (not `403`) if the id belongs to another organization - the caller should not learn whether the id exists at all outside their own tenant.

---

## Agent - enrollment and device lifecycle

### `POST /api/agent/enroll`
Public (the Agent has no token yet). Rate-limited more strictly than general traffic.
```json
{
  "organization_code": "ACME01-3F2A1B",
  "employee_id": "EMP-001",
  "device_id": "device-generated-locally",
  "hostname": "...", "os": "...", "os_version": "...", "arch": "...", "agent_version": "..."
}
```
Response `201`: `{ employee_id, device_token, already_registered }`.

Idempotent: enrolling the same `device_id` again (reinstall, or asking for a fresh token) updates the device record, **revokes all previous tokens for that device**, and issues a new one - `already_registered: true` on the response. `404` for an unknown `organization_code` or `employee_id`; `403` if the organization or employee is not `ACTIVE`.

### `GET /api/agent/device`
Device auth. Returns the calling device's own `device_id`, `employee_id`, `status`, `agent_version`, `last_seen`.

### `POST /api/agent/heartbeat`
Device auth. Updates `last_seen` and `status` in the Bridge's own database synchronously; separately makes a best-effort push to the organization's Zoho `device_heartbeat` function (not retried on failure - the next heartbeat, a few minutes later, self-corrects, so this is deliberately not put through the durable sync queue the way one-off activity events are).

---

## Agent - activity

All seven require device auth. All respond `202` immediately once the event is durably recorded - **none of them wait on Zoho**. `event_id` is required on every one and is the idempotency key: resubmitting the same `event_id` returns `duplicate: true` instead of creating a second record.

| Endpoint | Zoho function it eventually reaches |
|---|---|
| `POST /api/agent/work-session` | `work_session` |
| `POST /api/agent/browser-activity` | `browser_activity` |
| `POST /api/agent/application-usage` | `application_usage` |
| `POST /api/agent/keyboard-metrics` | `keyboard_metrics` |
| `POST /api/agent/mouse-metrics` | `mouse_metrics` |
| `POST /api/agent/screenshot` | `screenshot_upload` |
| `POST /api/agent/activity/batch` | routes each `events[]` entry to the matching function above by its `type` field (`browser`/`keyboard`/`mouse`/`application`/`session`) |

Response shape (single-event endpoints): `{ recorded: true, duplicate: boolean, sync_log_id }`.
Response shape (batch): `{ recorded: <count>, results: [{ event_id, type, duplicate }] }`.

`device_id`/`employee_id` in any request body are ignored - the authenticated device's own identity is always what gets recorded, so a device can never claim to be reporting for a different device or employee than the one its token belongs to.

See `docs/AGENT_INTEGRATION.md` for the exact field names each endpoint expects (they match the target Zoho Deluge functions field-for-field).

---

## Sync

Admin auth (`ORG_ADMIN` sees only their own organization; `SUPER_ADMIN` can pass `?organizationId=` for `/status`, or any `:organizationId` for the trigger).

### `GET /api/sync/status`
`{ organizationId, counts: { PENDING, SUCCESS, FAILED, DEAD } }`.

### `POST /api/sync/:organizationId`
Triggers one retry-worker tick immediately instead of waiting for the interval timer ("sync now"). **Known limitation:** in this first version the tick processes every organization's currently-due rows, not only the one named in the URL - the worker doesn't yet filter a single tick to one tenant. `403` if an `ORG_ADMIN` names an organization that isn't their own.

---

## Health

### `GET /health`
No auth. `200` with `{ status: "ok", database: "connected" }`, or `503` with `{ status: "degraded" }` if the database is unreachable. Not rate-limited, not request-logged (keeps log/monitoring noise down for a path polled every few seconds by uptime checks).

---

## Organizations (continued)

### `GET /api/organizations/me`
`ORG_ADMIN`. Returns the caller's own organization record.

### `PATCH /api/organizations/me`
`ORG_ADMIN`. `{ organizationName }`. Renames the organization.

### `GET /api/organizations/settings`
- **Auth**: `ORG_ADMIN` (`Authorization: Bearer <jwt>`)
- **Scope**: Organization determined solely from authenticated `req.admin.organizationId` (Tenant isolation enforced).
- **Response `200`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "organizationId": "uuid",
      "administratorEmail": "admin@example.com",
      "timeZone": "Asia/Kolkata",
      "workingHoursStart": "09:00",
      "workingHoursEnd": "18:00",
      "browserTracking": true,
      "applicationTracking": true,
      "keyboardMetrics": true,
      "mouseTracking": true,
      "screenshotsEnabled": false,
      "idleDetection": true,
      "idleThresholdSeconds": 300,
      "screenshotIntervalMs": 600000,
      "setupCompletedAt": "2026-09-07T12:00:00.000Z",
      "onboardingCompleted": true,
      "createdAt": "2026-09-07T10:00:00.000Z",
      "updatedAt": "2026-09-07T12:00:00.000Z"
    }
  }
  ```
- **Errors**: `404 NOT_FOUND` if settings have not been configured yet.

### `PATCH /api/organizations/settings`
- **Auth**: `ORG_ADMIN` (`Authorization: Bearer <jwt>`)
- **Scope**: Organization determined solely from authenticated `req.admin.organizationId`. `organizationId` cannot be specified in body or query.
- **Validation**:
  - `administratorEmail`: valid email, required
  - `timeZone`: non-empty string, max 100 chars, required
  - `workingHoursStart`: HH:mm format (24h), required
  - `workingHoursEnd`: HH:mm format (24h), required
  - `browserTracking`: boolean, optional
  - `applicationTracking`: boolean, optional
  - `keyboardMetrics`: boolean, optional
  - `mouseTracking`: boolean, optional
  - `screenshotsEnabled`: boolean, optional
  - `idleDetection`: boolean, optional
  - `idleThresholdSeconds`: non-negative integer, optional
  - `screenshotIntervalMs`: non-negative integer, optional
  - `setupCompleted`: boolean, required (sets `onboardingCompleted = true` and `setupCompletedAt = new Date()` when true, resets to false and null when false)
  - `organizationName`: string (2-200 chars), optional (updates `Organization.organizationName`)
  - Arbitrary fields are rejected.
- **Request Example**:
  ```json
  {
    "organizationName": "Zoflowx",
    "administratorEmail": "vigneshking933@gmail.com",
    "timeZone": "Asia/Kolkata",
    "workingHoursStart": "09:00",
    "workingHoursEnd": "18:30",
    "browserTracking": true,
    "applicationTracking": true,
    "keyboardMetrics": true,
    "mouseTracking": true,
    "screenshotsEnabled": false,
    "idleDetection": true,
    "idleThresholdSeconds": 300,
    "screenshotIntervalMs": 600000,
    "setupCompleted": true
  }
  ```
- **Response `200`**:
  ```json
  {
    "success": true,
    "data": {
      "id": "uuid",
      "organizationId": "uuid",
      "organizationName": "Zoflowx",
      "administratorEmail": "vigneshking933@gmail.com",
      "timeZone": "Asia/Kolkata",
      "workingHoursStart": "09:00",
      "workingHoursEnd": "18:30",
      "browserTracking": true,
      "applicationTracking": true,
      "keyboardMetrics": true,
      "mouseTracking": true,
      "screenshotsEnabled": false,
      "idleDetection": true,
      "idleThresholdSeconds": 300,
      "screenshotIntervalMs": 600000,
      "setupCompleted": true,
      "onboardingCompleted": true,
      "setupCompletedAt": "2026-09-07T12:00:00.000Z",
      "createdAt": "2026-09-07T10:00:00.000Z",
      "updatedAt": "2026-09-07T12:00:00.000Z"
    }
  }
  ```

---

## Creator Integrations

### `POST /api/integrations/creator/employees/:employeeId/activation`
- **Auth**: `X-TrackFlow-Integration-Key: <integration key>` header. Does NOT accept admin JWT or device tokens.
- **Request Body**:
  ```json
  {
    "organizationId": "<bridge organization id>"
  }
  ```
- **Response `200`**:
  ```json
  {
    "success": true,
    "data": {
      "activation_code": "TF-7K4P-92XM",
      "activation_id": "97d3f821-4fbb-4552-b1e6-34d2847a2503",
      "expires_at": "2026-09-10T07:38:40.872Z",
      "employee_id": "EMP-001"
    }
  }
  ```
- **Behavior & Security**:
  - Validates `X-TrackFlow-Integration-Key` header.
  - Verifies the organization exists.
  - Verifies the employee exists and belongs to that organization (`404 NOT_FOUND` if employee not found or belongs to another tenant).
  - Automatically revokes any previously active activation code for that employee.
  - Generates a single-use plaintext activation code returned exactly once in the response.
  - Plaintext code is never logged and never stored in the database (only sha256 hash is persisted).

---

## Devices

All require `ORG_ADMIN` auth, scoped to the caller's own organization.

### `GET /api/devices?skip=0&take=50`
`{ items: [...], total, skip, take }`. Each item includes its `employee`.

### `GET /api/devices/:id`
`404` if the id belongs to another organization.

### `PATCH /api/devices/:id/status`
`{ status: "ONLINE" | "OFFLINE" | "DISABLED" }`. A `DISABLED` device's existing token stops authenticating immediately (`GET /api/agent/device` etc. return `403`), but the token itself is not revoked - re-enabling restores access without a new enrollment.

### `POST /api/devices/:id/revoke-token`
Revokes every active token for the device (`401` on next Agent call, not `403` - the token itself is gone, not just blocked). The device record and its `status` are untouched; re-enrollment (`POST /api/agent/enroll` with the same `device_id`) is how it gets a new token.

---

## Sync (continued)

### `GET /api/sync/logs?skip=0&take=50&status=`
`ORG_ADMIN`/`SUPER_ADMIN`, scoped to the caller's own organization. `status` optional (`PENDING`/`SUCCESS`/`FAILED`/`DEAD`). Each item includes `device` and `device.employee`. This is what backs the Sync & Activity table - `GET /api/sync/status` alone only gives aggregate counts, not the rows themselves.

---

## Employees (continued)

### `PATCH /api/employees/:id`
`ORG_ADMIN`. Any of `fullName`, `email`, `department`, `designation`, `status` (`ACTIVE`/`DISABLED`) - at least one required. A `DISABLED` employee can no longer be used to enroll a *new* device (`403` on `/api/agent/enroll`), but does not revoke tokens of devices already enrolled under them - disable those devices separately via `PATCH /api/devices/:id/status` if that's also the intent.

---

## Error codes

| HTTP | `error.code` | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` | Request validation failed (see `error.details`) |
| 401 | `UNAUTHORIZED` | Missing/invalid/expired token |
| 403 | `FORBIDDEN` | Valid token, insufficient permission (wrong role, wrong org, disabled device, inactive org) |
| 404 | `NOT_FOUND` | Resource doesn't exist, or exists in a different tenant (never distinguished) |
| 409 | `CONFLICT` | Duplicate email / employeeCode |
| 429 | `RATE_LIMITED` | Too many requests |
| 502/503 | `BAD_GATEWAY` / `SERVICE_UNAVAILABLE` | Zoho Creator rejected the request or is unreachable |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

## Known limitations (deliberate, first-version scope)

- Admin JWTs are stateless and cannot be revoked before their 12h expiry.
- The Zoho access-token cache is an in-process `Map`; a multi-instance deployment needs this moved to Redis (see `docs/DEPLOYMENT.md`).
- `POST /api/sync/:organizationId` triggers a global tick, not a per-organization one.
- CORS currently reflects any origin (`cors()` with no allowlist) since there is no admin dashboard frontend built yet to restrict it to.
