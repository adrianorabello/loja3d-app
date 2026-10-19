import { InjectionToken } from '@angular/core';

/**
 * Base URL for every Clara Rosa API call.
 *
 * In development this resolves to the path prefix that the Fuse mock API handlers
 * register against (see `app/mock-api/clara-rosa/`). In production it points at the
 * real REST backend. Swapping backends is therefore a single environment change —
 * no service needs editing.
 *
 * Provided in `CoreModule` from `environment.apiBaseUrl`.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

/**
 * Absolute backend origin (no trailing slash); empty means "same origin / dev proxy".
 *
 * Provided in `CoreModule` from `environment.apiOrigin`.
 */
export const API_ORIGIN = new InjectionToken<string>('API_ORIGIN');
