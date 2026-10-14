import {
    Cart,
    CART_SCHEMA_VERSION,
    CartItem,
    CartLine,
    CartSummary,
    MAX_LINE_QUANTITY
} from 'app/shared/models/cart.model';

/**
 * Pure cart arithmetic and validation.
 *
 * Kept free of Angular, HTTP and storage so the rules that actually matter — quantity
 * clamping and money rounding — are trivially testable. `CartService` is then a thin
 * shell around these functions plus persistence.
 */

/**
 * Round to 2 decimal places.
 *
 * Money must never be summed in raw floats: `0.1 + 0.2` is `0.30000000000000004`, and a
 * cart of a few items drifts far enough to display a total that does not match the sum
 * of its visible lines. Rounding each step keeps the arithmetic consistent with what the
 * customer can see.
 */
export function roundMoney(value: number): number
{
    if ( !Number.isFinite(value) )
    {
        return 0;
    }

    // The EPSILON nudge matters: a plain `Math.round(value * 100) / 100` rounds 1.005
    // down to 1.00, because 1.005 * 100 is actually 100.49999999999999 in binary
    // floating point. Adding one ULP first pushes such values onto the correct side.
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Coerce an arbitrary input into a usable quantity, or null if it cannot be.
 *
 * Returns **null** rather than a default, so callers can distinguish "the user typed
 * nonsense" (show an error) from "the user asked for more than we have" (clamp and
 * explain). Accepts numeric strings because this runs against raw form input.
 *
 * @param value
 * @param maxStock  Upper bound; omit when stock is unknown or unlimited.
 */
export function normalizeQuantity(value: unknown, maxStock?: number): number | null
{
    // Reject empty-ish input outright. Note `Number('')` is 0, which would otherwise
    // silently become a valid-looking quantity.
    if ( value === null || value === undefined || value === '' )
    {
        return null;
    }

    if ( typeof value === 'boolean' )
    {
        return null;
    }

    const parsed = typeof value === 'number' ? value : Number(String(value).trim());

    if ( !Number.isFinite(parsed) )
    {
        return null;
    }

    // Fractional quantities make no sense for physical goods.
    if ( !Number.isInteger(parsed) )
    {
        return null;
    }

    if ( parsed < 1 )
    {
        return null;
    }

    const ceiling = resolveCeiling(maxStock);

    return Math.min(parsed, ceiling);
}

/**
 * The largest quantity allowed for a line.
 *
 * @param maxStock
 */
export function resolveCeiling(maxStock?: number): number
{
    if ( maxStock === null || maxStock === undefined || !Number.isFinite(maxStock) || maxStock < 0 )
    {
        return MAX_LINE_QUANTITY;
    }

    return Math.min(Math.floor(maxStock), MAX_LINE_QUANTITY);
}

/**
 * Whether a quantity is acceptable for a line.
 *
 * @param value
 * @param maxStock
 */
export function isValidQuantity(value: unknown, maxStock?: number): boolean
{
    const normalized = normalizeQuantity(value, maxStock);

    if ( normalized === null )
    {
        return false;
    }

    // normalizeQuantity clamps rather than rejecting, so compare back to the input to
    // detect "asked for more than available".
    const requested = typeof value === 'number' ? value : Number(String(value).trim());

    return normalized === requested;
}

/**
 * The line total for a single item.
 *
 * @param item
 */
export function lineTotal(item: CartItem): number
{
    const unit = Number.isFinite(item?.unitPrice) ? item.unitPrice : 0;
    const quantity = Number.isFinite(item?.quantity) ? item.quantity : 0;

    return roundMoney(unit * quantity);
}

/**
 * Decorate items with their line totals.
 *
 * @param items
 */
export function toCartLines(items: CartItem[]): CartLine[]
{
    return (items ?? []).map(item => ({...item, lineTotal: lineTotal(item)}));
}

