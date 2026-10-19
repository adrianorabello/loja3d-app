import { HttpClientModule } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { FuseMockApiModule } from '@fuse/lib/mock-api';
import { AuthService } from 'app/core/auth/auth.service';
import { User } from 'app/core/user/user.model';
import { UserService } from 'app/core/user/user.service';
import { mockApiServices } from 'app/mock-api';

describe('UserService (via mock API)', () => {

    let authService: AuthService;
    let userService: UserService;

    beforeEach(() => {
        localStorage.removeItem('access_token');

        TestBed.configureTestingModule({
            imports  : [
                HttpClientModule,
                FuseMockApiModule.forRoot(mockApiServices)
            ],
            providers: [AuthService]
        });

        authService = TestBed.inject(AuthService);
        userService = TestBed.inject(UserService);
    });

    afterEach(() => {
        localStorage.removeItem('access_token');
    });

    it('updates only the current session profile and does not accept a client-supplied role or id', (done) => {
        authService.signIn({email: 'cliente@clararosa.pt', password: 'cliente'}).subscribe((response) => {
            const forgedProfile: User = {
                ...response.user,
                id         : 'another-customer',
                role       : 'ADMIN',
                name       : 'Updated Customer',
                email      : 'cliente-atualizado@clararosa.pt',
                dateOfBirth: '2012-05-03',
                addresses  : [{
                    id        : 'address-1',
                    label     : 'Casa',
                    street    : 'Rua da Escola, 12',
                    postalCode: '1000-001',
                    city      : 'Lisboa',
                    country   : 'Portugal'
                }]
            };

            userService.update(forgedProfile).subscribe((updated) => {
                expect(updated.id).toBe(response.user.id);
                expect(updated.role).toBe('CUSTOMER');
                expect(updated.name).toBe('Updated Customer');
                expect(updated.email).toBe('cliente-atualizado@clararosa.pt');
                expect(updated.addresses.length).toBe(1);
                done();
            });
        });
    });

    it('rejects an email address already assigned to a different account', (done) => {
        authService.signIn({email: 'cliente@clararosa.pt', password: 'cliente'}).subscribe((response) => {
            userService.update({...response.user, email: 'admin@clararosa.pt'}).subscribe(
                () => done.fail('expected duplicate email to be rejected'),
                (error) => {
                    expect(error.status).toBe(409);
                    done();
                }
            );
        });
    });
});
