import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FuseAlertModule } from '@fuse/components/alert';
import { SharedModule } from 'app/shared/shared.module';
import { SharedComponentsModule } from 'app/shared/components/shared-components.module';
import { CustomerProfileComponent } from 'app/domains/customer/profile/profile.component';

@NgModule({
    declarations: [
        CustomerProfileComponent
    ],
    imports     : [
        RouterModule.forChild([{path: '', component: CustomerProfileComponent}]),
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        FuseAlertModule,
        SharedModule,
        SharedComponentsModule
    ]
})
export class CustomerProfileModule
{
}
