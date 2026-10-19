import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, takeUntil } from 'rxjs/operators';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { CartService } from 'app/core/cart/cart.service';
import { CategoryService } from 'app/core/category/category.service';
import { ProductService } from 'app/core/product/product.service';
import { I18nService } from 'app/core/i18n/i18n.service';
import { filterProducts, resolveSortOption, toCartItem } from 'app/core/product/product.utils';
import { Category } from 'app/shared/models/category.model';
import { PRODUCT_SORT_OPTIONS, Product, ProductSortOption } from 'app/shared/models/product.model';

/**
 * The dark product catalogue.
 *
 * Three design decisions worth knowing before editing this:
 *
 * 1. **Filter state lives in the URL** (`?q=`, `?category=`, `?sort=`), not in this class.
 *    That makes a result set shareable and deep-linkable, and it is also what lets the
 *    storefront header's search box drive this page — it already navigates to
 *    `/products?q=...`. Query params are read as a STREAM, never from `.snapshot`: a
 *    param-only change does not re-create the component, so a header search performed while
 *    already on this page must update the grid reactively.
 *
 * 2. **Filtering and sorting are pure functions** in `product.utils.ts`. This class only
 *    wires controls and query params to them, which is what makes the behaviour specifiable
 *    without rendering anything.
 *
 * 3. **The dark treatment is scoped, not global.** The template's root carries a `dark`
 *    class; `appConfig.scheme` stays `light`, so the header, the footer, the auth pages and
 *    the admin area are untouched. See the template for why a bare `.dark` is enough.
 */
@Component({
    selector     : 'storefront-catalog',
    templateUrl  : './catalog.component.html',
    encapsulation: ViewEncapsulation.None
})
export class CatalogComponent implements OnInit, OnDestroy
{
    products$: Observable<Product[]>;
    categories$: Observable<Category[]>;

    searchControl: FormControl = new FormControl('');
    sortOptions: ProductSortOption[] = PRODUCT_SORT_OPTIONS;

    activeCategoryId: string = '';
    activeSort: ProductSortOption = resolveSortOption(null);

    isScreenSmall: boolean;
    cartPanelOpen: boolean = false;

    /**
     * Held as a plain number rather than bound through `| async`.
     *
     * The badge needs both the count AND a hidden flag derived from it, and binding the
     * pipe twice would mean two subscriptions to the same stream; negating one of them also
     * trips the `template-no-negated-async` lint rule. One subscription here is simpler and
     * cheaper than both alternatives.
     */
    cartCount: number = 0;

    /** Transient add-to-cart feedback. Inline flash is the house pattern, not a snackbar. */
    message: string;
    messageParams: any;

    private _messageTimer: any;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _activatedRoute: ActivatedRoute,
        private _router: Router,
        private _productService: ProductService,
        private _categoryService: CategoryService,
        private _cartService: CartService,
        private _i18nService: I18nService,
        private _fuseMediaWatcherService: FuseMediaWatcherService
    )
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void
    {
        // Warm the caches. Both are no-ops once loaded.
        this._productService.ensureLoaded().subscribe();
        this._categoryService.ensureLoaded().subscribe();

        this.categories$ = this._categoryService.categories$;

        this._cartService.count$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((count) => {
                this.cartCount = count;
            });

        // The grid: catalogue x URL filters x active language. The language is a real
        // dependency, not incidental — name sorting runs on the resolved localized name, so
        // switching language can legitimately reorder the results.
        this.products$ = combineLatest([
            this._productService.products$,
            this._activatedRoute.queryParamMap,
            this._i18nService.language$
        ]).pipe(
            map(([products, params, language]) => {

                const query      = params.get('q') ?? '';
                const categoryId = params.get('category') ?? '';
                const sort       = resolveSortOption(params.get('sort'));

                // Mirror the URL back into the controls so a deep link arrives with the
                // filter bar already showing the right state.
                if ( this.searchControl.value !== query )
                {
                    this.searchControl.setValue(query, {emitEvent: false});
                }

                this.activeCategoryId = categoryId;
                this.activeSort = sort;

                return filterProducts(products, {query, categoryId, sort}, language);
            })
        );

        // Debounced search, written to the URL rather than held locally.
        this.searchControl.valueChanges
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe((value) => {
                this._patchQueryParams({q: (value ?? '').trim() || null});
            });

        // The panel flips side <-> over at Fuse's `md` (960px), NOT at the 768px the
        // responsive sign-in uses. Deliberate: the flip has to coincide with the grid's own
        // reflow, otherwise there is a band where a 320px panel squeezes a 3-column grid.
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({matchingAliases}) => {

                const wasSmall = this.isScreenSmall;
                this.isScreenSmall = !matchingAliases.includes('md');

                // Close the panel when it becomes an overlay. An open side panel silently
                // turning into a full-screen overlay on resize is a bad surprise. Mirrors
                // the storefront layout's handling of its mobile menu.
                if ( this.isScreenSmall && !wasSmall )
                {
                    this.cartPanelOpen = false;
                }
            });
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void
    {
        clearTimeout(this._messageTimer);
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Filter by category.
     *
     * @param categoryId
     */
    setCategory(categoryId: string): void
    {
        this._patchQueryParams({category: categoryId || null});
    }

    /**
     * Change the ordering.
     *
     * @param sort
     */
    setSort(sort: ProductSortOption): void
    {
        this._patchQueryParams({sort});
    }

    /**
     * Clear every filter.
     */
    clearFilters(): void
    {
        this.searchControl.setValue('', {emitEvent: false});
        this._patchQueryParams({q: null, category: null, sort: null});
    }

    /**
     * Add a product to the cart.
     *
     * Quantity is always 1 from a card — choosing a quantity or a colour is what the detail
     * page is for. `maxStock` is omitted for made-to-order pieces so the service applies its
     * own ceiling instead of clamping to a stock count that does not apply.
     *
     * @param product
     */
    addToCart(product: Product): void
    {
        const maxStock = product.madeToOrder ? undefined : product.stock;
        const applied = this._cartService.add(toCartItem(product, 1), maxStock);

        if ( applied === null )
        {
            this._flash('cart.invalidQuantity');

            return;
        }

        this._flash('product.addedToCart');

        // On desktop the panel is always visible, so opening it would be a no-op; on small
        // screens popping an overlay on every add would fight the shopper.
        if ( !this.isScreenSmall )
        {
            this.cartPanelOpen = true;
        }
    }

    /**
     * Proceed to checkout.
     *
     * NOTE: `/checkout` is delivered in the checkout phase. Until then this navigation
     * resolves through the catch-all route, exactly like the storefront header's existing
     * cart icon.
     */
    goToCheckout(): void
    {
        this._router.navigate(['/checkout']);
    }

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param product
     */
    trackByFn(index: number, product: Product): any
    {
        return product.id || index;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Merge a partial filter into the URL.
     *
     * `replaceUrl` keeps filter fiddling out of the back-button history — a shopper pressing
     * Back expects to leave the catalogue, not to walk back through six sort changes.
     *
     * @param params
     */
    private _patchQueryParams(params: any): void
    {
        this._router.navigate([], {
            relativeTo         : this._activatedRoute,
            queryParams        : params,
            queryParamsHandling: 'merge',
            replaceUrl         : true
        });
    }

    /**
     * Show a transient message.
     *
     * @param key
     * @param params
     */
    private _flash(key: string, params: any = null): void
    {
        this.message = key;
        this.messageParams = params;

        clearTimeout(this._messageTimer);
        this._messageTimer = setTimeout(() => {
            this.message = null;
            this.messageParams = null;
        }, 3000);
    }
}
