/* tslint:disable:max-line-length */
import { FuseNavigationItem } from '@fuse/components/navigation';

/**
 * Clara Rosa ADMIN navigation.
 *
 * This endpoint serves the admin shell only. The public storefront navigation is static
 * and lives in `app/layout/layouts/storefront/storefront.navigation.ts` — a shop header
 * must render without waiting on an HTTP round trip.
 *
 * Titles are translation KEYS, resolved by the `translate` pipe. Fuse renders
 * `{{item.title}}` with no pipe, so the keys are applied where the admin shell binds
 * them; see `ECOMMERCE_ARCHITECTURE.md` for the i18n coverage decision (admin gets nav
 * titles and table headers only).
 *
 * Role gating uses `meta.roles`, NOT the `hidden` callback Fuse also supports: functions
 * survive the mock's lodash cloneDeep but vanish silently through a real backend's JSON
 * serialization. See `app/core/navigation/navigation.utils.ts`.
 *
 * All four arrays must stay populated — `NavigationMockApi` reads each by name and
 * `InitialData` types all four.
 */
/**
 * Built fresh per export rather than shared.
 *
 * `NavigationMockApi` mutates these arrays in place (it assigns `children` onto the
 * compact, futuristic and horizontal items while filling them from the default set). If
 * all four exports pointed at one array, that loop would be writing to the same objects
 * it reads from. A factory keeps the four independent.
 */
const buildAdminNavigation = (): FuseNavigationItem[] => [
    {
        id      : 'admin.products',
        title   : 'Produtos',
        type    : 'collapsable',
        icon    : 'heroicons_outline:cube',
        meta    : {roles: ['ADMIN']},
        children: [
            {
                id   : 'admin.products.list',
                title: 'Lista de produtos',
                type : 'basic',
                link : '/admin/products',
                meta : {roles: ['ADMIN']}
            },
            {
                id   : 'admin.products.new',
                title: 'Adicionar produto',
                type : 'basic',
                link : '/admin/products/new',
                meta : {roles: ['ADMIN']}
            }
        ]
    },
    {
        id   : 'admin.divider',
        type : 'divider',
        meta : {roles: ['ADMIN']}
    },
    {
        id        : 'admin.back-to-store',
        title     : 'Voltar à loja',
        type      : 'basic',
        icon      : 'heroicons_outline:shopping-bag',
        link      : '/',
        exactMatch: true
    }
];

export const defaultNavigation: FuseNavigationItem[] = buildAdminNavigation();
export const compactNavigation: FuseNavigationItem[] = buildAdminNavigation();
export const futuristicNavigation: FuseNavigationItem[] = buildAdminNavigation();
export const horizontalNavigation: FuseNavigationItem[] = buildAdminNavigation();
