import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FuseAlertModule } from '@fuse/components/alert';
import { SharedModule } from 'app/shared/shared.module';
import { SharedComponentsModule } from 'app/shared/components/shared-components.module';
import { ProductFormComponent } from 'app/domains/admin/products/form/product-form.component';
import { ProductListComponent } from 'app/domains/admin/products/list/product-list.component';
import { adminProductsRoutes } from 'app/domains/admin/products/products.routing';

@NgModule({
    declarations: [
        ProductFormComponent,
        ProductListComponent
    ],
    imports     : [
        RouterModule.forChild(adminProductsRoutes),
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatRippleModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatSortModule,
        MatTableModule,
        MatTooltipModule,
        FuseAlertModule,
        SharedModule,
        SharedComponentsModule
    ]
})
export class AdminProductsModule
{
}
