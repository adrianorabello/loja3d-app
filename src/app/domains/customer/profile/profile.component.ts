import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { filter, finalize, takeUntil } from 'rxjs/operators';
import { UserService } from 'app/core/user/user.service';
import { User, UserAddress, UserProfileUpdate } from 'app/core/user/user.model';
import { UserAvatarService, validateAvatar } from 'app/core/user/user-avatar.service';
import { ConfirmDialogComponent, ConfirmDialogData } from 'app/shared/components/confirm-dialog/confirm-dialog.component';

@Component({
    selector     : 'customer-profile',
    templateUrl  : './profile.component.html',
    encapsulation: ViewEncapsulation.None
})
export class CustomerProfileComponent implements OnInit, OnDestroy
{
    profileForm: FormGroup;
    addressForm: FormGroup;
    user: User;
    addresses: UserAddress[] = [];
    isLoading: boolean = true;
    isSaving: boolean = false;
    showAddressForm: boolean = false;
    editingAddressId: string | null = null;
    saveError: string;
    saveSuccess: string;
    loadError: string;
    photoError: string;
    photoSuccess: string;
    previewUrl: SafeUrl;
    selectedPhoto: File;
    isPhotoSaving = false;
    isPhotoReading = false;
    sessionExpired = false;
    addressDirty = false;
    readonly today: string = new Date().toISOString().slice(0, 10);

    private _addressSequence: number = 0;
    private _unsubscribeAll: Subject<void> = new Subject<void>();
    private _confirmed: User;
    private _photoSequence = 0;
    private _previewObjectUrl: string;

    constructor(
        private _formBuilder: FormBuilder,
        private _matDialog: MatDialog,
        private _userService: UserService,
        public avatars: UserAvatarService,
        private _sanitizer: DomSanitizer
    )
    {
    }

