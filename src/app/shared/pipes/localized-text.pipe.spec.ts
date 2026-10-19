import { ChangeDetectorRef } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { I18nService } from 'app/core/i18n/i18n.service';
import { AppLanguage } from 'app/core/i18n/i18n.types';
import { LocalizedText } from 'app/shared/models/localized-text.model';
import { LocalizedTextPipe } from 'app/shared/pipes/localized-text.pipe';

/**
 * Coverage for the localized-text pipe.
 *
 * The behaviour worth pinning down is the reason this pipe is impure at all: a language
 * switch does not change the `LocalizedText` object's reference, so a pure pipe would never
 * re-run and every product name in the app would stay stuck in the previous language.
 */
describe('LocalizedTextPipe', () => {

    /** Minimal I18nService stand-in whose language the test drives. */
    class I18nStub
    {
        readonly subject: BehaviorSubject<AppLanguage> = new BehaviorSubject<AppLanguage>('pt-PT');

        get language(): AppLanguage
        {
            return this.subject.getValue();
        }

        get language$(): BehaviorSubject<AppLanguage>
        {
            return this.subject;
        }

        use(language: AppLanguage): void
        {
            this.subject.next(language);
        }
    }

    let i18n: I18nStub;
    let pipe: LocalizedTextPipe;
    let markForCheck: jasmine.Spy;

    const bilingual: LocalizedText = {'pt-PT': 'Dragão', 'en': 'Dragon'};

    beforeEach(() => {
        i18n = new I18nStub();
        markForCheck = jasmine.createSpy('markForCheck');

        // Constructed directly rather than through TestBed. Angular compiles a pipe's
        // ChangeDetectorRef dependency to `ɵɵinjectPipeChangeDetectorRef`, which resolves
        // from the surrounding VIEW — so a root-injector provider for the token is simply
        // never consulted and injection fails outright.
        pipe = new LocalizedTextPipe(
            i18n as unknown as I18nService,
            {markForCheck} as unknown as ChangeDetectorRef
        );
    });

    afterEach(() => {
        pipe.ngOnDestroy();
    });

    it('resolves the active language', () => {
        expect(pipe.transform(bilingual)).toBe('Dragão');
    });

    it('follows a language change', () => {
        expect(pipe.transform(bilingual)).toBe('Dragão');

        i18n.use('en');

        // The memo must be invalidated, or the pt-PT value would be served forever.
        expect(pipe.transform(bilingual)).toBe('Dragon');
    });

    it('marks the host view dirty on a language change, so OnPush hosts repaint', () => {
        pipe.transform(bilingual);
        expect(markForCheck).not.toHaveBeenCalled();

        i18n.use('en');

        // Without this an impure pipe still never runs inside an OnPush component, because
        // no change-detection pass reaches it. ProductCardComponent is OnPush.
        expect(markForCheck).toHaveBeenCalled();
    });

    it('does not mark dirty when the language is re-emitted unchanged', () => {
        pipe.transform(bilingual);
        i18n.use('pt-PT');

        expect(markForCheck).not.toHaveBeenCalled();
    });

    it('falls back to a populated language rather than rendering empty', () => {
        // A realistic half-translated record: an admin saved before filling in English.
        const halfTranslated: LocalizedText = {'pt-PT': 'Miniatura', 'en': ''};

        i18n.use('en');

        expect(pipe.transform(halfTranslated)).toBe('Miniatura');
    });

    it('returns an empty string for missing input', () => {
        expect(pipe.transform(null)).toBe('');
        expect(pipe.transform(undefined)).toBe('');
    });

    it('serves repeated reads from the memo', () => {
        // Impurity means transform runs on every change-detection pass, so the steady-state
        // cost has to be a cache hit rather than a rebuild.
        const first = pipe.transform(bilingual);
        const second = pipe.transform(bilingual);

        expect(second).toBe(first);
    });
});
