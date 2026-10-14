import { TestBed } from '@angular/core/testing';
import { CartService } from 'app/core/cart/cart.service';
import { CartItem, CART_SCHEMA_VERSION, CART_STORAGE_KEY } from 'app/shared/models/cart.model';

describe('CartService', () => {

    const item = (overrides: Partial<CartItem> = {}): CartItem => ({
        productId: 'p1',
        slug     : 'dragao-articulado',
        name     : {'pt-PT': 'Dragão', en: 'Dragon'},
        unitPrice: 24.90,
        quantity : 1,
        ...overrides
    });

    let service: CartService;

    const build = (): CartService => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({providers: [CartService]});

        return TestBed.inject(CartService);
    };

    beforeEach(() => {
        localStorage.removeItem(CART_STORAGE_KEY);
        service = build();
    });

    afterEach(() => {
        localStorage.removeItem(CART_STORAGE_KEY);
    });

    describe('add', () => {

        it('should add an item and report the applied quantity', () => {
            expect(service.add(item())).toBe(1);
            expect(service.items.length).toBe(1);
        });

        it('should merge a repeated product into one line', () => {
            service.add(item({quantity: 2}));

            // Reports the resulting line quantity, not just what was passed in.
            expect(service.add(item({quantity: 3}))).toBe(5);
            expect(service.items.length).toBe(1);
            expect(service.items[0].quantity).toBe(5);
        });

        it('should reject an invalid quantity without touching the cart', () => {
            expect(service.add(item({quantity: 0}))).toBeNull();
            expect(service.add(item({quantity: -2}))).toBeNull();
            expect(service.add(item({quantity: 1.5}))).toBeNull();
            expect(service.items.length).toBe(0);
        });

        // Returning the clamped number rather than null is what lets the caller say
        // "only 3 available" instead of showing a validation error.
        it('should clamp to available stock and report the clamped quantity', () => {
            expect(service.add(item({quantity: 10}), 3)).toBe(3);
            expect(service.items[0].quantity).toBe(3);
        });
    });

    describe('updateQuantity', () => {

        beforeEach(() => {
            service.add(item({quantity: 2}));
        });

        it('should set a valid quantity', () => {
            expect(service.updateQuantity('p1', 5)).toBe(5);
            expect(service.items[0].quantity).toBe(5);
        });

        it('should accept a numeric string', () => {
            expect(service.updateQuantity('p1', '4')).toBe(4);
            expect(service.items[0].quantity).toBe(4);
        });

        it('should reject junk and leave the quantity unchanged', () => {
            expect(service.updateQuantity('p1', 'abc')).toBeNull();
            expect(service.updateQuantity('p1', -1)).toBeNull();
            expect(service.updateQuantity('p1', '')).toBeNull();
            expect(service.items[0].quantity).toBe(2);
        });

        // Zero is rejected rather than treated as a removal: a mistyped 0 in a quantity
        // box should not silently delete the line.
        it('should reject zero rather than removing the line', () => {
            expect(service.updateQuantity('p1', 0)).toBeNull();
            expect(service.items.length).toBe(1);
            expect(service.items[0].quantity).toBe(2);
        });

        // Clamps rather than refusing — see the method's doc comment. The caller learns
        // it was clamped by comparing the returned number to what it asked for.
        it('should clamp a quantity above stock down to the maximum', () => {
            expect(service.updateQuantity('p1', 99, undefined, 4)).toBe(4);
            expect(service.items[0].quantity).toBe(4);
        });

        it('should report null for an unknown line', () => {
            expect(service.updateQuantity('nope', 3)).toBeNull();
        });
    });

    describe('remove / clear', () => {

        it('should remove a single line', () => {
            service.add(item({productId: 'p1'}));
            service.add(item({productId: 'p2'}));

            service.remove('p1');

            expect(service.items.length).toBe(1);
            expect(service.items[0].productId).toBe('p2');
        });

        it('should remove only the matching colour', () => {
            service.add(item({colorId: 'red'}));
            service.add(item({colorId: 'blue'}));

            service.remove('p1', 'red');

            expect(service.items.length).toBe(1);
            expect(service.items[0].colorId).toBe('blue');
        });

        it('should empty the cart', () => {
            service.add(item());
            service.clear();

            expect(service.isEmpty).toBe(true);
        });
    });

    describe('persistence', () => {

        it('should survive a reload', () => {
            service.add(item({quantity: 3}));

            const reloaded = build();

            expect(reloaded.items.length).toBe(1);
            expect(reloaded.items[0].quantity).toBe(3);
        });

        // The brief's explicit requirement.
        it('should never write an image into localStorage', () => {
            const withImage = {
                ...item(),
                image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg'
            } as unknown as CartItem;

            service.add(withImage);

            const stored = localStorage.getItem(CART_STORAGE_KEY);

            expect(stored).toBeTruthy();
            expect(stored).not.toContain('image');
            expect(stored).not.toContain('base64');
        });

        it('should stamp the schema version', () => {
            service.add(item());

            expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY)).version).toBe(CART_SCHEMA_VERSION);
        });

        it('should recover from corrupt stored JSON instead of throwing', () => {
            localStorage.setItem(CART_STORAGE_KEY, '{half written');

            expect(() => build()).not.toThrow();
            expect(build().items).toEqual([]);
        });

        it('should discard a cart from an older schema', () => {
            localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
                version: CART_SCHEMA_VERSION - 1,
                items  : [item()]
            }));

            expect(build().items).toEqual([]);
        });

        // Storage access itself throws in some contexts (private browsing, blocked site
        // data), not just the JSON parse — so construction must survive it.
        it('should survive localStorage being unavailable', () => {
            const getItem = spyOn(localStorage, 'getItem').and.throwError('SecurityError');
            const setItem = spyOn(localStorage, 'setItem').and.throwError('QuotaExceededError');

            let built: CartService;

            expect(() => {
                built = build();
            }).not.toThrow();

            // The in-memory cart still works for this session.
            expect(() => built.add(item())).not.toThrow();
            expect(built.items.length).toBe(1);

            expect(getItem).toHaveBeenCalled();
            expect(setItem).toHaveBeenCalled();
        });
    });

    describe('reactive surface', () => {

        it('should emit the unit count', () => {
            const counts: number[] = [];
            service.count$.subscribe(count => counts.push(count));

            service.add(item({quantity: 2}));
            service.add(item({productId: 'p2', quantity: 3}));

            expect(counts).toEqual([0, 2, 5]);
        });

        it('should emit a computed summary', (done) => {
            service.add(item({unitPrice: 24.90, quantity: 2}));

            service.summary$.subscribe((summary) => {
                expect(summary.subtotal).toBe(49.8);
                expect(summary.total).toBe(49.8);
                expect(summary.lines[0].lineTotal).toBe(49.8);
                done();
            });
        });
    });

    describe('capacity helpers', () => {

        it('should report the quantity already in the cart', () => {
            service.add(item({quantity: 2, colorId: 'red'}));

            expect(service.quantityOf('p1', 'red')).toBe(2);
            expect(service.quantityOf('p1', 'blue')).toBe(0);
            expect(service.quantityOf('nope')).toBe(0);
        });

        it('should report the remaining capacity against stock', () => {
            service.add(item({quantity: 2}));

            expect(service.remainingCapacity(5, 'p1')).toBe(3);
            expect(service.remainingCapacity(2, 'p1')).toBe(0);
            // Never negative, even if stock dropped below what is already in the cart.
            expect(service.remainingCapacity(1, 'p1')).toBe(0);
        });
    });
});
