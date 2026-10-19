import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormBuilder, FormGroup, NgForm, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
    @ViewChild('signUpNgForm') signUpNgForm: NgForm;

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
                name      : ['', Validators.required],
                email     : ['', [Validators.required, Validators.email]],
                password  : ['', [Validators.required, Validators.minLength(8)]],
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
        if ( this.signUpForm.invalid )
        {
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

                    // Sign-up now establishes a session, so send the new customer to the
                    // role-aware redirect rather than to the confirmation-required page
                    // (which was a dead end: the old mock returned no token).
                    this._router.navigateByUrl('/signed-in-redirect');
                },
                (response) => {

                    // Re-enable the form
                    this.signUpForm.enable();

                    // Reset the form
                    this.signUpNgForm.resetForm();

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
