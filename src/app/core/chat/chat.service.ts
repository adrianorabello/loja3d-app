import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormControl, Validators } from '@angular/forms';
import { BehaviorSubject, Subscription, timer } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import { UserService } from 'app/core/user/user.service';
import { User } from 'app/core/user/user.model';
import { environment } from 'environments/environment';
import { ChatAttachment, ChatConversation, ChatMessage, ChatPage } from './chat.model';
import { ChatRealtimeService } from './chat-realtime.service';

interface Draft
{
    text: string;
    attachments: ChatAttachment[];
    retry?: {key: string; fingerprint: string};
}

@Injectable({providedIn: 'root'})
export class ChatService
{
    readonly enabled = environment.chatEnabled && !environment.useMockApi;
    readonly changes = new BehaviorSubject<number>(0);
    readonly text = new FormControl('', Validators.maxLength(5000));
    readonly connection = this.realtime.status;
    user: User | null = null;
    conversations: ChatConversation[] = [];
    messages: ChatMessage[] = [];
    selected: string | null = null;
    hasOlder = false;
    listHasMore = false;
    loading = false;
    sending = false;
    uploading = false;
    error = '';
    listQuery = '';
    private drafts = new Map<string, Draft>();
    private histories = new Map<string, ChatMessage[]>();
    private attachmentWatches = new Map<string, Subscription>();
    private subscriptions = new Subscription();
    private generation = 0;
    private nextListCursor = '';
    private syncRunning = false;
    private syncAgain = false;
    private readPending = false;
    private listVersion = 0;

    constructor(private http: HttpClient, private users: UserService, private realtime: ChatRealtimeService)
    {
        if ( !this.enabled ) { return; }
        users.user$.subscribe(user => {
            if ( user?.id === this.user?.id && user?.role === this.user?.role ) { this.user = user; return; }
            this.reset();
            this.user = user;
            if ( user ) { this.realtime.start(); this.refreshList(); }
            this.notify();
        });
        realtime.events.subscribe(event => {
            if ( event.type === 'ready' || event.type === 'message.created' || event.type === 'read.updated' ) {
                this.refreshList();
                this.sync();
            }
        });
        window.addEventListener('focus', () => { if ( this.user ) { this.refreshList(); this.sync(); } });
        this.text.valueChanges.subscribe(value => {
            if ( this.selected ) { this.draft.text = value; }
        });
    }

    get draft(): Draft
    {
        if ( !this.selected ) { return {text: '', attachments: []}; }
        if ( !this.drafts.has(this.selected) ) { this.drafts.set(this.selected, {text: '', attachments: []}); }
        return this.drafts.get(this.selected);
    }

    get unread(): number { return this.conversations.reduce((total, item) => total + item.unread, 0); }
    get admin(): boolean { return this.user?.role === 'ADMIN'; }
    get selectedConversation(): ChatConversation | undefined { return this.conversations.find(item => item.id === this.selected); }
    get canSend(): boolean
    {
        return !!this.selected && !this.sending && !this.uploading && this.text.valid &&
            (!!String(this.text.value || '').trim() || !!this.draft.attachments.length) &&
            this.draft.attachments.every(file => file.status === 'ready');
    }

    notify(): void { this.changes.next(this.changes.value + 1); }

    refreshList(more = false): void
    {
        if ( !this.user ) { return; }
        const query = this.listQuery;
        const requestVersion = ++this.listVersion;
        const generation = this.generation;
        this.subscriptions.add(this.http.get<ChatPage<ChatConversation>>('api/v1/chat/conversations', {
            params: {q: query, cursor: more ? this.nextListCursor : '', limit: '50'}
        }).subscribe({
            next: page => {
                if ( generation !== this.generation || query !== this.listQuery || requestVersion !== this.listVersion ) { return; }
                this.conversations = more
                    ? Array.from(new Map([...this.conversations, ...page.items].map(item => [item.id, item])).values())
                    : page.items;
                this.listHasMore = page.hasMore;
                this.nextListCursor = String(page.nextCursor || '');
                this.notify();
            },
            error: error => this.fail(error)
        }));
    }

    startConversation(): void
    {
        if ( this.loading || !this.user ) { return; }
        this.loading = true;
        this.subscriptions.add(this.http.post<ChatConversation>('api/v1/chat/conversations', {}).subscribe({
            next: conversation => {
                this.loading = false;
                this.refreshList();
                this.select(conversation.id);
            },
            error: error => { this.loading = false; this.fail(error); }
        }));
    }

