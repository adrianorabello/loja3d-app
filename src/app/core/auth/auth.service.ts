import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthUtils } from 'app/core/auth/auth.utils';
import { UserService } from 'app/core/user/user.service';
import { Credentials, SignInResponse, SignUpPayload } from 'app/core/auth/auth.types';

@Injectable()
export class AuthService
{
    private _authenticated: boolean = false;

    /**
     * Constructor
     */
    constructor(
        private _httpClient: HttpClient,
        private _userService: UserService
    )
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Setter & getter for access token
     */
    set accessToken(token: string)
    {
        localStorage.setItem('access_token', token);
    }

    get accessToken(): string
    {
        return localStorage.getItem('access_token') ?? '';
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Forgot password
     *
     * @param email
     */
    forgotPassword(email: string): Observable<any>
    {
        return this._httpClient.post('api/auth/forgot-password', {email});
    }

    /**
     * Confirm an e-mail address with the token received by e-mail
     */
    verifyEmail(token: string): Observable<any>
    {
        return this._httpClient.post('api/auth/verify-email', {token});
    }

    /**
     * Ask for a new verification e-mail
     */
    resendVerification(email: string): Observable<any>
    {
        return this._httpClient.post('api/auth/resend-verification', {email});
    }

    /**
     * Reset password
     *
     * @param password
     */
    resetPassword(token: string, password: string): Observable<any>
    {
        return this._httpClient.post('api/auth/reset-password', {token, password});
    }

    /**
     * Sign in
     *
     * @param credentials
     */
    signIn(credentials: Credentials): Observable<SignInResponse>
    {
        // Throw error, if the user is already logged in
        if ( this._authenticated )
        {
            return throwError('User is already logged in.');
        }

        return this._httpClient.post('api/auth/sign-in', credentials).pipe(
            switchMap((response: SignInResponse) => {

                // Store the access token in the local storage
                this.accessToken = response.access_token;

                // Set the authenticated flag to true
                this._authenticated = true;

                // Store the user on the user service
                this._userService.user = response.user;

                // Return a new observable with the response
                return of(response);
            })
        );
    }

    /**
     * Sign in using the access token
     */
    signInUsingToken(): Observable<boolean>
    {
        // Renew token
        return this._httpClient.post('api/auth/refresh-access-token', {
            access_token: this.accessToken
        }).pipe(
            // NOTE: the order of these two operators matters, and was wrong as shipped.
            //
            // Fuse placed `catchError(() => of(false))` BEFORE this `switchMap`, so a
            // failed refresh emitted the boolean `false` straight into the switchMap,
            // where `response.access_token` threw a TypeError instead of resolving to
            // false. That was masked because the only caller was a guard, which swallowed
            // the error into a redirect. The storefront layout calls `check()` from
            // `ngOnInit`, where it would surface as an uncaught error on every page load
            // carrying a stale token.
            switchMap((response: SignInResponse) => {

                // Store the access token in the local storage
                this.accessToken = response.access_token;

                // Set the authenticated flag to true
                this._authenticated = true;

                // Store the user on the user service
                this._userService.user = response.user;

                // Return true
                return of(true);
            }),
            catchError(() => of(false))
        );
    }

    /**
     * Sign out
     */
    signOut(): Observable<any>
    {
        // Remove the access token from the local storage
        localStorage.removeItem('access_token');

        // Set the authenticated flag to false
        this._authenticated = false;

        // Return the observable
        return of(true);
    }

    /**
     * Sign up
     *
     * Unlike the shipped Fuse version, this establishes a session: the mock endpoint now
     * creates a CUSTOMER and returns a token, so a new user lands signed in rather than
     * on a dead end. The `company` field Fuse collected has been dropped — it has no
     * meaning for a consumer storefront.
     *
     * @param user
     */
    signUp(user: SignUpPayload): Observable<SignInResponse>
    {
        return this._httpClient.post('api/auth/sign-up', user).pipe(
            switchMap((response: SignInResponse) => {

                // Store the access token in the local storage
                this.accessToken = response.access_token;

                // Set the authenticated flag to true
                this._authenticated = true;

                // Store the user on the user service
                this._userService.user = response.user;

                return of(response);
            })
        );
    }

    /**
     * Unlock session
     *
     * @param credentials
     */
    unlockSession(credentials: Credentials): Observable<any>
    {
        return this._httpClient.post('api/auth/unlock-session', credentials);
    }

    /**
     * Check the authentication status
     */
    check(): Observable<boolean>
    {
        // Check if the user is logged in
        if ( this._authenticated )
        {
            return of(true);
        }

        // Check the access token availability
        if ( !this.accessToken )
        {
            return of(false);
        }

        // Check the access token expire date
        if ( AuthUtils.isTokenExpired(this.accessToken) )
        {
            return of(false);
        }

        // If the access token exists and it didn't expire, sign in using it
        return this.signInUsingToken();
    }
}
