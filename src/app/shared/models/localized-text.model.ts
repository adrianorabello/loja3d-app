import { AppLanguage } from 'app/core/i18n/i18n.types';

/**
 * Text that exists in every supported language.
 *
 * Product names and descriptions are **data**, not UI strings, so they belong in the
 * record rather than in a translation dictionary. Typing them as a `Record` over
 * `AppLanguage` means adding a language is a compiler-checked change: every localized
 * field in every mock payload will fail to type until it is filled in.
 *
 * Resolve for display with `LocalizedTextPipe`, never by indexing directly — the pipe
 * handles the missing-translation fallback in one place.
 */
export type LocalizedText = Record<AppLanguage, string>;

/**
 * Read a localized value, falling back to any populated language rather than rendering
 * an empty string.
 *
 * A half-translated catalogue is a realistic state — an admin can save a product before
 * filling in the English name — and showing the Portuguese name to an English visitor is
 * far better than showing nothing.
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

    if ( text[language] )
    {
        return text[language];
    }

    // Fall back to the first non-empty value in the record.
    const fallback = Object.keys(text).find(key => !!text[key as AppLanguage]);

    return fallback ? text[fallback as AppLanguage] : '';
}