    select(id: string): void
    {
        if ( this.sending || this.uploading || id === this.selected ) { return; }
        this.selected = id;
        this.text.setValue(this.draft.text, {emitEvent: false});
        this.messages = this.histories.get(id) || [];
        this.error = '';
        this.loadHistory();
    }

    loadHistory(older = false): void
    {
        const cid = this.selected;
        if ( !cid || this.loading ) { return; }
        this.loading = true;
        this.notify();
        const params: {[key: string]: string} = {limit: '50'};
        if ( older && this.messages.length ) { params.beforeSeq = String(this.messages[0].seq); }
        this.subscriptions.add(this.http.get<ChatPage<ChatMessage>>(`api/v1/chat/conversations/${cid}/messages`, {params}).subscribe({
            next: page => {
                this.loading = false;
                if ( this.selected !== cid ) { this.loadHistory(); this.notify(); return; }
                this.merge(cid, page.items);
                this.hasOlder = page.hasMore;
                this.notify();
            },
            error: error => { this.loading = false; this.fail(error); }
        }));
    }

    sync(): void
    {
        const cid = this.selected;
        if ( !cid ) { return; }
        if ( !this.histories.has(cid) ) { if ( !this.loading ) { this.loadHistory(); } return; }
        if ( this.syncRunning ) { this.syncAgain = true; return; }
        this.syncRunning = true;
        const items = this.histories.get(cid) || [];
        const lastSeq = this.contiguousSeq(items);
        this.subscriptions.add(this.http.get<ChatPage<ChatMessage>>(`api/v1/chat/conversations/${cid}/messages`, {
            params: {afterSeq: String(lastSeq), limit: '100'}
        }).subscribe({
            next: page => {
                this.merge(cid, page.items);
                this.syncRunning = false;
                if ( page.hasMore || this.syncAgain || cid !== this.selected ) {
                    this.syncAgain = false;
                    this.sync();
                }
                this.notify();
            },
            error: error => { this.syncRunning = false; this.fail(error); }
        }));
    }

