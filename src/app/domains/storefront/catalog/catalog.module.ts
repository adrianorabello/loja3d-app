import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FuseDrawerModule } from '@fuse/components/drawer';
import { SharedModule } from 'app/shared/shared.module';
import { SharedComponentsModule } from 'app/shared/components/shared-components.module';
import { CatalogComponent } from 'app/domains/storefront/catalog/catalog.component';
import { catalogRoutes } from 'app/domains/storefront/catalog/catalog.routing';

@NgModule({
    declarations: [
        CatalogComponent
    ],
    imports     : [
        RouterModule.forChild(catalogRoutes),
        MatBadgeModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        FuseDrawerModule,
        SharedModule,
        SharedComponentsModule
    ]
})
export class StorefrontCatalogModule
{
}
