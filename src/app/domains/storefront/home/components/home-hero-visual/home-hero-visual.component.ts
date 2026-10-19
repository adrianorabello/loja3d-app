import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Product, PRODUCT_IMAGE_PLACEHOLDER } from 'app/shared/models/product.model';

@Component({
    selector       : 'home-hero-visual',
    templateUrl    : './home-hero-visual.component.html',
    styleUrls      : ['./home-hero-visual.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeHeroVisualComponent
{
    @Input() products: Product[] = [];

    readonly placeholder: string = PRODUCT_IMAGE_PLACEHOLDER;
    readonly tones: string[] = ['mint', 'pink', 'yellow'];

    image(product: Product): string
    {
        return product?.images?.[0] || this.placeholder;
    }

    tone(index: number): string
    {
        return this.tones[index % this.tones.length];
    }

    trackById(index: number, product: Product): string
    {
        return product.id || String(index);
    }

    onImageError(event: Event): void
    {
        const image = event.target as HTMLImageElement;

        if ( image.src !== this.placeholder )
        {
            image.src = this.placeholder;
        }
    }
}
