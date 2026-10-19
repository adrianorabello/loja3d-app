import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { map, takeUntil } from 'rxjs/operators';
import { FuseNavigationItem } from '@fuse/components/navigation';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { AuthService } from 'app/core/auth/auth.service';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.model';
import { isAdmin } from 'app/core/auth/role.utils';
import { CartService } from 'app/core/cart/cart.service';
import { I18nService } from 'app/core/i18n/i18n.service';
import { AppLanguage, LANGUAGE_OPTIONS, LanguageOption } from 'app/core/i18n/i18n.types';
import { storefrontNavigation } from 'app/layout/layouts/storefront/storefront.navigation';

/**
 * Public storefront shell: header, footer and the router outlet between them.
 *
 * Unlike all ten of Fuse's non-empty layouts, this one takes **no** data from
 * `InitialDataResolver`. Everything comes from DI, so public pages cost no HTTP
 * requests before they can render and anonymous visitors are never blocked.
 */
@Component({
    selector     : 'storefront-layout',
    templateUrl  : './storefront.component.html',
    encapsulation: ViewEncapsulation.None
})
export class StorefrontLayoutComponent implements OnInit, OnDestroy
{
    isScreenSmall: boolean;
    mobileMenuOpen: boolean = false;
    navigation: FuseNavigationItem[] = storefrontNavigation;
    searchControl: FormControl = new FormControl('');
    languages: LanguageOption[] = LANGUAGE_OPTIONS;

    user$: Observable<User>;
    cartCount$: Observable<number>;
    language$: Observable<AppLanguage>;
    activeLanguage$: Observable<LanguageOption>;

    readonly currentYear: number = new Date().getFullYear();

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _activatedRoute: ActivatedRoute,
        private _router: Router,
        private _authService: AuthService,
        private _userService: UserService,
        private _cartService: CartService,
        private _i18nService: I18nService,
        private _fuseMediaWatcherService: FuseMediaWatcherService
    )
    {
        this.user$ = this._userService.user$;
        this.cartCount$ = this._cartService.count$;
        this.language$ = this._i18nService.language$;
        this.activeLanguage$ = this.language$.pipe(map(id => this.languages.find(option => option.id === id)));
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void
    {
        // Restore the session, if there is one to restore.
        //
        // This call is load-bearing. `UserService._user` is a ReplaySubject that nothing
        // populates on public routes: it is fed only by signIn/signInUsingToken or by
        // InitialDataResolver, and the storefront has no guard and no resolver. Without
        // this, a signed-in customer who hard-refreshes on /products would see "Sign in"
        // in the header despite holding a valid token.
        //
        // It also depends on the `signInUsingToken` ordering fix from Phase 2 — before
        // that, a stale token made this throw an uncaught TypeError on every page load.
        this._authService.check()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe();

        // Keep the search box in sync with the URL, so /products?q=dragao shows "dragao"
        // in the header rather than an empty field.
        this._activatedRoute.queryParamMap
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((params) => {
                const query = params.get('q') ?? '';

                if ( query !== this.searchControl.value )
                {
                    this.searchControl.setValue(query, {emitEvent: false});
                }
            });

        // Subscribe to media changes
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({matchingAliases}) => {
                this.isScreenSmall = !matchingAliases.includes('md');

                if ( !this.isScreenSmall )
                {
                    this.mobileMenuOpen = false;
                }
            });
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void
    {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Whether the user may reach the admin area — drives an extra header link.
     *
     * @param user
     */
    canSeeAdmin(user: User | null): boolean
    {
        return isAdmin(user);
    }

    /**
     * Toggle the mobile navigation menu
     */
    toggleMobileMenu(): void
    {
        this.mobileMenuOpen = !this.mobileMenuOpen;
    }

    /**
     * Close the mobile navigation menu
     */
    closeMobileMenu(): void
    {
        this.mobileMenuOpen = false;
    }

    /**
     * Run a search.
     *
     * Navigates with a query param rather than holding the term in a service, which
     * makes results deep-linkable and shareable, and keeps the catalog page the single
     * owner of its own filter state.
     */
    search(): void
    {
        const query = (this.searchControl.value ?? '').trim();

        this.closeMobileMenu();

        this._router.navigate(['/products'], {
            queryParams: query ? {q: query} : {}
        });
    }

    /**
     * Change the UI language
     *
     * @param language
     */
    setLanguage(language: AppLanguage): void
    {
        this._i18nService.use(language);
    }

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: any): any
    {
        return item.id || index;
    }
}
