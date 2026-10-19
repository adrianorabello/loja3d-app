import { Component, forwardRef, Input, OnInit } from '@angular/core';
import {
    AbstractControl, ControlValueAccessor, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator
} from '@angular/forms';
import { CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import { TranslateService } from '@ngx-translate/core';
import { buildPhoneCountries, PhoneCountry } from './phone-countries';

export interface PhoneValue
{
    phone: string;
    phoneCountry: string;
}

/**
 * Phone field with a country selector (searchable by country name or dial code).
 * Value is `{phone, phoneCountry}`; `phone` is E.164 whenever it can be parsed.
 * Validation uses libphonenumber-js metadata. Format validity is not ownership verification.
 */
@Component({
    selector : 'app-phone-input',
    templateUrl: './phone-input.component.html',
    providers: [
        {provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PhoneInputComponent), multi: true},
        {provide: NG_VALIDATORS, useExisting: forwardRef(() => PhoneInputComponent), multi: true}
    ]
})
export class PhoneInputComponent implements OnInit, ControlValueAccessor, Validator
{
    @Input() label: string;

    countries: PhoneCountry[] = [];
    filtered: PhoneCountry[] = [];
    country: CountryCode = 'PT';
    national: string = '';
    search: string = '';
    disabled: boolean = false;

    private _onChange: (value: PhoneValue | null) => void = () => {};
    private _onTouched: () => void = () => {};

    constructor(private _translate: TranslateService)
    {
    }

    ngOnInit(): void
    {
        this.countries = buildPhoneCountries(this._translate.currentLang || 'pt-BR');
        this.filtered = this.countries;
    }

    writeValue(value: PhoneValue | null): void
    {
        const parsed = value?.phone ? parsePhoneNumberFromString(value.phone) : undefined;
        if ( parsed )
        {
            this.country = (parsed.country ?? value.phoneCountry ?? this.country) as CountryCode;
            this.national = parsed.formatNational();
        }
        else
        {
            if ( value?.phoneCountry )
            {
                this.country = value.phoneCountry as CountryCode;
            }
            this.national = value?.phone ?? '';
        }
    }

    registerOnChange(fn: (value: PhoneValue | null) => void): void
    {
        this._onChange = fn;
    }

    registerOnTouched(fn: () => void): void
    {
        this._onTouched = fn;
    }

    setDisabledState(isDisabled: boolean): void
    {
        this.disabled = isDisabled;
    }

    validate(control: AbstractControl): ValidationErrors | null
    {
        const value: PhoneValue | null = control.value;
        if ( !value?.phone )
        {
            return null;
        }
        const parsed = parsePhoneNumberFromString(value.phone, value.phoneCountry as CountryCode);

        return parsed?.isValid() ? null : {phone: true};
    }

    filter(term: string): void
    {
        this.search = term;
        const q = term.trim().toLowerCase().replace(/^\+/, '');
        this.filtered = q
            ? this.countries.filter((c) => c.name.toLowerCase().includes(q) || c.dialCode.startsWith(q) || c.iso.toLowerCase() === q)
            : this.countries;
    }

    onCountryChange(iso: CountryCode): void
    {
        this.country = iso;
        this.emit();
    }

    onInput(value: string): void
    {
        this.national = value;
        // Pasting an international number switches the country automatically
        const parsed = value.trim().startsWith('+') ? parsePhoneNumberFromString(value) : undefined;
        if ( parsed?.country && this.countries.some((c) => c.iso === parsed.country) )
        {
            this.country = parsed.country;
        }
        this.emit();
    }

    touched(): void
    {
        this._onTouched();
    }

    trackByIso(_: number, country: PhoneCountry): string
    {
        return country.iso;
    }

    private emit(): void
    {
        const raw = this.national.trim();
        if ( !raw )
        {
            this._onChange(null);

            return;
        }
        const parsed = parsePhoneNumberFromString(raw, this.country);
        this._onChange({
            phone       : parsed?.isValid() ? parsed.number : raw,
            phoneCountry: parsed?.country ?? this.country
        });
    }
}
