import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRouteSnapshot, Resolve, RouterStateSnapshot } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { InitialData } from 'app/app.types';
import { User } from 'app/core/user/user.model';
import { filterNavigationByRole } from 'app/core/navigation/navigation.utils';

/**
 * Resolves the data the admin shell needs before it can render.
 *
 * Applied to the `/admin` route block ONLY. The storefront deliberately has no resolver:
 * every one of Fuse's non-empty layouts dereferences `data.navigation.*` and `data.user`
 * unguarded, which is precisely why Clara Rosa's storefront uses its own layout that
 * takes everything from DI instead. See `ECOMMERCE_ARCHITECTURE.md` §4.
 */
@Injectable({
    providedIn: 'root'
})
export class InitialDataResolver implements Resolve<any>
{
    /**
     * Constructor
     */
    constructor(private _httpClient: HttpClient)
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Use this resolver to resolve initial mock-api for the application
     *
     * @param route
     * @param state
     */
    resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<InitialData>
    {
        // Fork join multiple API endpoint calls to wait all of them to finish
        return forkJoin([
            this._httpClient.get<any>('api/common/messages').pipe(catchError(() => of([]))),
            this._httpClient.get<any>('api/common/navigation').pipe(catchError(() => of({default: [], compact: [], futuristic: [], horizontal: []}))),
            this._httpClient.get<any>('api/common/notifications').pipe(catchError(() => of([]))),
            this._httpClient.get<any>('api/common/shortcuts').pipe(catchError(() => of([]))),
            this._httpClient.get<User>('api/common/user').pipe(catchError(() => of(null)))
        ]).pipe(
            map(([messages, navigation, notifications, shortcuts, user]) => {

                // Hide navigation entries the signed-in role may not use.
                //
                // This runs here because the user is already in hand — and because it is
                // exactly the step a real backend would perform server-side instead,
                // making it a clean deletion later.
                //
                // Cosmetic only: access is enforced by RoleGuard. Hiding a link has never
                // stopped anyone from typing a URL.
                const role = user?.role;

                return {
                    messages,
                    navigation: {
                        compact   : filterNavigationByRole(navigation.compact, role),
                        default   : filterNavigationByRole(navigation.default, role),
                        futuristic: filterNavigationByRole(navigation.futuristic, role),
                        horizontal: filterNavigationByRole(navigation.horizontal, role)
                    },
                    notifications,
                    shortcuts,
                    user
                };
            })
        );
    }
}
