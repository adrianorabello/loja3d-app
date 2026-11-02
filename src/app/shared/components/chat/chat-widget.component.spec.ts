import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, NavigationEnd } from '@angular/router';
import { BehaviorSubject, Subject } from 'rxjs';
import { ChatService } from 'app/core/chat/chat.service';
import { ChatWidgetComponent } from './chat-widget.component';

describe('ChatWidgetComponent automatic opening', () => {
    let fixture: ComponentFixture<ChatWidgetComponent>;
    let component: ChatWidgetComponent;
    let chat: Pick<ChatService, 'enabled' | 'user' | 'changes'>;
    let events: Subject<NavigationEnd>;
    let router: {url: string; events: Subject<NavigationEnd>};

    beforeEach(() => {
        events = new Subject<NavigationEnd>();
        router = {url: '/', events};
        chat = {enabled: true, user: null, changes: new BehaviorSubject(0)};
        TestBed.configureTestingModule({
            declarations: [ChatWidgetComponent],
            providers: [
                {provide: ChatService, useValue: chat},
                {provide: Router, useValue: router}
            ]
        });
        TestBed.overrideComponent(ChatWidgetComponent, {set: {template: ''}});
    });

    function mount(): void
    {
        fixture = TestBed.createComponent(ChatWidgetComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    }

    function signIn(id = 'customer-a'): void
    {
        chat.user = {id, name: 'Customer', email: 'customer@example.pt', role: 'CUSTOMER'};
        chat.changes.next(chat.changes.value + 1);
    }

    function navigate(url: string): void
    {
        router.url = url;
        events.next(new NavigationEnd(1, url, url));
    }

    afterEach(() => { fixture?.destroy(); events.complete(); chat.changes.complete(); });

    it('opens the right-hand panel when a customer signs in on a storefront page', () => {
        mount();
        expect(component.opened).toBe(false);
        signIn();
        expect(component.opened).toBe(true);
    });

    it('opens for an identity already restored before mounting', () => {
        signIn();
        mount();
        expect(component.opened).toBe(true);
    });

    it('does not open when the chat feature is disabled', () => {
        TestBed.overrideProvider(ChatService, {useValue: {...chat, enabled: false}});
        signIn();
        mount();
        expect(component.opened).toBe(false);
    });

    it('respects manual closing through updates and normal navigation', () => {
        mount();
        signIn();
        component.changed(false);
        chat.changes.next(2);
        navigate('/products');
        expect(component.opened).toBe(false);
    });

    it('waits until leaving authentication before automatically opening', () => {
        router.url = '/sign-in?redirectURL=%2Fproducts';
        mount();
        signIn();
        expect(component.opened).toBe(false);
        navigate('/products');
        expect(component.opened).toBe(true);
    });

    it('does not duplicate the compositor on dedicated chat routes with query strings', () => {
        router.url = '/account/chat?filter=unread';
        mount();
        signIn();
        expect(component.hidden).toBe(true);
        expect(component.opened).toBe(false);
        navigate('/products');
        expect(component.opened).toBe(true);
        navigate('/admin/chat/conversation-id');
        expect(component.opened).toBe(false);
    });

    it('clears automatic-opening state on logout and opens on the next sign-in', () => {
        mount();
        signIn();
        component.changed(false);
        chat.user = null;
        chat.changes.next(2);
        expect(component.opened).toBe(false);
        signIn();
        expect(component.opened).toBe(true);
    });

    it('opens for a different identity without inheriting the previous close decision', () => {
        mount();
        signIn();
        component.changed(false);
        signIn('customer-b');
        expect(component.opened).toBe(true);
    });
});
