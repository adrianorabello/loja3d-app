import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, ReplaySubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { User, UserProfileUpdate } from 'app/core/user/user.model';

@Injectable({
    providedIn: 'root'
})
export class UserService
{
    private _user: ReplaySubject<User> = new ReplaySubject<User>(1);
    private _currentUser: User | null = null;
    private _sessionVersion = 0;

    get sessionVersion(): number
    {
        return this._sessionVersion;
    }

    /**
     * Constructor
     */
    constructor(private _httpClient: HttpClient)
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Setter & getter for user
     *
     * @param value
     */
    set user(value: User)
    {
        if ( this._currentUser?.id !== value?.id ) { this._sessionVersion++; }
        this._currentUser = value;
        // Store the value
        this._user.next(value);
    }

    get user$(): Observable<User>
    {
        return this._user.asObservable();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Update the user
     *
     * @param user
     */
    update(user: User): Observable<User>
    {
        return this._httpClient.patch<User>('api/common/user', {user}).pipe(
            tap((response) => {
                this.user = response;
            })
        );
    }

    getProfile(): Observable<User>
    {
        const session = this.sessionVersion;
        return this._httpClient.get<User>('api/v1/users/me').pipe(tap(user => this.acceptResponse(user, session)));
    }

    updateProfile(profile: UserProfileUpdate): Observable<User>
    {
        const session = this.sessionVersion;
        return this._httpClient.patch<User>('api/v1/users/me', profile).pipe(tap(user => this.acceptResponse(user, session)));
    }

    acceptResponse(user: User, session: number): void
    {
        // A response started in an old session must not sign that user back in after logout.
        if ( session !== this.sessionVersion )
        {
            throw new HttpErrorResponse({status: 401, statusText: 'Session changed'});
        }
        this.user = user;
    }
}
