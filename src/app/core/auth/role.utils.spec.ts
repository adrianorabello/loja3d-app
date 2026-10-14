import { User } from 'app/core/user/user.model';
import { hasAnyRole, homeRouteForUser, isAdmin, isCustomer } from 'app/core/auth/role.utils';

describe('role.utils', () => {

    const admin: User = {id: '1', name: 'Admin', email: 'admin@clararosa.pt', role: 'ADMIN'};
    const customer: User = {id: '2', name: 'Cliente', email: 'cliente@clararosa.pt', role: 'CUSTOMER'};

    describe('hasAnyRole', () => {

        it('should grant when the user holds the required role', () => {
            expect(hasAnyRole(admin, ['ADMIN'])).toBe(true);
            expect(hasAnyRole(customer, ['CUSTOMER'])).toBe(true);
        });

        it('should grant when the user holds one of several required roles', () => {
            expect(hasAnyRole(customer, ['ADMIN', 'CUSTOMER'])).toBe(true);
        });

        it('should deny when the user does not hold the required role', () => {
            expect(hasAnyRole(customer, ['ADMIN'])).toBe(false);
            expect(hasAnyRole(admin, ['CUSTOMER'])).toBe(false);
        });

        it('should deny an anonymous user', () => {
            expect(hasAnyRole(null, ['ADMIN'])).toBe(false);
            expect(hasAnyRole(undefined, ['ADMIN'])).toBe(false);
        });

        // The whole point of the fail-closed default: a payload that arrives without a
        // role must never be treated as privileged. `role` is declared required on the
        // User interface, but mock and backend responses are not type-checked.
        it('should deny a user whose role is missing or empty', () => {
            expect(hasAnyRole({id: '3', name: 'No role', email: 'x@y.pt'} as User, ['ADMIN'])).toBe(false);
            expect(hasAnyRole({id: '4', name: 'Empty', email: 'x@y.pt', role: '' as never}, ['ADMIN'])).toBe(false);
        });

        it('should treat an empty role requirement as "any authenticated user"', () => {
            expect(hasAnyRole(customer, [])).toBe(true);
            expect(hasAnyRole(admin, null)).toBe(true);
            expect(hasAnyRole(admin, undefined)).toBe(true);
        });

        it('should deny an anonymous user even with no role requirement', () => {
            expect(hasAnyRole(null, [])).toBe(false);
            expect(hasAnyRole(null, undefined)).toBe(false);
        });
    });

    describe('isAdmin / isCustomer', () => {

        it('should identify an admin', () => {
            expect(isAdmin(admin)).toBe(true);
            expect(isAdmin(customer)).toBe(false);
            expect(isAdmin(null)).toBe(false);
        });

        it('should identify a customer', () => {
            expect(isCustomer(customer)).toBe(true);
            expect(isCustomer(admin)).toBe(false);
            expect(isCustomer(null)).toBe(false);
        });
    });

    describe('homeRouteForUser', () => {

        it('should send an admin to the admin dashboard', () => {
            expect(homeRouteForUser(admin)).toBe('/admin/dashboard');
        });

        it('should send a customer to their orders', () => {
            expect(homeRouteForUser(customer)).toBe('/account/orders');
        });

        it('should send anyone else to the storefront home', () => {
            expect(homeRouteForUser(null)).toBe('/');
            expect(homeRouteForUser({id: '5', name: 'No role', email: 'x@y.pt'} as User)).toBe('/');
        });
    });
});
