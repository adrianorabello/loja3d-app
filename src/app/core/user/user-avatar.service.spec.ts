import { TestBed } from '@angular/core/testing';
import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AvatarState, MAX_AVATAR_BYTES, UserAvatarService, validateAvatar } from './user-avatar.service';
import { UserService } from './user.service';
import { User } from './user.model';

describe('UserAvatarService', () => {
    let http: HttpTestingController;
    let avatars: UserAvatarService;
    let users: UserService;
    const user: User = {id: '1', name: 'Ana', email: 'ana@example.com', role: 'CUSTOMER', avatar: 'api/v1/users/me/avatar?v=one', avatarVersion: 'one'};

    beforeEach(() => {
        TestBed.configureTestingModule({imports: [HttpClientTestingModule]});
        http = TestBed.inject(HttpTestingController);
        avatars = TestBed.inject(UserAvatarService);
        users = TestBed.inject(UserService);
        spyOn(URL, 'createObjectURL').and.returnValues('blob:one', 'blob:two');
        spyOn(URL, 'revokeObjectURL');
    });
    afterEach(() => http.verify());

    it('enforces the exact file size and type limits', () => {
        expect(MAX_AVATAR_BYTES).toBe(10 * 1024 * 1024);
        expect(validateAvatar({type: 'image/png', size: 2 * 1024 * 1024 + 1})).toBeNull();
        expect(validateAvatar({type: 'image/jpeg', size: MAX_AVATAR_BYTES})).toBeNull();
        expect(validateAvatar({type: 'image/png', size: 1})).toBeNull();
        expect(validateAvatar({type: 'image/png', size: 0})).toBe('customerAccount.photoSizeError');
        expect(validateAvatar({type: 'image/png', size: MAX_AVATAR_BYTES + 1})).toBe('customerAccount.photoSizeError');
        expect(validateAvatar({type: 'image/svg+xml', size: 100})).toBe('customerAccount.photoTypeError');
    });

    it('downloads once for all views and invalidates/revokes on replacement and sign-out', () => {
        let state: AvatarState;
        const a = avatars.state$.subscribe(value => state = value);
        const b = avatars.state$.subscribe();
        users.user = user;
        expect(state.loading).toBeTrue();
        const first = http.expectOne(req => req.url === 'api/v1/users/me/avatar' && req.params.get('v') === 'one');
        expect(first.request.responseType).toBe('blob');
        first.flush(new Blob(['image'], {type: 'image/jpeg'}));
        expect(TestBed.inject(DomSanitizer).sanitize(SecurityContext.URL, state.url)).toBe('blob:one');
        expect(URL.revokeObjectURL).not.toHaveBeenCalled();
        users.user = {...user, name: 'Ana Updated'};
        http.expectNone('api/v1/users/me/avatar');
        users.user = {...user, avatarVersion: 'two'};
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:one');
        http.expectOne(req => req.params.get('v') === 'two').flush(new Blob(['image']));
        users.user = null;
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:two');
        expect(state.url).toBeNull();
        a.unsubscribe();
        b.unsubscribe();
    });

    it('revokes when the last view leaves and cancels pending requests on user changes', () => {
        users.user = user;
        const subscription = avatars.state$.subscribe();
        const pending = http.expectOne(req => req.params.get('v') === 'one');
        users.user = {...user, id: '2', avatarVersion: 'other'};
        expect(pending.cancelled).toBeTrue();
        http.expectOne(req => req.params.get('v') === 'other').flush(new Blob(['image']));
        subscription.unsubscribe();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:one');
    });

    it('shows explicit loading failures and retries without changing the stored user', () => {
        spyOn(console, 'error');
        let state: AvatarState;
        const subscription = avatars.state$.subscribe(value => state = value);
        users.user = user;
        http.expectOne(req => req.url.endsWith('/avatar')).flush(new Blob(), {status: 503, statusText: 'Unavailable'});
        expect(state.error).toBeTrue();
        expect(console.error).toHaveBeenCalled();
        avatars.retry();
        http.expectOne(req => req.url.endsWith('/avatar')).flush(new Blob(['image']));
        expect(state.error).toBeFalse();
        expect(TestBed.inject(DomSanitizer).sanitize(SecurityContext.URL, state.url)).toBe('blob:one');
        subscription.unsubscribe();
    });

    it('sends multipart without setting Content-Type and publishes only successful responses', () => {
        let current: User;
        users.user$.subscribe(value => current = value);
        users.user = {...user, avatarVersion: null, avatar: null};
        const file = new File(['image'], 'photo.png', {type: 'image/png'});
        avatars.upload(file).subscribe();
        const request = http.expectOne('api/v1/users/me/avatar');
        expect(request.request.body instanceof FormData).toBeTrue();
        expect(request.request.body.get('file')).toEqual(file);
        expect(request.request.headers.has('Content-Type')).toBeFalse();
        expect(current.avatar).toBeNull();
        request.flush(user);
        expect(current.avatarVersion).toBe('one');
        avatars.remove().subscribe();
        const removal = http.expectOne('api/v1/users/me/avatar');
        expect(removal.request.method).toBe('DELETE');
        removal.flush({...user, avatar: null, avatarVersion: null});
        expect(current.avatar).toBeNull();
    });

    it('does not resurrect a logged-out user when an old upload response arrives', () => {
        let current: User;
        users.user$.subscribe(value => current = value);
        users.user = user;
        let status: number;
        avatars.upload(new File(['image'], 'photo.png', {type: 'image/png'}))
            .subscribe({error: error => status = error.status});
        const pending = http.expectOne('api/v1/users/me/avatar');
        users.user = null;
        pending.flush(user);
        expect(status).toBe(401);
        expect(current).toBeNull();
    });

    it('rejects a late profile update after the authenticated account changes', () => {
        let current: User;
        users.user$.subscribe(value => current = value);
        users.user = user;
        let status: number;
        users.updateProfile({name: 'Updated', dateOfBirth: null, phone: null, phoneCountry: null, addresses: []})
            .subscribe({error: error => status = error.status});
        const pending = http.expectOne('api/v1/users/me');
        users.user = {...user, id: '2', name: 'Other account'};
        pending.flush({...user, name: 'Updated'});
        expect(status).toBe(401);
        expect(current.id).toBe('2');
        expect(current.name).toBe('Other account');
    });
});
