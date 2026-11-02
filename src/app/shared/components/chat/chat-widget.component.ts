import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from 'app/core/chat/chat.service';

@Component({
    selector: 'app-chat-widget',
    template: `
        <ng-container *ngIf="chat.enabled">
            <!-- Keep Fuse mounted until its backdrop has finished closing on navigation. -->
            <button *ngIf="chat.user && !hidden" #launcher mat-fab color="primary" class="chat-launcher print:hidden" (click)="opened = !opened"
                [attr.aria-label]="'chat.title' | translate" [attr.aria-expanded]="opened">
                <mat-icon svgIcon="heroicons_outline:chat-alt-2"></mat-icon>
                <span *ngIf="chat.unread" class="chat-badge bg-card text-primary">{{ chat.unread }}</span>
            </button>
            <fuse-drawer class="chat-drawer print:hidden" name="support-chat" mode="over" position="right" [fixed]="true"
                [opened]="opened" (openedChanged)="changed($event)">
                <div *ngIf="opened" class="flex flex-col w-full h-full bg-card" role="dialog" [attr.aria-label]="'chat.title' | translate"
                    cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
                    <header class="flex items-center justify-between p-2 border-b">
                        <a mat-button [routerLink]="pageLink">{{ 'chat.fullPage' | translate }}</a>
                        <button mat-icon-button (click)="changed(false)" [attr.aria-label]="'chat.close' | translate">
                            <mat-icon svgIcon="heroicons_outline:x"></mat-icon>
                        </button>
                    </header>
                    <app-chat-workspace *ngIf="opened" class="flex-auto min-h-0" [compact]="true"></app-chat-workspace>
                </div>
            </fuse-drawer>
        </ng-container>`,
    styles: [`
        :host ::ng-deep .chat-drawer {
            width: 440px;
            min-width: 0;
            max-width: 100%;
        }
        .chat-launcher { position: fixed; right: 24px; bottom: 24px; z-index: 170; }
        .chat-badge { position: absolute; top: -4px; right: -4px; border-radius: 999px; padding: 2px 6px; font-size: 12px; }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatWidgetComponent implements OnDestroy
{
    @ViewChild('launcher', {read: ElementRef}) launcher: ElementRef<HTMLElement>;
    opened = false;
    hidden = false;
    private subscriptions = new Subscription();
    private autoOpenedForUser: string | null = null;

    constructor(public chat: ChatService, private router: Router, cdr: ChangeDetectorRef)
    {
        this.updateVisibility(router.url);
        this.subscriptions.add(chat.changes.subscribe(() => {
            this.updateOpenState();
            cdr.markForCheck();
        }));
        this.subscriptions.add(router.events.subscribe(event => {
            if ( !(event instanceof NavigationEnd) ) { return; }
            this.updateVisibility(event.urlAfterRedirects);
            this.updateOpenState();
            cdr.markForCheck();
        }));
    }

    private updateVisibility(url: string): void
    {
        const path = url.split(/[?#]/)[0];
        this.hidden = /^\/(?:account|admin)\/chat(?:\/|$)|^\/(?:sign-in|sign-up|sign-out|forgot-password|reset-password|unlock-session)(?:\/|$)/.test(path);
    }

    private updateOpenState(): void
    {
        if ( !this.chat.user ) {
            this.opened = false;
            this.autoOpenedForUser = null;
            return;
        }
        if ( !this.chat.enabled || this.hidden ) {
            this.opened = false;
            return;
        }
        if ( this.autoOpenedForUser !== this.chat.user.id ) {
            this.autoOpenedForUser = this.chat.user.id;
            this.opened = true;
        }
    }

    get pageLink(): string { return `${this.chat.admin ? '/admin' : '/account'}/chat${this.chat.selected ? '/' + this.chat.selected : ''}`; }
    changed(open: boolean): void { this.opened = open; if ( !open ) { this.launcher?.nativeElement.focus(); } }
    ngOnDestroy(): void { this.subscriptions.unsubscribe(); }
}
