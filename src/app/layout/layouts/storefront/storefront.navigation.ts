import { FuseNavigationItem } from '@fuse/components/navigation';

/**
 * Public storefront navigation.
 *
 * Static and in-code, unlike the admin navigation which comes from
 * `GET api/common/navigation`. Two reasons:
 *
 *   1. The store header must render on first paint without waiting for an HTTP round
 *      trip. The admin shell can afford a resolver; a shop front cannot.
 *   2. `InitialData` requires messages, notifications, shortcuts and four navigation
 *      flavours — none of which a storefront header wants.
 *
 * Typed as `FuseNavigationItem[]` even though it is rendered as plain anchors, so moving
 * it behind the endpoint later is mechanical rather than a rewrite.
 *
 * Account and cart links are deliberately NOT here: they are conditional UI driven by
 * `*ngIf` in the template, not navigation data.
 */
export const storefrontNavigation: FuseNavigationItem[] = [
    {
        id        : 'home',
        title     : 'nav.home',
        type      : 'basic',
        icon      : 'heroicons_outline:home',
        link      : '/',
        exactMatch: true
    },
    {
        id   : 'products',
        title: 'nav.products',
        type : 'basic',
        icon : 'heroicons_outline:cube',
        link : '/products'
    }
];
