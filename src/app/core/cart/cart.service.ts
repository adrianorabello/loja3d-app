import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CartItem, CartSummary, CART_STORAGE_KEY } from 'app/shared/models/cart.model';
import {
    addItem,
    emptyCart,
    isSameLine,
    normalizeQuantity,
    parseStoredCart,
    resolveCeiling,
    summarize,
    toPersistable
} from 'app/core/cart/cart.utils';

/**
 * Owns the shopping cart.
 *
 * Three deliberate properties, all required by the brief:
 *
 *   1. **No HTTP.** The cart lives entirely in localStorage. There is no server-side
 *      cart, so a visitor never needs an account to shop.
 *   2. **Independent of authentication.** Nothing here reads `AuthService` or
 *      `UserService`. Signing in or out does not disturb the cart.
 *   3. **No images persisted.** Enforced structurally by `toPersistable`, which
 *      allow-lists the fields it writes rather than storing whatever it was given.
 *
 * All arithmetic and validation lives in `cart.utils.ts`; this class is persistence
 * plus a reactive surface.
 */
@Injectable({ providedIn: 'root' })
export class CartService
{
    private _items: BehaviorSubject<CartItem[]> = new BehaviorSubject<CartItem[]>([]);

    /**
     * Constructor
     */
    constructor()
    {
        // Hydrate synchronously so the header badge is correct on first paint rather
        // than flashing 0.
        this._items.next(this._read());
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for the raw cart items
     */
    get items$(): Observable<CartItem[]>
    {
        return this._items.asObservable();
    }

    /**
     * Getter for the current items snapshot
     */
    get items(): CartItem[]
    {
        return this._items.getValue();
    }

    /**
     * Getter for the computed cart summary (lines, subtotal, total)
     */
    get summary$(): Observable<CartSummary>
    {
        return this._items.pipe(map(items => summarize(items)));
    }

    /**
     * Getter for the total number of units in the cart — drives the header badge
     */
    get count$(): Observable<number>
    {
        return this._items.pipe(map(items => items.reduce((count, item) => count + item.quantity, 0)));
    }

    /**
     * Whether the cart has no lines
     */
    get isEmpty(): boolean
    {
        return this.items.length === 0;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Add an item, merging into a matching line if one exists.
     *
     * Returns the quantity actually applied, or **null** if the request was rejected.
     *
     * The distinction matters for the UI. A rejection (`null`) means the input was
     * nonsense — zero, negative, fractional, junk text — and deserves a validation
     * message. A returned number lower than what was asked for means the request was
     * honoured but clamped to available stock, which deserves a different message
     * ("only 4 available"). A plain boolean could not express that difference.
     *
     * @param item
     * @param maxStock
     */
    add(item: CartItem, maxStock?: number): number | null
    {
        const quantity = normalizeQuantity(item.quantity, maxStock);

        if ( quantity === null )
        {
            return null;
        }

        const next = addItem(this.items, {...item, quantity}, maxStock);

        this._commit(next);

        // Report the resulting line quantity, which accounts for merging.
        const applied = next.find(candidate => isSameLine(candidate, item));

        return applied ? applied.quantity : quantity;
    }

    /**
     * Set the quantity of an existing line.
     *
     * Returns the quantity actually applied, or **null** if the request was rejected or
     * the line does not exist. Clamps to available stock rather than refusing, so typing
     * 99 when 4 remain sets 4 — doing nothing at all would leave the customer staring at
     * an unchanged field wondering what happened.
     *
     * A quantity of zero IS rejected rather than treated as a removal: removing is an
     * explicit action, so a fat-fingered 0 must not silently drop the line.
     *
     * @param productId
     * @param quantity
     * @param colorId
     * @param maxStock
     */
    updateQuantity(productId: string, quantity: unknown, colorId?: string, maxStock?: number): number | null
    {
        const normalized = normalizeQuantity(quantity, maxStock);

        if ( normalized === null )
        {
            return null;
        }

        const target = {productId, colorId} as CartItem;

        if ( !this.items.some(item => isSameLine(item, target)) )
        {
            return null;
        }

        this._commit(this.items.map(item => isSameLine(item, target)
            ? {...item, quantity: normalized}
            : item));

        return normalized;
    }

    /**
     * Remove a line entirely.
     *
     * @param productId
     * @param colorId
     */
    remove(productId: string, colorId?: string): void
    {
        const target = {productId, colorId} as CartItem;

        this._commit(this.items.filter(item => !isSameLine(item, target)));
    }

    /**
     * Remove every line.
     */
    clear(): void
    {
        this._commit([]);
    }

    /**
     * The quantity currently in the cart for a given product/colour.
     *
     * Used by the product page so the quantity selector can offer only the remaining
     * stock rather than the full amount.
     *
     * @param productId
     * @param colorId
     */
    quantityOf(productId: string, colorId?: string): number
    {
        const target = {productId, colorId} as CartItem;
        const match = this.items.find(item => isSameLine(item, target));

        return match ? match.quantity : 0;
    }

    /**
     * The largest quantity that may still be added for a product/colour.
     *
     * @param maxStock
     * @param productId
     * @param colorId
     */
    remainingCapacity(maxStock: number | undefined, productId: string, colorId?: string): number
    {
        return Math.max(0, resolveCeiling(maxStock) - this.quantityOf(productId, colorId));
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Persist and publish a new set of items.
     *
     * @param items
     * @private
     */
    private _commit(items: CartItem[]): void
    {
        this._write(items);
        this._items.next(items);
    }

    /**
     * Read the cart from storage.
     *
     * Storage access itself can throw (private browsing, blocked site data), which is
     * why even the `getItem` call is guarded — not just the JSON parse.
     *
     * @private
     */
    private _read(): CartItem[]
    {
        try
        {
            return parseStoredCart(localStorage.getItem(CART_STORAGE_KEY)).items;
        }
        catch
        {
            return emptyCart().items;
        }
    }

    /**
     * Write the cart to storage.
     *
     * A failure here is swallowed on purpose: the in-memory cart still works for this
     * session, and a storefront that throws because the quota is full — or because the
     * viewer blocked site data — is worse than one that forgets on reload.
     *
     * @param items
     * @private
     */
    private _write(items: CartItem[]): void
    {
        try
        {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(toPersistable(items)));
        }
        catch
        {
            // Intentionally ignored.
        }
    }
}
