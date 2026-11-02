import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { concat, defer, NEVER, Observable, of, Subject } from 'rxjs';
import { catchError, distinctUntilChanged, finalize, map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import { User } from './user.model';
import { UserService } from './user.service';

export interface AvatarState
{
    url: string | SafeUrl | null;
    loading: boolean;
    error: boolean;
}

export const MAX_AVATAR_BYTES = 10 * 1024 * 1024;

export function validateAvatar(file: Pick<File, 'size' | 'type'>): string | null
{
    if ( !['image/jpeg', 'image/png'].includes(file.type) ) { return 'customerAccount.photoTypeError'; }
    if ( !file.size || file.size > MAX_AVATAR_BYTES ) { return 'customerAccount.photoSizeError'; }
    return null;
}

@Injectable({providedIn: 'root'})
export class UserAvatarService
{
    readonly state$: Observable<AvatarState>;
    private _retry = new Subject<void>();

    constructor(private _http: HttpClient, private _users: UserService, private _sanitizer: DomSanitizer)
    {
        this.state$ = this._users.user$.pipe(
            distinctUntilChanged((a, b) => a?.id === b?.id && a?.avatar === b?.avatar && a?.avatarVersion === b?.avatarVersion),
            switchMap(user => this._retry.pipe(startWith(undefined), switchMap(() => this.load(user)))),
            shareReplay({bufferSize: 1, refCount: true})
        );
    }

    retry(): void
    {
        this._retry.next();
    }

    upload(file: File): Observable<User>
    {
        const session = this._users.sessionVersion;
        const body = new FormData();
        body.append('file', file, file.name);
        return this._http.post<User>('api/v1/users/me/avatar', body).pipe(tap(user => this._users.acceptResponse(user, session)));
    }

    remove(): Observable<User>
    {
        const session = this._users.sessionVersion;
        return this._http.delete<User>('api/v1/users/me/avatar').pipe(tap(user => this._users.acceptResponse(user, session)));
    }

    private load(user: User | null): Observable<AvatarState>
    {
        if ( !user?.avatarVersion )
        {
            return of({url: user?.avatar || null, loading: false, error: false});
        }
        return defer(() => {
            let url: string;
            return concat(this._http.get('api/v1/users/me/avatar', {
                params: {v: user.avatarVersion}, responseType: 'blob'
            }).pipe(
                map(blob => {
                    url = URL.createObjectURL(blob);
                    return {url: this._sanitizer.bypassSecurityTrustUrl(url), loading: false, error: false};
                }),
                catchError((error: unknown) => {
                    console.error('Could not load the profile photo.', error);
                    return of({url: null, loading: false, error: true});
                }),
                startWith({url: null, loading: true, error: false})
            ), NEVER).pipe(
                // The URL remains valid until this user/version is replaced or no view uses it.
                finalize(() => {
                    if ( url ) { URL.revokeObjectURL(url); }
                })
            );
        });
    }
}