    send(): void
    {
        const cid = this.selected;
        const draft = this.draft;
        const text = String(this.text.value || '').trim();
        if ( !this.canSend ) { return; }
        const attachmentIds = draft.attachments.map(file => file.id);
        const fingerprint = JSON.stringify({text, attachmentIds});
        if ( draft.retry?.fingerprint !== fingerprint ) {
            const bytes = crypto.getRandomValues(new Uint8Array(16));
            bytes[6] = (bytes[6] & 15) | 64;
            bytes[8] = (bytes[8] & 63) | 128;
            const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
            draft.retry = {key: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`, fingerprint};
        }
        this.sending = true;
        this.error = '';
        this.text.disable({emitEvent: false});
        this.notify();
        this.subscriptions.add(this.http.post<ChatMessage>(`api/v1/chat/conversations/${cid}/messages`, {
            clientMessageId: draft.retry.key, text, attachmentIds
        }).subscribe({
            next: message => {
                this.merge(cid, [message]);
                this.drafts.set(cid, {text: '', attachments: []});
                this.sending = false;
                this.text.enable({emitEvent: false});
                this.text.setValue('', {emitEvent: false});
                this.refreshList();
                this.notify();
            },
            error: error => {
                this.sending = false;
                this.text.enable({emitEvent: false});
                this.fail(error);
            }
        }));
    }

    upload(file: File): void
    {
        const cid = this.selected;
        if ( !cid || this.sending || this.uploading ) { return; }
        if ( file.size > 10 * 1024 * 1024 || !file.size || !/\.(jpe?g|png|pdf|stl|3mf)$/i.test(file.name) || this.draft.attachments.length >= 3 ) {
            this.error = 'chat.invalidFile'; this.notify(); return;
        }
        const form = new FormData();
        form.append('file', file);
        this.uploading = true;
        this.notify();
        this.subscriptions.add(this.http.post<ChatAttachment>(`api/v1/chat/conversations/${cid}/attachments`, form).subscribe({
            next: item => {
                this.uploading = false;
                this.draft.attachments.push(item);
                this.notify();
                this.watchAttachment(cid, item.id);
            },
            error: error => { this.uploading = false; this.fail(error); }
        }));
    }

    watchAttachment(cid: string, aid: string): void
    {
        this.attachmentWatches.get(aid)?.unsubscribe();
        const subscription = timer(1000, 2000).pipe(
            switchMap(() => this.http.get<ChatAttachment>(`api/v1/chat/conversations/${cid}/attachments/${aid}`)),
            takeWhile(item => item.status === 'quarantined' || item.status === 'uploading', true)
        ).subscribe({
            next: item => {
                const draft = this.drafts.get(cid);
                if ( draft ) { draft.attachments = draft.attachments.map(file => file.id === aid ? item : file); }
                this.notify();
            },
            error: error => this.fail(error)
        });
        this.attachmentWatches.set(aid, subscription);
        this.subscriptions.add(subscription);
    }

    retry(): void
    {
        this.error = '';
        this.refreshList();
        this.sync();
        for ( const file of this.draft.attachments ) {
            if ( file.status === 'uploading' || file.status === 'quarantined' ) { this.watchAttachment(this.selected, file.id); }
        }
    }

    removeAttachment(file: ChatAttachment): void
    {
        const cid = this.selected;
        if ( !cid || this.sending ) { return; }
        this.subscriptions.add(this.http.delete(`api/v1/chat/conversations/${cid}/attachments/${file.id}`).subscribe({
            next: () => {
                this.attachmentWatches.get(file.id)?.unsubscribe();
                this.attachmentWatches.delete(file.id);
                this.draft.attachments = this.draft.attachments.filter(item => item.id !== file.id);
                this.notify();
            },
            error: error => this.fail(error)
        }));
    }

    download(file: ChatAttachment): void
    {
        const cid = this.selected;
        this.subscriptions.add(this.http.get(`api/v1/chat/conversations/${cid}/attachments/${file.id}/content`, {
            responseType: 'blob'
        }).subscribe({
            next: blob => {
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement('a');
                anchor.href = url; anchor.download = file.name; anchor.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            },
            error: error => this.fail(error)
        }));
    }

    markRead(): void
    {
        const cid = this.selected;
        const seq = this.contiguousSeq(this.messages);
        const conversation = this.conversations.find(item => item.id === cid);
        if ( this.readPending || !cid || !seq || !conversation || seq <= conversation.lastReadSeq ) { return; }
        this.readPending = true;
        this.subscriptions.add(this.http.put<{lastReadSeq: number}>(`api/v1/chat/conversations/${cid}/read`, {
            lastReadSeq: seq
        }).subscribe({
            next: marker => {
                this.readPending = false;
                conversation.lastReadSeq = Math.max(conversation.lastReadSeq, marker.lastReadSeq);
                if ( marker.lastReadSeq >= conversation.lastSeq ) { conversation.unread = 0; }
                this.notify();
            },
            error: error => { this.readPending = false; this.fail(error); }
        }));
    }

    private merge(cid: string, items: ChatMessage[]): void
    {
        const byId = new Map((this.histories.get(cid) || []).map(message => [message.id, message]));
        items.forEach(item => byId.set(item.id, item));
        const merged = Array.from(byId.values()).sort((a, b) => a.seq - b.seq);
        this.histories.set(cid, merged);
        if ( cid === this.selected ) { this.messages = merged; }
    }

    private contiguousSeq(items: ChatMessage[]): number
    {
        let seq = items.length ? items[0].seq : 0;
        for ( const item of items ) {
            if ( item.seq > seq + 1 ) { break; }
            seq = item.seq;
        }
        return seq;
    }

    private fail(error: HttpErrorResponse): void
    {
        console.error('Chat request failed', error.status);
        const errors: {[key: number]: string} = {
            503: 'chat.unavailable', 429: 'chat.rateLimit', 413: 'chat.invalidFile',
            415: 'chat.invalidFile', 422: 'chat.invalidContent', 409: 'chat.conflict'
        };
        this.error = errors[error.status] || 'chat.requestFailed';
        this.notify();
    }

    private reset(): void
    {
        this.generation++;
        this.subscriptions.unsubscribe();
        this.subscriptions = new Subscription();
        this.realtime.stop();
        this.drafts.clear(); this.histories.clear(); this.attachmentWatches.clear();
        this.messages = []; this.conversations = []; this.selected = null;
        this.loading = this.sending = this.uploading = this.syncRunning = this.syncAgain = false;
        this.readPending = false;
        this.error = ''; this.listQuery = '';
        this.text.enable({emitEvent: false});
        this.text.setValue('', {emitEvent: false});
    }
}
