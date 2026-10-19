import { FormControl } from '@angular/forms';
import { buildPhoneCountries } from './phone-countries';
import { PhoneInputComponent } from './phone-input.component';

describe('PhoneInputComponent', () => {
    const component = new PhoneInputComponent({currentLang: 'pt-PT'} as any);

    it('lists countries with dial codes from libphonenumber metadata', () => {
        const list = buildPhoneCountries('pt-PT');
        expect(list.find((c) => c.iso === 'PT').dialCode).toBe('351');
        expect(list.find((c) => c.iso === 'GB').dialCode).toBe('44');
        expect(list.find((c) => c.iso === 'US').dialCode).toBe('1');
        expect(list.find((c) => c.iso === 'CA')).toBeUndefined();
    });

    it('validates numbers by country and accepts empty', () => {
        expect(component.validate(new FormControl(null))).toBeNull();
        expect(component.validate(new FormControl({phone: '+351912345678', phoneCountry: 'PT'}))).toBeNull();
        expect(component.validate(new FormControl({phone: '123', phoneCountry: 'PT'}))).toEqual({phone: true});
    });

    it('emits E.164 and switches country when an international number is pasted', () => {
        component.ngOnInit();
        let emitted: any;
        component.registerOnChange((v) => emitted = v);
        component.onInput('+44 7400 123456');
        expect(component.country).toBe('GB');
        expect(emitted).toEqual({phone: '+447400123456', phoneCountry: 'GB'});
    });
});
