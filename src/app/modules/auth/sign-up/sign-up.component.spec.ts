import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from 'app/core/auth/auth.service';
import { AuthSignUpModule } from './sign-up.module';
import { AuthSignUpComponent } from './sign-up.component';

describe('AuthSignUpComponent', () => {
    let fixture: ComponentFixture<AuthSignUpComponent>;
    let component: AuthSignUpComponent;
    let http: HttpTestingController;
    let navigate: jasmine.Spy;
    const snapshot = {queryParamMap: convertToParamMap({})};

    const fillForm = (): void => {
        component.signUpForm.setValue({
            name: 'Cliente Teste',
            email: 'signup@example.com',
            password: 'Test-password-123',
            passwordConfirm: 'Test-password-123',
            phone: null,
            agreements: true
        });
        fixture.detectChanges();
    };

    const submit = (): void => {
        const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
        form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
        fixture.detectChanges();
    };

    beforeEach(() => {
        localStorage.removeItem('access_token');
        snapshot.queryParamMap = convertToParamMap({});
        TestBed.configureTestingModule({
            imports: [
                AuthSignUpModule,
                HttpClientTestingModule,
                RouterTestingModule,
                NoopAnimationsModule,
                MatIconTestingModule,
                TranslateModule.forRoot()
            ],
            providers: [AuthService, {provide: ActivatedRoute, useValue: {snapshot}}]
        });
        http = TestBed.inject(HttpTestingController);
        navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.returnValue(Promise.resolve(true));
        fixture = TestBed.createComponent(AuthSignUpComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        http.verify();
        localStorage.removeItem('access_token');
    });

    it('does not send an invalid form and exposes validation errors', () => {
        submit();
        http.expectNone('api/auth/sign-up');
        expect(component.signUpForm.get('name').touched).toBeTrue();
    });

    it('matches backend name and password length constraints and password confirmation', () => {
        fillForm();
        for (const [field, value] of [
            ['name', 'X'], ['name', 'X'.repeat(101)],
            ['password', 'short'], ['password', 'X'.repeat(257)],
            ['passwordConfirm', 'different']
        ]) {
            fillForm();
            component.signUpForm.get(field).setValue(value);
            expect(component.signUpForm.invalid).toBeTrue();
        }
    });

    it('submits once, establishes the customer session and redirects', () => {
        fillForm();
        submit();
        component.signUp();
        const request = http.expectOne('api/auth/sign-up');
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({
            name: 'Cliente Teste', email: 'signup@example.com',
            password: 'Test-password-123', confirmPassword: 'Test-password-123'
        });
        request.flush({
            user: {id: 'customer-test', name: 'Cliente Teste', email: 'signup@example.com', role: 'CUSTOMER'},
            access_token: 'test-access-token', refresh_token: 'test-refresh-token', token_type: 'bearer'
        }, {status: 201, statusText: 'Created'});
        expect(TestBed.inject(AuthService).accessToken).toBe('test-access-token');
        expect(navigate).toHaveBeenCalledWith('/signed-in-redirect');
    });

    it('keeps user input and displays a duplicate email error without throwing', () => {
        fillForm();
        submit();
        http.expectOne('api/auth/sign-up').flush({detail: 'Duplicate'}, {status: 409, statusText: 'Conflict'});
        fixture.detectChanges();
        expect(component.signUpForm.enabled).toBeTrue();
        expect(component.signUpForm.get('email').value).toBe('signup@example.com');
        expect(component.showAlert).toBeTrue();
        expect(component.alert.message).toContain('already registered');
        expect(navigate).not.toHaveBeenCalled();
    });

    it('returns a newly registered customer to the requested print form', () => {
        snapshot.queryParamMap = convertToParamMap({redirectURL: '/account/requests/new'});
        fillForm();
        submit();
        http.expectOne('api/auth/sign-up').flush({
            user: {id: 'customer-test', name: 'Cliente Teste', email: 'signup@example.com', role: 'CUSTOMER'},
            access_token: 'test-access-token', token_type: 'bearer'
        }, {status: 201, statusText: 'Created'});
        expect(navigate).toHaveBeenCalledWith('/account/requests/new');
    });

    it('sends the optional phone in the backend format', () => {
        fillForm();
        component.signUpForm.get('phone').setValue({phone: '+351912345678', phoneCountry: 'PT'});
        submit();
        const request = http.expectOne('api/auth/sign-up');
        expect(request.request.body.phone).toBe('+351912345678');
        expect(request.request.body.phoneCountry).toBe('PT');
        request.flush({detail: 'Duplicate'}, {status: 409, statusText: 'Conflict'});
    });

    it('can retry after a network or CORS failure', () => {
        fillForm();
        submit();
        http.expectOne('api/auth/sign-up').error(new ErrorEvent('error'));
        fixture.detectChanges();
        expect(component.signUpForm.enabled).toBeTrue();
        expect(component.showAlert).toBeTrue();
        expect(fixture.nativeElement.querySelector('fuse-alert').textContent).toContain('Something went wrong');
        submit();
        http.expectOne('api/auth/sign-up').flush({detail: 'Unavailable'}, {status: 503, statusText: 'Unavailable'});
    });

    it('links existing customers to the real sign-in route', () => {
        const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
        expect(link.getAttribute('href')).toBe('/sign-in');
    });
});
