import { Route } from '@angular/router';
import { AuthGuard } from 'app/core/auth/guards/auth.guard';
import { NoAuthGuard } from 'app/core/auth/guards/noAuth.guard';
import { RoleGuard } from 'app/core/auth/guards/role.guard';
import { SignedInRedirectGuard } from 'app/core/auth/guards/signed-in-redirect.guard';
import { LayoutComponent } from 'app/layout/layout.component';
import { InitialDataResolver } from 'app/app.resolvers';

// @formatter:off
// tslint:disable:max-line-length
export const appRoutes: Route[] = [

    // Role-aware landing after sign in.
    //
    // Fuse's auth pages navigate to this dummy path and expect the routing file to decide
    // where it actually goes. A static `redirectTo` cannot express "depends on the role",
    // and Angular 11 has no functional redirects, so a guard returning a UrlTree does it.
    //
    // `children: []` is REQUIRED: Angular's route validator rejects a route with none of
    // component | redirectTo | children | loadChildren. The guard always returns a
    // UrlTree, so nothing is ever rendered.
    {
        path       : 'signed-in-redirect',
        pathMatch  : 'full',
        canActivate: [SignedInRedirectGuard],
        children   : []
    },

    // Customer account pages use the storefront shell, but are separate from the public
    // block so account data always passes through an authentication guard. This concrete
    // route must precede the public block's empty-path lazy home route.
    {
        path            : 'account',
        canActivateChild: [AuthGuard],
        component       : LayoutComponent,
        data            : {
            layout: 'storefront'
        },
        children        : [
            {path: 'profile', loadChildren: () => import('app/domains/customer/profile/profile.module').then(m => m.CustomerProfileModule)}
        ]
    },

    // Public storefront.
    //
    // NO guard and NO resolver, deliberately. An anonymous visitor must be able to
    // browse and build a cart without ever being redirected to sign in, and the
    // storefront layout takes everything it needs from DI.
    //
    // This is the first empty-path layout block on purpose. Empty-path parents with
    // children can claim an exhausted URL, so it must precede the guest/auth blocks to
    // keep '/' in the storefront rather than a childless empty layout.
    {
        path     : '',
        component: LayoutComponent,
        data     : {
            layout: 'storefront'
        },
        children : [
            // Catalogue and product detail.
            //
            // `products/:slug` is listed BEFORE the bare `products` deliberately. Both are
            // prefix matches, and a bare `products` carrying loadChildren would consume the
            // first segment of /products/dragao-articulado and then hand the remaining
            // 'dragao-articulado' to a child config that cannot match it. Ordering by
            // descending segment count makes resolution deterministic rather than relying
            // on the router backtracking across a lazy boundary.
            //
            // Both sit in THIS block, the unguarded one, on purpose: browsing the catalogue
            // and filling a cart must never trigger a sign-in redirect.
            {path: 'products/:slug', loadChildren: () => import('app/domains/storefront/product-details/product-details.module').then(m => m.StorefrontProductDetailsModule)},
            {path: 'products', loadChildren: () => import('app/domains/storefront/kids-store/kids-store.module').then(m => m.KidsStoreModule)},

            // Kids-friendly storefront — accessible via /kids-store or /products (default).
            {path: 'kids-store', redirectTo: 'products'},

            // Home sits at exactly '/' as an empty-path lazy route with NO pathMatch.
            //
            // `pathMatch: 'full'` must NOT be used here: a full match has to consume the
            // entire remaining URL, which is incompatible with a prefix-style route that
            // carries children or loadChildren.
            //
            // Because an empty path matches as a prefix of anything, this entry MUST stay
            // LAST among its siblings — every concrete sibling route added in later
            // phases (cart, checkout, 404) goes above it.
            {path: '', loadChildren: () => import('app/domains/storefront/home/home.module').then(m => m.StorefrontHomeModule)}
        ]
    },

    // E-mail confirmation links work for both guests and signed-in users
    {
        path: '',
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            {path: 'confirmation-required', loadChildren: () => import('app/modules/auth/confirmation-required/confirmation-required.module').then(m => m.AuthConfirmationRequiredModule)}
        ]
    },

    // Auth routes for guests
    {
        path: '',
        canActivate: [NoAuthGuard],
        canActivateChild: [NoAuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            {path: 'forgot-password', loadChildren: () => import('app/modules/auth/forgot-password/forgot-password.module').then(m => m.AuthForgotPasswordModule)},
            {path: 'reset-password', loadChildren: () => import('app/modules/auth/reset-password/reset-password.module').then(m => m.AuthResetPasswordModule)},
            {path: 'sign-in', loadChildren: () => import('app/modules/auth/sign-in/sign-in.module').then(m => m.AuthSignInModule)},
            {path: 'sign-up', loadChildren: () => import('app/modules/auth/sign-up/sign-up.module').then(m => m.AuthSignUpModule)}
        ]
    },

    // Auth routes for authenticated users
    {
        path: '',
        canActivate: [AuthGuard],
        canActivateChild: [AuthGuard],
        component: LayoutComponent,
        data: {
            layout: 'empty'
        },
        children: [
            {path: 'sign-out', loadChildren: () => import('app/modules/auth/sign-out/sign-out.module').then(m => m.AuthSignOutModule)},
            {path: 'unlock-session', loadChildren: () => import('app/modules/auth/unlock-session/unlock-session.module').then(m => m.AuthUnlockSessionModule)}
        ]
    },

    // Admin area.
    //
    // `data.layout` is declared EXPLICITLY. This block previously carried no layout and
    // inherited 'classy' from appConfig; now that appConfig defaults to 'storefront',
    // omitting it would render the admin area inside the shop chrome.
    //
    // RoleGuard resolves required roles by walking pathFromRoot, which is necessary
    // because Angular's default paramsInheritanceStrategy ('emptyOnly') means
    // /admin/products does not inherit `data` from this parent.
    //
    // RoleGuard is listed ALONE, without AuthGuard. It re-checks authentication itself,
    // and Angular runs canActivate guards concurrently — so pairing them meant two
    // guards each issuing a redirect for an anonymous visitor, producing competing
    // navigations that cancelled each other and left the visitor on the page they
    // started from.
    {
        path       : 'admin',
        canActivate: [RoleGuard],
        canActivateChild: [RoleGuard],
        component  : LayoutComponent,
        data       : {
            layout: 'classy',
            roles : ['ADMIN']
        },
        resolve    : {
            initialData: InitialDataResolver
        },
        children   : [
            // The parent RoleGuard protects the list, create, edit, and any future
            // product-management child routes.
            {path: 'products', loadChildren: () => import('app/domains/admin/products/products.module').then(m => m.AdminProductsModule)}
        ]
    },

    // Catch-all. MUST be the final element of this array.
    {path: '**', redirectTo: ''}
];
