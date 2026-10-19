# Deploying `loja3d-app` to Vercel

## Project settings
| Setting | Value |
|---|---|
| Root Directory | `./` when the repo is the app itself (`loja3d-app` if it lives in a monorepo) |
| Node.js Version | 20.x (Node 16 is no longer offered by Vercel; ng-compat.js handles OpenSSL 3) |
| Framework Preset | Other (also set in `vercel.json`) |
| Install / Build / Output | from `vercel.json`: `npm ci --legacy-peer-deps` / `npm run build:vercel` / `dist/loja3d-app` |

## Environments
| Environment | Vercel scope | `APP_ENV` | `API_URL` |
|---|---|---|---|
| local | none (`npm start`, proxy to `127.0.0.1:8000`) | – | – (relative URLs) |
| dev | Preview | `dev` (or derived from `VERCEL_ENV=preview`) | `https://api-dev.example.com` |
| prod | Production | `prod` (or derived from `VERCEL_ENV=production`) | `https://api.example.com` |

Variables (see `.env.example`): `APP_ENV`, `API_URL` (https origin, no path), `USE_MOCK_API` (default `false`).
`scripts/set-env.js` rewrites `src/environments/environment.prod.ts` before the build and fails when `API_URL`
is missing or not https for dev/prod. Do not commit the rewritten file (`git checkout src/environments/environment.prod.ts`).

Local checks: `APP_ENV=dev API_URL=https://api-dev.example.com npm run build:dev`.

## How requests reach the API
Services call relative `api/...` URLs. `ApiOriginInterceptor` prefixes `API_URL` to them at runtime; the browser
talks to the backend directly, so the backend must allow the frontend origin in `CORS_ORIGINS` and set `FRONTEND_URL`
(e-mail links). A Vercel `rewrites` proxy was not used: it hides CORS but adds a hop and body-size limits that matter
for base64 product images.

## Notes
- `vercel.json` uses explicit ordered `routes`: apply headers, serve existing files (`handle: filesystem`),
  rewrite non-file paths to `index.html`, then return **404 with `Cache-Control: no-store`** for missing files.
  Do not combine `routes` with top-level `rewrites`, `headers`, `redirects`, `cleanUrls` or `trailingSlash`.
  The explicit final 404 prevents a missing JavaScript/CSS file from falling through to an implicit HTML fallback.
- Only content-hashed JS/CSS bundles are immutable-cached. HTML and unhashed assets revalidate; translations use five minutes.
- CSP is **report-only**; review browser console reports, then switch to `Content-Security-Policy`.
- Preview URLs change per deploy: use a stable dev domain alias in Vercel, or extend backend CORS with a regex.
- Smoke test after deploy: home loads, `/admin/products` deep link works after refresh, sign-in succeeds (no CORS error), product list loads from the API.
- Rollback: Vercel dashboard > Deployments > Promote a previous deployment.

## Verify routing and MIME types

From the application directory, run the local routing regression tests (Node 18+):

```bash
node --test scripts/vercel-routing.test.js
```

After deploying the changed `vercel.json`, run the read-only HTTP smoke check (Node 18+):

```bash
node scripts/check-deploy.js https://www.printoy3d.com
```

It checks the home page, every local JS/CSS reference in its HTML, the `/admin/products`
deep link, and missing JS/CSS/translation URLs. Missing files must return 404 without
long-lived caching, not status 200 with `text/html`.

If the browser still reports `Refused to execute script` or `Refused to apply style`
with MIME type `text/html`, inspect the response body and status in Network. Do not
force a JavaScript/CSS Content-Type onto an HTML response or disable `nosniff`.
Older deployments may have cached HTML under a bundle URL with
`max-age=31536000, immutable`. A server-side fix cannot remove that existing browser
cache: after deployment, use DevTools > Network > Disable cache and reload, or
clear the site's cached files. An incognito window can confirm whether the failure
is limited to the original browser cache. If the smoke check still fails on the
new deployment, confirm the configured Root Directory and that the domain points
to that deployment.
