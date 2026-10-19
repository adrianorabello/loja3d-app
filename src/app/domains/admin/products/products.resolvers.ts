import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve, Router } from '@angular/router';
import { EMPTY, Observable } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ProductService } from 'app/core/product/product.service';
import { Product } from 'app/shared/models/product.model';

/**
 * Loads the product for `/admin/products/:id/edit`, active or not.
 *
 * An unknown id sends the admin back to the list instead of opening an empty form: an
 * empty form at an edit URL would silently turn "save" into a create.
 */
@Injectable({
    providedIn: 'root'
})
export class AdminProductResolver implements Resolve<Product>
{
    /**
     * Constructor
     */
    constructor(
        private _productService: ProductService,
        private _router: Router
    )
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Resolver
     *
     * @param route
     */
    resolve(route: ActivatedRouteSnapshot): Observable<Product>
    {
        return this._productService.getProductById(route.paramMap.get('id')).pipe(
            catchError(() => {
                this._router.navigateByUrl('/admin/products');

                // EMPTY cancels the navigation that triggered the resolve.
                return EMPTY;
            })
        );
    }
}
