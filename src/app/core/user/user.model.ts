/**
 * Application roles.
 *
 * Fuse ships with no role, permission or ACL concept of any kind — its only
 * authorization axis is authenticated-vs-not. This union, the `role` field below,
 * and `RoleGuard` are the whole of Clara Rosa's authorization model.
 *
 * It is a client-side convenience for routing and UI, NOT a security boundary.
 * Real enforcement belongs in the backend.
 */
export type UserRole = 'ADMIN' | 'CUSTOMER';

export interface UserAddress
{
    id: string;
    label: string;
    street: string;
    unit?: string;
    postalCode: string;
    city: string;
    country: string;
}

export interface User
{
    id: string;
    name: string;
    email: string;
    dateOfBirth?: string;
    phone?: string;
    phoneCountry?: string;
    emailVerified?: boolean;
    addresses?: UserAddress[];
    avatar?: string;
    status?: string;

    /**
     * Required rather than optional: an absent role is indistinguishable from an
     * unprivileged one at the type level, and making it explicit means the compiler
     * flags any code path that forgets to carry it. `role.utils.ts` still treats a
     * missing value as unauthorized at runtime, because mock and backend payloads
     * are not type-checked.
     */
    role: UserRole;
}
