import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { SharedModule } from 'app/shared/shared.module';
import { StorefrontLayoutComponent } from 'app/layout/layouts/storefront/storefront.component';

/**
 * Storefront layout module.
 *
 * Note what is NOT imported: none of the Fuse admin header widgets
 * (`MessagesModule`, `NotificationsModule`, `ShortcutsModule`, `SearchModule`,
 * `UserMenuModule`) and not `FuseHorizontalNavigationModule`. Every one of them is
 * either styled for admin chrome or depends on `InitialDataResolver` data this layout
 * deliberately does without.
 *
 * `SharedModule` supplies `CommonModule`, the reactive-forms directives for the search
 * box, and the `translate` pipe.
 */
@NgModule({
    declarations: [
        StorefrontLayoutComponent
    ],
    imports     : [
        RouterModule,
        MatButtonModule,
        MatDividerModule,
        MatIconModule,
        MatMenuModule,
        SharedModule
    ],
    exports     : [
        StorefrontLayoutComponent
    ]
})
export class StorefrontLayoutModule
{
}
