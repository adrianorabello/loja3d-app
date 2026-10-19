import { ChangeDetectionStrategy, Component, Input, ViewEncapsulation } from '@angular/core';
import { Product, StockState } from 'app/shared/models/product.model';
import { stockStateOf } from 'app/core/product/product.utils';

/**
 * Availability pill.
 *
 * Takes the whole product rather than a pre-computed state so every caller gets the same
 * `madeToOrder`-outranks-zero-stock rule from `stockStateOf()` instead of reimplementing it.
 *
 * Colours are chosen for the dark catalogue surface: the 400-weight shades clear WCAG AA on
 * `bg-card` (blueGray-800), whereas the 500/600 weights do not.
 */
@Component({
    selector       : 'stock-badge',
    templateUrl    : './stock-badge.component.html',
    encapsulation  : ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StockBadgeComponent
{
    @Input() product: Product;

    private readonly _labels: Record<StockState, string> = {
        'in-stock'     : 'stock.inStock',
        'low-stock'    : 'stock.lowStock',
        'out-of-stock' : 'stock.outOfStock',
        'made-to-order': 'stock.madeToOrder'
    };

    private readonly _classes: Record<StockState, string> = {
        'in-stock'     : 'text-green-400',
        'low-stock'    : 'text-amber-400',
        'out-of-stock' : 'text-red-400',
        'made-to-order': 'text-teal-400'
    };

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    get state(): StockState
    {
        return this.product ? stockStateOf(this.product) : 'out-of-stock';
    }

    get label(): string
    {
        return this._labels[this.state];
    }

    get colorClass(): string
    {
        return this._classes[this.state];
    }
}
