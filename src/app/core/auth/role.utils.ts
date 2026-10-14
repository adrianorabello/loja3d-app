import { User, UserRole } from 'app/core/user/user.model';

/**
 * Pure role predicates.
 *
 * Kept free of Angular and of any injected dependency so they are trivially testable
 * and reusable from guards, resolvers, components and templates alike.
 *
 * Every function treats a null, undefined or malformed user as **unauthorized**.
 * That default matters: the `User` interface declares `role` as required, but mock
 * payloads and real backend responses are not type-checked, so a missing role is a
 * genuine runtime possibility. Failing closed is the only safe reading.
 */

/**
 * Whether the user holds any of the given roles.
 *
 * An empty `roles` list means "no role requirement", so any authenticated user
 * passes. This is what lets a route omit `data.roles` and still be auth-gated by
 * `AuthGuard` alone.
 *
 * @param user
 * @param roles
 */
export function hasAnyRole(user: User | null | undefined, roles: UserRole[] | null | undefined): boolean
{
    if ( !roles || roles.length === 0 )
    {
        return !!user;
    }

    if ( !user || !user.role )
    {
        return false;
    }

    return roles.includes(user.role);
}

/**
 * Whether the user is an administrator.
 *
 * @param user
 */
export function isAdmin(user: User | null | undefined): boolean
{
    return hasAnyRole(user, ['ADMIN']);
}

/**
 * Whether the user is a customer.
 *
 * @param user
 */
export function isCustomer(user: User | null | undefined): boolean
{
    return hasAnyRole(user, ['CUSTOMER']);
}

/**
 * The route a user should land on after signing in.
 *
 * Centralised here so `SignedInRedirectGuard` stays a thin wrapper and the rule is
 * covered by the same spec as the predicates.
 *
 * @param user
 */
export function homeRouteForUser(user: User | null | undefined): string
{
    if ( isAdmin(user) )
    {
        return '/admin/dashboard';
    }

    if ( isCustomer(user) )
    {
        return '/account/orders';
    }

    return '/';
}
