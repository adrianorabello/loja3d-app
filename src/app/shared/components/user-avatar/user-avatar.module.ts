import { NgModule } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { SharedModule } from 'app/shared/shared.module';
import { UserAvatarComponent } from './user-avatar.component';

@NgModule({
    declarations: [UserAvatarComponent],
    imports: [SharedModule, MatIconModule],
    exports: [UserAvatarComponent]
})
export class UserAvatarModule {}
