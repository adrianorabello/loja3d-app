import { Injectable } from '@angular/core';
import { assign, cloneDeep } from 'lodash-es';
import { FuseMockApiService } from '@fuse/lib/mock-api';
import { MockSessionService } from 'app/mock-api/clara-rosa/auth/mock-session.service';

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

                // Get the user mock-api
                const user = cloneDeep(request.body.user);

                // Update the user mock-api.
                //
                // `role` is stripped: letting a client PATCH its own role would make the
                // whole authorization model self-serve, even as a mock.
                delete user.role;

                this._mockSessionService.currentUser = assign({}, this._mockSessionService.currentUser, user);

                // Return the response
                return [200, cloneDeep(this._mockSessionService.currentUser)];
            });
    }
}
