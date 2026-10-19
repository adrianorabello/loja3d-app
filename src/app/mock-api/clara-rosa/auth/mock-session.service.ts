import { Injectable } from '@angular/core';
import { cloneDeep } from 'lodash-es';
import { User, UserAddress } from 'app/core/user/user.model';
import { credentials, MockCredential } from 'app/mock-api/clara-rosa/auth/data';
import { user as adminUser } from 'app/mock-api/common/user/data';

/**
 * DEVELOPMENT-ONLY. Holds the mock backend's notion of "who is signed in".
 *
 * Fuse's `AuthMockApi` and `UserMockApi` each kept their own private copy of the one
 * hardcoded user, which was fine when exactly one user existed. With two roles it is
 * a bug: a CUSTOMER signing in would still have `GET api/common/user` answer with the
 * ADMIN record, silently escalating them on any screen that reads from that endpoint.
 *
 * This service is the single seam both handlers share, so the signed-in identity stays
 * consistent across every mock endpoint. It is registered in `mockApiServices` only so
 * the Fuse `APP_INITIALIZER` instantiates it eagerly, alongside the handlers that use it.
 */
@Injectable({
    providedIn: 'root'
})
export class MockSessionService
{
    /**
     * Defaults to the admin account so the app has a coherent user before any sign-in —
     * matching the shipped Fuse behaviour.
     */
    private _currentUser: User = adminUser;

    /**
     * Also mutable: sign-up appends to it, so a newly created account can sign in again
     * within the same page session.
     */
    private _credentials: MockCredential[] = cloneDeep(credentials);

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for the signed-in user
     */
    get currentUser(): User
    {
        return this._currentUser;
    }

    /**
     * Setter for the signed-in user
     */
    set currentUser(value: User)
    {
        this._currentUser = value;
    }

    /**
     * Update the profile bound to the active mock session. Identity and role are never
     * taken from the request, and changed email addresses remain usable for this session.
     *
     * @param profile
     */
    updateCurrentUserProfile(
        profile: Partial<Pick<User, 'name' | 'email' | 'dateOfBirth' | 'addresses'>>
    ): User | null
    {
        const email = (profile.email ?? this._currentUser.email).trim();
        const duplicateEmail = this._credentials.some(candidate =>
            candidate.user.id !== this._currentUser.id
            && candidate.email.toLowerCase() === email.toLowerCase()
        );

        if ( duplicateEmail )
        {
            return null;
        }

        this._currentUser = {
            ...this._currentUser,
            ...cloneDeep(profile),
            id   : this._currentUser.id,
            email,
            role : this._currentUser.role
        };

        const credential = this._credentials.find(item => item.user.id === this._currentUser.id);

        if ( credential )
        {
            credential.email = email;
            credential.user = cloneDeep(this._currentUser);
        }

        return cloneDeep(this._currentUser);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Find a user by email and password. Returns null when no match exists.
     *
     * Email comparison is case-insensitive and trimmed, because a demo that rejects
     * " Admin@ClaraRosa.pt " is just annoying.
     *
     * @param email
     * @param password
     */
    findByCredentials(email: string, password: string): User | null
    {
        const normalized = (email ?? '').trim().toLowerCase();

        const match = this._credentials.find(
            credential => credential.email.toLowerCase() === normalized && credential.password === password
        );

        return match ? cloneDeep(match.user) : null;
    }

    /**
     * Find a user by id — used to resolve the subject of a refreshed token, so a
     * session is restored as the right user rather than as whoever is hardcoded.
     *
     * @param id
     */
    findById(id: string): User | null
    {
        const match = this._credentials.find(credential => credential.user.id === id);

        return match ? cloneDeep(match.user) : null;
    }

    /**
     * Whether an email is already registered.
     *
     * @param email
     */
    emailExists(email: string): boolean
    {
        const normalized = (email ?? '').trim().toLowerCase();

        return this._credentials.some(credential => credential.email.toLowerCase() === normalized);
    }

    /**
     * Register a new CUSTOMER and return it.
     *
     * New accounts are always CUSTOMER — self-service admin registration would be an
     * obvious hole even in a mock.
     *
     * @param name
     * @param email
     * @param password
     * @param id
     */
    register(name: string, email: string, password: string, id: string): User
    {
        const user: User = {
            id,
            name,
            email : email.trim(),
            status: 'online',
            role  : 'CUSTOMER'
        };

        this._credentials.push({email: user.email, password, user});

        return cloneDeep(user);
    }
}
