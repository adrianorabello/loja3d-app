import { LocalizedText } from 'app/shared/models/localized-text.model';

/**
 * A product category.
 *
 * Categories are **data, not UI strings**, so the display name is a `LocalizedText` on the
 * record rather than a key in the translation dictionaries. The evidence is in the
 * dictionaries themselves: they define `catalog.category` and `catalog.allCategories` — the
 * labels *around* the filter — but no label for any individual category. An admin will be
 * able to add a category without a developer touching `en.json` / `pt-PT.json`.
 */
export interface Category
{
    id: string;
    slug: string;
    name: LocalizedText;
}
