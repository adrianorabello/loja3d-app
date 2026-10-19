import { Route } from '@angular/router';
import { ProductDetailsComponent } from 'app/domains/storefront/product-details/product-details.component';

export const productDetailsRoutes: Route[] = [
    {
        path     : '',
        component: ProductDetailsComponent
    }
];
