import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BreakpointState } from '@angular/cdk/layout';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { AuthService } from 'app/core/auth/auth.service';
import { I18nService } from 'app/core/i18n/i18n.service';
import { ProductService } from 'app/core/product/product.service';
import { AuthSignInModule } from 'app/modules/auth/sign-in/sign-in.module';
import { AuthSignInComponent } from 'app/modules/auth/sign-in/sign-in.component';
import { PRODUCT_IMAGE_PLACEHOLDER, Product } from 'app/shared/models/product.model';

describe('AuthSignInComponent', () => {
    let fixture: ComponentFixture<AuthSignInComponent>;
    let component: AuthSignInComponent;
    let httpMock: HttpTestingController;
    let productService: jasmine.SpyObj<ProductService>;
    let products: Subject<Product[]>;
    let reducedMotion: BehaviorSubject<BreakpointState>;

    const makeProduct = (id: string, active: boolean = true): Product => ({
        id, active, slug: id, name: {'pt-PT': `Peça ${id}`, en: `Piece ${id}`},
        description: {'pt-PT': 'Descrição', en: 'Description'},
        categoryId: 'category', price: 12.5, currency: 'EUR', colors: [],
        images: [`assets/${id}.jpg`], stock: 5, madeToOrder: false,
        featured: false, createdAt: '2026-01-01T00:00:00Z'
    });
    const emailInput = (): HTMLInputElement => fixture.nativeElement.querySelector('#email');
    const passwordInput = (): HTMLInputElement => fixture.nativeElement.querySelector('#password');
    const submitButton = (): HTMLButtonElement => fixture.nativeElement.querySelector('.login-submit');
    const submit = (): void => {
        fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
        fixture.detectChanges();
    };
    const typeCredentials = (): void => {
        emailInput().value = 'customer@example.com';
        emailInput().dispatchEvent(new Event('input'));
        passwordInput().value = 'password123';
        passwordInput().dispatchEvent(new Event('input'));
        fixture.detectChanges();
    };
    const loadSlides = (): void => {
        products.next([makeProduct('one'), makeProduct('two'), makeProduct('three')]);
        products.complete();
        fixture.detectChanges();
    };

    beforeEach(() => {
        jasmine.clock().install();
        localStorage.removeItem('access_token');
        products = new Subject<Product[]>();
        reducedMotion = new BehaviorSubject<BreakpointState>({matches: false, breakpoints: {}});
        productService = jasmine.createSpyObj<ProductService>('ProductService', ['getProducts']);
        productService.getProducts.and.returnValue(products.asObservable());

        TestBed.configureTestingModule({
            imports: [
                AuthSignInModule, RouterTestingModule, HttpClientTestingModule,
                NoopAnimationsModule, MatIconTestingModule, TranslateModule.forRoot()
            ],
            providers: [
                AuthService,
                {provide: ProductService, useValue: productService},
                {provide: FuseMediaWatcherService, useValue: {onMediaQueryChange$: () => reducedMotion.asObservable()}}
            ]
        });
        TestBed.inject(I18nService).use('en');
        httpMock = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(AuthSignInComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        httpMock.verify({ignoreCancelled: true});
        localStorage.removeItem('access_token');
        jasmine.clock().uninstall();
    });

    it('renders exactly one form with labelled, autofill-enabled inputs and no demo credentials', () => {
        expect(fixture.nativeElement.querySelectorAll('form').length).toBe(1);
        expect(fixture.nativeElement.querySelectorAll('#email').length).toBe(1);
        expect(emailInput().value).toBe('');
        expect(passwordInput().value).toBe('');
        expect(emailInput().type).toBe('email');
        expect(emailInput().autocomplete).toBe('email');
        expect(passwordInput().autocomplete).toBe('current-password');
        expect(fixture.nativeElement.querySelector('label[for="email"]')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('label[for="password"]')).not.toBeNull();
        expect(component.signInForm.value.rememberMe).toBeFalse();
    });

    it('loads real newest active products and limits the showcase to three', () => {
        expect(productService.getProducts).toHaveBeenCalledWith({sort: 'newest'});
        products.next([makeProduct('hidden', false), makeProduct('one'), makeProduct('two'), makeProduct('three'), makeProduct('four')]);
        fixture.detectChanges();

        expect(component.products.map(product => product.id)).toEqual(['one', 'two', 'three']);
        expect(fixture.nativeElement.querySelector('.featured-product-copy').textContent).toContain('Piece one');
        expect(fixture.nativeElement.querySelector('.product-art').getAttribute('src')).toBe('assets/one.jpg');
        expect(fixture.nativeElement.querySelector('.showcase-price').textContent).toContain('12.50');
    });

    it('shows loading and empty states without hiding the login form', () => {
        expect(component.productsLoading).toBeTrue();
        expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
        products.next([]);
        fixture.detectChanges();
        expect(component.productsLoading).toBeFalse();
        expect(fixture.nativeElement.textContent).toContain('signIn.noProducts');
        expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('.showcase-product')).toBeNull();
    });

    it('shows a catalogue error and retries without blocking sign-in', () => {
        products.error(new Error('Catalogue unavailable'));
        fixture.detectChanges();
        expect(component.productsError).toBeTrue();
        expect(submitButton().disabled).toBeFalse();
        expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('signIn.productsError');

        products = new Subject<Product[]>();
        productService.getProducts.and.returnValue(products.asObservable());
        fixture.nativeElement.querySelector('.showcase-retry').click();
        loadSlides();
        expect(component.productsError).toBeFalse();
        expect(component.products.length).toBe(3);
    });

    it('uses the standard placeholder for missing and broken images', () => {
        products.next([{...makeProduct('one'), images: []}]);
        fixture.detectChanges();
        const image: HTMLImageElement = fixture.nativeElement.querySelector('.product-art');
        expect(image.getAttribute('src')).toBe(PRODUCT_IMAGE_PLACEHOLDER);
        image.src = '/missing.jpg';
        image.dispatchEvent(new Event('error'));
        expect(image.getAttribute('src')).toBe(PRODUCT_IMAGE_PLACEHOLDER);
    });

    it('rotates every five seconds and wraps back to the first slide', () => {
        spyOnProperty(document, 'visibilityState', 'get').and.returnValue('visible');
        loadSlides();
        jasmine.clock().tick(4999);
        expect(component.activeSlide).toBe(0);
        jasmine.clock().tick(1);
        expect(component.activeSlide).toBe(1);
        jasmine.clock().tick(10000);
        expect(component.activeSlide).toBe(0);
    });

    it('supports manual selection and a persistent pause control', () => {
        loadSlides();
        const dots = fixture.nativeElement.querySelectorAll('.carousel-dot');
        dots[2].click();
        fixture.detectChanges();
        expect(component.activeSlide).toBe(2);
        expect(dots[2].getAttribute('aria-pressed')).toBe('true');
        fixture.nativeElement.querySelector('.carousel-pause').click();
        jasmine.clock().tick(10000);
        expect(component.activeSlide).toBe(2);
    });

    it('does not rotate when hovered, focused, or reduced motion is enabled', () => {
        loadSlides();
        component.carouselHovered = true;
        jasmine.clock().tick(5000);
        expect(component.activeSlide).toBe(0);
        component.carouselHovered = false;
        component.carouselFocused = true;
        jasmine.clock().tick(5000);
        expect(component.activeSlide).toBe(0);
        component.carouselFocused = false;
        reducedMotion.next({matches: true, breakpoints: {}});
        fixture.detectChanges();
        jasmine.clock().tick(10000);
        expect(component.activeSlide).toBe(0);
        expect(fixture.nativeElement.querySelector('.carousel-pause')).toBeNull();
        fixture.nativeElement.querySelectorAll('.carousel-dot')[1].click();
        expect(component.activeSlide).toBe(1);
    });

    it('stops rotation and ignores late catalogue responses after destruction', () => {
        fixture.destroy();
        products.next([makeProduct('late')]);
        jasmine.clock().tick(10000);
        expect(component.products).toEqual([]);
    });

    it('submits once through the form, sends rememberMe and disables controls while pending', () => {
        typeCredentials();
        component.signInForm.get('rememberMe').setValue(true);
        submit();
        component.signIn();
        submit();
        const request = httpMock.expectOne('api/auth/sign-in');
        expect(request.request.body.rememberMe).toBeTrue();
        expect(request.request.body.email).toBe('customer@example.com');
        expect(submitButton().disabled).toBeTrue();
        expect(emailInput().disabled).toBeTrue();
        expect(passwordInput().disabled).toBeTrue();
    });

    it('does not submit invalid credentials and exposes validation errors', () => {
        submit();
        httpMock.expectNone('api/auth/sign-in');
        expect(emailInput().getAttribute('aria-invalid')).toBe('true');
        expect(fixture.nativeElement.querySelector('#email-error').textContent).toContain('signIn.emailRequired');
        expect(fixture.nativeElement.querySelector('#password-error')).not.toBeNull();
    });

    it('rejects an invalid email without sending a request', () => {
        typeCredentials();
        component.signInForm.get('email').setValue('invalid');
        submit();
        httpMock.expectNone('api/auth/sign-in');
        expect(fixture.nativeElement.querySelector('#email-error').textContent).toContain('signIn.emailInvalid');
    });

    it('shows the sign-in error, remasks the password and clears submitted state after failure', () => {
        typeCredentials();
        component.showPassword = true;
        submit();
        httpMock.expectOne('api/auth/sign-in').flush({}, {status: 401, statusText: 'Unauthorized'});
        fixture.detectChanges();
        expect(component.showAlert).toBeTrue();
        expect(fixture.nativeElement.querySelector('.login-error[role="alert"]')).not.toBeNull();
        expect(component.signInForm.enabled).toBeTrue();
        expect(passwordInput().type).toBe('password');
        expect(emailInput().value).toBe('');
        expect(component.signInForm.get('rememberMe').value).toBeFalse();
        expect(component.signInForm.pristine).toBeTrue();
        expect(component.signInForm.untouched).toBeTrue();
        expect(fixture.nativeElement.querySelector('#email-error')).toBeNull();
    });

    it('preserves the default redirect after successful authentication', () => {
        const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.returnValue(Promise.resolve(true));
        typeCredentials();
        submit();
        httpMock.expectOne('api/auth/sign-in').flush({
            access_token: 'token', token_type: 'bearer',
            user: {id: 'customer', name: 'Customer', email: 'customer@example.com', role: 'CUSTOMER'}
        });
        expect(navigate).toHaveBeenCalledWith('/signed-in-redirect');
    });

    it('honours the redirectURL query parameter and preserves it on the sign-up link', () => {
        const route = TestBed.inject(ActivatedRoute);
        const params = {redirectURL: '/account/requests'};
        route.snapshot.queryParams = params;
        spyOnProperty(route.snapshot, 'queryParamMap', 'get').and.returnValue(convertToParamMap(params));
        const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.returnValue(Promise.resolve(true));
        typeCredentials();
        submit();
        httpMock.expectOne('api/auth/sign-in').flush({
            access_token: 'token', token_type: 'bearer',
            user: {id: 'customer', name: 'Customer', email: 'customer@example.com', role: 'CUSTOMER'}
        });
        expect(navigate).toHaveBeenCalledWith('/account/requests');
        expect(fixture.nativeElement.querySelector('.login-signup a').getAttribute('href')).toContain('/sign-up');
    });

    it('toggles password visibility without submitting and links to password recovery', () => {
        const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.password-toggle');
        toggle.click();
        fixture.detectChanges();
        expect(passwordInput().type).toBe('text');
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        toggle.click();
        fixture.detectChanges();
        expect(passwordInput().type).toBe('password');
        httpMock.expectNone('api/auth/sign-in');
        expect(fixture.nativeElement.querySelector('.login-options a').getAttribute('href')).toBe('/forgot-password');
    });

    it('renders translated labels when the language changes', () => {
        const translate = TestBed.inject(TranslateService);
        translate.setTranslation('en', {signIn: {title: 'Sign in to your account', password: 'Password'}});
        translate.setTranslation('de', {signIn: {title: 'Bei Ihrem Konto anmelden', password: 'Passwort'}});
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('#login-title').textContent).toBe('Sign in to your account');
        TestBed.inject(I18nService).use('de');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('#login-title').textContent).toBe('Bei Ihrem Konto anmelden');
        expect(fixture.nativeElement.querySelector('label[for="password"]').textContent).toBe('Passwort');
    });
});
