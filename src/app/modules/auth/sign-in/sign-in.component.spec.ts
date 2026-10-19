import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { AuthService } from 'app/core/auth/auth.service';
import { AuthSignInModule } from 'app/modules/auth/sign-in/sign-in.module';
import { AUTH_WIDE_LAYOUT_QUERY, AuthSignInComponent } from 'app/modules/auth/sign-in/sign-in.component';

/**
 * Coverage for the responsive sign-in presentation.
 *
 * This spec is the safety net for the whole feature. The page swaps between two chromes at
 * 768px while keeping ONE form instance, and almost everything that could go wrong is
 * invisible by inspection: a destroyed form, a validator stripped on teardown, a duplicated
 * element id, or a second auth request fired because the submit guard was lost mid-swap.
 * Each of those gets an explicit assertion below.
 */
describe('AuthSignInComponent (responsive presentation)', () => {

    /**
     * Stands in for `FuseMediaWatcherService`, which is otherwise provided by `FuseModule`.
     *
     * Backed by a `BehaviorSubject` on purpose: the real CDK `BreakpointObserver.observe()`
     * emits its first state synchronously on subscribe, and the component relies on that to
     * avoid a flicker frame. Using a BehaviorSubject reproduces that timing faithfully.
     */
    class MediaWatcherStub
    {
        readonly observedQueries: (string | string[])[] = [];

        private _state: BehaviorSubject<BreakpointState> =
            new BehaviorSubject<BreakpointState>({matches: false, breakpoints: {}});

        get onMediaChange$(): Observable<{ matchingAliases: string[], matchingQueries: any }>
        {
            return of({matchingAliases: [], matchingQueries: {}});
        }

        onMediaQueryChange$(query: string | string[]): Observable<BreakpointState>
        {
            this.observedQueries.push(query);

            return this._state.asObservable();
        }

        setWide(matches: boolean): void
        {
            this._state.next({matches, breakpoints: {}});
        }
    }

    let fixture: ComponentFixture<AuthSignInComponent>;
    let component: AuthSignInComponent;
    let mediaWatcher: MediaWatcherStub;
    let httpMock: HttpTestingController;

    const SIGN_IN_URL = 'api/auth/sign-in';

    // --- DOM helpers -------------------------------------------------------------------------

    const chrome = (): string | null => {
        const el = fixture.nativeElement.querySelector('[data-chrome]');

        return el ? el.getAttribute('data-chrome') : null;
    };
    const forms          = (): NodeList        => fixture.nativeElement.querySelectorAll('form');
    const emailInputs    = (): NodeList        => fixture.nativeElement.querySelectorAll('#email');
    const emailInput     = (): HTMLInputElement => fixture.nativeElement.querySelector('#email');
    const passwordInput  = (): HTMLInputElement => fixture.nativeElement.querySelector('#password');
    const submitButton   = (): HTMLButtonElement => fixture.nativeElement.querySelector('button.fuse-mat-button-large');
    const decorativePanel = (): HTMLElement     => fixture.nativeElement.querySelector('.bg-gray-800');

    /** Flip the viewport across the 768px boundary and settle the view. */
    const setViewport = (wide: boolean): void => {
        mediaWatcher.setWide(wide);
        fixture.detectChanges();
    };

    /** Put valid credentials into the DOM, so the model is driven the way a user would. */
    const typeCredentials = (email: string, password: string): void => {
        const emailEl = emailInput();
        const pwEl    = passwordInput();

        emailEl.value = email;
        emailEl.dispatchEvent(new Event('input'));
        pwEl.value = password;
        pwEl.dispatchEvent(new Event('input'));
        fixture.detectChanges();
    };

    beforeEach(() => {
        // Each spec starts from a clean session — the success path writes a token.
        localStorage.removeItem('access_token');

        mediaWatcher = new MediaWatcherStub();

        TestBed.configureTestingModule({
            imports  : [
                AuthSignInModule,
                RouterTestingModule,
                HttpClientTestingModule,
                NoopAnimationsModule
            ],
            providers: [
                AuthService,
                {provide: FuseMediaWatcherService, useValue: mediaWatcher}
            ]
        });

        httpMock  = TestBed.inject(HttpTestingController);
        fixture   = TestBed.createComponent(AuthSignInComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        localStorage.removeItem('access_token');
    });

    // -----------------------------------------------------------------------------------------
    // @ Presentation switching
    // -----------------------------------------------------------------------------------------

    it('observes exactly the 768px media query', () => {
        expect(mediaWatcher.observedQueries).toContain(AUTH_WIDE_LAYOUT_QUERY);
        expect(AUTH_WIDE_LAYOUT_QUERY).toBe('(min-width: 768px)');
    });

    it('renders Classic below 768px, without the decorative panel', () => {
        setViewport(false);

        expect(chrome()).toBe('classic');
        expect(decorativePanel()).toBeNull();
    });

    it('renders Modern Reversed at 768px and above, with the decorative panel visible', () => {
        setViewport(true);

        expect(chrome()).toBe('modern');

        // The panel must actually be in the DOM, not merely present-but-hidden. Upstream Fuse
        // gates it on `md:` (960px), which would leave it hidden across 768-959 — the exact
        // band this feature introduces.
        expect(decorativePanel()).not.toBeNull();
    });

    it('resolves to Classic when the media state is unknown', () => {
        // `isWideViewport` is intentionally left undefined, so a no-matchMedia environment
        // falls back to the narrow presentation rather than rendering nothing.
        component.isWideViewport = undefined;
        fixture.detectChanges();

        expect(chrome()).toBe('classic');
    });

    // -----------------------------------------------------------------------------------------
    // @ Accessibility: exactly one of everything
    // -----------------------------------------------------------------------------------------

    it('keeps exactly one form and one #email element at every width', () => {
        setViewport(false);
        expect(forms().length).toBe(1);
        expect(emailInputs().length).toBe(1);

        setViewport(true);
        expect(forms().length).toBe(1);
        expect(emailInputs().length).toBe(1);
    });

    // -----------------------------------------------------------------------------------------
    // @ State preservation across a swap
    // -----------------------------------------------------------------------------------------

    it('preserves typed values across a breakpoint change, in both the model and the DOM', () => {
        setViewport(false);
        typeCredentials('someone@clararosa.pt', 'hunter2');

        setViewport(true);

        // The model is the source of truth and lives on the component, not the view.
        expect(component.signInForm.value.email).toBe('someone@clararosa.pt');
        expect(component.signInForm.value.password).toBe('hunter2');

        // And the newly instantiated chrome must be painted with those values — this is the
        // `writeValue(control.value)` re-bind actually working, not just the model surviving.
        expect(emailInput().value).toBe('someone@clararosa.pt');
        expect(passwordInput().value).toBe('hunter2');
    });

    it('does not drop validators across repeated breakpoint changes', () => {
        for ( let i = 0; i < 10; i++ )
        {
            setViewport(i % 2 === 0);
        }

        const email = component.signInForm.get('email');

        email.setValue('');
        expect(email.hasError('required')).toBe(true);

        email.setValue('not-an-email');
        expect(email.hasError('email')).toBe(true);

        email.setValue('valid@clararosa.pt');
        expect(email.valid).toBe(true);
    });

    // -----------------------------------------------------------------------------------------
    // @ Submission
    // -----------------------------------------------------------------------------------------

    it('issues exactly one request per submit and disables the form while in flight', () => {
        setViewport(false);
        typeCredentials('admin@clararosa.pt', 'admin');

        submitButton().click();
        fixture.detectChanges();

        expect(httpMock.match(SIGN_IN_URL).length).toBe(1);
        expect(component.signInForm.disabled).toBe(true);
        expect(submitButton().disabled).toBe(true);
    });

    it('stays disabled and does not re-request when the breakpoint flips mid-flight', () => {
        setViewport(false);
        typeCredentials('admin@clararosa.pt', 'admin');

        submitButton().click();
        fixture.detectChanges();

        const inFlight = httpMock.match(SIGN_IN_URL);
        expect(inFlight.length).toBe(1);

        // Swap presentation while the request is outstanding.
        setViewport(true);

        // The re-bound controls must come back disabled, or the user could submit twice.
        expect(component.signInForm.disabled).toBe(true);
        expect(submitButton().disabled).toBe(true);
        expect(emailInput().disabled).toBe(true);
        expect(httpMock.match(SIGN_IN_URL).length).toBe(0);
    });

    it('does not submit an invalid form', () => {
        setViewport(false);
        typeCredentials('not-an-email', '');

        submitButton().click();
        fixture.detectChanges();

        expect(httpMock.match(SIGN_IN_URL).length).toBe(0);
        expect(component.signInForm.disabled).toBe(false);
    });

    // -----------------------------------------------------------------------------------------
    // @ Error handling — proves the model reset matches NgForm.resetForm()
    // -----------------------------------------------------------------------------------------

    it('shows the alert and clears the form on a failed sign in', () => {
        setViewport(false);
        typeCredentials('admin@clararosa.pt', 'wrong');

        submitButton().click();
        fixture.detectChanges();

        httpMock.expectOne(SIGN_IN_URL).flush(false, {status: 404, statusText: 'Not Found'});
        fixture.detectChanges();

        expect(component.showAlert).toBe(true);
        expect(component.alert.type).toBe('error');
        expect(fixture.nativeElement.querySelector('fuse-alert')).not.toBeNull();

        // Re-enabled, cleared, and back to pristine/untouched — the behaviour `resetForm()`
        // provided before the `@ViewChild` was removed.
        expect(component.signInForm.disabled).toBe(false);
        expect(component.signInForm.get('email').value).toBeFalsy();
        expect(component.signInForm.get('password').value).toBeFalsy();
        expect(component.signInForm.pristine).toBe(true);
        expect(component.signInForm.untouched).toBe(true);
    });

    it('clears the form on failure in the Modern Reversed chrome too', () => {
        // The error path must not depend on which chrome happens to be mounted.
        setViewport(true);
        typeCredentials('admin@clararosa.pt', 'wrong');

        submitButton().click();
        fixture.detectChanges();

        httpMock.expectOne(SIGN_IN_URL).flush(false, {status: 404, statusText: 'Not Found'});
        fixture.detectChanges();

        expect(component.showAlert).toBe(true);
        expect(component.signInForm.get('email').value).toBeFalsy();
        expect(component.signInForm.pristine).toBe(true);
    });

    // -----------------------------------------------------------------------------------------
    // @ Redirect behaviour
    // -----------------------------------------------------------------------------------------

    it('navigates to /signed-in-redirect when no redirectURL is present', () => {
        const router = TestBed.inject(Router);
        const navigate = spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));

        setViewport(false);
        typeCredentials('admin@clararosa.pt', 'admin');
        submitButton().click();

        httpMock.expectOne(SIGN_IN_URL).flush({
            access_token: 'header.eyJzdWIiOiIxIn0.signature',
            token_type  : 'bearer',
            user        : {id: '1', name: 'Admin', email: 'admin@clararosa.pt', role: 'ADMIN'}
        });

        expect(navigate).toHaveBeenCalledWith('/signed-in-redirect');
    });

    it('honours the redirectURL query parameter', () => {
        const router = TestBed.inject(Router);
        const navigate = spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));

        // Patch the real ActivatedRoute rather than replacing it, so routerLink directives in
        // the template keep working.
        //
        // `queryParamMap` is a getter with no setter, and it memoises into `_queryParamMap` on
        // first read, so set the underlying `queryParams` and prime the memo to match.
        const snapshot = TestBed.inject(ActivatedRoute).snapshot as any;
        snapshot.queryParams    = {redirectURL: '/account/orders'};
        snapshot._queryParamMap = convertToParamMap(snapshot.queryParams);

        setViewport(true);
        typeCredentials('cliente@clararosa.pt', 'cliente');
        submitButton().click();

        httpMock.expectOne(SIGN_IN_URL).flush({
            access_token: 'header.eyJzdWIiOiIyIn0.signature',
            token_type  : 'bearer',
            user        : {id: '2', name: 'Cliente', email: 'cliente@clararosa.pt', role: 'CUSTOMER'}
        });

        expect(navigate).toHaveBeenCalledWith('/account/orders');
    });

    // -----------------------------------------------------------------------------------------
    // @ Password visibility
    // -----------------------------------------------------------------------------------------

    it('toggles password visibility in both chromes', () => {
        [false, true].forEach((wide) => {
            setViewport(wide);

            const toggle = fixture.nativeElement.querySelector('button[mat-icon-button]') as HTMLButtonElement;

            expect(passwordInput().type).toBe('password');

            toggle.click();
            fixture.detectChanges();
            expect(passwordInput().type).toBe('text');

            toggle.click();
            fixture.detectChanges();
            expect(passwordInput().type).toBe('password');
        });
    });
});
