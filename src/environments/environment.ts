// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
    production: false,

    /**
     * When true, `FuseMockApiModule` is registered and every Clara Rosa request is
     * answered in-memory by the handlers in `app/mock-api/clara-rosa/`.
     *
     * Set to false to talk to a real backend at `apiBaseUrl`.
     */
    useMockApi: true,

    /**
     * Base URL every Clara Rosa service builds its endpoints from, injected as
     * `API_BASE_URL`. Matches the path the mock handlers register against.
     */
    apiBaseUrl: 'api/clara-rosa'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