    ngOnInit(): void
    {
        this.profileForm = this._formBuilder.group({
            name       : ['', [control => {
                const value = typeof control.value === 'string' ? control.value.trim() : '';
                return !value ? {required: true} : value.length < 2 || value.length > 100 ? {nameLength: true} : null;
            }]],
            email      : ['', [Validators.required, Validators.email]],
            dateOfBirth: ['', (control: AbstractControl): ValidationErrors | null => {
                if ( !control.value ) { return null; }
                const value = String(control.value);
                const date = new Date(value + 'T00:00:00Z');
                return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(date.getTime())
                    && date.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= this.today
                    ? null : {birthDate: true};
            }],
            phone      : [null]
        });
        this.addressForm = this._formBuilder.group({
            label     : ['', Validators.required],
            street    : ['', Validators.required],
            unit      : [''],
            postalCode: ['', Validators.required],
            city      : ['', Validators.required],
            country   : ['Portugal', Validators.required]
        });

        this._userService.user$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user) => {
                if ( !user ) { return; }
                const identityChanged = this.user && this.user.id !== user.id;
                this.user = user;
                this._confirmed = {...user, addresses: (user.addresses ?? []).map(address => ({...address}))};
                if ( identityChanged )
                {
                    this.resetPhotoSelection();
                    this.saveError = null;
                    this.saveSuccess = null;
                    this.sessionExpired = false;
                    this.restoreProfile();
                }
                else if ( !this.isSaving && !this.profileForm.dirty && !this.addressDirty && !this.showAddressForm )
                {
                    this.restoreProfile();
                }
            });
        this.loadProfile();
    }

    ngOnDestroy(): void
    {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
        this.cancelPhoto();
    }

    loadProfile(): void
    {
        if ( this.isSaving || this.isPhotoSaving ) { return; }
        this.isLoading = true;
        this.loadError = null;
        this._userService.getProfile().pipe(
            finalize(() => this.isLoading = false),
            takeUntil(this._unsubscribeAll)
        ).subscribe(user => {
            this.user = user;
            this.sessionExpired = false;
        }, (error: HttpErrorResponse) => {
            this.loadError = 'customerAccount.loadError';
            this.sessionExpired = error.status === 401;
        });
    }

    cancelProfile(): void
    {
        if ( this.isSaving ) { return; }
        this.restoreProfile();
        this.saveError = null;
        this.saveSuccess = null;
    }

    private restoreProfile(): void
    {
        if ( !this._confirmed ) { return; }
        const user = this._confirmed;
        this.addresses = (user.addresses ?? []).map(address => ({...address}));
        this.profileForm.reset({
            name: user.name, email: user.email, dateOfBirth: user.dateOfBirth ?? '',
            phone: user.phone ? {phone: user.phone, phoneCountry: user.phoneCountry} : null
        });
        this.addressDirty = false;
        this.cancelAddressEdit();
    }

    saveProfile(): void
    {
        if ( this.isSaving || this.isPhotoSaving || this.sessionExpired ) { return; }
        this.saveError = null;
        this.saveSuccess = null;

        if ( this.profileForm.invalid || !this.user || this.showAddressForm )
        {
            this.profileForm.markAllAsTouched();
            if ( this.showAddressForm ) { this.saveError = 'customerAccount.finishAddress'; }

            return;
        }

        const {phone, name, dateOfBirth} = this.profileForm.getRawValue();
        const updatedUser: UserProfileUpdate = {
            name: name.trim(),
            dateOfBirth: dateOfBirth || null,
            phone       : phone?.phone ?? null,
            phoneCountry: phone?.phoneCountry ?? null,
            addresses: [...this.addresses]
        };

        this.isSaving = true;
        this.profileForm.disable();
        this.addressForm.disable();
        this._userService.updateProfile(updatedUser)
            .pipe(
                finalize(() => {
                    this.isSaving = false;
                    if ( this.profileForm.disabled ) { this.profileForm.enable(); }
                    if ( this.addressForm.disabled ) { this.addressForm.enable(); }
                }),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(
                () => {
                    this.restoreProfile();
                    this.saveSuccess = 'customerAccount.saved';
                },
                (error: HttpErrorResponse) => {
                    this.profileForm.enable();
                    this.addressForm.enable();
                    this.sessionExpired = error.status === 401;
                    this.saveError = error?.status === 409
                        ? 'customerAccount.emailTaken'
                        : 'customerAccount.saveError';
                    if ( error.status === 422 && Array.isArray(error.error?.detail) )
                    {
                        for (const detail of error.error.detail)
                        {
                            const loc: unknown = detail?.loc;
                            if ( Array.isArray(loc) && loc[0] === 'body' && typeof loc[1] === 'string' )
                            {
                                const control = this.profileForm.get(loc[1]);
                                if ( control ) { control.setErrors({...control.errors, server: true}); control.markAsTouched(); }
                            }
                        }
                    }
                }
            );
    }

    selectPhoto(input: HTMLInputElement): void
    {
        const file = input.files?.[0];
        input.value = '';
        if ( !file || this.isPhotoSaving || this.isSaving || this.sessionExpired ) { return; }
        const sequence = ++this._photoSequence;
        this.isPhotoReading = false;
        this.photoSuccess = null;
        this.photoError = validateAvatar(file);
        if ( this.photoError ) { return; }
        const url = URL.createObjectURL(file);
        const image = new Image();
        this.isPhotoReading = true;
        const reject = (): void => {
            URL.revokeObjectURL(url);
            if ( sequence !== this._photoSequence ) { return; }
            this.isPhotoReading = false;
            this.photoError = 'customerAccount.photoInvalid';
        };
        image.onerror = reject;
        image.onload = () => {
            if ( sequence !== this._photoSequence ) { URL.revokeObjectURL(url); return; }
            if ( image.naturalWidth * image.naturalHeight > 16000000 ) { reject(); return; }
            if ( this._previewObjectUrl ) { URL.revokeObjectURL(this._previewObjectUrl); }
            this._previewObjectUrl = url;
            this.previewUrl = this._sanitizer.bypassSecurityTrustUrl(url);
            this.selectedPhoto = file;
            this.isPhotoReading = false;
        };
        image.src = url;
    }

    cancelPhoto(): void
    {
        if ( this.isPhotoSaving ) { return; }
        this.resetPhotoSelection();
    }

    private resetPhotoSelection(): void
    {
        ++this._photoSequence;
        if ( this._previewObjectUrl ) { URL.revokeObjectURL(this._previewObjectUrl); }
        this._previewObjectUrl = null;
        this.previewUrl = null;
        this.selectedPhoto = null;
        this.isPhotoReading = false;
        this.photoError = null;
        this.photoSuccess = null;
    }

    savePhoto(): void
    {
        if ( !this.selectedPhoto || this.isPhotoSaving || this.isPhotoReading || this.isSaving || this.sessionExpired ) { return; }
        this.isPhotoSaving = true;
        this.photoError = null;
        this.avatars.upload(this.selectedPhoto).pipe(
            finalize(() => this.isPhotoSaving = false), takeUntil(this._unsubscribeAll)
        ).subscribe(() => {
            this.isPhotoSaving = false;
            this.cancelPhoto();
            this.photoSuccess = 'customerAccount.photoSaved';
        }, (error: HttpErrorResponse) => this.handlePhotoError(error));
    }

    removePhoto(): void
    {
        if ( !this.user?.avatar || this.isPhotoSaving || this.isSaving || this.sessionExpired ) { return; }
        const data: ConfirmDialogData = {
            titleKey: 'customerAccount.removePhoto', messageKey: 'customerAccount.removePhotoConfirm', confirmKey: 'common.delete'
        };
        this._matDialog.open(ConfirmDialogComponent, {data, autoFocus: false}).afterClosed().pipe(
            filter(confirmed => confirmed === true), takeUntil(this._unsubscribeAll)
        ).subscribe(() => {
            if ( this.isPhotoSaving || this.isSaving ) { return; }
            this.isPhotoSaving = true;
            this.photoError = null;
            this.photoSuccess = null;
            this.avatars.remove().pipe(
                finalize(() => this.isPhotoSaving = false), takeUntil(this._unsubscribeAll)
            ).subscribe(() => {
                this.isPhotoSaving = false;
                this.cancelPhoto();
                this.photoSuccess = 'customerAccount.photoRemoved';
            }, (error: HttpErrorResponse) => this.handlePhotoError(error));
        });
    }

    private handlePhotoError(error: HttpErrorResponse): void
    {
        this.sessionExpired = error.status === 401;
        this.photoError = error.status === 413 ? 'customerAccount.photoSizeError'
            : error.status === 415 ? 'customerAccount.photoTypeError'
            : error.status === 422 ? 'customerAccount.photoInvalid' : 'customerAccount.photoSaveError';
    }

    startAddAddress(): void
    {
        if ( this.isSaving ) { return; }
        this.editingAddressId = null;
        this.addressForm.reset({label: '', street: '', unit: '', postalCode: '', city: '', country: 'Portugal'});
        this.showAddressForm = true;
    }

    editAddress(address: UserAddress): void
    {
        if ( this.isSaving ) { return; }
        this.editingAddressId = address.id;
        this.addressForm.patchValue(address);
        this.showAddressForm = true;
    }

    cancelAddressEdit(): void
    {
        this.showAddressForm = false;
        this.editingAddressId = null;
        this.addressForm.reset({label: '', street: '', unit: '', postalCode: '', city: '', country: 'Portugal'});
    }

    saveAddress(): void
    {
        if ( this.isSaving ) { return; }
        for (const control of Object.values(this.addressForm.controls))
        {
            if ( typeof control.value === 'string' ) { control.setValue(control.value.trim()); }
        }
        if ( this.addressForm.invalid )
        {
            this.addressForm.markAllAsTouched();

            return;
        }

        const value = this.addressForm.getRawValue();

        if ( this.editingAddressId )
        {
            this.addresses = this.addresses.map(address =>
                address.id === this.editingAddressId ? {...value, id: address.id} : address
            );
        }
        else
        {
            this.addresses = [...this.addresses, {
                ...value,
                id: `address-${Date.now()}-${this._addressSequence++}`
            }];
        }

        this.cancelAddressEdit();
        this.addressDirty = true;
        this.saveSuccess = null;
        this.saveError = null;
    }

    removeAddress(address: UserAddress): void
    {
        if ( this.isSaving ) { return; }
        const data: ConfirmDialogData = {
            titleKey     : 'customerAccount.removeAddressTitle',
            messageKey   : 'customerAccount.removeAddressConfirm',
            messageParams: {label: address.label},
            confirmKey   : 'common.delete'
        };

        this._matDialog.open(ConfirmDialogComponent, {data, autoFocus: false})
            .afterClosed()
            .pipe(
                filter(confirmed => confirmed === true),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(() => {
                if ( this.isSaving ) { return; }
                this.addresses = this.addresses.filter(item => item.id !== address.id);
                this.addressDirty = true;

                if ( this.editingAddressId === address.id )
                {
                    this.cancelAddressEdit();
                }

                this.saveSuccess = null;
                this.saveError = null;
            });
    }

    trackByAddress(index: number, address: UserAddress): string
    {
        return address.id;
    }
}
