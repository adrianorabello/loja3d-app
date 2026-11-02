import { ChangeDetectionStrategy, Component, NgModule, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from 'app/core/chat/chat.service';
import { ChatModule } from 'app/shared/components/chat/chat.module';

@Component({
    selector: 'app-chat-page',
    template: '<app-chat-workspace></app-chat-workspace>',
    styles: [':host { display: flex; width: 100%; max-width: 1280px; margin: 24px auto; height: calc(100vh - 180px); min-height: 400px; }'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatPageComponent implements OnInit, OnDestroy
{
    private subscription: Subscription;
    constructor(private chat: ChatService, private route: ActivatedRoute) {}
    ngOnInit(): void
    {
        this.subscription = this.route.paramMap.subscribe(params => {
            if ( this.chat.enabled && params.get('id') ) { this.chat.select(params.get('id')); }
        });
    }
    ngOnDestroy(): void { this.subscription?.unsubscribe(); }
}

@NgModule({
    declarations: [ChatPageComponent],
    imports: [ChatModule, RouterModule.forChild([
        {path: '', component: ChatPageComponent},
        {path: ':id', component: ChatPageComponent}
    ])]
})
export class ChatPageModule {}
