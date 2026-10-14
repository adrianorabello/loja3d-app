import { Route } from '@angular/router';
import { appRoutes } from 'app/app.routing';
import { AuthGuard } from 'app/core/auth/guards/auth.guard';
import { NoAuthGuard } from 'app/core/auth/guards/noAuth.guard';
import { RoleGuard } from 'app/core/auth/guards/role.guard';
import { SignedInRedirectGuard } from 'app/core/auth/guards/signed-in-redirect.guard';
import { InitialDataResolver } from 'app/app.resolvers';

/**
 * Structural assertions on the route table.
 *
 * These are cheap and deterministic, and they lock in invariants that are easy to break
 * by accident and awkward to notice: several blocks share `path: ''`, so their ORDER is
 * load-bearing, and the admin block's layout and roles are declared in `data` where a
 * careless edit would silently drop them.
 *
 * Guard behaviour itself is covered by `role.guard.spec.ts`; this file only asserts that
 * the guards and metadata are wired onto the right routes.
 */
describe('appRoutes', () => {

    const blockAt = (index: number): Route => appRoutes[index];

    const findBlock = (predicate: (route: Route) => boolean): Route => appRoutes.find(predicate);

    const storefrontBlock = (): Route =>
        findBlock(route => route.path === '' && route.data?.layout === 'storefront' && !route.canActivate);

    const guestBlock = (): Route =>
        findBlock(route => route.canActivate?.includes(NoAuthGuard));

    const adminBlock = (): Route => findBlock(route => route.path === 'admin');

    const indexOfBlock = (route: Route): number => appRoutes.indexOf(route);

    describe('signed-in-redirect', () => {

        it('should be guarded by SignedInRedirectGuard', () => {
            const route = findBlock(candidate => candidate.path === 'signed-in-redirect');

            expect(route).toBeDefined();
            expect(route.canActivate).toContain(SignedInRedirectGuard);
        });

        // Angular's route-config validator rejects a route with none of
        // component | redirectTo | children | loadChildren. The guard always returns a
        // UrlTree, so an empty children array is the correct way to satisfy it.
        it('should declare an empty children array', () => {
            const route = findBlock(candidate => candidate.path === 'signed-in-redirect');

            expect(route.children).toEqual([]);
            expect(route.component).toBeUndefined();
            expect(route.redirectTo).toBeUndefined();
        });
    });

    describe('block ordering', () => {

        // Regression guard for a bug that actually shipped during development: with the
        // auth blocks ahead of the storefront, a request for '/' was claimed by the guest
        // block (an empty-path parent with children matches an exhausted URL) and
        // rendered as a blank empty layout instead of the shop home.
        it('should place the public storefront block before any guarded empty-path block', () => {
            const storefront = indexOfBlock(storefrontBlock());
            const guest = indexOfBlock(guestBlock());

            expect(storefront).toBeGreaterThanOrEqual(0);
            expect(guest).toBeGreaterThanOrEqual(0);
            expect(storefront).toBeLessThan(guest);
        });

        it('should keep the catch-all as the very last route', () => {
            const last = blockAt(appRoutes.length - 1);

            expect(last.path).toBe('**');
            expect(appRoutes.filter(route => route.path === '**').length).toBe(1);
        });
    });

    describe('public storefront block', () => {

        it('should have no guards, so anonymous browsing never redirects to sign-in', () => {
            const block = storefrontBlock();

            expect(block.canActivate).toBeUndefined();
            expect(block.canActivateChild).toBeUndefined();
        });

        // The whole reason a 12th layout exists: every non-empty Fuse layout
        // dereferences resolved initialData unguarded.
        it('should have no resolver', () => {
            expect(storefrontBlock().resolve).toBeUndefined();
        });

        it('should render the storefront layout', () => {
            expect(storefrontBlock().data.layout).toBe('storefront');
        });

        // An empty path matches as a prefix of anything, so it must come last or it
        // swallows its siblings.
        it('should keep the empty-path home route last among its children', () => {
            const children = storefrontBlock().children;
            const emptyIndex = children.findIndex(child => child.path === '');

            expect(emptyIndex).toBe(children.length - 1);
        });

        // pathMatch 'full' requires consuming the whole remaining URL, which a route
        // carrying loadChildren cannot do — combining them makes the branch fail to match.
        it('should not combine pathMatch full with loadChildren', () => {
            storefrontBlock().children.forEach((child) => {
                if ( child.loadChildren )
                {
                    expect(child.pathMatch).not.toBe('full');
                }
            });
        });
    });

    describe('admin block', () => {

        it('should be mounted at /admin', () => {
            expect(adminBlock()).toBeDefined();
        });

        // Load-bearing: this block previously carried no layout and inherited 'classy'
        // from appConfig. appConfig now defaults to 'storefront', so without an explicit
        // declaration the admin area would render inside the shop chrome.
        it('should declare its layout explicitly rather than inheriting it', () => {
            expect(adminBlock().data.layout).toBe('classy');
        });

        it('should require the ADMIN role', () => {
            expect(adminBlock().data.roles).toEqual(['ADMIN']);
        });

        it('should apply RoleGuard on both activate and activateChild', () => {
            const block = adminBlock();

            expect(block.canActivate).toContain(RoleGuard);
            expect(block.canActivateChild).toContain(RoleGuard);
        });

        // RoleGuard re-checks authentication itself. Pairing it with AuthGuard meant two
        // concurrent guards each redirecting an anonymous visitor, and the competing
        // navigations cancelled each other out.
        it('should NOT also list AuthGuard, to avoid competing redirects', () => {
            const block = adminBlock();

            expect(block.canActivate).not.toContain(AuthGuard);
            expect(block.canActivateChild).not.toContain(AuthGuard);
        });

        it('should resolve initial data for the admin shell', () => {
            expect(adminBlock().resolve.initialData).toBe(InitialDataResolver);
        });
    });

    describe('auth blocks', () => {

        it('should render guest auth pages in the empty layout', () => {
            expect(guestBlock().data.layout).toBe('empty');
        });

        it('should expose the expected guest routes', () => {
            const paths = guestBlock().children.map(child => child.path);

            expect(paths).toContain('sign-in');
            expect(paths).toContain('sign-up');
            expect(paths).toContain('forgot-password');
            expect(paths).toContain('reset-password');
            expect(paths).toContain('confirmation-required');
        });

        it('should keep sign-out and unlock-session behind AuthGuard', () => {
            const block = findBlock(route =>
                route.canActivate?.includes(AuthGuard)
                && route.data?.layout === 'empty');

            const paths = block.children.map(child => child.path);

            expect(paths).toContain('sign-out');
            expect(paths).toContain('unlock-session');
        });
    });
});
