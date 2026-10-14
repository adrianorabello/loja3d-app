import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { AuthService } from 'app/core/auth/auth.service';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.model';
import { homeRouteForUser } from 'app/core/auth/role.utils';

/**
 * Sends a freshly signed-in user to the right landing page for their role.
 *
 * Fuse's sign-in flow navigates to the dummy `signed-in-redirect` path and expects
 * `app.routing.ts` to decide where that actually goes (see the comment at
 * `modules/auth/sign-in/sign-in.component.ts`). A static `redirectTo` cannot express
 * "depends on the role", and Angular 11 has no functional redirects — so a guard
 * returning a `UrlTree` is the mechanism.
 *
 * Keeping the decision here rather than in the sign-in component also means
 * `unlock-session`, which targets the same path, gets the same behaviour for free.
 *
 * Note: the route declaring this guard must also declare `children: []`. Angular's
 * route-config validator rejects a route with none of
 * `component | redirectTo | children | loadChildren`, and the guard always returns a
 * `UrlTree`, so nothing is ever rendered.
 */
@Injectable({
    providedIn: 'root'
})
export class SignedInRedirectGuard implements CanActivate
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
     */
    canActivate(): Observable<UrlTree>
    {
        return this._authService.check().pipe(
            switchMap((authenticated) => {

                if ( !authenticated )
                {
                    return of(this._router.parseUrl('/sign-in'));
                }

                return this._userService.user$.pipe(
                    take(1),
                    switchMap((user: User) => of(this._router.parseUrl(homeRouteForUser(user))))
                );
            })
        );
    }
}
