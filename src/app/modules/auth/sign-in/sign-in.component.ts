import { Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, FormGroupDirective, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { AuthService } from 'app/core/auth/auth.service';
import { ProductService } from 'app/core/product/product.service';
import { PRODUCT_IMAGE_PLACEHOLDER, Product } from 'app/shared/models/product.model';
import { environment } from 'environments/environment';

@Component({
    selector     : 'auth-sign-in',
    templateUrl  : './sign-in.component.html',
    styleUrls    : ['./sign-in.component.scss'],
    encapsulation: ViewEncapsulation.None
})
export class AuthSignInComponent implements OnInit, OnDestroy
{
    @ViewChild(FormGroupDirective) private _formDirective: FormGroupDirective;

    signInForm: FormGroup;
    showAlert: boolean = false;
    showPassword: boolean = false;
    products: Product[] = [];
    activeSlide: number = 0;
    productsLoading: boolean = false;
    productsError: boolean = false;
    carouselPaused: boolean = false;
    carouselHovered: boolean = false;
    carouselFocused: boolean = false;
    reducedMotion: boolean = false;
    readonly placeholder: string = PRODUCT_IMAGE_PLACEHOLDER;

    private _unsubscribeAll: Subject<void> = new Subject<void>();

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _authService: AuthService,
        private _formBuilder: FormBuilder,
        private _router: Router,
        private _productService: ProductService,
        private _fuseMediaWatcherService: FuseMediaWatcherService
    )
    {
    }

    get activeProduct(): Product | undefined
    {
        return this.products[this.activeSlide];
    }

    ngOnInit(): void
    {
        this.signInForm = this._formBuilder.group({
            email     : [environment.useMockApi ? 'admin@clararosa.pt' : '', [Validators.required, Validators.email]],
            password  : [environment.useMockApi ? 'admin' : '', Validators.required],
            rememberMe: [false]
        });

        this._fuseMediaWatcherService.onMediaQueryChange$('(prefers-reduced-motion: reduce)')
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(state => this.reducedMotion = state.matches);

        interval(5000).pipe(takeUntil(this._unsubscribeAll)).subscribe(() => {
            if ( this.products.length > 1 && !this.reducedMotion && !this.carouselPaused &&
                !this.carouselHovered && !this.carouselFocused && document.visibilityState === 'visible' )
            {
                this.activeSlide = (this.activeSlide + 1) % this.products.length;
            }
        });

        this.loadProducts();
    }

    ngOnDestroy(): void
    {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadProducts(): void
    {
        if ( this.productsLoading )
        {
            return;
        }

        this.productsLoading = true;
        this.productsError = false;
        this._productService.getProducts({sort: 'newest'})
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(
                (products) => {
                    this.products = products.filter(product => product.active).slice(0, 3);
                    this.activeSlide = 0;
                    this.productsLoading = false;
                },
                () => {
                    this.productsLoading = false;
                    this.productsError = true;
                }
            );
    }

    onImageError(event: Event): void
    {
        const image = event.target as HTMLImageElement;
        if ( image.getAttribute('src') !== this.placeholder )
        {
            image.src = this.placeholder;
        }
    }

    signIn(): void
    {
        if ( this.signInForm.disabled )
        {
            return;
        }

        if ( this.signInForm.invalid )
        {
            this.signInForm.markAllAsTouched();
            return;
        }

        this.signInForm.disable();
        this.showAlert = false;

        this._authService.signIn(this.signInForm.value)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(
                () => {
                    const redirectURL = this._activatedRoute.snapshot.queryParamMap.get('redirectURL') || '/signed-in-redirect';
                    this._router.navigateByUrl(redirectURL);
                },
                () => {
                    this.signInForm.enable();
                    this._formDirective.resetForm({rememberMe: false});
                    this.showPassword = false;
                    this.showAlert = true;
                }
            );
    }
}
