import { CountryCode, getCountryCallingCode } from 'libphonenumber-js';

/** ISO 3166-1 alpha-2 codes offered in the selector: Europe (incl. UK), Latin America & Caribbean, USA. */
export const PHONE_REGIONS: CountryCode[] = [
    // Europe
    'AL', 'AD', 'AT', 'BY', 'BE', 'BA', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IS',
    'IE', 'IT', 'XK' as CountryCode, 'LV', 'LI', 'LT', 'LU', 'MT', 'MD', 'MC', 'ME', 'NL', 'MK', 'NO', 'PL', 'PT',
    'RO', 'SM', 'RS', 'SK', 'SI', 'ES', 'SE', 'CH', 'UA', 'GB', 'VA',
    // Latin America & Caribbean
    'AG', 'AR', 'BS', 'BB', 'BZ', 'BO', 'BR', 'CL', 'CO', 'CR', 'CU', 'DM', 'DO', 'EC', 'SV', 'GD', 'GT', 'GY',
    'HT', 'HN', 'JM', 'MX', 'NI', 'PA', 'PY', 'PE', 'PR', 'KN', 'LC', 'VC', 'SR', 'TT', 'UY', 'VE',
    // United States
    'US'
];

export interface PhoneCountry
{
    iso: CountryCode;
    name: string;
    dialCode: string;
    flag: string;
}

const flagOf = (iso: string): string =>
    iso.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));

export function buildPhoneCountries(locale: string): PhoneCountry[]
{
    let names: { of(code: string): string | undefined } | null = null;
    try
    {
        names = new (Intl as any).DisplayNames([locale], {type: 'region'});
    }
    catch
    {
        names = null;
    }

    const countries: PhoneCountry[] = [];
    for ( const iso of PHONE_REGIONS )
    {
        let dialCode: string;
        try
        {
            dialCode = getCountryCallingCode(iso);
        }
        catch
        {
            continue;
        }
        countries.push({iso, name: names?.of(iso) ?? iso, dialCode, flag: flagOf(iso)});
    }

    return countries.sort((a, b) => a.name.localeCompare(b.name, locale));
}
