import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Product } from 'app/shared/models/product.model';

@Component({
    selector       : 'home-hero',
    templateUrl    : './home-hero.component.html',
    styleUrls      : ['./home-hero.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeHeroComponent
{
    @Input() products: Product[] = [];

    @Output() readonly explore: EventEmitter<void> = new EventEmitter<void>();
    @Output() readonly requestQuote: EventEmitter<void> = new EventEmitter<void>();
}
