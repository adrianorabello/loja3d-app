import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from 'app/shared/shared.module';
import { KidsStoreComponent } from 'app/domains/storefront/kids-store/kids-store.component';
import { kidsStoreRoutes } from 'app/domains/storefront/kids-store/kids-store.routing';

@NgModule({
    declarations: [
        KidsStoreComponent
    ],
    imports     : [
        RouterModule.forChild(kidsStoreRoutes),
        MatButtonModule,
        MatIconModule,
        SharedModule
    ]
})
export class KidsStoreModule
{
}
