import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { CartService } from 'app/core/cart/cart.service';
import { ProductService } from 'app/core/product/product.service';
import { toCartItem } from 'app/core/product/product.utils';
import { Product, PRODUCT_IMAGE_PLACEHOLDER } from 'app/shared/models/product.model';

/**
 * Kids-friendly storefront page.
 *
 * A playful, colorful alternative storefront at `/kids-store` that presents the same
 * catalogue in a child-friendly visual treatment — cream backgrounds, pastel product
 * panels, rounded shapes, and a fun "WEIRDLY CUTE. SERIOUSLY FUN." hero section.
 *
 * Reuses `ProductService` and `CartService` without duplication. All visual styles are
 * scoped to this component's SCSS file and do not leak into other pages.
 */
@Component({
    selector     : 'kids-store',
    templateUrl  : './kids-store.component.html',
    styleUrls    : ['./kids-store.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class KidsStoreComponent implements OnInit, OnDestroy
{
    products$: Observable<Product[]>;
    featuredProducts$: Observable<Product[]>;
    cartCount: number = 0;

    /** Transient add-to-cart feedback message key. */
    message: string;

    /** Pastel background colours for product card image areas, cycled by index. */
    readonly pastelColors: string[] = ['#F5A3C7', '#9CCAF5', '#F8DA62', '#D4F0C8', '#F5D0A9', '#C7C7F5'];

    /** Placeholder used when a product has no images. */
    readonly placeholder: string = PRODUCT_IMAGE_PLACEHOLDER;

    private _messageTimer: any;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _productService: ProductService,
        private _cartService: CartService,
        private _router: Router
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
        // Warm the product cache — no-op if already loaded by another page.
        this._productService.ensureLoaded().subscribe();

        // Active products for the grid.
        this.products$ = this._productService.products$.pipe(
            map(products => products.filter(p => p.active))
        );

        // Featured products for the hero section (max 3).
        this.featuredProducts$ = this._productService.getFeatured().pipe(
            map(products => products.slice(0, 3))
        );

        // Cart badge count.
        this._cartService.count$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((count) => {
                this.cartCount = count;
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
     * Add a product to the cart (1 unit).
     *
     * Made-to-order pieces pass no maxStock so the service applies its own ceiling
     * rather than clamping to a stock count that does not apply.
     *
     * @param product
     */
    addToCart(product: Product): void
    {
        const maxStock = product.madeToOrder ? undefined : product.stock;
        const applied = this._cartService.add(toCartItem(product, 1), maxStock);

        if ( applied === null )
        {
            return;
        }

        this._flash('kidsStore.addedToCart');
    }

    /**
     * Add the product to the cart and navigate to checkout.
     *
     * @param product
     */
    buyNow(product: Product): void
    {
        const maxStock = product.madeToOrder ? undefined : product.stock;
        this._cartService.add(toCartItem(product, 1), maxStock);
        this._router.navigate(['/checkout']);
    }

    /**
     * Smooth-scroll to the products section.
     */
    scrollToProducts(): void
    {
        const el = document.getElementById('kids-products');

        if ( el )
        {
            el.scrollIntoView({behavior: 'smooth', block: 'start'});
        }
    }

    /**
     * Get the first image of a product, or the placeholder.
     *
     * @param product
     */
    productImage(product: Product): string
    {
        return product?.images?.[0] || this.placeholder;
    }

    /**
     * Pastel background colour for a product card, cycled by index.
     *
     * @param index
     */
    pastelColor(index: number): string
    {
        return this.pastelColors[index % this.pastelColors.length];
    }

    /**
     * Handle broken product images by swapping in the placeholder.
     *
     * @param event
     */
    onImageError(event: Event): void
    {
        const img = event.target as HTMLImageElement;

        if ( img.src !== this.placeholder )
        {
            img.src = this.placeholder;
        }
    }

    /**
     * Track by function for ngFor loops.
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
     * Show a transient message, then clear it after 3 seconds.
     *
     * @param key
     */
    private _flash(key: string): void
    {
        this.message = key;

        clearTimeout(this._messageTimer);
        this._messageTimer = setTimeout(() => {
            this.message = null;
        }, 3000);
    }
}
