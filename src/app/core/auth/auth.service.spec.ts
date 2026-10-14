import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FuseMockApiModule } from '@fuse/lib/mock-api';
import { mockApiServices } from 'app/mock-api';
import { AuthService } from 'app/core/auth/auth.service';
import { UserService } from 'app/core/user/user.service';
import { AccessTokenPayload, SignInResponse } from 'app/core/auth/auth.types';

/**
 * Integration coverage for the role plumbing, driven through the REAL mock API
 * interceptor rather than a stub.
 *
 * This is the only automated check that the whole chain lines up: credential lookup →
 * JWT payload → AuthService state → UserService emission. Given that roles are the
 * newest and most consequential addition to this codebase, it earns its place.
 */
describe('AuthService (via mock API)', () => {

    let authService: AuthService;
    let userService: UserService;

    /**
     * Decode a mock JWT payload without verifying it — the handler already verified,
     * and the point here is to assert which claims are present.
     */
    const decodePayload = (token: string): AccessTokenPayload => {
        const segment = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');

        return JSON.parse(atob(segment));
    };

    beforeEach(() => {
        // Each spec starts from a clean session.
        localStorage.removeItem('access_token');

        TestBed.configureTestingModule({
            imports  : [
                HttpClientModule,
                FuseMockApiModule.forRoot(mockApiServices)
            ],
            providers: [
                AuthService
            ]
        });

        authService = TestBed.inject(AuthService);
        userService = TestBed.inject(UserService);
    });

    afterEach(() => {
        localStorage.removeItem('access_token');
    });

    it('should sign in the ADMIN account and carry the role', (done) => {
        authService.signIn({email: 'admin@clararosa.pt', password: 'admin'}).subscribe((response) => {
            expect(response.user.role).toBe('ADMIN');
            expect(response.user.email).toBe('admin@clararosa.pt');
            expect(response.token_type).toBe('bearer');
            done();
        });
    });

    it('should sign in the CUSTOMER account and carry the role', (done) => {
        authService.signIn({email: 'cliente@clararosa.pt', password: 'cliente'}).subscribe((response) => {
            expect(response.user.role).toBe('CUSTOMER');
            done();
        });
    });

    // Fuse's mock signed a payload of only {iat, iss, exp} — identifying nobody and
    // authorizing nothing. Both claims below are Clara Rosa additions.
    it('should put sub and role claims in the access token', (done) => {
        authService.signIn({email: 'cliente@clararosa.pt', password: 'cliente'}).subscribe((response) => {
            const payload = decodePayload(response.access_token);

            expect(payload.sub).toBe(response.user.id);
            expect(payload.role).toBe('CUSTOMER');
            expect(payload.exp).toBeGreaterThan(payload.iat);
            done();
        });
    });

    it('should push the signed-in user onto UserService', (done) => {
        authService.signIn({email: 'admin@clararosa.pt', password: 'admin'}).subscribe(() => {
            userService.user$.subscribe((user) => {
                expect(user.role).toBe('ADMIN');
                done();
            });
        });
    });

    it('should accept a case-insensitive, padded email', (done) => {
        authService.signIn({email: '  Admin@ClaraRosa.PT  ', password: 'admin'}).subscribe((response) => {
            expect(response.user.role).toBe('ADMIN');
            done();
        });
    });

    it('should reject an incorrect password', (done) => {
        authService.signIn({email: 'admin@clararosa.pt', password: 'wrong'}).subscribe(
            () => done.fail('expected sign-in to fail'),
            (error) => {
                // 404, not 401: AuthInterceptor reloads the page on any 401.
                expect(error.status).toBe(404);
                done();
            }
        );
    });

    it('should reject an unknown email', (done) => {
        authService.signIn({email: 'nobody@clararosa.pt', password: 'admin'}).subscribe(
            () => done.fail('expected sign-in to fail'),
            (error) => {
                expect(error.status).toBe(404);
                done();
            }
        );
    });

    it('should register a new account as CUSTOMER and establish a session', (done) => {
        const email = `novo-${Date.now()}@clararosa.pt`;

        authService.signUp({name: 'Novo Cliente', email, password: 'secret'}).subscribe((response) => {
            expect(response.user.role).toBe('CUSTOMER');
            expect(response.access_token).toBeTruthy();
            expect(authService.accessToken).toBe(response.access_token);
            done();
        });
    });

    it('should refuse to register an email that already exists', (done) => {
        authService.signUp({name: 'Dup', email: 'admin@clararosa.pt', password: 'x'}).subscribe(
            () => done.fail('expected sign-up to fail'),
            (error) => {
                expect(error.status).toBe(409);
                done();
            }
        );
    });

    // Regression test for a real bug in the shipped Fuse AuthService: `catchError` was
    // piped BEFORE `switchMap`, so a failed refresh emitted `false` into the switchMap
    // and threw a TypeError on `response.access_token` instead of resolving to false.
    it('should resolve false — not throw — when the stored token is invalid', (done) => {
        authService.accessToken = 'not.a.valid.token';

        authService.signInUsingToken().subscribe({
            next : (result) => {
                expect(result).toBe(false);
                done();
            },
            error: (error) => done.fail(`expected false, got an error: ${error}`)
        });
    });

    // The shipped mock always answered a token refresh with its one hardcoded user,
    // regardless of which token was presented. With two roles that silently escalates a
    // customer to admin on any page reload. This asserts the token's `sub` decides.
    it('should resolve a refreshed token to its own subject, not the last signed-in user', (done) => {
        const httpClient = TestBed.inject(HttpClient);

        // Capture a CUSTOMER token, then make ADMIN the mock's current session user.
        authService.signIn({email: 'cliente@clararosa.pt', password: 'cliente'}).subscribe((customer) => {
            authService.signOut().subscribe(() => {
                authService.signIn({email: 'admin@clararosa.pt', password: 'admin'}).subscribe((admin) => {

                    expect(admin.user.role).toBe('ADMIN');

                    // Present the CUSTOMER's token while ADMIN is the current session.
                    httpClient.post<SignInResponse>('api/auth/refresh-access-token', {
                        access_token: customer.access_token
                    }).subscribe((refreshed) => {
                        expect(refreshed.user.role).toBe('CUSTOMER');
                        expect(refreshed.user.id).toBe(customer.user.id);
                        done();
                    });
                });
            });
        });
    });

    it('should clear the token on sign out', (done) => {
        authService.signIn({email: 'admin@clararosa.pt', password: 'admin'}).subscribe(() => {
            authService.signOut().subscribe(() => {
                expect(authService.accessToken).toBe('');
                done();
            });
        });
    });
});
