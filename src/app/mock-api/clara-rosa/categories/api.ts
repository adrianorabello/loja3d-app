import { Injectable } from '@angular/core';
import { cloneDeep } from 'lodash-es';
import { FuseMockApiService } from '@fuse/lib/mock-api';
import { categories as categoriesData } from 'app/mock-api/clara-rosa/categories/data';

/**
 * DEVELOPMENT-ONLY category handlers.
 *
 * Registered at `api/clara-rosa/categories` — a SIBLING of `products`, not
 * `products/categories`. That is forced by the matcher: `FuseMockApiService.findHandler`
 * compares path segments one by one and treats any `:param` segment as a wildcard, so a
 * literal four-segment `api/clara-rosa/products/categories` would be shadowed by
 * `api/clara-rosa/products/:slug` whenever the latter is registered first.
 */
@Injectable({
    providedIn: 'root'
})
export class CategoriesMockApi
{
    /**
     * Constructor
     */
    constructor(private _fuseMockApiService: FuseMockApiService)
    {
        // Register Mock API handlers
        this.registerHandlers();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Register Mock API handlers
     */
    registerHandlers(): void
    {
        // -----------------------------------------------------------------------------------------------------
        // @ Categories - GET
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onGet('api/clara-rosa/categories', 200)
            .reply(() => [200, cloneDeep(categoriesData)]);
    }
}
