import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FuseAnimations } from '@fuse/animations';
import { AuthService } from 'app/core/auth/auth.service';

export type ConfirmationState = 'pending' | 'verifying' | 'verified' | 'failed';

@Component({
    selector     : 'auth-confirmation-required',
    templateUrl  : './confirmation-required.component.html',
    encapsulation: ViewEncapsulation.None,
    animations   : FuseAnimations
})
export class AuthConfirmationRequiredComponent implements OnInit
{
    state: ConfirmationState = 'pending';

    constructor(
        private _route: ActivatedRoute,
        private _authService: AuthService
    )
    {
    }

    ngOnInit(): void
    {
        const token = this._route.snapshot.queryParamMap.get('token');
        if ( !token )
        {
            return;
        }

        this.state = 'verifying';
        this._authService.verifyEmail(token).subscribe(
            () => this.state = 'verified',
            () => this.state = 'failed'
        );
    }
}
