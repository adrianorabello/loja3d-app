import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.model';
import { RoleGuard } from 'app/core/auth/guards/role.guard';

describe('RoleGuard', () => {

    const admin: User = {id: '1', name: 'Admin', email: 'admin@clararosa.pt', role: 'ADMIN'};
    const customer: User = {id: '2', name: 'Cliente', email: 'cliente@clararosa.pt', role: 'CUSTOMER'};

    let guard: RoleGuard;
    let authService: jasmine.SpyObj<AuthService>;
    let userService: { user$: any };
    let router: jasmine.SpyObj<Router>;

    /**
     * Build a snapshot chain mimicking Angular's `pathFromRoot`.
     *
     * Each entry is a `data` object (or null for a route carrying no data). The LAST
     * non-null `data.roles` in the chain is what the guard must honour.
     */
    const snapshotWithChain = (chain: Array<{roles?: string[]} | null>): ActivatedRouteSnapshot => {
        const pathFromRoot = chain.map((data) => ({
            routeConfig: data ? {data} : {}
        }));

        return {pathFromRoot} as unknown as ActivatedRouteSnapshot;
    };

    const stateFor = (url: string): RouterStateSnapshot => ({url} as RouterStateSnapshot);

    beforeEach(() => {
        authService = jasmine.createSpyObj<AuthService>('AuthService', ['check']);
        router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);

        // Return a recognisable stand-in so assertions can inspect what the guard asked
        // for. The guard returns a UrlTree rather than calling navigate(), so Angular
        // folds the redirect into the current navigation instead of racing a second one.
        router.createUrlTree.and.callFake(
            (commands: any[], options?: any) =>
                ({__commands: commands, __options: options} as unknown as UrlTree)
        );
        userService = {user$: of(admin)};

        TestBed.configureTestingModule({
            providers: [
                RoleGuard,
                {provide: AuthService, useValue: authService},
                {provide: UserService, useValue: userService},
                {provide: Router, useValue: router}
            ]
        });

        guard = TestBed.inject(RoleGuard);
    });

    it('should allow an ADMIN into an ADMIN-only route', (done) => {
        authService.check.and.returnValue(of(true));
        userService.user$ = of(admin);

        guard.canActivate(snapshotWithChain([{roles: ['ADMIN']}]), stateFor('/admin/dashboard'))
             .subscribe((allowed) => {
                 expect(allowed).toBe(true);
                 expect(router.createUrlTree).not.toHaveBeenCalled();
                 done();
             });
    });

    it('should redirect a CUSTOMER away from an ADMIN-only route', (done) => {
        authService.check.and.returnValue(of(true));
        userService.user$ = of(customer);

        guard.canActivate(snapshotWithChain([{roles: ['ADMIN']}]), stateFor('/admin/dashboard'))
             .subscribe((result) => {
                 // Sent home, NOT back to sign-in — they are already authenticated, so a
                 // sign-in redirect would loop.
                 expect(result).not.toBe(true);
                 expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
                 done();
             });
    });

    it('should send an anonymous visitor to sign-in with a redirectURL', (done) => {
        authService.check.and.returnValue(of(false));

        guard.canActivate(snapshotWithChain([{roles: ['ADMIN']}]), stateFor('/admin/products'))
             .subscribe((result) => {
                 expect(result).not.toBe(true);
                 expect(router.createUrlTree).toHaveBeenCalledWith(
                     ['sign-in'],
                     {queryParams: {redirectURL: '/admin/products'}}
                 );
                 done();
             });
    });

    it('should allow any authenticated user when the route declares no roles', (done) => {
        authService.check.and.returnValue(of(true));
        userService.user$ = of(customer);

        guard.canActivate(snapshotWithChain([null]), stateFor('/account/orders'))
             .subscribe((allowed) => {
                 expect(allowed).toBe(true);
                 done();
             });
    });

    // This is the case Angular's default `paramsInheritanceStrategy: 'emptyOnly'` breaks:
    // a child route with its own path does not inherit parent `data`, so reading
    // `route.data.roles` directly would find nothing on /admin/products.
    it('should find roles declared on an ancestor route', (done) => {
        authService.check.and.returnValue(of(true));
        userService.user$ = of(customer);

        guard.canActivate(
            snapshotWithChain([null, {roles: ['ADMIN']}, null]),
            stateFor('/admin/products')
        ).subscribe((result) => {
            expect(result).not.toBe(true);
            expect(router.createUrlTree).toHaveBeenCalledWith(['/']);
            done();
        });
    });

    it('should let the closest declaration win over an ancestor', (done) => {
        authService.check.and.returnValue(of(true));
        userService.user$ = of(customer);

        guard.canActivate(
            snapshotWithChain([{roles: ['ADMIN']}, {roles: ['CUSTOMER']}]),
            stateFor('/account/orders')
        ).subscribe((allowed) => {
            expect(allowed).toBe(true);
            done();
        });
    });

    it('should deny when the user stream emits no user', (done) => {
        authService.check.and.returnValue(of(true));
        userService.user$ = of(null);

        guard.canActivate(snapshotWithChain([{roles: ['ADMIN']}]), stateFor('/admin/dashboard'))
             .subscribe((result) => {
                 expect(result).not.toBe(true);
                 done();
             });
    });

    it('should apply the same rules via canActivateChild', (done) => {
        authService.check.and.returnValue(of(true));
        userService.user$ = of(customer);

        guard.canActivateChild(snapshotWithChain([{roles: ['ADMIN']}]), stateFor('/admin/orders'))
             .subscribe((result) => {
                 expect(result).not.toBe(true);
                 done();
             });
    });
});
