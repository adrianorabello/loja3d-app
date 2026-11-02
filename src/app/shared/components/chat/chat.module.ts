import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslateModule } from '@ngx-translate/core';
import { FuseAlertModule } from '@fuse/components/alert';
import { FuseDrawerModule } from '@fuse/components/drawer';
import { FuseAutogrowModule } from '@fuse/directives/autogrow';
import { ChatWorkspaceComponent } from './chat-workspace.component';
import { ChatWidgetComponent } from './chat-widget.component';
import { ChatAttachmentComponent } from './chat-attachment.component';

@NgModule({
    declarations: [ChatWorkspaceComponent, ChatWidgetComponent, ChatAttachmentComponent],
    imports: [
        CommonModule, ReactiveFormsModule, RouterModule, A11yModule, MatButtonModule, MatIconModule,
        MatProgressBarModule, TranslateModule, FuseAlertModule, FuseDrawerModule, FuseAutogrowModule
    ],
    exports: [ChatWorkspaceComponent, ChatWidgetComponent]
})
export class ChatModule {}
