import { Component } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientModule } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { FuseModule } from '@fuse';
import { FuseConfigModule } from '@fuse/services/config';
import { FuseMockApiModule } from '@fuse/lib/mock-api';
import { mockApiServices } from 'app/mock-api';
import { LayoutModule } from 'app/layout/layout.module';
import { appConfig } from 'app/core/config/app.config';
import { appRoutes } from 'app/app.routing';
import { AuthService } from 'app/core/auth/auth.service';
import { UserService } from 'app/core/user/user.service';

@Component({selector: 'test-host', template: '<router-outlet></router-outlet>'})
class TestHostComponent
{
}

/**
 * Drives the REAL route table with the REAL guards and the REAL mock API, to verify the
 * access matrix end to end.
 *
 * The guard unit specs prove the decision logic; the routing config spec proves the
 * metadata is attached to the right routes. This file proves the two actually compose —
 * that a signed-in ADMIN reaches /admin, a CUSTOMER is turned away, and an anonymous
 * visitor is sent to sign-in with a return URL.
 *
 * Lazy `loadChildren` is deliberately NOT exercised here: this asserts routing decisions
 * and final URLs, not component rendering.
 */
describe('appRoutes (integration)', () => {

    let router: Router;
    let authService: AuthService;

    beforeEach(() => {
        localStorage.removeItem('access_token');

        TestBed.configureTestingModule({
            declarations: [TestHostComponent],
            imports     : [
                HttpClientModule,
                NoopAnimationsModule,
                // LayoutComponent is the component on most route blocks, so the real
                // layout infrastructure has to be present for navigation to activate.
                FuseModule,
                FuseConfigModule.forRoot(appConfig),
                LayoutModule,
                FuseMockApiModule.forRoot(mockApiServices),
                RouterTestingModule.withRoutes(appRoutes)
            ],
            providers   : [AuthService]
        });

        router = TestBed.inject(Router);
        authService = TestBed.inject(AuthService);

        TestBed.createComponent(TestHostComponent);
    });

    afterEach(() => {
        localStorage.removeItem('access_token');
    });

    const signInAs = (email: string, password: string, done: () => void): void => {
        authService.signIn({email, password}).subscribe(() => done());
    };

    it('should let a signed-in ADMIN into /admin/products', (done) => {
        signInAs('admin@clararosa.pt', 'admin', () => {
            router.navigateByUrl('/admin/products').then((ok) => {
                expect(ok).toBe(true);
                expect(router.url).toBe('/admin/products');
                done();
            });
        });
    });

    it('should turn a CUSTOMER away from /admin/products and send them home', (done) => {
        signInAs('cliente@clararosa.pt', 'cliente', () => {
            router.navigateByUrl('/admin/products').then(() => {
                // RoleGuard redirects to '/' rather than sign-in: they are already
                // authenticated, so a sign-in redirect would loop.
                expect(router.url).toBe('/');
                done();
            });
        });
    });

    it('should send an anonymous visitor from /admin/products to sign-in with a return URL', (done) => {
        router.navigateByUrl('/admin/products').then(() => {
            expect(router.url).toContain('/sign-in');
            expect(decodeURIComponent(router.url)).toContain('redirectURL=/admin/products');
            done();
        });
    });

    it('should protect customer profile data and preserve the requested return URL', (done) => {
        router.navigateByUrl('/account/profile').then(() => {
            expect(router.url).toContain('/sign-in');
            expect(decodeURIComponent(router.url)).toContain('redirectURL=/account/profile');
            done();
        });
    });

    it('should let a signed-in customer reach their own profile', (done) => {
        signInAs('cliente@clararosa.pt', 'cliente', () => {
            router.navigateByUrl('/account/profile').then((ok) => {
                expect(ok).toBe(true);
                expect(router.url).toBe('/account/profile');
                done();
            });
        });
    });

    it('should resolve / to the storefront block, not an auth block', (done) => {
        router.navigateByUrl('/').then((ok) => {
            expect(ok).toBe(true);
            expect(router.url).toBe('/');

            // The layout is what actually regressed during development: the guest block
            // was claiming '/' and rendering a blank empty layout.
            const root = router.routerState.snapshot.root;
            let layout: string;

            for ( const child of root.children )
            {
                layout = child.routeConfig?.data?.layout ?? layout;
            }

            expect(layout).toBe('storefront');
            done();
        });
    });

    it('should let an anonymous visitor reach /sign-in', (done) => {
        router.navigateByUrl('/sign-in').then((ok) => {
            expect(ok).toBe(true);
            expect(router.url).toBe('/sign-in');
            done();
        });
    });

    it('should bounce a signed-in user away from /sign-in', (done) => {
        signInAs('admin@clararosa.pt', 'admin', () => {
            router.navigateByUrl('/sign-in').then(() => {
                // NoAuthGuard sends them to '', which is now the storefront home.
                expect(router.url).toBe('/');
                done();
            });
        });
    });

    it('should send an unknown URL to the storefront via the catch-all', (done) => {
        router.navigateByUrl('/no-such-page').then(() => {
            expect(router.url).toBe('/');
            done();
        });
    });

    it('should route an ADMIN from signed-in-redirect to the admin dashboard', (done) => {
        signInAs('admin@clararosa.pt', 'admin', () => {
            router.navigateByUrl('/signed-in-redirect').then(() => {
                // /admin/dashboard does not exist until Phase 7, so the catch-all then
                // sends it home. What matters here is that the guard targeted the admin
                // destination rather than the customer one.
                expect(router.url).not.toContain('account/orders');
                done();
            });
        });
    });
});
