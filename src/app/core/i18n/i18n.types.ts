/**
 * Languages the application ships with. `pt-BR` is the default.
 *
 * Product data (`LocalizedText`) is keyed independently of this union — see
 * `app/shared/models/localized-text.model.ts`.
 */
export type AppLanguage = 'pt-BR' | 'en' | 'de';

/**
 * Default language, used when no stored preference exists.
 */
export const DEFAULT_LANGUAGE: AppLanguage = 'pt-BR';

/**
 * Every supported language, in display order.
 */
export const AVAILABLE_LANGUAGES: AppLanguage[] = ['pt-BR', 'en', 'de'];

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

    /** Short code shown next to the flag. */
    code: string;

    /** Path to the flag image. */
    flag: string;

    /** Value for `<html lang>`. */
    htmlLang: string;
}

/**
 * Labels are intentionally written in their own language rather than translated —
 * a language picker that renders "English" in Portuguese helps nobody.
 */
export const LANGUAGE_OPTIONS: LanguageOption[] = [
    { id: 'pt-BR', label: 'Português (Brasil)', code: 'PT', flag: 'assets/images/flags/br.svg', htmlLang: 'pt-BR' },
    { id: 'en', label: 'English (UK)', code: 'EN', flag: 'assets/images/flags/gb.svg', htmlLang: 'en-GB' },
    { id: 'de', label: 'Deutsch', code: 'DE', flag: 'assets/images/flags/de.svg', htmlLang: 'de' }
];

/**
 * Language ids stored by earlier versions, mapped to their current id.
 */
export const LEGACY_LANGUAGE_IDS: Record<string, AppLanguage> = {'pt-PT': 'pt-BR'};
