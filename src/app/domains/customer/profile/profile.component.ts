import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { filter, finalize, takeUntil } from 'rxjs/operators';
import { UserService } from 'app/core/user/user.service';
import { User, UserAddress } from 'app/core/user/user.model';
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
    readonly today: string = new Date().toISOString().slice(0, 10);

    private _addressSequence: number = 0;
    private _unsubscribeAll: Subject<void> = new Subject<void>();

    constructor(
        private _formBuilder: FormBuilder,
        private _matDialog: MatDialog,
        private _userService: UserService
    )
    {
    }

    ngOnInit(): void
    {
        this.profileForm = this._formBuilder.group({
            name       : ['', Validators.required],
            email      : ['', [Validators.required, Validators.email]],
            dateOfBirth: [''],
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
                this.user = user;
                this.addresses = [...(user.addresses ?? [])];
                this.profileForm.patchValue({
                    name       : user.name,
                    email      : user.email,
                    dateOfBirth: user.dateOfBirth ?? '',
                    phone      : user.phone ? {phone: user.phone, phoneCountry: user.phoneCountry} : null
                });
                this.isLoading = false;
            });
    }

    ngOnDestroy(): void
    {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    saveProfile(): void
    {
        this.saveError = null;
        this.saveSuccess = null;

        if ( this.profileForm.invalid || !this.user )
        {
            this.profileForm.markAllAsTouched();

            return;
        }

        const {phone, ...profileValues} = this.profileForm.getRawValue();
        const updatedUser: User = {
            ...this.user,
            ...profileValues,
            phone       : phone?.phone ?? null,
            phoneCountry: phone?.phoneCountry ?? null,
            addresses: [...this.addresses]
        };

        this.isSaving = true;
        this._userService.update(updatedUser)
            .pipe(
                finalize(() => this.isSaving = false),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(
                () => this.saveSuccess = 'customerAccount.saved',
                (error: HttpErrorResponse) => {
                    this.saveError = error?.status === 409
                        ? 'customerAccount.emailTaken'
                        : 'customerAccount.saveError';
                }
            );
    }

    startAddAddress(): void
    {
        this.editingAddressId = null;
        this.addressForm.reset({label: '', street: '', unit: '', postalCode: '', city: '', country: 'Portugal'});
        this.showAddressForm = true;
    }

    editAddress(address: UserAddress): void
    {
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
        this.saveSuccess = null;
        this.saveError = null;
    }

    removeAddress(address: UserAddress): void
    {
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
                this.addresses = this.addresses.filter(item => item.id !== address.id);

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
