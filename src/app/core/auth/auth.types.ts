import { User, UserRole } from 'app/core/user/user.model';

/**
 * Typed contracts for the auth endpoints.
 *
 * The shipped `AuthService` methods were all `Observable<any>`; these interfaces
 * replace that so callers get real completion and the compiler catches a renamed
 * field instead of surfacing it as `undefined` at runtime.
 */

export interface Credentials
{
    email: string;
    password: string;
}

export interface SignUpPayload
{
    name: string;
    email: string;
    password: string;
    confirmPassword?: string;
    phone?: string;
    phoneCountry?: string;
}

export interface SignInResponse
{
    user: User;
    access_token: string;
    token_type: string;
}

/**
 * Decoded mock JWT payload.
 *
 * `sub` and `role` are Clara Rosa additions — the shipped Fuse mock signed a payload
 * of only `{iat, iss, exp}`, carrying no identity or authorization claim at all.
 */
export interface AccessTokenPayload
{
    iat: number;
    iss: string;
    exp: number;
    sub: string;
    role: UserRole;
}
