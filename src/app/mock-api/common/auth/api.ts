import { Injectable } from '@angular/core';
import Base64 from 'crypto-js/enc-base64';
import HmacSHA256 from 'crypto-js/hmac-sha256';
import Utf8 from 'crypto-js/enc-utf8';
import { cloneDeep } from 'lodash-es';
import { FuseMockApiService, FuseMockApiUtils } from '@fuse/lib/mock-api';
import { User } from 'app/core/user/user.model';
import { MockSessionService } from 'app/mock-api/clara-rosa/auth/mock-session.service';

/**
 * DEVELOPMENT-ONLY authentication handlers.
 *
 * Adapted from the shipped Fuse mock. Three substantive changes:
 *
 *   1. Credentials come from `MockSessionService` (backed by
 *      `clara-rosa/auth/data.ts`) instead of a hardcoded email/password comparison,
 *      so more than one account — and more than one role — can exist.
 *   2. The JWT payload now carries `sub` and `role`. Fuse signed only
 *      `{iat, iss, exp}`, which identified nobody and authorized nothing.
 *   3. Sign-up actually creates an account and returns a token. It previously
 *      returned `[200, true]` with no session, making /sign-up a dead end.
 *
 * See the header of `clara-rosa/auth/data.ts` for why none of this is secure.
 */
@Injectable({
    providedIn: 'root'
})
export class AuthMockApi
{
    private readonly _secret: string;

