import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FuseAlertModule } from '@fuse/components/alert';
import { SharedModule } from 'app/shared/shared.module';
import { RequestStatusNotificationsComponent } from './request-status-notifications.component';

@NgModule({
    declarations: [RequestStatusNotificationsComponent],
    imports: [RouterModule, SharedModule, MatButtonModule, MatIconModule, FuseAlertModule],
    exports: [RequestStatusNotificationsComponent]
})
export class RequestStatusNotificationsModule {}
