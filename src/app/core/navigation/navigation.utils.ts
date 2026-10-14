import { FuseNavigationItem } from '@fuse/components/navigation';
import { UserRole } from 'app/core/user/user.model';

/**
 * Role metadata attached to a navigation item.
 *
 * Carried in `FuseNavigationItem.meta` rather than the `hidden` callback that Fuse also
 * offers. `hidden` takes a function, and functions happen to survive the mock API's
 * lodash `cloneDeep` — which makes it a trap: the moment navigation comes from a real
 * REST backend, any function in the payload vanishes silently through JSON
 * serialization and every "hidden" item becomes visible. `meta` is plain data and
 * survives both paths identically.
 */
export interface NavigationMeta
{
    roles?: UserRole[];
}

/**
 * Remove navigation items the given role may not see.
 *
 * Recurses into children and drops a parent whose children are all filtered away —
 * otherwise an ADMIN-only group would render as an empty, un-clickable heading.
 *
 * Applied in `InitialDataResolver`, which already fetches the user. That is also exactly
 * where a real backend would filter server-side instead, making this step a clean
 * deletion later. Note this is cosmetic defence: route access is enforced by `RoleGuard`,
 * and hiding a link has never stopped anyone from typing a URL.
 *
 * @param items
 * @param role
 */
export function filterNavigationByRole(
    items: FuseNavigationItem[] | null | undefined,
    role: UserRole | null | undefined
): FuseNavigationItem[]
{
    if ( !items )
    {
        return [];
    }

    return items.reduce<FuseNavigationItem[]>((accumulator, item) => {

        if ( !isItemVisibleToRole(item, role) )
        {
            return accumulator;
        }

        // Leaf item — keep as-is.
        if ( !item.children )
        {
            return [...accumulator, item];
        }

        const children = filterNavigationByRole(item.children, role);

        // A container left with no children is noise, so drop it. Items that legitimately
        // ship an empty `children` array (Fuse's compact and horizontal navigation stubs
        // do exactly that) are preserved, since nothing was actually removed.
        if ( children.length === 0 && item.children.length > 0 )
        {
            return accumulator;
        }

        return [...accumulator, {...item, children}];
    }, []);
}

/**
 * Whether a single item is visible to the given role.
 *
 * An item with no role metadata is visible to everyone — so adding a nav entry does not
 * require remembering to annotate it.
 *
 * @param item
 * @param role
 */
export function isItemVisibleToRole(item: FuseNavigationItem, role: UserRole | null | undefined): boolean
{
    const meta = item?.meta as NavigationMeta | undefined;
    const required = meta?.roles;

    if ( !required || required.length === 0 )
    {
        return true;
    }

    if ( !role )
    {
        return false;
    }

    return required.includes(role);
}
