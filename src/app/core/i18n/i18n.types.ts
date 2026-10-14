/**
 * Languages the application ships with. `pt-PT` is the default.
 *
 * This union is deliberately narrow: it is also the key set of `LocalizedText`
 * (see `app/shared/models/localized-text.model.ts`), so adding a language here
 * is a typed, compiler-checked change across every localized product record.
 */
export type AppLanguage = 'pt-PT' | 'en';

/**
 * Default language, used when no stored preference exists.
 */
export const DEFAULT_LANGUAGE: AppLanguage = 'pt-PT';

/**
 * Every supported language, in display order.
 */
export const AVAILABLE_LANGUAGES: AppLanguage[] = ['pt-PT', 'en'];

/**
 * localStorage key holding the viewer's language preference.
 */
export const LANGUAGE_STORAGE_KEY = 'clara_rosa_lang';

/**
 * Display metadata for a language, used by the header language switcher.
 */
export interface LanguageOption
{
    id: AppLanguage;
    label: string;
}

/**
 * Labels are intentionally written in their own language rather than translated —
 * a language picker that renders "English" in Portuguese helps nobody.
 */
export const LANGUAGE_OPTIONS: LanguageOption[] = [
    { id: 'pt-PT', label: 'Português' },
    { id: 'en', label: 'English' }
];
