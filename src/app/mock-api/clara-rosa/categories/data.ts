/* tslint:disable:max-line-length */
import { Category } from 'app/shared/models/category.model';

/**
 * Category ids, exported as constants so `products/data.ts` references them symbolically
 * instead of repeating string literals that could drift out of sync.
 */
export const CATEGORY_FIGURES = 'cat-figuras';
export const CATEGORY_ACCESSORIES = 'cat-acessorios';
export const CATEGORY_HOME_OFFICE = 'cat-casa-escritorio';
export const CATEGORY_PERSONALISED = 'cat-personalizados';

export const categories: Category[] = [
    {
        id  : CATEGORY_FIGURES,
        slug: 'figuras',
        name: {
            'pt-PT': 'Figuras e Colecionáveis',
            'en'   : 'Figures & Collectibles'
        }
    },
    {
        id  : CATEGORY_ACCESSORIES,
        slug: 'acessorios',
        name: {
            'pt-PT': 'Acessórios',
            'en'   : 'Accessories'
        }
    },
    {
        id  : CATEGORY_HOME_OFFICE,
        slug: 'casa-e-escritorio',
        name: {
            'pt-PT': 'Casa e Escritório',
            'en'   : 'Home & Office'
        }
    },
    {
        id  : CATEGORY_PERSONALISED,
        slug: 'personalizados',
        name: {
            'pt-PT': 'Personalizados',
            'en'   : 'Personalised'
        }
    }
];
