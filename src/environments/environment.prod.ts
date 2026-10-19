// Safe defaults. `scripts/set-env.js` (npm run build:vercel) rewrites this file from
// APP_ENV / API_URL / USE_MOCK_API before the production build.
export const environment = {
    production: true,
    name: 'prod',

    /**
     * Absolute origin of the backend (no trailing slash). Empty keeps relative URLs.
     */
    apiOrigin: '',

    useMockApi: false,

    /**
     * Base URL every Clara Rosa service builds its endpoints from, injected as
     * `API_BASE_URL`.
     */
    apiBaseUrl: 'api/clara-rosa'
};