/**
 * Compute every displayed total from the stored items.
 *
 * Shipping is zero for the MVP — there is no carrier integration, and inventing a
 * figure would be worse than showing "free". It is modelled explicitly rather than
 * omitted so adding real shipping later does not change the shape of this result.
 *
 * @param items
 */
export function summarize(items: CartItem[]): CartSummary
{
    const lines = toCartLines(items);

    const subtotal = roundMoney(lines.reduce((total, line) => total + line.lineTotal, 0));
    const shipping = 0;

    return {
        lines,
        itemCount: lines.reduce((count, line) => count + line.quantity, 0),
        subtotal,
        shipping,
        total    : roundMoney(subtotal + shipping)
    };
}

/**
 * An empty cart at the current schema version.
 */
export function emptyCart(): Cart
{
    return {version: CART_SCHEMA_VERSION, items: []};
}

/**
 * Whether two lines refer to the same orderable thing.
 *
 * Colour is part of the identity: the same product in two colours is two lines, not one
 * line of quantity two.
 *
 * @param a
 * @param b
 */
export function isSameLine(a: CartItem, b: CartItem): boolean
{
    return a.productId === b.productId && (a.colorId ?? null) === (b.colorId ?? null);
}

/**
 * Add an item, merging into an existing line when one matches.
 *
 * Returns a new array; never mutates the input. The merged quantity is re-clamped, so
 * adding 3 to an existing 98 yields the ceiling rather than 101.
 *
 * @param items
 * @param item
 * @param maxStock
 */
export function addItem(items: CartItem[], item: CartItem, maxStock?: number): CartItem[]
{
    const current = items ?? [];
    const existing = current.find(candidate => isSameLine(candidate, item));

    if ( !existing )
    {
        return [...current, {...item, quantity: Math.min(item.quantity, resolveCeiling(maxStock))}];
    }

    return current.map(candidate => isSameLine(candidate, item)
        ? {...candidate, quantity: Math.min(candidate.quantity + item.quantity, resolveCeiling(maxStock))}
        : candidate);
}

/**
 * Parse a stored payload into a cart, discarding anything unusable.
 *
 * Returns an empty cart for corrupt JSON, a stale schema version, or an items array that
 * is not an array. Individual malformed items are dropped rather than failing the whole
 * cart — losing one bad line beats losing the customer's whole basket.
 *
 * @param raw
 */
export function parseStoredCart(raw: string | null): Cart
{
    if ( !raw )
    {
        return emptyCart();
    }

    try
    {
        const parsed = JSON.parse(raw);

        if ( !parsed || parsed.version !== CART_SCHEMA_VERSION || !Array.isArray(parsed.items) )
        {
            return emptyCart();
        }

        return {version: CART_SCHEMA_VERSION, items: parsed.items.filter(isUsableItem)};
    }
    catch
    {
        return emptyCart();
    }
}

/**
 * Whether a parsed object is a usable cart line.
 *
 * @param item
 */
function isUsableItem(item: any): item is CartItem
{
    return !!item
        && typeof item.productId === 'string' && item.productId.length > 0
        && typeof item.slug === 'string'
        && Number.isFinite(item.unitPrice) && item.unitPrice >= 0
        && Number.isInteger(item.quantity) && item.quantity >= 1;
}

/**
 * Strip a cart down to exactly what gets persisted.
 *
 * Explicitly allow-lists fields rather than storing whatever it was handed, which is
 * what guarantees an image or other bulky field can never leak into localStorage even
 * if someone adds one to `CartItem` later.
 *
 * @param items
 */
export function toPersistable(items: CartItem[]): Cart
{
    return {
        version: CART_SCHEMA_VERSION,
        items  : (items ?? []).map(item => ({
            productId: item.productId,
            slug     : item.slug,
            name     : item.name,
            unitPrice: item.unitPrice,
            quantity : item.quantity,
            ...(item.colorId ? {colorId: item.colorId} : {})
        }))
    };
}
