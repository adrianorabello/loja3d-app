import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';
import { PRODUCT_IMAGE_PLACEHOLDER, Product } from 'app/shared/models/product.model';
import { isPurchasable } from 'app/core/product/product.utils';

/**
 * A catalogue card.
 *
 * Deliberately dumb: it renders a product and emits an intent. The `CartService` call stays
 * in the catalogue page, so the card can be reused on the home page's featured strip and in
 * search results without dragging cart behaviour along with it.
 *
 * `OnPush` because a grid renders a dozen or more of these and nothing here depends on
 * mutable state — the only inputs are a product reference and the language, and the language
 * is handled by `LocalizedTextPipe` marking the view dirty.
 */
@Component({
    selector       : 'product-card',
    templateUrl    : './product-card.component.html',
    encapsulation  : ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardComponent
{
    @Input() product: Product;
    @Input() presentation: 'catalog' | 'home' = 'catalog';

    @Output() readonly addToCart: EventEmitter<Product> = new EventEmitter<Product>();

    readonly placeholder: string = PRODUCT_IMAGE_PLACEHOLDER;

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * First image, or the placeholder when a product has no artwork yet.
     */
    get image(): string
    {
        return this.product?.images?.[0] || this.placeholder;
    }

    /**
     * Whether the add button is live. Out-of-stock disables it; made-to-order does not.
     */
    get canAdd(): boolean
    {
        return !!this.product && isPurchasable(this.product);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Swap in the placeholder when an image fails to load.
     *
     * Matters for admin-uploaded images, which can be broken data URLs — a product must
     * still be buyable when its picture is not.
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
}
