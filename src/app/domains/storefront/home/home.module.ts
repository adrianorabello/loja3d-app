import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { SharedModule } from 'app/shared/shared.module';
import { SharedComponentsModule } from 'app/shared/components/shared-components.module';
import { StorefrontHomePageComponent } from 'app/domains/storefront/home/home.page';
import { HomeHeroComponent } from 'app/domains/storefront/home/components/home-hero/home-hero.component';
import { HomeHeroVisualComponent } from 'app/domains/storefront/home/components/home-hero-visual/home-hero-visual.component';
import { HomeCatalogComponent } from 'app/domains/storefront/home/components/home-catalog/home-catalog.component';
import { HomeCustomBannerComponent } from 'app/domains/storefront/home/components/home-custom-banner/home-custom-banner.component';
import { storefrontHomeRoutes } from 'app/domains/storefront/home/home.routing';

@NgModule({
    declarations: [
        StorefrontHomePageComponent,
        HomeHeroComponent,
        HomeHeroVisualComponent,
        HomeCatalogComponent,
        HomeCustomBannerComponent
    ],
    imports     : [
        RouterModule.forChild(storefrontHomeRoutes),
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule,
        SharedModule,
        SharedComponentsModule
    ]
})
export class StorefrontHomeModule
{
}
