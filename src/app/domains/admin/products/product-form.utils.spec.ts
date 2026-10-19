import { formValueToProduct, MAX_IMAGE_BYTES, ProductFormValue, productToFormValue, slugify, validateImageFile } from 'app/domains/admin/products/product-form.utils';

describe('product-form.utils', () => {

    describe('slugify', () => {

        it('should lower-case, strip accents and hyphenate', () => {
            expect(slugify('Dragão  Articulado!')).toBe('dragao-articulado');
        });

        it('should trim leading and trailing separators', () => {
            expect(slugify('  --Olá--  ')).toBe('ola');
        });

        it('should tolerate empty input', () => {
            expect(slugify('')).toBe('');
            expect(slugify(null)).toBe('');
        });
    });

    describe('validateImageFile', () => {

        it('should accept JPG and PNG under the cap', () => {
            expect(validateImageFile({type: 'image/jpeg', size: 1000})).toBeNull();
            expect(validateImageFile({type: 'image/png', size: MAX_IMAGE_BYTES})).toBeNull();
        });

        it('should reject other MIME types', () => {
            expect(validateImageFile({type: 'image/svg+xml', size: 10})).toBe('productForm.imageWrongType');
            expect(validateImageFile({type: 'image/gif', size: 10})).toBe('productForm.imageWrongType');
        });

        it('should reject files over 2 MB', () => {
            expect(validateImageFile({type: 'image/png', size: MAX_IMAGE_BYTES + 1})).toBe('productForm.imageTooLarge');
        });
    });

    describe('formValueToProduct', () => {

        const value: ProductFormValue = {
            namePt       : ' Dragão ',
            nameEn       : '',
            descriptionPt: 'Descrição',
            descriptionEn: '',
            slug         : '',
            categoryId   : 'cat-figuras',
            price        : 12.345,
            dimensions   : {width: null, height: null, depth: null},
            stock        : 4.9,
            colors       : [{name: 'Rosa Claro', hex: '#ffc0cb'}],
            madeToOrder  : false,
            active       : true,
            featured     : false
        };

        it('should derive the slug from the Portuguese name when blank', () => {
            expect(formValueToProduct(value, []).slug).toBe('dragao');
        });

        it('should round the price to 2dp and floor the stock', () => {
            const product = formValueToProduct(value, []);

            expect(product.price).toBe(12.35);
            expect(product.stock).toBe(4);
        });

        it('should map colours with a generated id and pass images through', () => {
            const product = formValueToProduct(value, ['data:image/png;base64,AAA']);

            expect(product.colors[0].id).toBe('rosa-claro');
            expect(product.images).toEqual(['data:image/png;base64,AAA']);
            expect(product.currency).toBe('EUR');
        });

        it('should persist complete dimensions in millimetres and omit empty dimensions', () => {
            const withDimensions = formValueToProduct({
                ...value,
                dimensions: {width: 120, height: 80, depth: 25}
            }, []);

            expect(withDimensions.dimensions).toEqual({width: 120, height: 80, depth: 25, unit: 'mm'});
            expect(formValueToProduct(value, []).dimensions).toBeUndefined();
        });

        it('should reject partial or non-positive dimensions', () => {
            expect(() => formValueToProduct({
                ...value,
                dimensions: {width: 120, height: null, depth: null}
            }, [])).toThrowError('Product dimensions must be provided as three positive measurements.');
            expect(() => formValueToProduct({
                ...value,
                dimensions: {width: 120, height: 80, depth: 0}
            }, [])).toThrowError('Product dimensions must be provided as three positive measurements.');
        });
    });

    describe('productToFormValue', () => {

        it('should round-trip through formValueToProduct', () => {
            const value: ProductFormValue = {
                namePt       : 'Porta-lápis',
                nameEn       : 'Pencil holder',
                descriptionPt: 'Descrição',
                descriptionEn: 'Description',
                nameDe       : '',
                descriptionDe: '',
                slug         : 'porta-lapis',
                categoryId   : 'cat-casa-escritorio',
                price        : 9.5,
                dimensions   : {width: 100, height: 140, depth: 80},
                stock        : 7,
                colors       : [{name: 'Azul', hex: '#0000ff'}],
                madeToOrder  : true,
                active       : false,
                featured     : true
            };
            const product = {...formValueToProduct(value, []), id: 'prd-1', createdAt: '2026-01-01T00:00:00Z'};

            expect(productToFormValue(product)).toEqual(value);
        });
    });
});
