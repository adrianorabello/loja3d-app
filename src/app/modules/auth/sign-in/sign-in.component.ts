import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { FuseAnimations } from '@fuse/animations';
import { FuseAlertType } from '@fuse/components/alert';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { AuthService } from 'app/core/auth/auth.service';

/**
 * The viewport width at which the sign-in page switches from the Fuse Classic
 * presentation to Fuse Modern Reversed.
 *
 * This is Angular Material's medium-screen threshold, and it is deliberately NOT one of
 * Fuse's own breakpoints: `tailwind.config.js` defines `sm:600 md:960 lg:1280 xl:1440`,
 * so there is no 768 alias to reuse. Adding one would change a global token consumed by
 * all eleven other layouts, so instead this query goes straight to the CDK through
 * `FuseMediaWatcherService.onMediaQueryChange$`, which is an unfiltered passthrough to
 * `BreakpointObserver.observe()`.
 *
 * Exported so the spec can assert against the same literal rather than duplicating it.
 */
export const AUTH_WIDE_LAYOUT_QUERY = '(min-width: 768px)';

@Component({
    selector     : 'auth-sign-in',
    templateUrl  : './sign-in.component.html',
    encapsulation: ViewEncapsulation.None,
    animations   : FuseAnimations
})
export class AuthSignInComponent implements OnInit, OnDestroy
{
    alert: { type: FuseAlertType, message: string } = {
        type   : 'success',
        message: ''
    };
    signInForm: FormGroup;
    showAlert: boolean = false;

    /**
     * Which presentation to render: Modern Reversed when true, Classic when false.
     *
     * Deliberately left `undefined` rather than initialised. The template reads it as
     * `isWideViewport ? modernChrome : classicChrome`, so an environment without
     * `matchMedia` falls back to Classic — the narrow presentation — instead of
     * rendering nothing.
     */
    isWideViewport: boolean;

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _activatedRoute: ActivatedRoute,
        private _authService: AuthService,
        private _formBuilder: FormBuilder,
        private _router: Router,
        private _fuseMediaWatcherService: FuseMediaWatcherService
    )
    {
        // Subscribed HERE rather than in ngOnInit, and this placement is load-bearing.
        //
        // CDK's `BreakpointObserver.observe()` emits its first state SYNCHRONOUSLY on
        // subscribe — its implementation is
        // `concat(src.pipe(take(1)), src.pipe(skip(1), debounceTime(0)))`, and only the
        // subsequent emissions are debounced. Subscribing in the constructor therefore
        // settles `isWideViewport` before the first change-detection pass, so there is no
        // frame in which neither chrome is rendered and no layout flicker on first paint.
        this._fuseMediaWatcherService.onMediaQueryChange$(AUTH_WIDE_LAYOUT_QUERY)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((state) => {
                this.isWideViewport = state.matches;
            });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void
    {
        // Create the form.
        //
        // Prefilled with the ADMIN demo account. The CUSTOMER account is
        // cliente@clararosa.pt / cliente — see `mock-api/clara-rosa/auth/data.ts`.
        //
        // The form is created ONCE here and lives on the component, not in the view.
        // That is what makes the responsive presentation swap non-destructive: swapping
        // the chrome destroys an embedded view, but `signInForm` and every control's
        // value, validator and disabled state survive on this instance.
        this.signInForm = this._formBuilder.group({
            email     : ['admin@clararosa.pt', [Validators.required, Validators.email]],
            password  : ['admin', Validators.required],
            rememberMe: ['']
        });
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void
    {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Sign in
     */
    signIn(): void
    {
        // Return if the form is invalid
        if ( this.signInForm.invalid )
        {
            return;
        }

        // Disable the form.
        //
        // This also guards against a double submit across a presentation swap: on
        // re-bind, `FormControlName._setUpControl()` re-applies `setDisabledState(true)`
        // when the control is disabled, so the inputs and the submit button stay disabled
        // in the newly rendered chrome while the request is still in flight.
        this.signInForm.disable();

        // Hide the alert
        this.showAlert = false;

        // Sign in
        this._authService.signIn(this.signInForm.value)
            .subscribe(
                () => {

                    // Set the redirect url.
                    // The '/signed-in-redirect' is a dummy url to catch the request and redirect the user
                    // to the correct page after a successful sign in. This way, that url can be set via
                    // routing file and we don't have to touch here.
                    const redirectURL = this._activatedRoute.snapshot.queryParamMap.get('redirectURL') || '/signed-in-redirect';

                    // Navigate to the redirect url
                    this._router.navigateByUrl(redirectURL);

                },
                (response) => {

                    // Re-enable the form
                    this.signInForm.enable();

                    // Reset the form.
                    //
                    // Resets the MODEL rather than calling `NgForm.resetForm()` through a
                    // `@ViewChild`. With two interchangeable chromes the `NgForm` instance
                    // is re-created on every swap, so a view query can go stale and an
                    // error arriving in the same tick as a swap would silently fail to
                    // clear the fields.
                    //
                    // This is exactly equivalent, not merely similar: `resetForm()` is
                    // `form.reset()` plus clearing `submitted`, `form.reset()` already
                    // marks the group and all descendants pristine and untouched, and
                    // `submitted` is dead here — the submit button is bound to `(click)`,
                    // never `(ngSubmit)`, so nothing ever sets or reads it.
                    this.signInForm.reset();
                    this.signInForm.markAsPristine();
                    this.signInForm.markAsUntouched();

                    // Set the alert
                    this.alert = {
                        type   : 'error',
                        message: 'Wrong email or password'
                    };

                    // Show the alert
                    this.showAlert = true;
                }
            );
    }
}
