/* tslint:disable:max-line-length */
import { Product, ProductColor } from 'app/shared/models/product.model';
import {
    CATEGORY_ACCESSORIES,
    CATEGORY_FIGURES,
    CATEGORY_HOME_OFFICE,
    CATEGORY_PERSONALISED
} from 'app/mock-api/clara-rosa/categories/data';

/**
 * DEVELOPMENT-ONLY catalogue data.
 *
 * Six hand-authored 3D-printed products. Every localized field is filled in both languages
 * except where a gap is *deliberate* — `miniatura-decorativa` has no English description, so
 * the `LocalizedTextPipe` fallback has something real to exercise rather than only being
 * covered by a synthetic spec.
 *
 * Images point at the hand-authored SVGs in `assets/images/clara-rosa/products/`. They are
 * not photographs and are not derived from any third-party source.
 */

/**
 * The filament colours offered, shared across products. `hex` is carried on the record so a
 * swatch needs no lookup table in the UI.
 */
const MINT: ProductColor = {
    id  : 'mint',
    name: {'pt-PT': 'Menta', 'en': 'Mint'},
    hex : '#5EEAD4'
};
const WHITE: ProductColor = {
    id  : 'branco',
    name: {'pt-PT': 'Branco', 'en': 'White'},
    hex : '#F8FAFC'
};
const BLACK: ProductColor = {
    id  : 'preto',
    name: {'pt-PT': 'Preto', 'en': 'Black'},
    hex : '#1E293B'
};
const ROSE: ProductColor = {
    id  : 'rosa',
    name: {'pt-PT': 'Rosa', 'en': 'Rose'},
    hex : '#FB7185'
};
const AMBER: ProductColor = {
    id  : 'ambar',
    name: {'pt-PT': 'Âmbar', 'en': 'Amber'},
    hex : '#FBBF24'
};

