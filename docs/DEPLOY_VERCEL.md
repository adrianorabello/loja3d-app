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
- `vercel.json` rewrites non-file paths to `index.html` (SPA deep links); hashed bundles are immutable-cached.
- CSP is **report-only**; review browser console reports, then switch to `Content-Security-Policy`.
- Preview URLs change per deploy: use a stable dev domain alias in Vercel, or extend backend CORS with a regex.
- Smoke test after deploy: home loads, `/admin/products` deep link works after refresh, sign-in succeeds (no CORS error), product list loads from the API.
- Rollback: Vercel dashboard > Deployments > Promote a previous deployment.