    /**
     * Constructor
     */
    constructor(
        private _fuseMockApiService: FuseMockApiService,
        private _mockSessionService: MockSessionService
    )
    {
        // Set the mock-api
        this._secret = 'YOUR_VERY_CONFIDENTIAL_SECRET_FOR_SIGNING_JWT_TOKENS!!!';

        // Register Mock API handlers
        this.registerHandlers();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Register Mock API handlers
     */
    registerHandlers(): void
    {
        // -----------------------------------------------------------------------------------------------------
        // @ Forgot password - POST
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onPost('api/auth/forgot-password', 1000)
            .reply(() => [200, true]);

        // -----------------------------------------------------------------------------------------------------
        // @ Reset password - POST
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onPost('api/auth/reset-password', 1000)
            .reply(() => [200, true]);

        // -----------------------------------------------------------------------------------------------------
        // @ Sign in - POST
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onPost('api/auth/sign-in', 1000)
            .reply(({request}) => {

                const user = this._mockSessionService.findByCredentials(request.body.email, request.body.password);

                // Invalid credentials.
                //
                // 404 rather than 401 is deliberate and inherited: `AuthInterceptor`
                // calls signOut() + location.reload() on ANY 401, so returning 401 from
                // a sign-in attempt would reload the page instead of showing an error.
                if ( !user )
                {
                    return [404, false];
                }

                this._mockSessionService.currentUser = user;

                return [
                    200,
                    {
                        user        : cloneDeep(user),
                        access_token: this._generateJWTToken(user),
                        token_type  : 'bearer'
                    }
                ];
            });

        // -----------------------------------------------------------------------------------------------------
        // @ Verify and refresh the access token - POST
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onPost('api/auth/refresh-access-token')
            .reply(({request}) => {

                const accessToken = request.body.access_token;

                if ( !this._verifyJWTToken(accessToken) )
                {
                    return [401, {error: 'Invalid token'}];
                }

                // Resolve the subject from the token rather than returning whichever user
                // happens to be hardcoded. Without this, a CUSTOMER restoring a session
                // from a stored token would come back as the ADMIN.
                const subject = this._readTokenSubject(accessToken);
                const user = subject ? this._mockSessionService.findById(subject) : null;

                if ( !user )
                {
                    return [401, {error: 'Unknown subject'}];
                }

                this._mockSessionService.currentUser = user;

                return [
                    200,
                    {
                        user        : cloneDeep(user),
                        access_token: this._generateJWTToken(user),
                        token_type  : 'bearer'
                    }
                ];
            });

        // -----------------------------------------------------------------------------------------------------
        // @ Sign up - POST
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onPost('api/auth/sign-up', 1000)
            .reply(({request}) => {

                const {name, email, password} = request.body;

                if ( this._mockSessionService.emailExists(email) )
                {
                    return [409, {error: 'Email already registered'}];
                }

                // Always CUSTOMER — self-service admin registration would be a hole even
                // in a mock.
                const user = this._mockSessionService.register(name, email, password, FuseMockApiUtils.guid());

                this._mockSessionService.currentUser = user;

                return [
                    200,
                    {
                        user        : cloneDeep(user),
                        access_token: this._generateJWTToken(user),
                        token_type  : 'bearer'
                    }
                ];
            });

        // -----------------------------------------------------------------------------------------------------
        // @ Unlock session - POST
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onPost('api/auth/unlock-session', 1000)
            .reply(({request}) => {

                const user = this._mockSessionService.findByCredentials(request.body.email, request.body.password);

                if ( !user )
                {
                    return [404, false];
                }

                this._mockSessionService.currentUser = user;

                return [
                    200,
                    {
                        user        : cloneDeep(user),
                        access_token: this._generateJWTToken(user),
                        token_type  : 'bearer'
                    }
                ];
            });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Return base64 encoded version of the given string
     *
     * @param source
     * @private
     */
    private _base64url(source: any): string
    {
        // Encode in classical base64
        let encodedSource = Base64.stringify(source);

        // Remove padding equal characters
        encodedSource = encodedSource.replace(/=+$/, '');

        // Replace characters according to base64url specifications
        encodedSource = encodedSource.replace(/\+/g, '-');
        encodedSource = encodedSource.replace(/\//g, '_');

        // Return the base64 encoded string
        return encodedSource;
    }

    /**
     * Generates a JWT token using CryptoJS library.
     *
     * This generator is for mocking purposes only and it is NOT
     * safe to use it in production frontend applications!
     *
     * @param user
     * @private
     */
    private _generateJWTToken(user: User): string
    {
        // Define token header
        const header = {
            alg: 'HS256',
            typ: 'JWT'
        };

        // Calculate the issued at and expiration dates
        const date = new Date();
        const iat = Math.floor(date.getTime() / 1000);
        const exp = Math.floor((date.setDate(date.getDate() + 7)) / 1000);

        // Define token payload.
        //
        // `sub` and `role` are Clara Rosa additions — without a subject claim there is
        // no way to tell whose session a stored token represents.
        const payload = {
            iat : iat,
            iss : 'Fuse',
            exp : exp,
            sub : user.id,
            role: user.role
        };

        // Stringify and encode the header
        const stringifiedHeader = Utf8.parse(JSON.stringify(header));
        const encodedHeader = this._base64url(stringifiedHeader);

        // Stringify and encode the payload
        const stringifiedPayload = Utf8.parse(JSON.stringify(payload));
        const encodedPayload = this._base64url(stringifiedPayload);

        // Sign the encoded header and mock-api
        let signature: any = encodedHeader + '.' + encodedPayload;
        signature = HmacSHA256(signature, this._secret);
        signature = this._base64url(signature);

        // Build and return the token
        return encodedHeader + '.' + encodedPayload + '.' + signature;
    }

    /**
     * Read the `sub` claim out of a token payload.
     *
     * Only ever called after `_verifyJWTToken`, but still fully guarded — a malformed
     * payload must not throw inside an interceptor.
     *
     * @param token
     * @private
     */
    private _readTokenSubject(token: string): string | null
    {
        try
        {
            const payload = token.split('.')[1];

            if ( !payload )
            {
                return null;
            }

            // Reverse the base64url substitutions before decoding.
            const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
            const decoded = JSON.parse(Utf8.stringify(Base64.parse(normalized)));

            return decoded?.sub ?? null;
        }
        catch
        {
            return null;
        }
    }

    /**
     * Verify the given token
     *
     * @param token
     * @private
     */
    private _verifyJWTToken(token: string): boolean
    {
        // Split the token into parts
        const parts = token.split('.');
        const header = parts[0];
        const payload = parts[1];
        const signature = parts[2];

        // Re-sign and encode the header and payload using the secret
        const signatureCheck = this._base64url(HmacSHA256(header + '.' + payload, this._secret));

        // Verify that the resulting signature is valid
        return (signature === signatureCheck);
    }
}
