const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const pinoHttp = require('pino-http');

const { logger } = require('./config/logger');
const { env } = require('./config/env');
const { general: generalRateLimit } = require('./middleware/rateLimit');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { api } = require('./routes');
const healthRoutes = require('./routes/health.routes');

/**
 * CORS.
 *
 * FIXED 06-Sep-2026. This was a bare `cors()` - wildcard origin, on an API
 * whose endpoints issue device tokens and return employee records. Any
 * page on any site could drive it from a logged-in admin's browser. The
 * Agent is an Electron process and sends no Origin header, so it is
 * unaffected by an allowlist; only browser callers are, which is the whole
 * point.
 */
function corsOptions() {
  const allowed = env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length === 0) {
    // No browser front-end configured: reject cross-origin outright rather
    // than silently permitting everything.
    return { origin: false, credentials: true };
  }
  return {
    origin(origin, cb) {
      // No Origin header: non-browser client (Agent, curl, server-to-server).
      if (!origin) return cb(null, true);
      return allowed.includes(origin)
        ? cb(null, true)
        : cb(new Error('Origin not allowed'));
    },
    credentials: true,
  };
}

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // The Bridge sits behind a TLS terminator in production; without this
  // express-rate-limit keys every request to the proxy's own IP and
  // req.ip is useless for the audit log.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors(corsOptions()));

  // Screenshots arrive base64-encoded, which inflates the payload by ~33%.
  // The previous 2mb ceiling rejected any real capture with a 413 the
  // Agent recorded as a non-retriable 400, silently discarding it.
  app.use(express.json({ limit: env.JSON_BODY_LIMIT }));

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/health' },
      // Never let a query string reach the log. Enrollment and OAuth
      // callbacks carry codes in the query, and PART 29 forbids logging
      // activation secrets or OAuth values.
      customProps: (req) => ({ path: String(req.url || '').split('?')[0] }),
      serializers: {
        req(req) {
          return {
            method: req.method,
            path: String(req.url || '').split('?')[0],
            remoteAddress: req.remoteAddress,
          };
        },
      },
    })
  );

  app.use(generalRateLimit);


  // ─── Static installer downloads ────────────────────────────────────────────
  // Files in public/downloads/ are served at /downloads/<filename>.
  // Redirects to official GitHub Releases CDN when files aren't stored locally.
  const WIN_RELEASE_URL = 'https://github.com/vicky9790/Workflowtracker-Agent/releases/download/v1.0.0/WorkSight-Agent-Setup-1.0.0.exe';
  const MAC_RELEASE_URL = 'https://github.com/vicky9790/Workflowtracker-Agent/releases/download/v1.0.0/WorkSight-Agent-1.0.0.dmg';

  app.get('/downloads/WorkSight-Agent-Setup.exe', (req, res, next) => {
    const localPath = path.join(__dirname, '../public/downloads/WorkSight-Agent-Setup.exe');
    if (require('fs').existsSync(localPath)) {
      return res.download(localPath);
    }
    return res.redirect(WIN_RELEASE_URL);
  });

  app.get('/downloads/WorkSight-Agent.dmg', (req, res, next) => {
    const localPath = path.join(__dirname, '../public/downloads/WorkSight-Agent.dmg');
    if (require('fs').existsSync(localPath)) {
      return res.download(localPath);
    }
    return res.redirect(MAC_RELEASE_URL);
  });

  app.use('/downloads', express.static(path.join(__dirname, '../public/downloads'), {
    setHeaders(res, filePath) {
      res.setHeader('Content-Disposition', 'attachment; filename="' + path.basename(filePath) + '"');
      res.setHeader('Cache-Control', 'no-cache');
    },
  }));

  // ─── Download landing page ──────────────────────────────────────────────────
  app.get('/download', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Download WorkSight Agent</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0f14; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .container { text-align: center; max-width: 560px; padding: 40px 24px; }
  .logo { width: 80px; height: 80px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; font-size: 36px; }
  h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; background: linear-gradient(135deg, #e2e8f0, #a5b4fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  p { color: #94a3b8; font-size: 15px; margin-bottom: 36px; line-height: 1.6; }
  .buttons { display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .btn { display: inline-flex; align-items: center; gap: 10px; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 600; font-size: 15px; transition: transform 0.15s, box-shadow 0.15s; }
  .btn-win { background: linear-gradient(135deg, #0078d4, #106ebe); color: #fff; }
  .btn-mac { background: linear-gradient(135deg, #1c1c1e, #3a3a3c); color: #fff; border: 1px solid #48484a; }
  .btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
  .note { margin-top: 32px; font-size: 13px; color: #64748b; line-height: 1.6; }
  .note strong { color: #94a3b8; }
</style>
</head>
<body>
<div class="container">
  <div class="logo">⚡</div>
  <h1>WorkSight Agent</h1>
  <p>Download and install the WorkSight monitoring agent for your device. Available for Windows and macOS.</p>
  <div class="buttons">
    <a href="/downloads/WorkSight-Agent-Setup.exe" class="btn btn-win">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
      Download for Windows
    </a>
    <a href="/downloads/WorkSight-Agent.dmg" class="btn btn-mac">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>
      Download for macOS
    </a>
  </div>
  <p class="note">
    <strong>Windows:</strong> Run the .exe installer and click &ldquo;More info &rarr; Run anyway&rdquo; if SmartScreen appears.<br/>
    <strong>macOS:</strong> Open the .dmg, drag to Applications. If blocked: right-click &rarr; Open.
  </p>
</div>
</body>
</html>`);
  });

  app.use('/health', healthRoutes);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
