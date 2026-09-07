"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatorClient = exports.ApiError = void 0;
class ApiError extends Error {
    constructor(message, status, retriable, body) {
        super(message);
        this.status = status;
        this.retriable = retriable;
        this.body = body;
        this.name = 'ApiError';
    }
}
exports.ApiError = ApiError;
/**
 * Centralized HTTP client for the Bridge Backend (formerly: direct to Zoho
 * Creator's custom API). Thin: it maps status codes to typed errors and
 * marks which are retriable. Backoff/retry policy is owned by the sync
 * layer so the queue stays the single scheduler - unchanged behavior from
 * the direct-to-Zoho version.
 *
 * The Bridge uses one bearer device token (issued at enrollment) for every
 * call, so there is one base URL plus a route segment per event type,
 * instead of twelve separately configured Zoho public-key URLs. The Agent
 * never sees a Zoho URL, public key, or credential of any kind - the
 * Bridge alone knows how to reach each organization's Zoho account.
 */
class CreatorClient {
    constructor(opts, auth) {
        this.opts = opts;
        this.auth = auth;
        this.timeoutMs = opts.timeoutMs ?? 15_000;
    }
    async post(pathName, body, options) {
        const apiName = pathName.replace(/^\//, '').replace(/\//g, '_');
        const route = CreatorClient.PATH_TO_ROUTE[apiName]
            || (pathName.startsWith('/api/') ? pathName.replace(/^\//, '') : undefined)
            || (pathName.startsWith('api/') ? pathName : undefined);
        if (!route) {
            throw new ApiError(`No Bridge route configured for ${apiName}`, 500, false);
        }
        const url = `${this.opts.apiBaseUrl.replace(/\/$/, '')}/${route}`;
        if (this.opts.quotaManager && !this.opts.quotaManager.canMakeCall(options?.isCritical)) {
            const metrics = this.opts.quotaManager.getMetrics();
            this.opts.logger.warn('[API QUOTA EXCEEDED] Daily call budget reached or low buffer active', {
                apiName,
                callsToday: metrics.callsToday,
                remainingQuota: metrics.remainingQuota,
                resetsAt: metrics.resetsAt,
                isCritical: options?.isCritical ?? false,
            });
            throw new ApiError('Daily API quota exceeded', 429, true);
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Device-Id': this.auth.deviceId(),
                    ...this.auth.headers(),
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            if (this.opts.quotaManager) {
                this.opts.quotaManager.recordCall(apiName);
            }
            const text = await res.text();
            const parsed = text ? safeJson(text) : undefined;
            if (res.status === 200 || res.status === 201 || res.status === 202) {
                const envelope = parsed;
                this.opts.logger.debug('Bridge API response', { api: apiName, status: res.status, body: envelope });
                if (envelope && envelope.success === false) {
                    // The Bridge accepted the HTTP call but rejected it logically
                    // (validation, tenant checks) - shouldn't normally happen for a
                    // 2xx status, but don't silently treat it as success if it does.
                    throw new ApiError(envelope.error?.message || 'Bridge reported failure', 400, false, envelope);
                }
                return (envelope?.data !== undefined ? envelope.data : parsed);
            }
            const errBody = parsed;
            const message = errBody?.error?.message;
            if (res.status === 400)
                throw new ApiError(message || 'Validation error', 400, false, parsed);
            if (res.status === 401 || res.status === 403)
                throw new ApiError(message || 'Authentication failed', res.status, false, parsed);
            if (res.status === 404)
                throw new ApiError(message || 'Not found', 404, false, parsed);
            if (res.status === 409)
                throw new ApiError(message || 'Conflict', 409, false, parsed);
            if (res.status === 429)
                throw new ApiError(message || 'Rate limited', 429, true, parsed);
            if (res.status >= 500)
                throw new ApiError(message || 'Server error', res.status, true, parsed);
            throw new ApiError(message || `Unexpected status ${res.status}`, res.status, false, parsed);
        }
        catch (err) {
            if (err instanceof ApiError)
                throw err;
            // Network failure / timeout / offline -> retriable.
            const msg = err instanceof Error ? err.message : 'network error';
            throw new ApiError(msg, 0, true);
        }
        finally {
            clearTimeout(timer);
        }
    }
}
exports.CreatorClient = CreatorClient;
/**
 * Internal event-type name -> full Bridge path.
 *
 * FIXED 06-Sep-2026. Every route was previously built as
 * `${apiBaseUrl}/api/agent/${segment}`, which produced
 * /api/agent/work-session and the doubly-wrong
 * /api/agent/activity/batch. PART 32, docs/API.md and the Postman
 * collection all specify /api/activity/* for ingestion and /api/agent/*
 * only for device lifecycle. The Bridge now mounts the canonical paths
 * (with /api/agent retained as a deprecated alias), so the Agent
 * addresses the documented contract.
 */
CreatorClient.PATH_TO_ROUTE = {
    // Device lifecycle
    device_register: 'api/agent/enroll',
    device_heartbeat: 'api/agent/heartbeat',
    api_agent_enroll: 'api/agent/enroll',
    api_agent_heartbeat: 'api/agent/heartbeat',
    // Activity ingestion
    activity_batch: 'api/activity/batch',
    work_session: 'api/activity/work-session',
    application_usage: 'api/activity/application-usage',
    browser_activity: 'api/activity/browser-activity',
    keyboard_metrics: 'api/activity/keyboard-metrics',
    mouse_metrics: 'api/activity/mouse-metrics',
    screenshot_upload: 'api/activity/screenshot',
};
function safeJson(text) {
    try {
        return JSON.parse(text);
    }
    catch {
        return text;
    }
}
//# sourceMappingURL=client.js.map