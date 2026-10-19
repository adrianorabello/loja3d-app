import { LocalizedText } from 'app/shared/models/localized-text.model';

/**
 * A colour a product can be printed in.
 *
 * `hex` is presentation data carried on the record so a swatch can be rendered without a
 * lookup table in the UI.
 */
export interface ProductColor
{
    id: string;
    name: LocalizedText;
    hex: string;
}

/**
 * Physical dimensions in millimetres.
 */
export interface ProductDimensions
{
    width: number;
    height: number;
    depth: number;
    unit: 'mm';
}

/**
 * A catalogue product.
 *
 * Field shapes follow `prompts/ECOMMERCE_ARCHITECTURE.md` §5 — this is not a fresh design.
 * Two details worth knowing when consuming it:
 *
 *   - `price` becomes `CartItem.unitPrice`. The rename is deliberate (`unitPrice` contrasts
 *     with `lineTotal` in a cart line) and is bridged in exactly one place, `toCartItem()`
 *     in `core/product/product.utils.ts`.
 *   - `images` is **dropped** when building a cart item. Admin-uploaded images are base64
 *     data URLs, and the cart is persisted to localStorage, so carrying them would risk the
 *     ~5 MB quota on every write. The cart UI joins on `id` to recover a thumbnail.
 */
export interface Product
{
    id: string;
    slug: string;                      // URL key for /products/:slug
    name: LocalizedText;
    description: LocalizedText;
    categoryId: string;
    price: number;                     // EUR, 2dp
    currency: 'EUR';
    dimensions?: ProductDimensions;    // optional for legacy products without measurements
    colors: ProductColor[];
    images: string[];                  // asset paths, or base64 data URLs from admin upload
    stock: number;
    active: boolean;                   // inactive products never reach the public catalogue
    madeToOrder: boolean;
    featured: boolean;
    createdAt: string;                 // ISO 8601 — drives the "newest first" sort
}

/**
 * How the catalogue is ordered. The values are also the `?sort=` query-param values, so they
 * are part of the URL contract and must stay stable.
 *
 * Each one maps to an existing translation key (`catalog.sortNameAsc`, `catalog.sortNameDesc`,
 * `catalog.sortPriceAsc`, `catalog.sortPriceDesc`, `catalog.sortNewest`).
 */
export type ProductSortOption =
    | 'name-asc'
    | 'name-desc'
    | 'price-asc'
    | 'price-desc'
    | 'newest';

/**
 * Default ordering when `?sort=` is absent or unrecognised.
 */
export const DEFAULT_PRODUCT_SORT: ProductSortOption = 'newest';

/**
 * Every sort option, in the order the picker should list them.
 */
export const PRODUCT_SORT_OPTIONS: ProductSortOption[] = [
    'newest',
    'name-asc',
    'name-desc',
    'price-asc',
    'price-desc'
];

/**
 * Availability, derived from `stock` + `madeToOrder` rather than stored.
 *
 * `madeToOrder` deliberately outranks a zero stock count: a made-to-order piece is printed
 * after the order is confirmed, so "0 in stock" does not mean "cannot be bought".
 */
export type StockState = 'in-stock' | 'low-stock' | 'out-of-stock' | 'made-to-order';

/**
 * At or below this quantity the catalogue warns that stock is running out.
 */
export const LOW_STOCK_THRESHOLD = 3;

/**
 * Stand-in image, used for a product with no artwork, for a failed `<img>` load, and for a
 * cart line whose product is not in the cache (or has since been deleted).
 */
export const PRODUCT_IMAGE_PLACEHOLDER = 'assets/images/clara-rosa/placeholder.svg';
