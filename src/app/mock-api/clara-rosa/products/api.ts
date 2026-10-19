import { Injectable } from '@angular/core';
import { cloneDeep } from 'lodash-es';
import { FuseMockApiService } from '@fuse/lib/mock-api';
import { DEFAULT_LANGUAGE } from 'app/core/i18n/i18n.types';
import { filterProducts, resolveSortOption } from 'app/core/product/product.utils';
import { products as productsData } from 'app/mock-api/clara-rosa/products/data';
import { Product } from 'app/shared/models/product.model';

/**
 * DEVELOPMENT-ONLY catalogue handlers.
 *
 * Three things here are deliberate and easy to get wrong:
 *
 *   1. **Only `active` products are served.** The storefront must never show a
 *      discontinued item. Admin screens will need the unfiltered list and will get their
 *      own endpoint rather than a flag on this one.
 *   2. **Query parameters are read from `request.params`, not parsed out of the URL.** The
 *      interceptor matches on the URL path, which excludes the query string, so callers must
 *      pass filters via `HttpParams` — see the note in `ProductService.getProducts`.
 *   3. **Handlers return `cloneDeep`.** Without it a consumer mutating a product would
 *      corrupt this module's own store for the rest of the session.
 *
 * Filtering reuses the same pure helpers the catalogue uses client-side, so the two cannot
 * drift apart. The language passed to the sort is the app default; the real backend will
 * sort in the database and the client re-sorts for the active language anyway.
 */
@Injectable({
    providedIn: 'root'
})
export class ProductsMockApi
{
    /**
     * Per-instance copy of the seed data. Admin writes mutate this store rather than the
     * module-level array, so separate TestBed instances never pollute each other.
     */
    private _store: Product[] = cloneDeep(productsData);

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
        // @ Products - GET
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onGet('api/clara-rosa/products', 200)
            .reply(({request}) => {

                const query      = request.params.get('q') ?? '';
                const categoryId = request.params.get('category');
                const sort       = resolveSortOption(request.params.get('sort'));

                const results = filterProducts(
                    cloneDeep(this._store),
                    {query, categoryId, sort},
                    DEFAULT_LANGUAGE
                );

                return [200, results];
            });

        // -----------------------------------------------------------------------------------------------------
        // @ Admin products (including inactive) - GET
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onGet('api/clara-rosa/admin/products', 200)
            .reply(() => [200, cloneDeep(this._store)]);

        // -----------------------------------------------------------------------------------------------------
        // @ Product by id (admin, any status) - GET
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onGet('api/clara-rosa/product/:id', 200)
            .reply(({urlParams}) => {
                const product = this._store.find(item => item.id === urlParams.id);

                return product
                    ? [200, cloneDeep(product)]
                    : [404, {error: 'Product not found'}];
            });

        // -----------------------------------------------------------------------------------------------------
        // @ Product - POST. The server assigns `id` and `createdAt`; a duplicate slug is a 409.
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onPost('api/clara-rosa/product', 200)
            .reply(({request}) => {
                const input: Product = request.body.product;

                if ( this._store.some(item => item.slug === input.slug) )
                {
                    return [409, {error: 'Slug already in use'}];
                }

                const created: Product = {
                    ...cloneDeep(input),
                    id       : `prd-${Math.random().toString(36).slice(2, 8)}`,
                    createdAt: new Date().toISOString()
                };

                this._store.unshift(created);

                return [200, cloneDeep(created)];
            });

        // -----------------------------------------------------------------------------------------------------
        // @ Product - PATCH
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onPatch('api/clara-rosa/product', 200)
            .reply(({request}) => {
                const id: string = request.body.id;
                const patch: Partial<Product> = request.body.product;
                const index = this._store.findIndex(item => item.id === id);

                if ( index < 0 )
                {
                    return [404, {error: 'Product not found'}];
                }

                if ( patch.slug && this._store.some(item => item.slug === patch.slug && item.id !== id) )
                {
                    return [409, {error: 'Slug already in use'}];
                }

                // `id` and `createdAt` are server-owned and cannot be overwritten by a client.
                this._store[index] = {
                    ...this._store[index],
                    ...cloneDeep(patch),
                    id       : this._store[index].id,
                    createdAt: this._store[index].createdAt
                };

                return [200, cloneDeep(this._store[index])];
            });

        // -----------------------------------------------------------------------------------------------------
        // @ Product - DELETE
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onDelete('api/clara-rosa/product', 200)
            .reply(({request}) => {
                const id = request.params.get('id');
                const index = this._store.findIndex(item => item.id === id);

                if ( index < 0 )
                {
                    return [404, {error: 'Product not found'}];
                }

                this._store.splice(index, 1);

                return [200, true];
            });

        // -----------------------------------------------------------------------------------------------------
        // @ Product by slug - GET
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onGet('api/clara-rosa/products/:slug', 200)
            .reply(({urlParams}) => {

                const product = this._store.find(item => item.slug === urlParams.slug && item.active);

                // 404 rather than `[200, null]`: the detail page routes to the not-found view
                // on an error, and a null body would render a blank shell instead.
                return product
                    ? [200, cloneDeep(product)]
                    : [404, {error: 'Product not found'}];
            });
    }
}
