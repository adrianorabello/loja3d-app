import { NgModule } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { UserMenuComponent } from 'app/layout/common/user-menu/user-menu.component';
import { SharedModule } from 'app/shared/shared.module';
import { RouterModule } from '@angular/router';
import { UserAvatarModule } from 'app/shared/components/user-avatar/user-avatar.module';

@NgModule({
    declarations: [
        UserMenuComponent
    ],
    imports     : [
        MatButtonModule,
        MatDividerModule,
        MatIconModule,
        MatMenuModule,
        SharedModule,
        RouterModule,
        UserAvatarModule
    ],
    exports     : [
        UserMenuComponent
    ]
})
export class UserMenuModule
{
}
