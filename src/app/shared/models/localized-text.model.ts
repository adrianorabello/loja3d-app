import { AppLanguage } from 'app/core/i18n/i18n.types';

/**
 * Keys under which product text is stored (backend and mocks).
 *
 * The Portuguese entry keeps its historical `pt-PT` key so existing catalogue data needs no
 * migration; it is served to the `pt-BR` UI. German is optional and falls back.
 */
export type LocalizedTextKey = 'pt-PT' | 'en' | 'de';

/**
 * Text that exists in each supported language.
 *
 * Product names and descriptions are **data**, not UI strings, so they belong in the
 * record rather than in a translation dictionary. Resolve for display with
 * `LocalizedTextPipe`, never by indexing directly — the pipe handles the
 * missing-translation fallback in one place.
 */
export type LocalizedText = { 'pt-PT': string; en: string; de?: string };

/**
 * Data key that holds the text of a UI language.
 */
export function localizedTextKey(language: AppLanguage): LocalizedTextKey
{
    return language === 'pt-BR' ? 'pt-PT' : language;
}

/**
 * Read a localized value, falling back to any populated language rather than rendering
 * an empty string.
 *
 * A half-translated catalogue is a realistic state, and showing the Portuguese name to an
 * English visitor is far better than showing nothing.
 *
 * @param text
 * @param language
 */
export function resolveLocalizedText(text: LocalizedText | null | undefined, language: AppLanguage): string
{
    if ( !text )
    {
        return '';
    }

    const key = localizedTextKey(language);

    if ( text[key] )
    {
        return text[key];
    }

    // Fall back to the default-language text, then to any populated value.
    const fallback = ['pt-PT', 'en', 'de'].find(k => !!text[k as LocalizedTextKey]);

    return fallback ? text[fallback as LocalizedTextKey] : '';
}
