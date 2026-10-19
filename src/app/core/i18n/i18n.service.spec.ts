import { I18nService } from 'app/core/i18n/i18n.service';
import { LANGUAGE_STORAGE_KEY } from 'app/core/i18n/i18n.types';

describe('I18nService', () => {

    let translate: { use: jasmine.Spy; addLangs: jasmine.Spy; setDefaultLang: jasmine.Spy };
    let doc: { documentElement: { lang: string } };
    let service: I18nService;

    beforeEach(() => {
        localStorage.clear();
        translate = {use: jasmine.createSpy('use'), addLangs: jasmine.createSpy('addLangs'), setDefaultLang: jasmine.createSpy('setDefaultLang')};
        doc = {documentElement: {lang: ''}};
        service = new I18nService(translate as any, doc);
    });

    afterEach(() => localStorage.clear());

    it('defaults to Portuguese (Brazil)', () => {
        service.init();
        expect(service.language).toBe('pt-BR');
        expect(doc.documentElement.lang).toBe('pt-BR');
    });

    it('switches language, persists it and updates <html lang>', () => {
        service.use('de');
        expect(translate.use).toHaveBeenCalledWith('de');
        expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('de');
        expect(doc.documentElement.lang).toBe('de');

        service.use('en');
        expect(doc.documentElement.lang).toBe('en-GB');
    });

    it('migrates the legacy pt-PT preference to pt-BR', () => {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, 'pt-PT');
        service.init();
        expect(service.language).toBe('pt-BR');
    });

    it('restores a stored language and ignores unknown values', () => {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
        service.init();
        expect(service.language).toBe('de');

        service.use('xx' as any);
        expect(service.language).toBe('pt-BR');
    });
});
