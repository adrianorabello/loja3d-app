import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ChatAttachment } from 'app/core/chat/chat.model';

@Component({
    selector: 'app-chat-attachment',
    template: `
        <img *ngIf="preview" class="rounded-lg my-2 max-h-40 max-w-full object-contain" [src]="preview" [alt]="file.name">
        <button mat-button *ngIf="failed" (click)="load()">{{ 'chat.previewFailed' | translate }}</button>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatAttachmentComponent implements OnChanges, OnDestroy
{
    @Input() conversationId: string;
    @Input() file: ChatAttachment;
    preview: SafeUrl | null = null;
    failed = false;
    private url = '';
    private subscription: Subscription;

    constructor(private http: HttpClient, private sanitizer: DomSanitizer, private cdr: ChangeDetectorRef) {}

    ngOnChanges(): void { this.load(); }

    load(): void
    {
        this.clear();
        if ( !this.file?.contentType.startsWith('image/') || !['ready', 'attached'].includes(this.file.status) ) { return; }
        this.failed = false;
        this.subscription = this.http.get(`api/v1/chat/conversations/${this.conversationId}/attachments/${this.file.id}/content`, {
            responseType: 'blob'
        }).subscribe({
            next: blob => {
                this.url = URL.createObjectURL(blob);
                this.preview = this.sanitizer.bypassSecurityTrustUrl(this.url);
                this.cdr.markForCheck();
            },
            error: error => {
                console.error('Chat image preview failed', error.status);
                this.failed = true;
                this.cdr.markForCheck();
            }
        });
    }

    private clear(): void
    {
        this.subscription?.unsubscribe();
        if ( this.url ) { URL.revokeObjectURL(this.url); }
        this.url = ''; this.preview = null;
    }

    ngOnDestroy(): void { this.clear(); }
}
