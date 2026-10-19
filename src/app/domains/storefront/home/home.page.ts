import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { CartService } from 'app/core/cart/cart.service';
import { ProductService } from 'app/core/product/product.service';
import { toCartItem } from 'app/core/product/product.utils';
import { Product } from 'app/shared/models/product.model';

@Component({
    selector       : 'storefront-home-page',
    templateUrl    : './home.page.html',
    styleUrls      : ['./home.page.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StorefrontHomePageComponent implements OnInit, OnDestroy
{
    private _products: BehaviorSubject<Product[] | null> = new BehaviorSubject<Product[] | null>(null);

    products$: Observable<Product[] | null> = this._products.asObservable();
    loadError: boolean = false;
    private _loadSubscription: Subscription;

    constructor(
        private _productService: ProductService,
        private _cartService: CartService,
        private _snackBar: MatSnackBar,
        private _translate: TranslateService
    )
    {
    }

    ngOnInit(): void
    {
        this._loadProducts();
    }

    ngOnDestroy(): void
    {
        this._loadSubscription?.unsubscribe();
        this._products.complete();
    }

    addToCart(product: Product): void
    {
        const maxStock = product.madeToOrder ? undefined : product.stock;
        const result = this._cartService.add(toCartItem(product, 1), maxStock);

        this._showMessage(result === null
            ? 'home.feedback.unavailable'
            : 'home.feedback.added');
    }

    scrollToCatalog(): void
    {
        const catalog = document.getElementById('home-catalog');

        if ( !catalog )
        {
            return;
        }

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        catalog.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block   : 'start'
        });
    }

    retryLoading(): void
    {
        this._loadProducts(true);
    }

    requestCustomQuote(): void
    {
        this._showMessage('home.feedback.quoteUnavailable');
    }

    private _loadProducts(refresh: boolean = false): void
    {
        this._loadSubscription?.unsubscribe();
        this.loadError = false;
        this._products.next(null);
        const request = refresh
            ? this._productService.refresh()
            : this._productService.ensureLoaded();

        this._loadSubscription = request.pipe(
            map(products => products.filter(product => product.active))
        ).subscribe(
            products => this._products.next(products),
            () => {
                this.loadError = true;
                this._products.next(null);
                this._showMessage('home.feedback.loadFailed');
            }
        );
    }

    private _showMessage(key: string): void
    {
        this._snackBar.open(
            this._translate.instant(key),
            this._translate.instant('common.close'),
            {duration: 3500}
        );
    }
}
