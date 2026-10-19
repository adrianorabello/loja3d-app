import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SharedModule } from 'app/shared/shared.module';
import { CartPanelComponent } from 'app/shared/components/cart-panel/cart-panel.component';
import { ConfirmDialogComponent } from 'app/shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from 'app/shared/components/empty-state/empty-state.component';
import { PhoneInputComponent } from 'app/shared/components/phone-input/phone-input.component';
import { ProductCardComponent } from 'app/shared/components/product-card/product-card.component';
import { StockBadgeComponent } from 'app/shared/components/stock-badge/stock-badge.component';

/**
 * Clara Rosa's Material-using presentational widgets.
 *
 * Separate from `SharedModule` on purpose, and the reason is recorded in that module's own
 * header: `SharedModule` stays Material-free so every feature imports only the Mat modules
 * it actually uses. Anything that needs Material lives here instead, and importing this
 * module is an explicit opt-in.
 *
 * `A11yModule` is here for the cart panel's focus trap — `fuse-drawer` ships without one,
 * which is a real defect when it is an overlay.
 */
@NgModule({
    declarations: [
        CartPanelComponent,
        ConfirmDialogComponent,
        EmptyStateComponent,
        PhoneInputComponent,
        ProductCardComponent,
        StockBadgeComponent
    ],
    imports     : [
        RouterModule,
        A11yModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
        SharedModule
    ],
    exports     : [
        CartPanelComponent,
        ConfirmDialogComponent,
        EmptyStateComponent,
        PhoneInputComponent,
        ProductCardComponent,
        StockBadgeComponent
    ]
})
export class SharedComponentsModule
{
}
