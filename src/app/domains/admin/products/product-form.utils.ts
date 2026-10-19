import { LocalizedText } from 'app/shared/models/localized-text.model';
import { Product } from 'app/shared/models/product.model';

/**
 * Pure helpers for the admin product form. Kept out of the component so the rules that
 * matter (what an upload may be, what a slug looks like, what gets persisted) are unit
 * testable without a TestBed.
 */

/**
 * MIME types an admin may upload. Deliberately a whitelist: SVG is excluded because it can
 * carry script and these images are rendered straight from a data URL.
 */
export const ALLOWED_IMAGE_TYPES: string[] = ['image/jpeg', 'image/png'];

/**
 * Per-file size cap, in bytes. Images are stored as base64 in the (mock) record, so this
 * also bounds how large a single product can grow.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Raw shape of the product form, as `FormGroup.getRawValue()` returns it.
 */
export interface ProductFormValue
{
    namePt: string;
    nameEn: string;
    descriptionPt: string;
    descriptionEn: string;
    nameDe?: string;
    descriptionDe?: string;
    slug: string;
    categoryId: string;
    price: number;
    dimensions: { width: number | null; height: number | null; depth: number | null };
    stock: number;
    colors: { name: string; hex: string }[];
    madeToOrder: boolean;
    active: boolean;
    featured: boolean;
}

/**
 * Turn free text into a URL slug: lower-case, accents stripped, non-alphanumerics collapsed
 * to single hyphens, no leading or trailing hyphen.
 *
 * @param text
 */
/**
 * German is optional: only add the key when the admin filled it in.
 */
function withGerman(text: LocalizedText, german: string | undefined): LocalizedText
{
    const de = (german ?? '').trim();

    return de ? {...text, de} : text;
}

export function slugify(text: string): string
{
    return (text ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Validate a file picked for upload.
 *
 * @returns an i18n key for the problem, or `null` when the file is acceptable.
 * @param file
 */
export function validateImageFile(file: { type: string; size: number }): string | null
{
    if ( !ALLOWED_IMAGE_TYPES.includes(file.type) )
    {
        return 'productForm.imageWrongType';
    }

    if ( file.size > MAX_IMAGE_BYTES )
    {
        return 'productForm.imageTooLarge';
    }

    return null;
}

/**
 * Map the form value (plus the already-read image data URLs) to the shape the API stores.
 * An empty English text is allowed through: `resolveLocalizedText` falls back to Portuguese.
 *
 * @param value
 * @param images
 */
export function formValueToProduct(value: ProductFormValue, images: string[]): Omit<Product, 'id' | 'createdAt'>
{
    const dimensionValues = [value.dimensions.width, value.dimensions.height, value.dimensions.depth];
    const hasDimensions = dimensionValues.some(dimension => dimension !== null && dimension !== undefined);

    if ( hasDimensions && dimensionValues.some(dimension => typeof dimension !== 'number' || !Number.isFinite(dimension) || dimension <= 0) )
    {
        throw new Error('Product dimensions must be provided as three positive measurements.');
    }

    return {
        slug       : value.slug.trim() || slugify(value.namePt),
        name       : withGerman({'pt-PT': value.namePt.trim(), en: (value.nameEn ?? '').trim()}, value.nameDe),
        description: withGerman({'pt-PT': value.descriptionPt.trim(), en: (value.descriptionEn ?? '').trim()}, value.descriptionDe),
        categoryId : value.categoryId,
        price      : Math.round(Number(value.price) * 100) / 100,
        currency   : 'EUR',
        ...(hasDimensions ? {
            dimensions: {
                width : Number(value.dimensions.width),
                height: Number(value.dimensions.height),
                depth : Number(value.dimensions.depth),
                unit  : 'mm' as const
            }
        } : {}),
        colors     : value.colors.map(color => ({
            id  : slugify(color.name),
            name: {'pt-PT': color.name.trim(), en: color.name.trim()},
            hex : color.hex
        })),
        images,
        stock      : Math.floor(Number(value.stock)),
        active     : value.active,
        madeToOrder: value.madeToOrder,
        featured   : value.featured
    };
}

/**
 * The inverse of `formValueToProduct`, used to seed the form in edit mode. Colour names are
 * edited in Portuguese only (the form has one name field per colour), so the Portuguese
 * text is what comes back.
 *
 * @param product
 */
export function productToFormValue(product: Product): ProductFormValue
{
    return {
        namePt       : product.name?.['pt-PT'] ?? '',
        nameEn       : product.name?.en ?? '',
        descriptionPt: product.description?.['pt-PT'] ?? '',
        descriptionEn: product.description?.en ?? '',
        nameDe       : product.name?.de ?? '',
        descriptionDe: product.description?.de ?? '',
        slug         : product.slug,
        categoryId   : product.categoryId,
        price        : product.price,
        dimensions   : {
            width : product.dimensions?.width ?? null,
            height: product.dimensions?.height ?? null,
            depth : product.dimensions?.depth ?? null
        },
        stock        : product.stock,
        colors       : (product.colors ?? []).map(color => ({name: color.name?.['pt-PT'] ?? '', hex: color.hex})),
        madeToOrder  : product.madeToOrder,
        active       : product.active,
        featured     : product.featured
    };
}
