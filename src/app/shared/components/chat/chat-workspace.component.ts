import { AfterViewChecked, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ChatService } from 'app/core/chat/chat.service';
import { ChatMessage } from 'app/core/chat/chat.model';

@Component({
    selector: 'app-chat-workspace',
    templateUrl: './chat-workspace.component.html',
    styleUrls: ['./chat-workspace.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatWorkspaceComponent implements OnInit, OnDestroy, AfterViewChecked
{
    @Input() compact = false;
    @ViewChild('history') history: ElementRef<HTMLElement>;
    showList = true;
    private subscriptions = new Subscription();
    private search = new Subject<string>();
    private nearBottom = true;
    private previousCount = 0;
    private previousConversation = '';
    private oldHeight = 0;
    private destroyed = false;
    private lastReadCandidate = '';

    constructor(public chat: ChatService, private cdr: ChangeDetectorRef) {}

    ngOnInit(): void
    {
        this.showList = !this.chat.selected;
        this.subscriptions.add(this.chat.changes.subscribe(() => {
            if ( this.chat.selected && this.chat.selected !== this.previousConversation ) { this.showList = false; }
            this.cdr.markForCheck();
        }));
        this.subscriptions.add(this.search.pipe(debounceTime(300), distinctUntilChanged()).subscribe(query => {
            this.chat.listQuery = query;
            this.chat.refreshList();
        }));
    }

    ngAfterViewChecked(): void
    {
        const element = this.history?.nativeElement;
        if ( !element ) { return; }
        if ( this.oldHeight && !this.chat.loading ) {
            element.scrollTop += element.scrollHeight - this.oldHeight;
            this.oldHeight = 0;
        }
        else if ( this.chat.selected !== this.previousConversation || (this.nearBottom && this.chat.messages.length !== this.previousCount) ) {
            element.scrollTop = element.scrollHeight;
        }
        this.previousConversation = this.chat.selected;
        this.previousCount = this.chat.messages.length;
        // Defer read state changes until after the current Angular check.
        const candidate = `${this.chat.selected}:${this.chat.messages[this.chat.messages.length - 1]?.seq}:${this.chat.messages.length}`;
        if ( candidate !== this.lastReadCandidate && !this.showList && this.nearBottom &&
            document.visibilityState === 'visible' && document.hasFocus() ) {
            this.lastReadCandidate = candidate;
            Promise.resolve().then(() => { if ( !this.destroyed ) { this.chat.markRead(); } });
        }
    }

    @HostListener('window:focus')
    focused(): void
    {
        if ( !this.showList && this.nearBottom && document.visibilityState === 'visible' ) { this.chat.markRead(); }
    }

    scrolled(): void
    {
        const element = this.history.nativeElement;
        this.nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        if ( this.nearBottom ) { this.focused(); }
    }

    older(): void
    {
        this.oldHeight = this.history.nativeElement.scrollHeight;
        this.chat.loadHistory(true);
    }

    select(id: string): void
    {
        this.chat.select(id);
        this.showList = false;
        this.nearBottom = true;
    }

    query(event: Event): void { this.search.next((event.target as HTMLInputElement).value); }

    fileSelected(event: Event): void
    {
        const input = event.target as HTMLInputElement;
        if ( input.files?.length ) { this.chat.upload(input.files[0]); }
        input.value = '';
    }

    keydown(event: KeyboardEvent): void
    {
        if ( event.key === 'Enter' && !event.shiftKey && !event.isComposing ) {
            event.preventDefault();
            this.chat.send();
        }
    }

    day(message: ChatMessage): string
    {
        const date = new Date(message.createdAt);
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }

    trackMessage(index: number, message: ChatMessage): string { return message.id; }
    ngOnDestroy(): void { this.destroyed = true; this.subscriptions.unsubscribe(); this.search.complete(); }
}
