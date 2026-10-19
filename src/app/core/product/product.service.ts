import { Inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { API_BASE_URL } from 'app/core/api/api.config';
import { Product } from 'app/shared/models/product.model';
import { ProductFilter } from 'app/core/product/product.utils';

/**
 * Read access to the catalogue.
 *
 * State is a plain `BehaviorSubject` cache, matching `CartService` and Fuse's own services —
 * this codebase has no state-management library and does not need one for a six-product
 * catalogue.
 *
 * All the filtering and sorting logic lives in `product.utils.ts` as pure functions. This
 * class only does I/O and caching.
 */
@Injectable({
    providedIn: 'root'
})
export class ProductService
{
    private _products: BehaviorSubject<Product[]> = new BehaviorSubject<Product[]>([]);

    /**
     * Constructor
     */
    constructor(
        private _httpClient: HttpClient,
        @Inject(API_BASE_URL) private _baseUrl: string
    )
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for the cached catalogue
     */
    get products$(): Observable<Product[]>
    {
        return this._products.asObservable();
    }

    /**
     * Synchronous read of the cache. Empty until something has fetched.
     */
    get products(): Product[]
    {
        return this._products.value;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Fetch the catalogue and publish it to the cache.
     *
     * Any filter is sent as `HttpParams`, never concatenated into the URL. That is not a
     * style preference: the mock-API interceptor matches on `request.url` and compares path
     * segments, so a hand-built `.../products?q=dragao` turns the last segment into
     * `products?q=dragao`, matches no handler, and falls through to the network as a silent
     * 404. See `FuseMockApiService.findHandler`.
     *
     * @param filter
     */
    getProducts(filter?: ProductFilter): Observable<Product[]>
    {
        let params = new HttpParams();

        if ( filter?.query )
        {
            params = params.set('q', filter.query);
        }

        if ( filter?.categoryId )
        {
            params = params.set('category', filter.categoryId);
        }

        if ( filter?.sort )
        {
            params = params.set('sort', filter.sort);
        }

        return this._httpClient.get<Product[]>(`${this._baseUrl}/products`, {params}).pipe(
            tap(products => this._products.next(products))
        );
    }

    /**
     * Fetch once, then serve the cache.
     *
     * Exists so a component can depend on the catalogue being loaded without knowing whether
     * some other component already loaded it. The cart panel needs exactly this: it joins
     * cart lines against products to render thumbnails, and it must work on a page that
     * never fetched the catalogue itself.
     */
    ensureLoaded(): Observable<Product[]>
    {
        return this.products.length > 0
            ? of(this.products)
            : this.getProducts();
    }

    /**
     * Fetch a single product by its URL slug.
     *
     * Served from the cache when possible so navigating from a card to its detail page costs
     * no request. An unknown slug propagates the error rather than resolving to `undefined`,
     * so the detail page can route to the not-found view instead of rendering a blank shell.
     *
     * @param slug
     */
    getProductBySlug(slug: string): Observable<Product>
    {
        const cached = this.products.find(product => product.slug === slug);

        if ( cached )
        {
            return of(cached);
        }

        return this._httpClient.get<Product>(`${this._baseUrl}/products/${slug}`);
    }

    /**
     * Products flagged as featured, derived from the cache rather than from an endpoint.
     *
     * Note the endpoint that deliberately does NOT exist: `products/featured` would be a
     * four-segment path and would collide with `products/:slug`, which the mock API resolves
     * in registration order. Deriving it here avoids that class of bug entirely.
     */
    getFeatured(): Observable<Product[]>
    {
        return this.ensureLoaded().pipe(
            map(products => products.filter(product => product.active && product.featured))
        );
    }

    /**
     * Reload the catalogue, bypassing the cache.
     */
    refresh(): Observable<Product[]>
    {
        return this.getProducts();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Admin methods
    //
    // Writes invalidate the storefront cache so the next `ensureLoaded()` refetches. Without
    // that, an edited or deleted product would keep showing in the shop until a full reload.
    // -----------------------------------------------------------------------------------------------------

    /**
     * Every product, including inactive ones. Deliberately not cached: admin always wants
     * the current truth, and caching it would have to be kept apart from the public cache.
     */
    getAllProducts(): Observable<Product[]>
    {
        return this._httpClient.get<Product[]>(`${this._baseUrl}/admin/products`);
    }

    /**
     * A single product by id, regardless of its `active` flag.
     *
     * @param id
     */
    getProductById(id: string): Observable<Product>
    {
        return this._httpClient.get<Product>(`${this._baseUrl}/product/${id}`);
    }

    /**
     * Create a product. `id` and `createdAt` are assigned by the server.
     *
     * @param product
     */
    createProduct(product: Omit<Product, 'id' | 'createdAt'>): Observable<Product>
    {
        return this._httpClient.post<Product>(`${this._baseUrl}/product`, {product}).pipe(
            tap(() => this.invalidateCache())
        );
    }

    /**
     * Update a product.
     *
     * @param id
     * @param product
     */
    updateProduct(id: string, product: Partial<Product>): Observable<Product>
    {
        return this._httpClient.patch<Product>(`${this._baseUrl}/product`, {id, product}).pipe(
            tap(() => this.invalidateCache())
        );
    }

    /**
     * Delete a product.
     *
     * @param id
     */
    deleteProduct(id: string): Observable<boolean>
    {
        // The id goes through `HttpParams` for the same reason as the filters above.
        const params = new HttpParams().set('id', id);

        return this._httpClient.delete<boolean>(`${this._baseUrl}/product`, {params}).pipe(
            tap(() => this.invalidateCache())
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Empty the public cache so `ensureLoaded()` fetches again.
     */
    private invalidateCache(): void
    {
        this._products.next([]);
    }
}
