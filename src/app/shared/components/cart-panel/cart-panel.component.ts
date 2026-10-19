import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewEncapsulation } from '@angular/core';
import { Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { CartService } from 'app/core/cart/cart.service';
import { ProductService } from 'app/core/product/product.service';
import { CartLine, CartSummary, MAX_LINE_QUANTITY } from 'app/shared/models/cart.model';
import { PRODUCT_IMAGE_PLACEHOLDER } from 'app/shared/models/product.model';

/**
 * A cart line decorated for display with data that is NOT persisted.
 */
export interface CartPanelLine extends CartLine
{
    image: string;
    maxStock: number | undefined;
}

/**
 * Everything the panel renders, in one object so the template subscribes once.
 */
export interface CartPanelViewModel extends CartSummary
{
    lines: CartPanelLine[];
}

/**
 * The shopping bag panel.
 *
 * Reads and writes `CartService` and owns no cart state of its own — add, remove, quantity
 * clamping, subtotal arithmetic and localStorage persistence are all already implemented
 * there and spec-covered.
 *
 * Thumbnails are joined in from `ProductService` rather than read off the cart line.
 * `CartItem` deliberately has no image field: admin images are base64 data URLs and the cart
 * is persisted to localStorage, so storing them would risk the quota on every write. The
 * join has to survive three awkward states, all handled below — products not fetched yet,
 * the panel mounted on a page that never fetches them, and a product deleted after it was
 * added to the cart.
 */
@Component({
    selector       : 'cart-panel',
    templateUrl    : './cart-panel.component.html',
    encapsulation  : ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartPanelComponent implements OnInit, OnDestroy
{
    /** Shown as a dialog on small screens, where the panel is an overlay. */
    @Input() isOverlay: boolean = false;

    @Output() readonly closeRequested: EventEmitter<void> = new EventEmitter<void>();
    @Output() readonly checkout: EventEmitter<void> = new EventEmitter<void>();

    vm$: Observable<CartPanelViewModel>;

    /** Transient validation feedback. The house pattern is an inline flash, not a snackbar. */
    message: string;
    messageParams: any;

    private _messageTimer: any;

    /**
     * Constructor
     */
    constructor(
        private _cartService: CartService,
        private _productService: ProductService,
        private _changeDetectorRef: ChangeDetectorRef
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
        // Make the panel self-sufficient: it must render thumbnails even when mounted on a
        // page that never loaded the catalogue. `ensureLoaded` is a no-op when the cache is
        // already warm, so the common case costs nothing.
        this._productService.ensureLoaded().subscribe();

        this.vm$ = combineLatest([
            this._cartService.summary$,
            this._productService.products$
        ]).pipe(
            map(([summary, products]) => ({
                ...summary,
                lines: summary.lines.map((line) => {
                    const product = products.find(candidate => candidate.id === line.productId);

                    return {
                        ...line,
                        // Falls back to the placeholder while the catalogue is still loading
                        // and permanently for a product that no longer exists.
                        image   : product?.images?.[0] || PRODUCT_IMAGE_PLACEHOLDER,
                        // Undefined means "no known ceiling": made-to-order, or a product we
                        // cannot see. CartService then applies MAX_LINE_QUANTITY instead.
                        maxStock: !product || product.madeToOrder ? undefined : product.stock
                    };
                })
            }))
        );
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void
    {
        clearTimeout(this._messageTimer);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Step a line's quantity.
     *
     * `updateQuantity` returns the quantity actually applied, or null when the request was
     * rejected. Both outcomes get their own message: a null means the input was nonsense,
     * while a number lower than requested means it was honoured but clamped to stock. A
     * single "didn't work" message would be wrong for the clamped case.
     *
     * @param line
     * @param delta
     */
    changeQuantity(line: CartPanelLine, delta: number): void
    {
        const requested = line.quantity + delta;

        if ( requested < 1 )
        {
            // Zero is not a removal — removing is an explicit action, so a fat-fingered
            // decrement at 1 must not silently drop the line.
            this._flash('cart.minQuantity');

            return;
        }

        if ( requested > MAX_LINE_QUANTITY )
        {
            this._flash('cart.maxQuantity', {max: MAX_LINE_QUANTITY});

            return;
        }

        const applied = this._cartService.updateQuantity(line.productId, requested, line.colorId, line.maxStock);

        if ( applied === null )
        {
            this._flash('cart.invalidQuantity');

            return;
        }

        if ( applied < requested )
        {
            this._flash('cart.maxQuantity', {max: applied});
        }
    }

    /**
     * Remove a line.
     *
     * @param line
     */
    remove(line: CartPanelLine): void
    {
        this._cartService.remove(line.productId, line.colorId);
    }

    /**
     * Empty the cart.
     */
    clear(): void
    {
        this._cartService.clear();
    }

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param line
     */
    trackByFn(index: number, line: CartPanelLine): any
    {
        return `${line.productId}:${line.colorId ?? ''}`;
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

        this._changeDetectorRef.markForCheck();

        clearTimeout(this._messageTimer);
        this._messageTimer = setTimeout(() => {
            this.message = null;
            this.messageParams = null;

            // Required under OnPush: this fires outside any event binding, so without it
            // the expired message would stay on screen until something else marked the
            // view dirty.
            this._changeDetectorRef.markForCheck();
        }, 4000);
    }
}
