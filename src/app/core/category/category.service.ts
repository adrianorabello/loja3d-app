import { Inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { API_BASE_URL } from 'app/core/api/api.config';
import { Category } from 'app/shared/models/category.model';

/**
 * Read access to the product categories.
 *
 * Note the endpoint is `<base>/categories`, a sibling of `products` rather than
 * `products/categories`. That is forced by the mock API: it matches on exact segment count
 * with `:param` wildcards and resolves in registration order, so a literal four-segment
 * `products/categories` would be shadowed by `products/:slug`.
 */
@Injectable({
    providedIn: 'root'
})
export class CategoryService
{
    private _categories: BehaviorSubject<Category[]> = new BehaviorSubject<Category[]>([]);

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
     * Getter for the cached categories
     */
    get categories$(): Observable<Category[]>
    {
        return this._categories.asObservable();
    }

    /**
     * Synchronous read of the cache. Empty until something has fetched.
     */
    get categories(): Category[]
    {
        return this._categories.value;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Fetch the categories and publish them to the cache.
     */
    getCategories(): Observable<Category[]>
    {
        return this._httpClient.get<Category[]>(`${this._baseUrl}/categories`).pipe(
            tap(categories => this._categories.next(categories))
        );
    }

    /**
     * Fetch once, then serve the cache.
     */
    ensureLoaded(): Observable<Category[]>
    {
        return this.categories.length > 0
            ? of(this.categories)
            : this.getCategories();
    }
}
