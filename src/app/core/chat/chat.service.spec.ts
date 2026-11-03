import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BehaviorSubject, Subject } from 'rxjs';
import { ChatService } from './chat.service';
import { ChatRealtimeService } from './chat-realtime.service';
import { UserService } from 'app/core/user/user.service';
import { environment } from 'environments/environment';
import { ChatMessage } from './chat.model';

describe('ChatService', () => {
    let service: ChatService;
    let http: HttpTestingController;
    const user = {id: 'customer-a', name: 'Customer', role: 'CUSTOMER'};
    let users: BehaviorSubject<unknown>;
    let realtime: {start: jasmine.Spy; stop: jasmine.Spy; status: BehaviorSubject<string>; events: Subject<unknown>};
    let enabled: boolean;
    let visibility: jasmine.Spy;
    let online: jasmine.Spy;

    beforeEach(() => {
        jasmine.clock().install();
        visibility = spyOnProperty(document, 'visibilityState', 'get').and.returnValue('visible');
        online = spyOnProperty(navigator, 'onLine', 'get').and.returnValue(true);
        enabled = environment.chatEnabled;
        environment.chatEnabled = true;
        users = new BehaviorSubject(null);
        realtime = {start: jasmine.createSpy(), stop: jasmine.createSpy(), status: new BehaviorSubject('connected'), events: new Subject()};
        TestBed.configureTestingModule({
            imports: [HttpClientTestingModule],
            providers: [
                {provide: UserService, useValue: {user$: users}},
                {provide: ChatRealtimeService, useValue: realtime}
            ]
        });
        service = TestBed.inject(ChatService);
        http = TestBed.inject(HttpTestingController);
        users.next(user);
        list();
    });

    function list(): void
    {
        http.expectOne(request => request.url === 'api/v1/chat/conversations').flush({
            items: [{id: 'c1', customerName: 'Customer', lastSeq: 0, lastReadSeq: 0, unread: 0}],
            hasMore: false, nextCursor: null
        });
    }

    function select(): void
    {
        service.select('c1');
        http.expectOne('api/v1/chat/conversations/c1/messages?limit=50').flush({items: [], hasMore: false});
    }

    function message(id: string, seq: number): ChatMessage
    {
        return {id, seq, conversationId: 'c1', sender: {id: user.id, name: user.name, role: user.role},
            clientMessageId: 'key', text: 'Hello', createdAt: '2026-11-02T10:00:00Z', attachments: []};
    }

    afterEach(() => {
        users.next(null);
        http.verify({ignoreCancelled: true});
        environment.chatEnabled = enabled;
        jasmine.clock().uninstall();
    });

    it('uses one realtime connection across profile updates and clears drafts on logout', () => {
        select();
        service.text.setValue('Private draft');
        users.next({...user, name: 'New name'});
        expect(realtime.start).toHaveBeenCalledTimes(1);
        expect(service.text.value).toBe('Private draft');
        users.next(null);
        expect(service.messages).toEqual([]);
        expect(service.text.value).toBe('');
        expect(service.selected).toBeNull();
    });

    it('preserves failed text and retries with the same idempotency key without duplicate sends', () => {
        select();
        service.text.setValue('Hello');
        service.send();
        service.send();
        const first = http.expectOne('api/v1/chat/conversations/c1/messages');
        const key = first.request.body.clientMessageId;
        first.flush({detail: 'Unavailable'}, {status: 503, statusText: 'Unavailable'});
        expect(service.text.value).toBe('Hello');
        service.send();
        const retry = http.expectOne('api/v1/chat/conversations/c1/messages');
        expect(retry.request.body.clientMessageId).toBe(key);
        retry.flush(message('m1', 1));
        list();
        expect(service.messages.length).toBe(1);
        expect(service.text.value).toBe('');
    });

    it('merges duplicate websocket synchronization without duplicating a message', () => {
        select();
        service.sync();
        http.expectOne('api/v1/chat/conversations/c1/messages?afterSeq=0&limit=100').flush({items: [message('m1', 1)], hasMore: false});
        service.sync();
        http.expectOne('api/v1/chat/conversations/c1/messages?afterSeq=1&limit=100').flush({items: [message('m1', 1)], hasMore: false});
        expect(service.messages.map(item => item.id)).toEqual(['m1']);
    });

    it('receives new messages within ten seconds without socket events, reloads or focus changes', () => {
        select();
        jasmine.clock().tick(9999);
        http.expectNone(request => request.url.includes('/messages'));
        jasmine.clock().tick(1);
        list();
        http.expectOne('api/v1/chat/conversations/c1/messages?afterSeq=0&limit=100').flush({
            items: [message('incoming', 1)], hasMore: false
        });
        expect(service.messages.map(item => item.id)).toEqual(['incoming']);
        expect(realtime.status.value).toBe('connected');
        jasmine.clock().tick(10000);
        list();
        http.expectOne('api/v1/chat/conversations/c1/messages?afterSeq=1&limit=100').flush({
            items: [message('incoming', 1), message('next', 2)], hasMore: false
        });
        expect(service.messages.map(item => item.id)).toEqual(['incoming', 'next']);
    });

    it('continues to synchronize immediately on websocket events', () => {
        select();
        realtime.events.next({v: 1, type: 'message.created'});
        list();
        http.expectOne('api/v1/chat/conversations/c1/messages?afterSeq=0&limit=100').flush({
            items: [message('live', 1)], hasMore: false
        });
        expect(service.messages[0].id).toBe('live');
    });

    it('refreshes conversation summaries without requiring a selected conversation', () => {
        jasmine.clock().tick(10000);
        http.expectOne(request => request.url === 'api/v1/chat/conversations').flush({
            items: [{id: 'c1', customerName: 'Customer', lastSeq: 1, lastReadSeq: 0, unread: 1}],
            hasMore: false, nextCursor: null
        });
        expect(service.unread).toBe(1);
        http.expectNone(request => request.url.includes('/messages'));
    });

    it('does not overlap periodic list requests while an earlier request is pending', () => {
        jasmine.clock().tick(10000);
        const pending = http.expectOne(request => request.url === 'api/v1/chat/conversations');
        jasmine.clock().tick(20000);
        http.expectNone(request => request.url === 'api/v1/chat/conversations');
        pending.flush({items: [], hasMore: false, nextCursor: null});
        jasmine.clock().tick(10000);
        list();
        expect(service.conversations[0].id).toBe('c1');
    });

    it('skips background and offline polling and resumes on the next visible online tick', () => {
        visibility.and.returnValue('hidden');
        jasmine.clock().tick(10000);
        http.expectNone(request => request.url === 'api/v1/chat/conversations');
        visibility.and.returnValue('visible');
        online.and.returnValue(false);
        jasmine.clock().tick(10000);
        http.expectNone(request => request.url === 'api/v1/chat/conversations');
        online.and.returnValue(true);
        jasmine.clock().tick(10000);
        list();
        expect(service.conversations.length).toBe(1);
    });

    it('stops polling on logout and starts only one timer for the next identity', () => {
        users.next({...user, name: 'Updated'});
        jasmine.clock().tick(10000);
        list();
        expect(realtime.start).toHaveBeenCalledTimes(1);
        users.next(null);
        jasmine.clock().tick(20000);
        http.expectNone(request => request.url === 'api/v1/chat/conversations');
        users.next({...user, id: 'customer-b'});
        list();
        jasmine.clock().tick(10000);
        list();
        expect(realtime.start).toHaveBeenCalledTimes(2);
    });

    it('retries a failed periodic sync without clearing the draft or duplicating messages', () => {
        select();
        service.text.setValue('Unsent draft');
        jasmine.clock().tick(10000);
        list();
        http.expectOne('api/v1/chat/conversations/c1/messages?afterSeq=0&limit=100').flush(
            {}, {status: 503, statusText: 'Unavailable'}
        );
        expect(service.error).toBe('chat.unavailable');
        expect(service.text.value).toBe('Unsent draft');
        jasmine.clock().tick(10000);
        list();
        http.expectOne('api/v1/chat/conversations/c1/messages?afterSeq=0&limit=100').flush({
            items: [message('recovered', 1)], hasMore: false
        });
        expect(service.messages.map(item => item.id)).toEqual(['recovered']);
        expect(service.text.value).toBe('Unsent draft');
    });

    it('repairs sequence gaps when the HTTP response arrives before an earlier event', () => {
        select();
        service.sync();
        http.expectOne('api/v1/chat/conversations/c1/messages?afterSeq=0&limit=100').flush({
            items: [message('m1', 1), message('m3', 3)], hasMore: false
        });
        service.sync();
        http.expectOne('api/v1/chat/conversations/c1/messages?afterSeq=1&limit=100').flush({
            items: [message('m2', 2), message('m3', 3)], hasMore: false
        });
        expect(service.messages.map(item => item.seq)).toEqual([1, 2, 3]);
    });

    it('blocks empty, excessive or pending-file messages', () => {
        select();
        service.send();
        service.text.setValue('x'.repeat(5001));
        service.send();
        service.text.setValue('');
        service.draft.attachments.push({id: 'a1', name: 'a.pdf', contentType: 'application/pdf', size: 2, status: 'quarantined'});
        service.send();
        http.expectNone('api/v1/chat/conversations/c1/messages');
        expect(service.sending).toBe(false);
    });

    it('cancels old-session requests before another identity can observe their data', () => {
        service.select('c1');
        const request = http.expectOne('api/v1/chat/conversations/c1/messages?limit=50');
        users.next({...user, id: 'customer-b'});
        expect(request.cancelled).toBe(true);
        list();
        expect(service.messages).toEqual([]);
    });
});
