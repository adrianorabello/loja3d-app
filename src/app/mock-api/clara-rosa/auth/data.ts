/* tslint:disable:max-line-length */
import { User } from 'app/core/user/user.model';
import { user as adminUser } from 'app/mock-api/common/user/data';

/**
 * ============================================================================
 *  DEVELOPMENT-ONLY AUTHENTICATION ADAPTER
 * ============================================================================
 *
 * A plaintext credential table, read by `AuthMockApi` in place of the hardcoded
 * email/password comparison Fuse shipped with.
 *
 * This is scaffolding for local development and demos. It is NOT an authentication
 * system, and must never be treated as one:
 *
 *   - Passwords are stored in plaintext, in the client bundle.
 *   - The JWT is signed in the browser with a secret that is also in the bundle,
 *     so anyone can mint a token claiming any role.
 *   - Role checks happen entirely client-side and can be bypassed trivially.
 *
 * Replacing this means pointing `environment.apiBaseUrl` at a real backend and
 * setting `environment.useMockApi` to false. Authorization must then be enforced
 * server-side on every request — the client's role is a UI hint, nothing more.
 */

export interface MockCredential
{
    email: string;
    password: string;
    user: User;
}

/**
 * The CUSTOMER account. The ADMIN account is `common/user/data.ts`, reused here so
 * there is a single definition of each user.
 */
export const customerUser: User = {
    id    : 'b4f0a8e2-1c3d-4a5b-9e7f-2d6c8a1b3e5f',
    name  : 'Cliente Demo',
    email : 'cliente@clararosa.pt',
    avatar: 'assets/images/avatars/female-01.jpg',
    status: 'online',
    role  : 'CUSTOMER'
};

export const credentials: MockCredential[] = [
    {
        email   : 'admin@clararosa.pt',
        password: 'admin',
        user    : adminUser
    },
    {
        email   : 'cliente@clararosa.pt',
        password: 'cliente',
        user    : customerUser
    }
];
