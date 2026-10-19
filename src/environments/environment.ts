// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
    production: false,

    /**
     * Deployment target: `local`, `dev` or `prod`. Informational only.
     */
    name: 'local',

    /**
     * Absolute origin of the backend (no trailing slash). Empty keeps relative URLs, which
     * `proxy.conf.json` forwards to the local FastAPI. Set per environment by
     * `scripts/set-env.js` on deploy.
     */
    apiOrigin: '',

    /**
     * Set to false to talk to the real FastAPI backend on port 8000 (proxied via proxy.conf.json).
     * Set to true to fallback to in-memory mock handlers.
     */
    useMockApi: true,

    /**
     * Base URL every Clara Rosa service builds its endpoints from, injected as
     * `API_BASE_URL`. Matches the path the mock handlers register against.
     */
    apiBaseUrl: 'api/clara-rosa',
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
