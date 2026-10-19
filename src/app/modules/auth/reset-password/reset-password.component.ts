import { Component, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, NgForm, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';
import { FuseAnimations } from '@fuse/animations';
import { FuseValidators } from '@fuse/validators';
import { FuseAlertType } from '@fuse/components/alert';
import { AuthService } from 'app/core/auth/auth.service';

@Component({
    selector     : 'auth-reset-password',
    templateUrl  : './reset-password.component.html',
    encapsulation: ViewEncapsulation.None,
    animations   : FuseAnimations
})
export class AuthResetPasswordComponent implements OnInit
{
    @ViewChild('resetPasswordNgForm') resetPasswordNgForm: NgForm;

    alert: { type: FuseAlertType, message: string } = {
        type   : 'success',
        message: ''
    };
    resetPasswordForm: FormGroup;
    showAlert: boolean = false;

    /**
     * Constructor
     */
    constructor(
        private _authService: AuthService,
        private _formBuilder: FormBuilder,
        private _route: ActivatedRoute
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
        // Create the form
        this.resetPasswordForm = this._formBuilder.group({
                password       : ['', [Validators.required, Validators.minLength(8)]],
                passwordConfirm: ['', Validators.required]
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
     * Reset password
     */
    resetPassword(): void
    {
        const token = this._route.snapshot.queryParamMap.get('token');
        if ( this.resetPasswordForm.invalid || !token )
        {
            if ( !token )
            {
                this.alert = {type: 'error', message: 'Link inválido ou expirado. Peça uma nova recuperação de senha.'};
                this.showAlert = true;
            }
            return;
        }

        // Disable the form
        this.resetPasswordForm.disable();

        // Hide the alert
        this.showAlert = false;

        // Send the request to the server
        this._authService.resetPassword(token, this.resetPasswordForm.get('password').value)
            .pipe(
                finalize(() => {

                    // Re-enable the form
                    this.resetPasswordForm.enable();

                    // Reset the form
                    this.resetPasswordNgForm.resetForm();

                    // Show the alert
                    this.showAlert = true;
                })
            )
            .subscribe(
                (response) => {

                    // Set the alert
                    this.alert = {
                        type   : 'success',
                        message: 'Senha redefinida com sucesso. Já pode iniciar sessão.'
                    };
                },
                (response) => {

                    // Set the alert
                    this.alert = {
                        type   : 'error',
                        message: 'Link inválido ou expirado. Peça uma nova recuperação de senha.'
                    };
                }
            );
    }
}
