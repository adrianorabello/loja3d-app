import { Product } from 'app/shared/models/product.model';
import {
    filterProducts,
    isPurchasable,
    matchesQuery,
    resolveSortOption,
    sortProducts,
    stockStateOf,
    toCartItem
} from 'app/core/product/product.utils';

/**
 * Coverage for the pure catalogue helpers.
 *
 * No TestBed and no HTTP: these are the rules that decide what a shopper sees, so they are
 * worth pinning down exactly. Mirrors `cart.utils.spec.ts`.
 */
describe('product.utils', () => {

    /**
     * Minimal product factory — only the fields a given spec cares about need overriding.
     */
    const make = (overrides: Partial<Product> = {}): Product => ({
        id         : 'prd-x',
        slug       : 'produto-x',
        name       : {'pt-PT': 'Produto', 'en': 'Product'},
        description: {'pt-PT': 'Descrição', 'en': 'Description'},
        categoryId : 'cat-a',
        price      : 10,
        currency   : 'EUR',
        colors     : [],
        images     : ['a.svg'],
        stock      : 5,
        active     : true,
        madeToOrder: false,
        featured   : false,
        createdAt  : '2026-01-01T00:00:00.000Z',
        ...overrides
    });

    // -----------------------------------------------------------------------------------------
    // @ toCartItem
    // -----------------------------------------------------------------------------------------

    describe('toCartItem', () => {

        it('renames price to unitPrice and snapshots the name', () => {
            const product = make({id: 'prd-1', slug: 's', price: 24.9});
            const item = toCartItem(product, 2);

            expect(item.productId).toBe('prd-1');
            expect(item.slug).toBe('s');
            expect(item.unitPrice).toBe(24.9);
            expect(item.quantity).toBe(2);
            expect(item.name).toEqual(product.name);
        });

        it('never carries images into the cart', () => {
            // Structural guard for the localStorage quota rule: admin images are base64 data
            // URLs, and the cart is persisted, so an image field here would be a real bug.
            const item = toCartItem(make({images: ['big.svg', 'bigger.svg']}), 1) as any;

            expect(item.images).toBeUndefined();
            expect(Object.keys(item)).not.toContain('images');
        });

        it('passes the colour through when given', () => {
            expect(toCartItem(make(), 1, 'mint').colorId).toBe('mint');
            expect(toCartItem(make(), 1).colorId).toBeUndefined();
        });
    });

    // -----------------------------------------------------------------------------------------
    // @ stockStateOf
    // -----------------------------------------------------------------------------------------

    describe('stockStateOf', () => {

        it('reports in-stock above the low threshold', () => {
            expect(stockStateOf(make({stock: 10}))).toBe('in-stock');
        });

        it('reports low-stock at or below the threshold', () => {
            expect(stockStateOf(make({stock: 3}))).toBe('low-stock');
            expect(stockStateOf(make({stock: 1}))).toBe('low-stock');
        });

        it('reports out-of-stock at zero', () => {
            expect(stockStateOf(make({stock: 0}))).toBe('out-of-stock');
        });

        it('lets madeToOrder outrank a zero stock count', () => {
            // The distinction that matters commercially: a made-to-order piece is printed
            // after the order is placed, so zero on hand does not mean unbuyable.
            expect(stockStateOf(make({stock: 0, madeToOrder: true}))).toBe('made-to-order');
            expect(isPurchasable(make({stock: 0, madeToOrder: true}))).toBe(true);
            expect(isPurchasable(make({stock: 0, madeToOrder: false}))).toBe(false);
        });
    });

    // -----------------------------------------------------------------------------------------
    // @ matchesQuery
    // -----------------------------------------------------------------------------------------

    describe('matchesQuery', () => {

        const dragon = make({
            name       : {'pt-PT': 'Dragão Articulado', 'en': 'Articulated Dragon'},
            description: {'pt-PT': 'Elos que se movem', 'en': 'Links that move'}
        });

        it('matches everything on an empty query', () => {
            expect(matchesQuery(dragon, '')).toBe(true);
            expect(matchesQuery(dragon, '   ')).toBe(true);
        });

        it('ignores diacritics in both directions', () => {
            expect(matchesQuery(dragon, 'dragao')).toBe(true);
            expect(matchesQuery(dragon, 'dragão')).toBe(true);
        });

        it('ignores case and surrounding whitespace', () => {
            expect(matchesQuery(dragon, '  ARTICULADO ')).toBe(true);
        });

        it('searches every language, not just the active one', () => {
            expect(matchesQuery(dragon, 'dragon')).toBe(true);
        });

        it('searches the description as well as the name', () => {
            expect(matchesQuery(dragon, 'movem')).toBe(true);
        });

        it('rejects a non-match', () => {
            expect(matchesQuery(dragon, 'bicicleta')).toBe(false);
        });
    });

    // -----------------------------------------------------------------------------------------
    // @ resolveSortOption
    // -----------------------------------------------------------------------------------------

    describe('resolveSortOption', () => {

        it('accepts known options', () => {
            expect(resolveSortOption('price-asc')).toBe('price-asc');
            expect(resolveSortOption('name-desc')).toBe('name-desc');
        });

        it('falls back on anything unknown, since query params are user-editable', () => {
            expect(resolveSortOption('nonsense')).toBe('newest');
            expect(resolveSortOption('')).toBe('newest');
            expect(resolveSortOption(null)).toBe('newest');
            expect(resolveSortOption(undefined)).toBe('newest');
        });
    });

    // -----------------------------------------------------------------------------------------
    // @ sortProducts
    // -----------------------------------------------------------------------------------------

    describe('sortProducts', () => {

        const ana    = make({id: 'a', name: {'pt-PT': 'Ana', 'en': 'Ana'}, price: 30, createdAt: '2026-01-03T00:00:00.000Z'});
        const agueda = make({id: 'b', name: {'pt-PT': 'Água', 'en': 'Water'}, price: 10, createdAt: '2026-01-01T00:00:00.000Z'});
        const zebra  = make({id: 'c', name: {'pt-PT': 'Zebra', 'en': 'Zebra'}, price: 20, createdAt: '2026-01-02T00:00:00.000Z'});
        const all = [ana, agueda, zebra];

        it('sorts by price ascending and descending', () => {
            expect(sortProducts(all, 'price-asc', 'pt-PT').map(p => p.id)).toEqual(['b', 'c', 'a']);
            expect(sortProducts(all, 'price-desc', 'pt-PT').map(p => p.id)).toEqual(['a', 'c', 'b']);
        });

        it('sorts newest first by createdAt', () => {
            expect(sortProducts(all, 'newest', 'pt-PT').map(p => p.id)).toEqual(['a', 'c', 'b']);
        });

        it('collates accented names beside their base letter, not after z', () => {
            // A naive `<` comparison puts "Água" after "Zebra" because of the code point.
            expect(sortProducts(all, 'name-asc', 'pt-PT').map(p => p.id)).toEqual(['b', 'a', 'c']);
            expect(sortProducts(all, 'name-desc', 'pt-PT').map(p => p.id)).toEqual(['c', 'a', 'b']);
        });

        it('sorts on the resolved name for the active language', () => {
            // "Água"/"Water" swaps position with "Zebra" between locales.
            expect(sortProducts(all, 'name-asc', 'en').map(p => p.id)).toEqual(['a', 'b', 'c']);
        });

        it('does not mutate the input array', () => {
            const input = [...all];
            sortProducts(input, 'price-asc', 'pt-PT');

            expect(input.map(p => p.id)).toEqual(['a', 'b', 'c']);
        });
    });

    // -----------------------------------------------------------------------------------------
    // @ filterProducts
    // -----------------------------------------------------------------------------------------

    describe('filterProducts', () => {

        const list = [
            make({id: 'a', name: {'pt-PT': 'Dragão', 'en': 'Dragon'}, categoryId: 'figuras', price: 25}),
            make({id: 'b', name: {'pt-PT': 'Porta-lápis', 'en': 'Pencil Holder'}, categoryId: 'casa', price: 11}),
            make({id: 'c', name: {'pt-PT': 'Placa', 'en': 'Nameplate'}, categoryId: 'casa', price: 18}),
            make({id: 'd', name: {'pt-PT': 'Oculto', 'en': 'Hidden'}, categoryId: 'casa', price: 1, active: false})
        ];

        it('always excludes inactive products', () => {
            const ids = filterProducts(list, {}, 'pt-PT').map(p => p.id);

            expect(ids).not.toContain('d');
            expect(ids.length).toBe(3);
        });

        it('filters by category', () => {
            expect(filterProducts(list, {categoryId: 'casa'}, 'pt-PT').map(p => p.id).sort())
                .toEqual(['b', 'c']);
        });

        it('treats a falsy category as "all"', () => {
            expect(filterProducts(list, {categoryId: null}, 'pt-PT').length).toBe(3);
            expect(filterProducts(list, {categoryId: ''}, 'pt-PT').length).toBe(3);
        });

        it('combines query, category and sort', () => {
            const result = filterProducts(
                list,
                {query: 'a', categoryId: 'casa', sort: 'price-asc'},
                'pt-PT'
            );

            expect(result.map(p => p.id)).toEqual(['b', 'c']);
        });

        it('returns an empty list rather than throwing on no match', () => {
            expect(filterProducts(list, {query: 'bicicleta'}, 'pt-PT')).toEqual([]);
        });

        it('tolerates missing input', () => {
            expect(filterProducts(null, null, 'pt-PT')).toEqual([]);
            expect(filterProducts(undefined, {}, 'pt-PT')).toEqual([]);
        });
    });
});
