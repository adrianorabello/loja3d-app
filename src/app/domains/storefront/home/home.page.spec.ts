import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { CartService } from 'app/core/cart/cart.service';
import { ProductService } from 'app/core/product/product.service';
import { StorefrontHomePageComponent } from 'app/domains/storefront/home/home.page';
import { StorefrontHomeModule } from 'app/domains/storefront/home/home.module';
import { Product } from 'app/shared/models/product.model';

describe('StorefrontHomePageComponent', () => {

    let fixture: ComponentFixture<StorefrontHomePageComponent>;
    let component: StorefrontHomePageComponent;
    let productService: jasmine.SpyObj<ProductService>;
    let cartService: jasmine.SpyObj<CartService>;
    let snackBar: MatSnackBar;

    const products: Product[] = [
        {
            id         : 'active-1',
            slug       : 'active-product',
            name       : {'pt-PT': 'Produto ativo', 'en': 'Active product'},
            description: {'pt-PT': 'Descrição', 'en': 'Description'},
            categoryId : 'cat-1',
            price      : 12.5,
            currency   : 'EUR',
            dimensions : {width: 20, height: 30, depth: 40, unit: 'mm'},
            colors     : [],
            images     : [],
            stock      : 2,
            active     : true,
            madeToOrder: false,
            featured   : true,
            createdAt  : '2026-01-01T00:00:00.000Z'
        },
        {
            id         : 'inactive-1',
            slug       : 'inactive-product',
            name       : {'pt-PT': 'Produto oculto', 'en': 'Hidden product'},
            description: {'pt-PT': 'Descrição', 'en': 'Description'},
            categoryId : 'cat-1',
            price      : 8,
            currency   : 'EUR',
            colors     : [],
            images     : [],
            stock      : 1,
            active     : false,
            madeToOrder: false,
            featured   : false,
            createdAt  : '2026-01-01T00:00:00.000Z'
        }
    ];

    beforeEach(() => {
        productService = jasmine.createSpyObj<ProductService>('ProductService', ['ensureLoaded', 'refresh']);
        productService.ensureLoaded.and.returnValue(of(products));
        productService.refresh.and.returnValue(of(products));
        cartService = jasmine.createSpyObj<CartService>('CartService', ['add']);
        cartService.add.and.returnValue(1);

        TestBed.configureTestingModule({
            imports: [
                MatIconTestingModule,
                RouterTestingModule,
                StorefrontHomeModule,
                TranslateModule.forRoot()
            ],
            providers: [
                {provide: ProductService, useValue: productService},
                {provide: CartService, useValue: cartService}
            ]
        });

        fixture = TestBed.createComponent(StorefrontHomePageComponent);
        component = fixture.componentInstance;
        snackBar = TestBed.inject(MatSnackBar);
        spyOn(snackBar, 'open');
        fixture.detectChanges();
    });

    it('renders only active products in the home catalogue', () => {
        const productCards = fixture.nativeElement.querySelectorAll('product-card');

        expect(productCards.length).toBe(1);
        expect(fixture.nativeElement.textContent).toContain('Produto ativo');
        expect(fixture.nativeElement.textContent).not.toContain('Produto oculto');
    });

    it('adds the selected item to the cart service and displays feedback', () => {
        component.addToCart(products[0]);

        expect(cartService.add).toHaveBeenCalled();
        expect(cartService.add.calls.mostRecent().args[0].productId).toBe('active-1');
        expect(snackBar.open).toHaveBeenCalled();
    });

    it('surfaces catalogue loading errors and allows a retry', () => {
        productService.refresh.and.returnValue(throwError(new Error('offline')));
        component.retryLoading();
        fixture.componentRef.changeDetectorRef.markForCheck();
        fixture.detectChanges();

        expect(component.loadError).toBe(true);
        expect(fixture.nativeElement.textContent).toContain('home.feedback.loadFailedTitle');

        productService.refresh.and.returnValue(of(products));
        component.retryLoading();
        fixture.componentRef.changeDetectorRef.markForCheck();

        expect(productService.refresh).toHaveBeenCalledTimes(2);
    });
});
