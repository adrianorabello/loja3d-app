import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from 'app/shared/shared.module';
import { SharedComponentsModule } from 'app/shared/components/shared-components.module';
import { ProductDetailsComponent } from 'app/domains/storefront/product-details/product-details.component';
import { productDetailsRoutes } from 'app/domains/storefront/product-details/product-details.routing';

@NgModule({
    declarations: [
        ProductDetailsComponent
    ],
    imports     : [
        RouterModule.forChild(productDetailsRoutes),
        MatButtonModule,
        MatIconModule,
        SharedModule,
        SharedComponentsModule
    ]
})
export class StorefrontProductDetailsModule
{
}
