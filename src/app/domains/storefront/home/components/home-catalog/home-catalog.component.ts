import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Product } from 'app/shared/models/product.model';

@Component({
    selector       : 'home-catalog',
    templateUrl    : './home-catalog.component.html',
    styleUrls      : ['./home-catalog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeCatalogComponent
{
    @Input() products: Product[] = [];

    @Output() readonly addToCart: EventEmitter<Product> = new EventEmitter<Product>();

    trackById(index: number, product: Product): string
    {
        return product.id || String(index);
    }
}
