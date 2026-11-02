import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FuseValidators } from '@fuse/validators';
import { FuseAnimations } from '@fuse/animations';
import { FuseAlertType } from '@fuse/components/alert';
import { AuthService } from 'app/core/auth/auth.service';

@Component({
    selector     : 'auth-sign-up',
    templateUrl  : './sign-up.component.html',
    encapsulation: ViewEncapsulation.None,
    animations   : FuseAnimations
})
export class AuthSignUpComponent implements OnInit
{
    alert: { type: FuseAlertType, message: string } = {
        type   : 'success',
        message: ''
    };
    signUpForm: FormGroup;
    showAlert: boolean = false;

    /**
     * Constructor
     */
    constructor(
        private _authService: AuthService,
        private _formBuilder: FormBuilder,
        private _activatedRoute: ActivatedRoute,
        private _router: Router
    )
    {
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
        // The `company` field Fuse collected has been dropped — it has no meaning for a
        // consumer storefront, and `SignUpPayload` no longer carries it.
        this.signUpForm = this._formBuilder.group({
                name      : ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
                email     : ['', [Validators.required, Validators.email]],
                password  : ['', [Validators.required, Validators.minLength(8), Validators.maxLength(256)]],
                passwordConfirm: ['', Validators.required],
                phone     : [null],
                agreements: ['', Validators.requiredTrue]
            },
            {
                validators: FuseValidators.mustMatch('password', 'passwordConfirm')
            }
        );
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Sign up
     */
    signUp(): void
    {
        // Do nothing if the form is invalid
        if ( this.signUpForm.disabled || this.signUpForm.invalid )
        {
            this.signUpForm.markAllAsTouched();
            return;
        }

        // Disable the form
        this.signUpForm.disable();

        // Hide the alert
        this.showAlert = false;

        // Sign up
        const {name, email, password, passwordConfirm, phone} = this.signUpForm.value;

        this._authService.signUp({
            name, email, password, confirmPassword: passwordConfirm,
            ...(phone?.phone ? {phone: phone.phone, phoneCountry: phone.phoneCountry} : {})
        })
            .subscribe(
                () => {

                    const redirectURL = this._activatedRoute.snapshot.queryParamMap.get('redirectURL') || '/signed-in-redirect';
                    this._router.navigateByUrl(redirectURL);
                },
                (response) => {

                    // Re-enable the form
                    this.signUpForm.enable();

                    // Set the alert
                    this.alert = {
                        type   : 'error',
                        message: response?.status === 409
                            ? 'This email address is already registered.'
                            : 'Something went wrong, please try again.'
                    };

                    // Show the alert
                    this.showAlert = true;
                }
            );
    }
}