export const products: Product[] = [
    {
        id         : 'prd-0001',
        slug       : 'dragao-articulado',
        name       : {
            'pt-PT': 'Dragão Articulado',
            'en'   : 'Articulated Dragon'
        },
        description: {
            'pt-PT': 'Dragão impresso numa só peça, com elos articulados que se movem sem necessitar de montagem. Cerca de 24 cm da cabeça à cauda.',
            'en'    : 'Dragon printed in a single piece, with articulated links that move freely and need no assembly. Roughly 24 cm nose to tail.'
        },
        categoryId : CATEGORY_FIGURES,
        price      : 24.90,
        currency   : 'EUR',
        colors     : [MINT, BLACK, ROSE],
        images     : [
            'assets/images/clara-rosa/products/dragao-articulado-01.svg',
            'assets/images/clara-rosa/products/dragao-articulado-02.svg'
        ],
        stock      : 8,
        active     : true,
        madeToOrder: false,
        featured   : true,
        createdAt  : '2026-09-28T10:00:00.000Z'
    },
    {
        id         : 'prd-0002',
        slug       : 'porta-chaves-personalizado',
        name       : {
            'pt-PT': 'Porta-chaves Personalizado',
            'en'   : 'Personalised Keychain'
        },
        description: {
            'pt-PT': 'Porta-chaves com o nome ou a palavra que escolher, impresso em duas cores. Indique o texto nas notas da encomenda.',
            'en'    : 'Keychain carrying the name or word of your choice, printed in two colours. Add the text in your order notes.'
        },
        categoryId : CATEGORY_PERSONALISED,
        price      : 7.50,
        currency   : 'EUR',
        colors     : [MINT, WHITE, BLACK, ROSE, AMBER],
        images     : [
            'assets/images/clara-rosa/products/porta-chaves-personalizado-01.svg',
            'assets/images/clara-rosa/products/porta-chaves-personalizado-02.svg'
        ],
        stock      : 0,
        active     : true,
        // Printed per order, so a zero stock count must NOT read as "out of stock".
        madeToOrder: true,
        featured   : true,
        createdAt  : '2026-10-02T09:30:00.000Z'
    },
    {
        id         : 'prd-0003',
        slug       : 'suporte-telemovel',
        name       : {
            'pt-PT': 'Suporte para Telemóvel',
            'en'   : 'Phone Stand'
        },
        description: {
            'pt-PT': 'Suporte de secretária com inclinação de 60°, compatível com telemóveis até 9 mm de espessura. Base com apoio antiderrapante.',
            'en'    : 'Desk stand angled at 60°, fits phones up to 9 mm thick. Non-slip pads on the base.'
        },
        categoryId : CATEGORY_HOME_OFFICE,
        price      : 12.00,
        currency   : 'EUR',
        colors     : [WHITE, BLACK, MINT],
        images     : [
            'assets/images/clara-rosa/products/suporte-telemovel-01.svg',
            'assets/images/clara-rosa/products/suporte-telemovel-02.svg'
        ],
        stock      : 2,
        active     : true,
        madeToOrder: false,
        featured   : false,
        createdAt  : '2026-08-14T15:45:00.000Z'
    },
    {
        id         : 'prd-0004',
        slug       : 'miniatura-decorativa',
        name       : {
            'pt-PT': 'Miniatura Decorativa',
            'en'   : 'Decorative Miniature'
        },
        description: {
            'pt-PT': 'Miniatura de 7 cm sobre base redonda, impressa em camadas de 0,1 mm para um acabamento fino. Ideal para prateleira ou secretária.',
            // Left empty on purpose: exercises the LocalizedTextPipe fallback with real data.
            'en'    : ''
        },
        categoryId : CATEGORY_FIGURES,
        price      : 15.75,
        currency   : 'EUR',
        colors     : [WHITE, MINT],
        images     : [
            'assets/images/clara-rosa/products/miniatura-decorativa-01.svg',
            'assets/images/clara-rosa/products/miniatura-decorativa-02.svg'
        ],
        stock      : 0,
        active     : true,
        madeToOrder: false,
        featured   : false,
        createdAt  : '2026-07-21T11:10:00.000Z'
    },
    {
        id         : 'prd-0005',
        slug       : 'porta-lapis',
        name       : {
            'pt-PT': 'Porta-lápis',
            'en'   : 'Pencil Holder'
        },
        description: {
            'pt-PT': 'Porta-lápis hexagonal com três compartimentos, 10 cm de altura. Paredes com textura de linhas de impressão visível.',
            'en'    : 'Hexagonal pencil holder with three compartments, 10 cm tall. Walls keep a visible layer-line texture.'
        },
        categoryId : CATEGORY_HOME_OFFICE,
        price      : 11.25,
        currency   : 'EUR',
        colors     : [MINT, ROSE, AMBER],
        images     : [
            'assets/images/clara-rosa/products/porta-lapis-01.svg',
            'assets/images/clara-rosa/products/porta-lapis-02.svg'
        ],
        stock      : 14,
        active     : true,
        madeToOrder: false,
        featured   : false,
        createdAt  : '2026-09-05T08:20:00.000Z'
    },
    {
        id         : 'prd-0006',
        slug       : 'placa-de-nome',
        name       : {
            'pt-PT': 'Placa de Nome',
            'en'   : 'Nameplate'
        },
        description: {
            'pt-PT': 'Placa de porta ou secretária com texto em relevo, até 18 caracteres. Inclui fita adesiva dupla face.',
            'en'    : 'Door or desk plate with raised lettering, up to 18 characters. Double-sided tape included.'
        },
        categoryId : CATEGORY_PERSONALISED,
        price      : 18.40,
        currency   : 'EUR',
        colors     : [WHITE, BLACK, MINT, ROSE],
        images     : [
            'assets/images/clara-rosa/products/placa-de-nome-01.svg',
            'assets/images/clara-rosa/products/placa-de-nome-02.svg'
        ],
        stock      : 5,
        active     : true,
        madeToOrder: true,
        featured   : true,
        createdAt  : '2026-10-08T16:05:00.000Z'
    },
    {
        id         : 'prd-0007',
        slug       : 'suporte-auscultadores',
        name       : {
            'pt-PT': 'Suporte para Auscultadores',
            'en'   : 'Headphone Stand'
        },
        description: {
            'pt-PT': 'Produto descontinuado, mantido apenas para testar que itens inativos não aparecem na loja.',
            'en'    : 'Discontinued product, kept only to prove inactive items never reach the storefront.'
        },
        categoryId : CATEGORY_ACCESSORIES,
        price      : 16.00,
        currency   : 'EUR',
        colors     : [BLACK],
        images     : [],
        stock      : 3,
        // Deliberately inactive: the public endpoint must filter this out, and the catalogue
        // spec asserts it never appears. It is also the only product with no images, which
        // exercises the placeholder path.
        active     : false,
        madeToOrder: false,
        featured   : false,
        createdAt  : '2026-06-01T12:00:00.000Z'
    }
];
