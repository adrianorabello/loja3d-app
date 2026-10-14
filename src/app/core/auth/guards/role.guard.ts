import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanActivateChild, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { AuthService } from 'app/core/auth/auth.service';
import { UserService } from 'app/core/user/user.service';
import { User, UserRole } from 'app/core/user/user.model';
import { hasAnyRole } from 'app/core/auth/role.utils';

/**
 * Restricts a route to users holding one of the roles listed in its `data.roles`.
 *
 * Two deliberate design choices:
 *
 * 1. **`CanLoad` is NOT implemented.** `canLoad` receives a `Route`, not an
 *    `ActivatedRouteSnapshot`, so it cannot walk the route cascade to find the
 *    required roles. The consequence is that an admin lazy chunk remains
 *    downloadable by a customer — the *route* is blocked, the *code* is not secret.
 *    In an app whose entire dataset ships in the bundle that distinction is moot.
 *    **This guard is not a security boundary.** Real authorization belongs server-side.
 *
 * 2. **It re-checks authentication itself** rather than assuming `AuthGuard` already
 *    ran. Because of that, a route using this guard should NOT also list `AuthGuard`:
 *    Angular runs `canActivate` guards concurrently, and two guards each issuing their
 *    own `router.navigate()` produce competing navigations that cancel one another,
 *    leaving the user on the page they started from. Listing `RoleGuard` alone covers
 *    both the unauthenticated and the unauthorized case deterministically.
 *
 * 3. **It returns a `UrlTree` rather than calling `router.navigate()`.** Angular folds a
 *    returned `UrlTree` into the current navigation instead of starting a second one,
 *    which is what makes the outcome deterministic.
 */
@Injectable({
    providedIn: 'root'
})
export class RoleGuard implements CanActivate, CanActivateChild
{
    /**
     * Constructor
     */
    constructor(
        private _authService: AuthService,
        private _userService: UserService,
        private _router: Router
    )
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Can activate
     *
     * @param route
     * @param state
     */
    canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree>
    {
        return this._check(route, state.url);
    }

    /**
     * Can activate child
     *
     * @param childRoute
     * @param state
     */
    canActivateChild(childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree>
    {
        return this._check(childRoute, state.url);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Resolve the roles required by this route.
     *
     * Walks `pathFromRoot` and takes the LAST `data.roles` found, mirroring how
     * `LayoutComponent._updateLayout()` resolves `data.layout` — so the idiom is already
     * familiar in this codebase.
     *
     * This walk is necessary, not defensive: Angular's default
     * `paramsInheritanceStrategy` is `'emptyOnly'`, which means a child route with its
     * own path (such as `/admin/products`) does NOT inherit `data` from its parent. A
     * naive `route.data.roles` read would therefore find nothing on exactly the routes
     * that most need protecting.
     *
     * @param route
     * @private
     */
    private _requiredRoles(route: ActivatedRouteSnapshot): UserRole[]
    {
        let roles: UserRole[] = [];

        for ( const snapshot of route.pathFromRoot )
        {
            const candidate = snapshot.routeConfig?.data?.roles as UserRole[] | undefined;

            if ( candidate )
            {
                roles = candidate;
            }
        }

        return roles;
    }

    /**
     * Check authentication, then role membership
     *
     * @param route
     * @param redirectURL
     * @private
     */
    private _check(route: ActivatedRouteSnapshot, redirectURL: string): Observable<boolean | UrlTree>
    {
        const requiredRoles = this._requiredRoles(route);

        return this._authService.check().pipe(
            switchMap((authenticated) => {

                // Not signed in at all — send them to sign in and come back afterwards.
                if ( !authenticated )
                {
                    return of(this._router.createUrlTree(['sign-in'], {queryParams: {redirectURL}}));
                }

                return this._userService.user$.pipe(
                    take(1),
                    switchMap((user: User) => {

                        if ( hasAnyRole(user, requiredRoles) )
                        {
                            return of(true);
                        }

                        // Signed in but not permitted. Deliberately NOT a redirect back to
                        // sign-in: they are already authenticated, so that would loop.
                        // Sending them to the storefront home is both honest and useful.
                        return of(this._router.createUrlTree(['/']));
                    })
                );
            })
        );
    }
}
