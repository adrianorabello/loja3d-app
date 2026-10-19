import { AppLanguage } from 'app/core/i18n/i18n.types';
import { CartItem } from 'app/shared/models/cart.model';
import { resolveLocalizedText } from 'app/shared/models/localized-text.model';
import {
    DEFAULT_PRODUCT_SORT,
    LOW_STOCK_THRESHOLD,
    PRODUCT_SORT_OPTIONS,
    Product,
    ProductSortOption,
    StockState
} from 'app/shared/models/product.model';

/**
 * Pure catalogue helpers.
 *
 * Deliberately free of Angular: no decorators, no DI, no `HttpClient`. Everything here is a
 * function of its arguments, which is what lets `product.utils.spec.ts` cover the filtering
 * and sorting rules without a TestBed. Mirrors the `cart.utils.ts` / `cart.service.ts` split.
 */

/**
 * Fold case and strip diacritics so "dragao" matches "Dragão".
 *
 * Portuguese product names are full of accents and nobody types them into a search box, so
 * an accent-sensitive search would make most of the catalogue unfindable.
 */
function normalize(value: string): string
{
    return (value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Build a cart item from a product.
 *
 * The single boundary between `Product` and `CartItem`, and therefore the single place that
 * renames `price` to `unitPrice` and **drops `images`**. Keeping it in one function is what
 * makes the no-images-in-localStorage rule structural rather than a convention someone has
 * to remember.
 *
 * `name` and `unitPrice` are snapshotted on purpose: they are what the customer saw when
 * they added the item, so a later admin price change must not silently re-price the cart.
 *
 * @param product
 * @param quantity
 * @param colorId
 */
export function toCartItem(product: Product, quantity: number, colorId?: string): CartItem
{
    return {
        productId: product.id,
        slug     : product.slug,
        name     : product.name,
        unitPrice: product.price,
        quantity,
        colorId
    };
}

/**
 * Derive availability from stock and the made-to-order flag.
 *
 * Order matters: `madeToOrder` is checked first, because such a piece is printed after the
 * order is confirmed and so is buyable at zero stock.
 *
 * @param product
 */
export function stockStateOf(product: Product): StockState
{
    if ( product.madeToOrder )
    {
        return 'made-to-order';
    }

    if ( product.stock <= 0 )
    {
        return 'out-of-stock';
    }

    if ( product.stock <= LOW_STOCK_THRESHOLD )
    {
        return 'low-stock';
    }

    return 'in-stock';
}

/**
 * Whether a product can be added to the cart right now.
 *
 * @param product
 */
export function isPurchasable(product: Product): boolean
{
    return stockStateOf(product) !== 'out-of-stock';
}

/**
 * Whether a product matches a free-text query.
 *
 * Searches the name **and** the description, in **every** language rather than only the
 * active one — an English-speaking visitor searching "dragon" should still find a product
 * whose English name was never filled in. (The shipped Fuse inventory mock searches only
 * `name`; that is a bug, not a pattern to copy.)
 *
 * @param product
 * @param query
 */
export function matchesQuery(product: Product, query: string): boolean
{
    const needle = normalize(query);

    if ( !needle )
    {
        return true;
    }

    const haystack = [
        ...Object.values(product.name ?? {}),
        ...Object.values(product.description ?? {})
    ].map(normalize);

    return haystack.some(value => value.includes(needle));
}

/**
 * Coerce an untrusted `?sort=` value into a known option.
 *
 * Query params are user-editable, so an unknown value must fall back rather than produce an
 * empty or arbitrarily ordered grid.
 *
 * @param value
 */
export function resolveSortOption(value: string | null | undefined): ProductSortOption
{
    return PRODUCT_SORT_OPTIONS.includes(value as ProductSortOption)
        ? (value as ProductSortOption)
        : DEFAULT_PRODUCT_SORT;
}

/**
 * Sort a copy of the list.
 *
 * Name sorts run against the **resolved** localized name for the active language, so the
 * ordering follows the language switcher, and use `Intl.Collator` so "ã" sorts beside "a"
 * instead of after "z" as a naive `<` comparison would put it.
 *
 * @param products
 * @param sort
 * @param language
 */
export function sortProducts(products: Product[], sort: ProductSortOption, language: AppLanguage): Product[]
{
    const collator = new Intl.Collator(language, {sensitivity: 'base', numeric: true});
    const byName = (a: Product, b: Product): number => collator.compare(
        resolveLocalizedText(a.name, language),
        resolveLocalizedText(b.name, language)
    );

    // Copy first — callers hand us the service cache, and sorting in place would mutate it.
    const sorted = [...products];

    switch ( sort )
    {
        case 'name-asc':
            return sorted.sort(byName);

        case 'name-desc':
            return sorted.sort((a, b) => byName(b, a));

        case 'price-asc':
            return sorted.sort((a, b) => a.price - b.price);

        case 'price-desc':
            return sorted.sort((a, b) => b.price - a.price);

        case 'newest':
        default:
            return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
}

/**
 * The catalogue's filter criteria, as held in the URL.
 */
export interface ProductFilter
{
    query?: string;
    categoryId?: string | null;
    sort?: ProductSortOption;
}

/**
 * Apply search, category and sort in one pass.
 *
 * The catalogue component does nothing but wire form controls and query params to this
 * function. That purity is what makes the behaviour specifiable without rendering anything.
 *
 * @param products
 * @param filter
 * @param language
 */
export function filterProducts(products: Product[], filter: ProductFilter, language: AppLanguage): Product[]
{
    const {query, categoryId, sort} = filter ?? {};

    const matched = (products ?? []).filter(product =>
        product.active &&
        matchesQuery(product, query ?? '') &&
        (!categoryId || product.categoryId === categoryId)
    );

    return sortProducts(matched, resolveSortOption(sort), language);
}
