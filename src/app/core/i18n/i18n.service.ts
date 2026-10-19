import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
    AppLanguage,
    AVAILABLE_LANGUAGES,
    DEFAULT_LANGUAGE,
    LANGUAGE_OPTIONS,
    LANGUAGE_STORAGE_KEY,
    LEGACY_LANGUAGE_IDS
} from 'app/core/i18n/i18n.types';

/**
 * Owns the active UI language.
 *
 * Wraps `TranslateService` so the rest of the app depends on a narrow, typed API
 * (`AppLanguage`) rather than ngx-translate's `string`-based one. That keeps the
 * translation library swappable and makes `LocalizedText` lookups type-safe.
 *
 * Note: `LOCALE_ID` is pinned in `CoreModule` and is NOT changed here. Locale-aware
 * formatting follows the active language through `AppCurrencyPipe` instead.
 */
@Injectable({ providedIn: 'root' })
export class I18nService
{
    private _language: BehaviorSubject<AppLanguage> = new BehaviorSubject<AppLanguage>(DEFAULT_LANGUAGE);

    /**
     * Constructor
     */
    constructor(
        private _translateService: TranslateService,
        @Inject(DOCUMENT) private _document: any
    )
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for the active language as a stream
     */
    get language$(): Observable<AppLanguage>
    {
        return this._language.asObservable();
    }

    /**
     * Getter for the active language's current value
     */
    get language(): AppLanguage
    {
        return this._language.getValue();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Initialize the translation system.
     *
     * Called once from `AppComponent`. Resolves the startup language from storage,
     * falling back to the default, and registers the available languages with
     * ngx-translate so its own fallback chain works.
     */
    init(): void
    {
        this._translateService.addLangs(AVAILABLE_LANGUAGES);
        this._translateService.setDefaultLang(DEFAULT_LANGUAGE);

        this.use(this._readStoredLanguage());
    }

    /**
     * Switch the active language and persist the choice.
     *
     * @param language
     */
    use(language: AppLanguage): void
    {
        // Guard against an unsupported value reaching ngx-translate — it would
        // request a dictionary that does not exist and silently render raw keys.
        const next = AVAILABLE_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;

        this._translateService.use(next);
        this._document.documentElement.lang = LANGUAGE_OPTIONS.find(option => option.id === next).htmlLang;
        this._writeStoredLanguage(next);
        this._language.next(next);
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Read the stored language preference.
     *
     * Storage access can throw outright (private browsing, blocked site data), so
     * every read is guarded — a store that cannot be read is simply "no preference".
     */
    private _readStoredLanguage(): AppLanguage
    {
        try
        {
            const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
            const stored = (LEGACY_LANGUAGE_IDS[raw] ?? raw) as AppLanguage | null;

            return stored && AVAILABLE_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
        }
        catch
        {
            return DEFAULT_LANGUAGE;
        }
    }

    /**
     * Persist the language preference. A failure here is not worth surfacing —
     * the language still applies for this session.
     *
     * @param language
     */
    private _writeStoredLanguage(language: AppLanguage): void
    {
        try
        {
            localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        }
        catch
        {
            // Intentionally ignored.
        }
    }
}
