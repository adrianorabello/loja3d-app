import { Route } from '@angular/router';
import { ProductFormComponent } from 'app/domains/admin/products/form/product-form.component';
import { ProductListComponent } from 'app/domains/admin/products/list/product-list.component';
import { AdminProductResolver } from 'app/domains/admin/products/products.resolvers';

/**
 * One `ProductFormComponent` serves both `new` and `:id/edit`. It is in edit mode exactly
 * when the resolver supplied a product.
 *
 * `new` is listed before `:id/edit`. The two have different segment counts so they cannot
 * collide today, but keeping literals ahead of params is the rule everywhere else in the
 * route table.
 */
export const adminProductsRoutes: Route[] = [
    {
        path     : '',
        pathMatch: 'full',
        component: ProductListComponent
    },
    {
        path     : 'new',
        component: ProductFormComponent
    },
    {
        path     : ':id/edit',
        component: ProductFormComponent,
        resolve  : {
            product: AdminProductResolver
        }
    }
];
