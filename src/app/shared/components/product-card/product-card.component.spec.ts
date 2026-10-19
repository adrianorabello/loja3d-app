import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChangeDetectorRef } from '@angular/core';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { SharedComponentsModule } from 'app/shared/components/shared-components.module';
import { ProductCardComponent } from 'app/shared/components/product-card/product-card.component';
import { PRODUCT_IMAGE_PLACEHOLDER, Product } from 'app/shared/models/product.model';

/**
 * Coverage for the catalogue card.
 *
 * Focused on the contract rather than the styling: what it emits, when the add button is
 * live, and the keyboard-accessibility shape. Tailwind class strings are deliberately not
 * asserted — that would be a tautology that breaks on every restyle.
 */
describe('ProductCardComponent', () => {

    let fixture: ComponentFixture<ProductCardComponent>;
    let component: ProductCardComponent;

    const make = (overrides: Partial<Product> = {}): Product => ({
        id         : 'prd-1',
        slug       : 'dragao-articulado',
        name       : {'pt-PT': 'Dragão', 'en': 'Dragon'},
        description: {'pt-PT': 'Desc', 'en': 'Desc'},
        categoryId : 'cat-a',
        price      : 24.9,
        currency   : 'EUR',
        colors     : [],
        images     : ['assets/images/clara-rosa/products/dragao-articulado-01.svg'],
        stock      : 5,
        active     : true,
        madeToOrder: false,
        featured   : false,
        createdAt  : '2026-01-01T00:00:00.000Z',
        ...overrides
    });

    /**
     * Reassign the product and re-render.
     *
     * The component is OnPush, so setting the input from outside the template does NOT mark
     * the view dirty — `detectChanges()` on its own would leave the previous product on
     * screen and quietly make these assertions meaningless.
     */
    const setProduct = (product: Product): void => {
        component.product = product;
        fixture.componentRef.injector.get(ChangeDetectorRef).markForCheck();
        fixture.detectChanges();
    };

    const addButton = (): HTMLButtonElement => fixture.nativeElement.querySelector('button');
    const detailLink = (): HTMLAnchorElement =>
        Array.from<HTMLAnchorElement>(fixture.nativeElement.querySelectorAll('a'))
            .find(a => a.getAttribute('aria-hidden') !== 'true');

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                MatIconTestingModule,
                SharedComponentsModule,
                RouterTestingModule,
                TranslateModule.forRoot()
            ]
        });

        fixture = TestBed.createComponent(ProductCardComponent);
        component = fixture.componentInstance;
        component.product = make();
        fixture.detectChanges();
    });

    it('emits the product when the add button is clicked', () => {
        const emitted: Product[] = [];
        component.addToCart.subscribe(product => emitted.push(product));

        addButton().click();

        expect(emitted.length).toBe(1);
        expect(emitted[0].id).toBe('prd-1');
    });

    it('enables the add button for an in-stock product', () => {
        expect(component.canAdd).toBe(true);
        expect(addButton().disabled).toBe(false);
    });

    it('disables the add button when out of stock', () => {
        setProduct(make({stock: 0}));

        expect(component.canAdd).toBe(false);
        expect(addButton().disabled).toBe(true);
    });

    it('keeps the add button live for a made-to-order product at zero stock', () => {
        // The commercially important case: printed after the order, so zero on hand does
        // not mean unbuyable.
        setProduct(make({stock: 0, madeToOrder: true}));

        expect(component.canAdd).toBe(true);
        expect(addButton().disabled).toBe(false);
    });

    it('links to the product detail route', () => {
        expect(detailLink().getAttribute('href')).toBe('/products/dragao-articulado');
    });

    it('uses the placeholder when a product has no images', () => {
        setProduct(make({images: []}));

        expect(component.image).toBe(PRODUCT_IMAGE_PLACEHOLDER);
    });

    it('shows millimetre dimensions in the home presentation when they exist', () => {
        component.presentation = 'home';
        setProduct(make({dimensions: {width: 10, height: 20, depth: 30, unit: 'mm'}}));

        expect(fixture.nativeElement.textContent).toContain('10 × 20 × 30 mm');
    });

    it('does not show a dimensions row for legacy products without measurements', () => {
        component.presentation = 'home';
        setProduct(make());

        expect(fixture.nativeElement.textContent).not.toContain('home.catalog.dimensions');
    });

    it('swaps in the placeholder when an image fails to load', () => {
        const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;

        img.dispatchEvent(new Event('error'));

        expect(img.src).toContain(PRODUCT_IMAGE_PLACEHOLDER);
    });

    it('exposes exactly two keyboard stops and keeps the image wrapper out of the tab order', () => {
        // The card root must not be focusable, and the image link is mouse-only so it does
        // not become a third stop with the same destination and accessible name.
        const focusable = fixture.nativeElement.querySelectorAll('button, a:not([tabindex="-1"])');
        const imageLink = fixture.nativeElement.querySelector('a[aria-hidden="true"]');

        expect(focusable.length).toBe(2);
        expect(imageLink.getAttribute('tabindex')).toBe('-1');
        expect(fixture.nativeElement.firstElementChild.getAttribute('tabindex')).toBeNull();
    });
});
