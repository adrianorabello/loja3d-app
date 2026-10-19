import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { CartService } from 'app/core/cart/cart.service';
import { ProductService } from 'app/core/product/product.service';
import { isPurchasable, stockStateOf, toCartItem } from 'app/core/product/product.utils';
import { MAX_LINE_QUANTITY } from 'app/shared/models/cart.model';
import { PRODUCT_IMAGE_PLACEHOLDER, Product } from 'app/shared/models/product.model';

/**
 * Product detail page, reached from a card's "view details" link at `/products/:slug`.
 *
 * Unlike the catalogue cards — which always add a single unit — this page is where a colour
 * and a quantity are chosen, so it is the only place that needs the clamping behaviour of
 * `CartService.add`'s return value.
 *
 * An unknown or inactive slug sets `notFound` rather than throwing or leaving a blank shell:
 * the mock API answers 404 for both, and a discontinued product must not be reachable by
 * typing its URL.
 */
@Component({
    selector     : 'storefront-product-details',
    templateUrl  : './product-details.component.html',
    encapsulation: ViewEncapsulation.None
})
export class ProductDetailsComponent implements OnInit, OnDestroy
{
    product: Product;
    notFound: boolean = false;
    loading: boolean = true;

    activeImageIndex: number = 0;
    selectedColorId: string;
    quantity: number = 1;

    message: string;
    messageParams: any;

    readonly placeholder: string = PRODUCT_IMAGE_PLACEHOLDER;
    readonly maxQuantity: number = MAX_LINE_QUANTITY;

    private _messageTimer: any;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _activatedRoute: ActivatedRoute,
        private _productService: ProductService,
        private _cartService: CartService
    )
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    get images(): string[]
    {
        return this.product?.images?.length ? this.product.images : [this.placeholder];
    }

    get activeImage(): string
    {
        return this.images[this.activeImageIndex] ?? this.placeholder;
    }

    get canAdd(): boolean
    {
        return !!this.product && isPurchasable(this.product);
    }

    get isMadeToOrder(): boolean
    {
        return !!this.product && stockStateOf(this.product) === 'made-to-order';
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void
    {
        // Read the slug as a stream: navigating between two product pages reuses this
        // component instance and changes only the param.
        this._activatedRoute.paramMap
            .pipe(
                switchMap(params => this._productService.getProductBySlug(params.get('slug'))),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(
                (product) => {
                    this.product = product;
                    this.notFound = false;
                    this.loading = false;
                    this.activeImageIndex = 0;
                    this.quantity = 1;
                    this.selectedColorId = product.colors?.length ? product.colors[0].id : undefined;
                },
                () => {
                    // Covers both an unknown slug and a deactivated product.
                    this.product = null;
                    this.notFound = true;
                    this.loading = false;
                }
            );
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
     * Show a gallery image.
     *
     * @param index
     */
    showImage(index: number): void
    {
        this.activeImageIndex = index;
    }

    /**
     * Pick a colour.
     *
     * @param colorId
     */
    selectColor(colorId: string): void
    {
        this.selectedColorId = colorId;
    }

    /**
     * Step the quantity, bounded by the hard line ceiling.
     *
     * @param delta
     */
    changeQuantity(delta: number): void
    {
        const next = this.quantity + delta;

        if ( next < 1 || next > this.maxQuantity )
        {
            return;
        }

        this.quantity = next;
    }

    /**
     * Add the chosen quantity and colour to the cart.
     */
    addToCart(): void
    {
        if ( !this.canAdd )
        {
            return;
        }

        // Omitted for made-to-order pieces: there is no meaningful stock ceiling, so the
        // service applies MAX_LINE_QUANTITY instead of clamping to a count that is 0.
        const maxStock = this.product.madeToOrder ? undefined : this.product.stock;

        // Captured BEFORE the add. `add()` returns the resulting LINE quantity, which
        // accounts for merging into an existing line, so detecting a clamp means comparing
        // against what the line *should* have become — reading the cart afterwards would
        // just hand back `applied` again and never report a clamp.
        const existing = this._cartService.quantityOf(this.product.id, this.selectedColorId);
        const expected = existing + this.quantity;

        const applied = this._cartService.add(
            toCartItem(this.product, this.quantity, this.selectedColorId),
            maxStock
        );

        if ( applied === null )
        {
            this._flash('cart.invalidQuantity');

            return;
        }

        if ( applied < expected )
        {
            this._flash('cart.maxQuantity', {max: applied});

            return;
        }

        this._flash('product.addedToCart');
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

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
