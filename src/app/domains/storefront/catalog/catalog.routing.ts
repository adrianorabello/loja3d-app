import { Route } from '@angular/router';
import { CatalogComponent } from 'app/domains/storefront/catalog/catalog.component';

export const catalogRoutes: Route[] = [
    {
        path     : '',
        component: CatalogComponent
    }
];
