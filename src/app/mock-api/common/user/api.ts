import { Injectable } from '@angular/core';
import { cloneDeep } from 'lodash-es';
import { FuseMockApiService } from '@fuse/lib/mock-api';
import { MockSessionService } from 'app/mock-api/clara-rosa/auth/mock-session.service';
import { User } from 'app/core/user/user.model';

@Injectable({
    providedIn: 'root'
})
export class UserMockApi
{
    /**
     * Constructor
     *
     * Reads the signed-in user from `MockSessionService` rather than keeping a private
     * copy of the one hardcoded account. Without this, `GET api/common/user` would answer
     * with the ADMIN record no matter who actually signed in.
     */
    constructor(
        private _fuseMockApiService: FuseMockApiService,
        private _mockSessionService: MockSessionService
    )
    {
        // Register Mock API handlers
        this.registerHandlers();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Register Mock API handlers
     */
    registerHandlers(): void
    {
        // -----------------------------------------------------------------------------------------------------
        // @ User - GET
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onGet('api/common/user')
            .reply(() => [200, cloneDeep(this._mockSessionService.currentUser)]);

        // -----------------------------------------------------------------------------------------------------
        // @ User - PATCH
        // -----------------------------------------------------------------------------------------------------
        this._fuseMockApiService
            .onPatch('api/common/user')
            .reply(({request}) => {

                const user: Partial<User> = cloneDeep(request.body.user);
                const updated = this._mockSessionService.updateCurrentUserProfile({
                    name       : user.name,
                    email      : user.email,
                    dateOfBirth: user.dateOfBirth,
                    addresses  : user.addresses
                });

                return updated
                    ? [200, updated]
                    : [409, {error: 'Email already in use'}];
            });
    }
}
