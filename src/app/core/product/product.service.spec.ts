import { TestBed } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FuseMockApiModule } from '@fuse/lib/mock-api';
import { mockApiServices } from 'app/mock-api';
import { API_BASE_URL } from 'app/core/api/api.config';
import { ProductService } from 'app/core/product/product.service';
import { CategoryService } from 'app/core/category/category.service';

const BASE = 'api/clara-rosa';

/**
 * Integration coverage driven through the REAL mock API interceptor.
 *
 * Follows `auth.service.spec.ts`: wiring the genuine handlers is the only way to prove the
 * URL shapes actually resolve, and URL resolution is the single most failure-prone part of
 * this layer — the matcher compares path segments and ignores the query string, so a wrong
 * shape fails silently as an unhandled passthrough rather than as a visible error.
 */
describe('ProductService (via mock API)', () => {

    let productService: ProductService;
    let categoryService: CategoryService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports  : [
                HttpClientModule,
                FuseMockApiModule.forRoot(mockApiServices)
            ],
            providers: [
                {provide: API_BASE_URL, useValue: BASE}
            ]
        });

        productService  = TestBed.inject(ProductService);
        categoryService = TestBed.inject(CategoryService);
    });

    it('serves the active catalogue and hides inactive products', (done) => {
        productService.getProducts().subscribe((products) => {
            expect(products.length).toBe(6);
            expect(products.every(product => product.active)).toBe(true);
            expect(products.map(p => p.slug)).not.toContain('suporte-auscultadores');
            done();
        });
    });

    it('publishes the fetched catalogue to the cache', (done) => {
        productService.getProducts().subscribe(() => {
            expect(productService.products.length).toBe(6);

            productService.products$.subscribe((products) => {
                expect(products.length).toBe(6);
                done();
            });
        });
    });

    it('looks a product up by slug', (done) => {
        productService.getProductBySlug('dragao-articulado').subscribe((product) => {
            expect(product.slug).toBe('dragao-articulado');
            expect(product.name['pt-PT']).toBe('Dragão Articulado');
            expect(product.price).toBe(24.90);
            expect(product.currency).toBe('EUR');
            done();
        });
    });

    it('404s on an unknown slug instead of resolving empty', (done) => {
        productService.getProductBySlug('nao-existe').subscribe(
            () => {
                done.fail('expected the unknown slug to error');
            },
            (error) => {
                expect(error.status).toBe(404);
                done();
            }
        );
    });

    it('404s on an inactive product, so discontinued items are unreachable by URL', (done) => {
        productService.getProductBySlug('suporte-auscultadores').subscribe(
            () => {
                done.fail('expected an inactive product to be unreachable');
            },
            (error) => {
                expect(error.status).toBe(404);
                done();
            }
        );
    });

    it('filters server-side by query', (done) => {
        // Accent-insensitive on the server too, because the handler reuses the same pure
        // helper the catalogue uses client-side.
        productService.getProducts({query: 'dragao'}).subscribe((products) => {
            expect(products.length).toBe(1);
            expect(products[0].slug).toBe('dragao-articulado');
            done();
        });
    });

    it('filters server-side by category', (done) => {
        productService.getProducts({categoryId: 'cat-personalizados'}).subscribe((products) => {
            expect(products.length).toBe(2);
            expect(products.every(p => p.categoryId === 'cat-personalizados')).toBe(true);
            done();
        });
    });

    it('sorts server-side', (done) => {
        productService.getProducts({sort: 'price-asc'}).subscribe((products) => {
            const prices = products.map(p => p.price);

            expect(prices).toEqual([...prices].sort((a, b) => a - b));
            done();
        });
    });

    it('fetches once across repeated ensureLoaded calls', (done) => {
        productService.ensureLoaded().subscribe(() => {
            const cached = productService.products;

            productService.ensureLoaded().subscribe((products) => {
                // Same array instance means the second call never went to the network.
                expect(products).toBe(cached);
                done();
            });
        });
    });

    it('derives featured products without a products/featured endpoint', (done) => {
        // `products/featured` would be four segments and would be shadowed by
        // `products/:slug`, so this is derived from the cache on purpose.
        productService.getFeatured().subscribe((products) => {
            expect(products.length).toBeGreaterThan(0);
            expect(products.every(product => product.featured && product.active)).toBe(true);
            done();
        });
    });

    it('reflects admin visibility changes in the public catalogue', (done) => {
        productService.updateProduct('prd-0001', {active: false}).subscribe(() => {
            productService.getProducts().subscribe((products) => {
                expect(products.map(product => product.id)).not.toContain('prd-0001');

                productService.updateProduct('prd-0001', {active: true}).subscribe(() => {
                    productService.getProducts().subscribe((updatedProducts) => {
                        expect(updatedProducts.map(product => product.id)).toContain('prd-0001');
                        done();
                    });
                });
            });
        });
    });

    it('serves categories from a sibling endpoint, not products/categories', (done) => {
        categoryService.getCategories().subscribe((categories) => {
            expect(categories.length).toBe(4);
            expect(categories.map(c => c.slug)).toContain('personalizados');
            expect(categories[0].name['pt-PT']).toBeTruthy();
            expect(categories[0].name['en']).toBeTruthy();
            done();
        });
    });

    it('returns a copy, so a consumer cannot corrupt the mock store', (done) => {
        productService.getProducts().subscribe((first) => {
            first[0].price = -999;

            productService.refresh().subscribe((second) => {
                expect(second[0].price).not.toBe(-999);
                done();
            });
        });
    });
});

/**
 * URL-shape coverage, against a mocked backend rather than the mock API.
 *
 * Separate TestBed because this asserts the exact request the service *emits* — which the
 * real interceptor would swallow before `HttpTestingController` could see it.
 */
describe('ProductService (request shapes)', () => {

    let productService: ProductService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports  : [HttpClientTestingModule],
            providers: [
                {provide: API_BASE_URL, useValue: BASE}
            ]
        });

        productService = TestBed.inject(ProductService);
        httpMock       = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('sends filters as HttpParams and keeps them out of the URL path', () => {
        productService.getProducts({query: 'dragao', categoryId: 'cat-figuras', sort: 'price-asc'}).subscribe();

        // The guard for the documented trap: the matcher splits on '/' and compares
        // segments, so a query string baked into the URL makes the last segment
        // "products?q=dragao" and matches no handler at all.
        const req = httpMock.expectOne(request => request.url === `${BASE}/products`);

        expect(req.request.url).toBe(`${BASE}/products`);
        expect(req.request.url).not.toContain('?');
        expect(req.request.params.get('q')).toBe('dragao');
        expect(req.request.params.get('category')).toBe('cat-figuras');
        expect(req.request.params.get('sort')).toBe('price-asc');

        req.flush([]);
    });

    it('omits parameters that were not supplied', () => {
        productService.getProducts().subscribe();

        const req = httpMock.expectOne(`${BASE}/products`);

        expect(req.request.params.keys().length).toBe(0);

        req.flush([]);
    });

    it('builds the slug endpoint with exactly four segments', () => {
        productService.getProductBySlug('dragao-articulado').subscribe();

        const req = httpMock.expectOne(`${BASE}/products/dragao-articulado`);

        expect(req.request.url.split('/').length).toBe(4);

        req.flush({});
    });
});
