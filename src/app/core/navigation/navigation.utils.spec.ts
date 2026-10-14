import { FuseNavigationItem } from '@fuse/components/navigation';
import { filterNavigationByRole, isItemVisibleToRole } from 'app/core/navigation/navigation.utils';

describe('navigation.utils', () => {

    describe('isItemVisibleToRole', () => {

        it('should show an unannotated item to everyone', () => {
            const item: FuseNavigationItem = {type: 'basic', title: 'Home'};

            expect(isItemVisibleToRole(item, 'ADMIN')).toBe(true);
            expect(isItemVisibleToRole(item, 'CUSTOMER')).toBe(true);
            expect(isItemVisibleToRole(item, null)).toBe(true);
        });

        it('should respect role metadata', () => {
            const item: FuseNavigationItem = {type: 'basic', title: 'Admin', meta: {roles: ['ADMIN']}};

            expect(isItemVisibleToRole(item, 'ADMIN')).toBe(true);
            expect(isItemVisibleToRole(item, 'CUSTOMER')).toBe(false);
            expect(isItemVisibleToRole(item, null)).toBe(false);
        });

        it('should treat an empty roles array as unrestricted', () => {
            const item: FuseNavigationItem = {type: 'basic', title: 'Open', meta: {roles: []}};

            expect(isItemVisibleToRole(item, null)).toBe(true);
        });
    });

    describe('filterNavigationByRole', () => {

        const navigation: FuseNavigationItem[] = [
            {id: 'shop', title: 'Shop', type: 'basic', link: '/'},
            {
                id      : 'admin',
                title   : 'Admin',
                type    : 'group',
                meta    : {roles: ['ADMIN']},
                children: [
                    {id: 'dashboard', title: 'Dashboard', type: 'basic', link: '/admin/dashboard'},
                    {id: 'products', title: 'Products', type: 'basic', link: '/admin/products'}
                ]
            },
            {
                id      : 'account',
                title   : 'Account',
                type    : 'group',
                children: [
                    {id: 'orders', title: 'Orders', type: 'basic', link: '/account/orders'},
                    {id: 'audit', title: 'Audit', type: 'basic', link: '/admin/audit', meta: {roles: ['ADMIN']}}
                ]
            }
        ];

        it('should keep everything for an ADMIN', () => {
            const result = filterNavigationByRole(navigation, 'ADMIN');

            expect(result.length).toBe(3);
            expect(result[1].children.length).toBe(2);
            expect(result[2].children.length).toBe(2);
        });

        it('should drop the admin group entirely for a CUSTOMER', () => {
            const result = filterNavigationByRole(navigation, 'CUSTOMER');

            expect(result.map(item => item.id)).toEqual(['shop', 'account']);
        });

        it('should filter restricted children out of an unrestricted group', () => {
            const result = filterNavigationByRole(navigation, 'CUSTOMER');
            const account = result.find(item => item.id === 'account');

            expect(account.children.map(child => child.id)).toEqual(['orders']);
        });

        it('should drop an anonymous visitor down to unrestricted items only', () => {
            const result = filterNavigationByRole(navigation, null);

            expect(result.map(item => item.id)).toEqual(['shop', 'account']);
        });

        // Otherwise an ADMIN-only group renders for a customer as an empty, dead heading.
        it('should drop a group whose every child was filtered away', () => {
            const adminOnlyGroup: FuseNavigationItem[] = [
                {
                    id      : 'tools',
                    title   : 'Tools',
                    type    : 'group',
                    children: [
                        {id: 'a', title: 'A', type: 'basic', meta: {roles: ['ADMIN']}},
                        {id: 'b', title: 'B', type: 'basic', meta: {roles: ['ADMIN']}}
                    ]
                }
            ];

            expect(filterNavigationByRole(adminOnlyGroup, 'CUSTOMER')).toEqual([]);
        });

        // Fuse's compact/horizontal navigation sets legitimately ship `children: []`,
        // filled in server-side at request time. Those must not be mistaken for groups
        // that were emptied by filtering.
        it('should preserve an item that was already childless', () => {
            const stub: FuseNavigationItem[] = [
                {id: 'stub', title: 'Stub', type: 'aside', children: []}
            ];

            expect(filterNavigationByRole(stub, 'CUSTOMER').length).toBe(1);
        });

        it('should not mutate the input', () => {
            const before = JSON.stringify(navigation);
            filterNavigationByRole(navigation, 'CUSTOMER');

            expect(JSON.stringify(navigation)).toBe(before);
        });

        it('should tolerate nullish input', () => {
            expect(filterNavigationByRole(null, 'ADMIN')).toEqual([]);
            expect(filterNavigationByRole(undefined, 'ADMIN')).toEqual([]);
        });
    });
});
