import { Route } from '@angular/router';
import { StorefrontHomePageComponent } from 'app/domains/storefront/home/home.page';

export const storefrontHomeRoutes: Route[] = [
    {
        path     : '',
        component: StorefrontHomePageComponent
    }
];
