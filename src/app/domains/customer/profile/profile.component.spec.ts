import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { MatDialog } from '@angular/material/dialog';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AuthService } from 'app/core/auth/auth.service';
import { AuthInterceptor } from 'app/core/auth/auth.interceptor';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.model';
import { CustomerProfileModule } from './profile.module';
import { CustomerProfileComponent } from './profile.component';

describe('Customer profile editing', () => {
    let fixture: ComponentFixture<CustomerProfileComponent>;
    let component: CustomerProfileComponent;
    let http: HttpTestingController;
    let users: UserService;
    const user: User = {
        id: '1', name: 'Ana', email: 'ana@example.com', role: 'CUSTOMER', avatar: null,
        phone: '+351912345678', phoneCountry: 'PT', dateOfBirth: '1995-01-01',
        addresses: [{id: 'home', label: 'Home', street: 'Main street', postalCode: '4000-001', city: 'Porto', country: 'Portugal'}]
    };
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [CustomerProfileModule, HttpClientTestingModule, RouterTestingModule, TranslateModule.forRoot(),
                NoopAnimationsModule, MatIconTestingModule],
            providers: [AuthService, {provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true}]
        });
        users = TestBed.inject(UserService);
        http = TestBed.inject(HttpTestingController);
        fixture = TestBed.createComponent(CustomerProfileComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });
    afterEach(() => {
        fixture.destroy();
        http.verify();
    });

    function loaded(): void
    {
        http.expectOne('api/v1/users/me').flush(user);
        fixture.detectChanges();
    }

    it('loads real data, keeps email read-only and preserves dirty data on external updates', () => {
        expect(component.isLoading).toBeTrue();
        loaded();
        expect(component.profileForm.value.name).toBe('Ana');
        expect(fixture.nativeElement.querySelector('input[type=email]').readOnly).toBeTrue();
        component.profileForm.patchValue({name: 'My draft'});
        component.profileForm.markAsDirty();
        users.user = {...user, name: 'Server name'};
        expect(component.profileForm.value.name).toBe('My draft');
        component.cancelProfile();
        expect(component.profileForm.value.name).toBe('Server name');
        expect(component.profileForm.pristine).toBeTrue();
    });

    it('surfaces initial loading errors and retries the GET', () => {
        http.expectOne('api/v1/users/me').flush({}, {status: 503, statusText: 'Unavailable'});
        fixture.detectChanges();
        expect(component.loadError).toBe('customerAccount.loadError');
        expect(fixture.nativeElement.querySelector('[formControlName=name]')).toBeNull();
        component.loadProfile();
        loaded();
        expect(component.loadError).toBeNull();
    });

    it('does not carry a dirty profile or staged addresses into another account', () => {
        loaded();
        component.profileForm.patchValue({name: 'Private draft'});
        component.profileForm.markAsDirty();
        component.addressDirty = true;
        users.user = {...user, id: '2', name: 'Another account', addresses: []};
        expect(component.profileForm.value.name).toBe('Another account');
        expect(component.profileForm.pristine).toBeTrue();
        expect(component.addresses).toEqual([]);
        expect(component.addressDirty).toBeFalse();
    });

    it('validates trimmed names, dates and phone numbers before sending', () => {
        loaded();
        for (const name of [' ', 'A', 'a'.repeat(101)])
        {
            component.profileForm.patchValue({name});
            component.saveProfile();
            http.expectNone(req => req.method === 'PATCH');
        }
        component.profileForm.patchValue({name: 'Valid Name'});
        for (const dateOfBirth of ['1899-01-01', '2999-01-01', '2026-02-30'])
        {
            component.profileForm.patchValue({dateOfBirth});
            component.saveProfile();
            http.expectNone(req => req.method === 'PATCH');
        }
        component.profileForm.patchValue({dateOfBirth: '', phone: {phone: '123', phoneCountry: 'PT'}});
        component.saveProfile();
        http.expectNone(req => req.method === 'PATCH');
        expect(component.profileForm.get('phone').invalid).toBeTrue();
    });

    it('sends only allowed fields, prevents duplicate sends and synchronizes confirmed data', () => {
        loaded();
        component.profileForm.patchValue({name: '  Ana Updated  ', dateOfBirth: '', phone: null});
        component.saveProfile();
        component.saveProfile();
        const request = http.expectOne(req => req.method === 'PATCH');
        expect(request.request.body).toEqual({
            name: 'Ana Updated', dateOfBirth: null, phone: null, phoneCountry: null, addresses: user.addresses
        });
        expect(component.profileForm.disabled).toBeTrue();
        request.flush({...user, name: 'Ana Updated', phone: null, phoneCountry: null, dateOfBirth: null});
        expect(component.profileForm.value.name).toBe('Ana Updated');
        expect(component.profileForm.pristine).toBeTrue();
        expect(component.isSaving).toBeFalse();
        expect(component.saveSuccess).toBe('customerAccount.saved');
    });

    it('preserves data on server errors and associates 422 errors with fields', () => {
        loaded();
        component.profileForm.patchValue({name: 'My draft'});
        component.profileForm.markAsDirty();
        component.saveProfile();
        http.expectOne(req => req.method === 'PATCH').flush({detail: [{loc: ['body', 'name'], msg: 'Invalid'}]},
            {status: 422, statusText: 'Unprocessable'});
        expect(component.profileForm.value.name).toBe('My draft');
        expect(component.profileForm.get('name').hasError('server')).toBeTrue();
        expect(component.profileForm.enabled).toBeTrue();
        component.profileForm.get('name').setValue('Corrected');
        component.saveProfile();
        http.expectOne(req => req.method === 'PATCH').flush({...user, name: 'Corrected'});
        expect(component.saveSuccess).toBeTruthy();
    });

    it('keeps the draft on expired session without reloading or publishing success', () => {
        loaded();
        component.profileForm.patchValue({name: 'My draft'});
        component.saveProfile();
        http.expectOne(req => req.method === 'PATCH').flush({}, {status: 401, statusText: 'Unauthorized'});
        expect(component.sessionExpired).toBeTrue();
        expect(component.profileForm.value.name).toBe('My draft');
        expect(component.saveSuccess).toBeNull();
    });

    it('stages address changes and cancels back to the server snapshot', () => {
        loaded();
        component.startAddAddress();
        component.addressForm.patchValue({label: ' Work ', street: ' Street ', postalCode: '1000-001', city: 'Lisboa'});
        component.saveAddress();
        expect(component.addresses.length).toBe(2);
        expect(component.addresses[1].label).toBe('Work');
        http.expectNone(req => req.method === 'PATCH');
        component.cancelProfile();
        expect(component.addresses).toEqual(user.addresses);
        expect(component.addressDirty).toBeFalse();
    });

    it('does not silently discard an unfinished address editor', () => {
        loaded();
        component.startAddAddress();
        component.saveProfile();
        expect(component.saveError).toBe('customerAccount.finishAddress');
        http.expectNone(req => req.method === 'PATCH');
    });

    it('rejects invalid file types before reading and previews a valid selection without uploading', () => {
        loaded();
        const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type=file]');
        Object.defineProperty(input, 'files', {configurable: true, value: [new File(['svg'], 'bad.svg', {type: 'image/svg+xml'})]});
        component.selectPhoto(input);
        expect(component.photoError).toBe('customerAccount.photoTypeError');
        const image = document.createElement('img');
        spyOn(window, 'Image').and.returnValue(image);
        spyOn(URL, 'createObjectURL').and.returnValue('blob:preview');
        spyOn(URL, 'revokeObjectURL');
        const file = new File(['image'], 'photo.png', {type: 'image/png'});
        Object.defineProperty(input, 'files', {value: [file]});
        component.selectPhoto(input);
        image.onload.call(image, new Event('load'));
        expect(TestBed.inject(DomSanitizer).sanitize(SecurityContext.URL, component.previewUrl)).toBe('blob:preview');
        expect(component.selectedPhoto).toBe(file);
        http.expectNone(req => req.method === 'POST');
        component.cancelPhoto();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
        expect(component.selectedPhoto).toBeNull();
    });

    it('preserves photo selection and personal draft on upload failure and allows retry', () => {
        loaded();
        component.profileForm.patchValue({name: 'My draft'});
        component.profileForm.markAsDirty();
        component.selectedPhoto = new File(['image'], 'photo.png', {type: 'image/png'});
        component.savePhoto();
        component.savePhoto();
        http.expectOne(req => req.method === 'POST').flush({}, {status: 503, statusText: 'Unavailable'});
        expect(component.selectedPhoto).not.toBeNull();
        expect(component.photoError).toBe('customerAccount.photoSaveError');
        expect(component.isPhotoSaving).toBeFalse();
        component.savePhoto();
        http.expectOne(req => req.method === 'POST').flush({...user, avatar: 'assets/images/logo/printoy-purple.svg'});
        fixture.detectChanges();
        expect(component.profileForm.value.name).toBe('My draft');
        expect(component.selectedPhoto).toBeNull();
        expect(component.photoSuccess).toBe('customerAccount.photoSaved');
    });

    it('removes only after confirmation and updates the default avatar', () => {
        loaded();
        users.user = {...user, avatar: 'assets/current.jpg'};
        spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({
            afterClosed: () => of(true)
        } as ReturnType<MatDialog['open']>);
        component.removePhoto();
        const request = http.expectOne(req => req.method === 'DELETE');
        request.flush({...user, avatar: null});
        expect(component.user.avatar).toBeNull();
        expect(component.photoSuccess).toBe('customerAccount.photoRemoved');
    });
});
