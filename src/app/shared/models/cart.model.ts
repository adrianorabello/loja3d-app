import { LocalizedText } from 'app/shared/models/localized-text.model';

/**
 * A line in the shopping cart.
 *
 * Deliberately carries NO image field. Two reasons:
 *
 *   1. The brief forbids persisting large images in localStorage, and admin-uploaded
 *      images are base64 data URLs — a handful of those would blow the ~5 MB quota and
 *      make every cart write throw.
 *   2. An image path is presentation, not order data. The cart UI joins `productId`
 *      against `ProductService` to render a thumbnail.
 *
 * `name` and `unitPrice` ARE snapshotted, because they are what the customer saw when
 * they added the item. If an admin changes a price afterwards, the cart should not
 * silently re-price itself underneath them.
 */
export interface CartItem
{
    productId: string;
    slug: string;
    name: LocalizedText;
    unitPrice: number;
    quantity: number;
    colorId?: string;
}

/**
 * The persisted cart.
 *
 * `version` exists so a future change to `CartItem` can invalidate stored carts instead
 * of crashing on them — see `CART_SCHEMA_VERSION`.
 */
export interface Cart
{
    version: number;
    items: CartItem[];
}

/**
 * A cart line with its computed total, produced for display. Never persisted.
 */
export interface CartLine extends CartItem
{
    lineTotal: number;
}

/**
 * Computed cart totals, produced for display. Never persisted.
 */
export interface CartSummary
{
    lines: CartLine[];
    itemCount: number;
    subtotal: number;
    shipping: number;
    total: number;
}

/**
 * Bumping this invalidates every stored cart. Do that whenever `CartItem` changes
 * shape in a way that would make an old payload wrong rather than merely incomplete.
 */
export const CART_SCHEMA_VERSION = 1;

/**
 * localStorage key holding the cart.
 */
export const CART_STORAGE_KEY = 'clara_rosa_cart';

/**
 * Hard ceiling on a single line's quantity, applied even when stock is unknown.
 * Prevents a typo like 9999 from reaching checkout.
 */
export const MAX_LINE_QUANTITY = 99;
