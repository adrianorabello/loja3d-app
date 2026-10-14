import { CartItem, CART_SCHEMA_VERSION, MAX_LINE_QUANTITY } from 'app/shared/models/cart.model';
import {
    addItem,
    isSameLine,
    isValidQuantity,
    lineTotal,
    normalizeQuantity,
    parseStoredCart,
    resolveCeiling,
    roundMoney,
    summarize,
    toPersistable
} from 'app/core/cart/cart.utils';

describe('cart.utils', () => {

    const item = (overrides: Partial<CartItem> = {}): CartItem => ({
        productId: 'p1',
        slug     : 'dragao-articulado',
        name     : {'pt-PT': 'Dragão', en: 'Dragon'},
        unitPrice: 24.90,
        quantity : 1,
        ...overrides
    });

    describe('roundMoney', () => {

        it('should round to 2 decimal places', () => {
            expect(roundMoney(24.9)).toBe(24.9);
            expect(roundMoney(24.904)).toBe(24.9);
            expect(roundMoney(24.905)).toBe(24.91);
        });

        // The reason this function exists at all.
        it('should tame binary floating point drift', () => {
            expect(roundMoney(0.1 + 0.2)).toBe(0.3);
            expect(roundMoney(19.99 * 3)).toBe(59.97);
        });

        // A plain Math.round(x * 100) / 100 gets these wrong, because 1.005 * 100 is
        // 100.49999999999999 in binary floating point.
        it('should round half-cent values up', () => {
            expect(roundMoney(1.005)).toBe(1.01);
            expect(roundMoney(2.675)).toBe(2.68);
        });

        it('should return 0 for non-finite input', () => {
            expect(roundMoney(NaN)).toBe(0);
            expect(roundMoney(Infinity)).toBe(0);
        });
    });

    describe('normalizeQuantity', () => {

        it('should accept positive integers', () => {
            expect(normalizeQuantity(1)).toBe(1);
            expect(normalizeQuantity(7)).toBe(7);
        });

        it('should accept numeric strings from form input', () => {
            expect(normalizeQuantity('3')).toBe(3);
            expect(normalizeQuantity('  5  ')).toBe(5);
        });

        it('should reject zero and negatives', () => {
            expect(normalizeQuantity(0)).toBeNull();
            expect(normalizeQuantity(-1)).toBeNull();
            expect(normalizeQuantity('-4')).toBeNull();
        });

        it('should reject non-integers', () => {
            expect(normalizeQuantity(1.5)).toBeNull();
            expect(normalizeQuantity('2.7')).toBeNull();
        });

        it('should reject non-numeric junk', () => {
            expect(normalizeQuantity('abc')).toBeNull();
            expect(normalizeQuantity(NaN)).toBeNull();
            expect(normalizeQuantity(Infinity)).toBeNull();
            expect(normalizeQuantity({})).toBeNull();
            expect(normalizeQuantity([])).toBeNull();
        });

        // `Number('')` is 0, so an empty field would otherwise look like a real value.
        it('should reject empty and nullish input', () => {
            expect(normalizeQuantity('')).toBeNull();
            expect(normalizeQuantity(null)).toBeNull();
            expect(normalizeQuantity(undefined)).toBeNull();
        });

        // `Number(true)` is 1, which would be a silently valid quantity.
        it('should reject booleans', () => {
            expect(normalizeQuantity(true)).toBeNull();
            expect(normalizeQuantity(false)).toBeNull();
        });

        it('should clamp to available stock', () => {
            expect(normalizeQuantity(10, 4)).toBe(4);
            expect(normalizeQuantity(3, 4)).toBe(3);
        });

        it('should clamp to the hard ceiling when stock is unknown', () => {
            expect(normalizeQuantity(500)).toBe(MAX_LINE_QUANTITY);
        });

        it('should clamp to the hard ceiling even when stock exceeds it', () => {
            expect(normalizeQuantity(500, 100000)).toBe(MAX_LINE_QUANTITY);
        });
    });

    describe('isValidQuantity', () => {

        it('should distinguish clamped from exact', () => {
            expect(isValidQuantity(3, 10)).toBe(true);
            // 20 was clamped to 10, so the request was not honoured as asked.
            expect(isValidQuantity(20, 10)).toBe(false);
        });

        it('should reject junk', () => {
            expect(isValidQuantity('abc')).toBe(false);
            expect(isValidQuantity(0)).toBe(false);
        });
    });

    describe('resolveCeiling', () => {

        it('should fall back to the hard ceiling for unknown stock', () => {
            expect(resolveCeiling(undefined)).toBe(MAX_LINE_QUANTITY);
            expect(resolveCeiling(null)).toBe(MAX_LINE_QUANTITY);
            expect(resolveCeiling(NaN)).toBe(MAX_LINE_QUANTITY);
            expect(resolveCeiling(-5)).toBe(MAX_LINE_QUANTITY);
        });

        it('should floor fractional stock', () => {
            expect(resolveCeiling(4.8)).toBe(4);
        });

        it('should allow zero stock', () => {
            expect(resolveCeiling(0)).toBe(0);
        });
    });

    describe('lineTotal', () => {

        it('should multiply unit price by quantity', () => {
            expect(lineTotal(item({unitPrice: 24.90, quantity: 3}))).toBe(74.7);
        });

        it('should treat malformed numbers as zero', () => {
            expect(lineTotal(item({unitPrice: NaN}))).toBe(0);
            expect(lineTotal(item({quantity: NaN}))).toBe(0);
        });
    });

    describe('summarize', () => {

        it('should compute a consistent subtotal and total', () => {
            const summary = summarize([
                item({productId: 'p1', unitPrice: 24.90, quantity: 2}),
                item({productId: 'p2', unitPrice: 9.95, quantity: 3})
            ]);

            expect(summary.itemCount).toBe(5);
            expect(summary.subtotal).toBe(79.65);
            expect(summary.shipping).toBe(0);
            expect(summary.total).toBe(79.65);
        });

        // Guards the specific failure the customer would actually notice: visible line
        // totals that do not add up to the displayed subtotal.
        it('should keep the subtotal equal to the sum of displayed lines', () => {
            const summary = summarize([
                item({productId: 'p1', unitPrice: 0.1, quantity: 1}),
                item({productId: 'p2', unitPrice: 0.2, quantity: 1})
            ]);

            const visibleSum = roundMoney(summary.lines.reduce((t, l) => t + l.lineTotal, 0));

            expect(summary.subtotal).toBe(visibleSum);
            expect(summary.subtotal).toBe(0.3);
        });

        it('should handle an empty cart', () => {
            const summary = summarize([]);

            expect(summary.itemCount).toBe(0);
            expect(summary.subtotal).toBe(0);
            expect(summary.total).toBe(0);
            expect(summary.lines).toEqual([]);
        });

        it('should tolerate a nullish item list', () => {
            expect(summarize(null).itemCount).toBe(0);
        });
    });

    describe('isSameLine', () => {

        it('should match on product and colour together', () => {
            expect(isSameLine(item({colorId: 'red'}), item({colorId: 'red'}))).toBe(true);
            expect(isSameLine(item({colorId: 'red'}), item({colorId: 'blue'}))).toBe(false);
            expect(isSameLine(item({productId: 'p1'}), item({productId: 'p2'}))).toBe(false);
        });

        it('should treat absent and undefined colour as equivalent', () => {
            expect(isSameLine(item(), item({colorId: undefined}))).toBe(true);
        });
    });

    describe('addItem', () => {

        it('should append a new line', () => {
            const result = addItem([], item());

            expect(result.length).toBe(1);
            expect(result[0].quantity).toBe(1);
        });

        it('should merge quantities into a matching line', () => {
            const result = addItem([item({quantity: 2})], item({quantity: 3}));

            expect(result.length).toBe(1);
            expect(result[0].quantity).toBe(5);
        });

        it('should keep the same product in different colours as separate lines', () => {
            const result = addItem([item({colorId: 'red'})], item({colorId: 'blue'}));

            expect(result.length).toBe(2);
        });

        it('should re-clamp the merged quantity to stock', () => {
            const result = addItem([item({quantity: 3})], item({quantity: 5}), 4);

            expect(result[0].quantity).toBe(4);
        });

        it('should not mutate the input array', () => {
            const original = [item({quantity: 2})];
            addItem(original, item({quantity: 1}));

            expect(original[0].quantity).toBe(2);
        });
    });

    describe('parseStoredCart', () => {

        it('should round-trip a valid payload', () => {
            const stored = JSON.stringify(toPersistable([item({quantity: 2})]));

            expect(parseStoredCart(stored).items.length).toBe(1);
            expect(parseStoredCart(stored).items[0].quantity).toBe(2);
        });

        it('should return an empty cart for corrupt JSON', () => {
            expect(parseStoredCart('{not json').items).toEqual([]);
            expect(parseStoredCart('[]').items).toEqual([]);
            expect(parseStoredCart('null').items).toEqual([]);
        });

        it('should return an empty cart for a missing payload', () => {
            expect(parseStoredCart(null).items).toEqual([]);
            expect(parseStoredCart('').items).toEqual([]);
        });

        it('should discard a cart written by an older schema', () => {
            const stale = JSON.stringify({version: CART_SCHEMA_VERSION - 1, items: [item()]});

            expect(parseStoredCart(stale).items).toEqual([]);
        });

        it('should drop malformed lines but keep good ones', () => {
            const mixed = JSON.stringify({
                version: CART_SCHEMA_VERSION,
                items  : [
                    item(),
                    {productId: '', slug: 'x', unitPrice: 1, quantity: 1},
                    {productId: 'p9', slug: 'y', unitPrice: 'free', quantity: 1},
                    {productId: 'p9', slug: 'y', unitPrice: 1, quantity: 0},
                    {productId: 'p9', slug: 'y', unitPrice: 1, quantity: 1.5}
                ]
            });

            expect(parseStoredCart(mixed).items.length).toBe(1);
        });
    });

    describe('toPersistable', () => {

        // The brief's requirement, enforced structurally: the allow-list means an image
        // field cannot leak into localStorage even if one is added to CartItem later.
        it('should never persist an image, however it arrives', () => {
            const withImage = {
                ...item(),
                image    : 'data:image/png;base64,AAAA',
                thumbnail: 'assets/images/x.svg',
                images   : ['a.svg', 'b.svg']
            } as unknown as CartItem;

            const persisted = toPersistable([withImage]);
            const serialized = JSON.stringify(persisted);

            expect(serialized).not.toContain('image');
            expect(serialized).not.toContain('thumbnail');
            expect(serialized).not.toContain('base64');
            expect(Object.keys(persisted.items[0]).sort())
                .toEqual(['name', 'productId', 'quantity', 'slug', 'unitPrice']);
        });

        it('should include colorId only when set', () => {
            expect(toPersistable([item({colorId: 'red'})]).items[0].colorId).toBe('red');
            expect('colorId' in toPersistable([item()]).items[0]).toBe(false);
        });

        it('should stamp the current schema version', () => {
            expect(toPersistable([]).version).toBe(CART_SCHEMA_VERSION);
        });
    });
});
