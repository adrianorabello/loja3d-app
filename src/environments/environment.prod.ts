export const environment = {
    production: true,

    /**
     * Kept true until a real backend exists, so production builds of this MVP remain
     * demonstrable. Flip to false — and point `apiBaseUrl` at the real service — as
     * the first step of backend integration.
     */
    useMockApi: true,

    /**
     * Base URL every Clara Rosa service builds its endpoints from, injected as
     * `API_BASE_URL`.
     */
    apiBaseUrl: 'api/clara-rosa'
};
