import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from 'app/core/auth/auth.service';
import { UserService } from 'app/core/user/user.service';
import { PrintRequest, RequestHistory } from './print-request.model';
import { RequestStatusNotificationsComponent } from './request-status-notifications.component';
import { RequestStatusNotificationsModule } from './request-status-notifications.module';

describe('Request status notifications', () => {
    let fixture: ComponentFixture<RequestStatusNotificationsComponent>;
    let http: HttpTestingController;
    let users: UserService;
    const customer = {id: 'customer-1', name: 'Customer', email: 'customer@example.com', role: 'CUSTOMER' as const};
    const baselineEvent: RequestHistory = {
        id: 'created', kind: 'request_submitted', actorRole: 'customer', actorName: 'Customer',
        message: '', status: 'submitted', createdAt: '2026-01-01T00:00:00Z'
    };
    const request = (history: RequestHistory[] = [baselineEvent], id = 'request-1'): PrintRequest => ({
        id, reference: 'CR-TEST', ownerId: customer.id, customerName: customer.name, customerEmail: customer.email,
        title: 'My print', description: 'A custom print', quantity: 1, dimensions: '1 cm', material: '', color: '',
        referenceLinks: [], status: history[history.length - 1].status, version: history.length,
        createdAt: baselineEvent.createdAt, updatedAt: history[history.length - 1].createdAt,
        quotes: [], history, allowedActions: [], allowedTransitions: []
    });
    const update = (extra: Partial<RequestHistory> = {}): RequestHistory => ({
        id: 'updated', kind: 'status_changed', actorRole: 'admin', actorName: 'Team', message: 'Under review',
        status: 'under_review', createdAt: new Date().toISOString(), ...extra
    });

    beforeEach(() => {
        localStorage.removeItem('access_token');
        TestBed.configureTestingModule({
            imports: [
                RequestStatusNotificationsModule, HttpClientTestingModule, RouterTestingModule,
                NoopAnimationsModule, MatIconTestingModule, TranslateModule.forRoot()
            ],
            providers: [AuthService]
        });
        http = TestBed.inject(HttpTestingController);
        users = TestBed.inject(UserService);
        TestBed.inject(AuthService).accessToken =
            `header.${btoa(JSON.stringify({exp: Math.floor(Date.now() / 1000) + 3600}))}.signature`;
        fixture = TestBed.createComponent(RequestStatusNotificationsComponent);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
        http.verify();
        localStorage.removeItem('access_token');
    });

    function poll(items: PrintRequest[], page = 1, total = items.length): void
    {
        const pending = http.expectOne(req => req.url === 'api/v1/print-requests' && req.params.get('page') === String(page));
        expect(pending.request.params.get('pageSize')).toBe('100');
        pending.flush({items, total, page, pageSize: 100});
    }

    it('uses the first response as baseline and shows one Fuse alert for each new team status change', fakeAsync(() => {
        users.user = customer;
        tick(0);
        poll([request()]);
        expect(fixture.componentInstance.notices.length).toBe(0);
        tick(15000);
        poll([request([baselineEvent, update()])]);
        fixture.detectChanges();
        expect(fixture.componentInstance.notices.length).toBe(1);
        expect(fixture.nativeElement.querySelector('fuse-alert').textContent).toContain('My print');
        expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/account/requests/request-1');
        tick(9999);
        expect(fixture.componentInstance.notices.length).toBe(1);
        tick(1);
        expect(fixture.componentInstance.notices.length).toBe(0);
        tick(5000);
        poll([request([baselineEvent, update()])]);
        expect(fixture.componentInstance.notices.length).toBe(0);
        fixture.destroy();
    }));

    it('does not notify historical events, customer actions or admin messages without a status change', fakeAsync(() => {
        users.user = customer;
        tick(0);
        poll([request([baselineEvent, update({createdAt: '2026-01-01T01:00:00Z'})])]);
        tick(15000);
        poll([request([
            baselineEvent, update({createdAt: '2026-01-01T01:00:00Z'}),
            update({id: 'message', kind: 'admin_message'}),
            update({id: 'cancel', actorRole: 'customer', status: 'cancelled'})
        ])]);
        expect(fixture.componentInstance.notices.length).toBe(0);
        fixture.destroy();
    }));

    it('reads all pages and does not overlap slow requests', fakeAsync(() => {
        users.user = customer;
        tick(0);
        tick(15000);
        poll([request()], 1, 101);
        poll([request([baselineEvent], 'request-101')], 2, 101);
        tick(15000);
        poll([request()], 1, 101);
        poll([request([baselineEvent, update()], 'request-101')], 2, 101);
        expect(fixture.componentInstance.notices[0].requestId).toBe('request-101');
        fixture.destroy();
    }));

    it('surfaces polling failures and recovers without losing the baseline', fakeAsync(() => {
        spyOn(console, 'error');
        users.user = customer;
        tick(0);
        poll([request()]);
        tick(15000);
        http.expectOne(req => req.url === 'api/v1/print-requests').flush({}, {status: 503, statusText: 'Unavailable'});
        fixture.detectChanges();
        expect(fixture.componentInstance.pollingError).toBeTrue();
        expect(fixture.nativeElement.textContent).toContain('requests.notificationCheckError');
        tick(15000);
        poll([request([baselineEvent, update()])]);
        expect(fixture.componentInstance.pollingError).toBeFalse();
        expect(fixture.componentInstance.notices.length).toBe(1);
        fixture.destroy();
    }));

    it('clears alerts and polling on sign-out and does not poll for administrators', fakeAsync(() => {
        users.user = customer;
        tick(0);
        poll([request()]);
        tick(15000);
        poll([request([baselineEvent, update()])]);
        TestBed.inject(AuthService).signOut().subscribe();
        expect(fixture.componentInstance.notices.length).toBe(0);
        tick(30000);
        http.expectNone(req => req.url === 'api/v1/print-requests');
        users.user = {...customer, role: 'ADMIN'};
        tick(30000);
        http.expectNone(req => req.url === 'api/v1/print-requests');
        fixture.destroy();
    }));

    it('keeps the baseline on profile updates, supports manual dismissal and stops on destroy', fakeAsync(() => {
        users.user = customer;
        tick(0);
        poll([request()]);
        users.user = {...customer, name: 'Updated name'};
        tick(15000);
        poll([request([baselineEvent, update()])]);
        fixture.detectChanges();
        fixture.nativeElement.querySelector('button').click();
        expect(fixture.componentInstance.notices.length).toBe(0);
        fixture.destroy();
        tick(30000);
        http.expectNone(req => req.url === 'api/v1/print-requests');
    }));

    it('does not partially process pages when a later page fails', fakeAsync(() => {
        spyOn(console, 'error');
        users.user = customer;
        tick(0);
        poll([request()], 1, 101);
        http.expectOne(req => req.params.get('page') === '2').flush({}, {status: 503, statusText: 'Unavailable'});
        tick(15000);
        poll([request([baselineEvent, update()])], 1, 101);
        poll([request([baselineEvent], 'request-101')], 2, 101);
        expect(fixture.componentInstance.notices.length).toBe(0);
        expect(fixture.componentInstance.pollingError).toBeFalse();
        fixture.destroy();
    }));

    it('cancels in-flight polling and establishes a new baseline when the customer changes', fakeAsync(() => {
        users.user = customer;
        tick(0);
        const pending = http.expectOne(req => req.url === 'api/v1/print-requests');
        users.user = {...customer, id: 'customer-2'};
        expect(pending.cancelled).toBeTrue();
        tick(0);
        poll([request([baselineEvent, update()])]);
        expect(fixture.componentInstance.notices.length).toBe(0);
        fixture.destroy();
    }));

    it('skips guests and expired tokens and resets alerts on expiry', fakeAsync(() => {
        tick(15000);
        http.expectNone(req => req.url === 'api/v1/print-requests');
        users.user = customer;
        tick(0);
        poll([request()]);
        tick(15000);
        poll([request([baselineEvent, update()])]);
        TestBed.inject(AuthService).accessToken =
            `header.${btoa(JSON.stringify({exp: Math.floor(Date.now() / 1000) - 1}))}.signature`;
        tick(15000);
        http.expectNone(req => req.url === 'api/v1/print-requests');
        expect(fixture.componentInstance.notices.length).toBe(0);
        fixture.destroy();
    }));

    it('notifies every distinct team change between polls, including quote publication', fakeAsync(() => {
        users.user = customer;
        tick(0);
        poll([request()]);
        tick(15000);
        poll([request([
            baselineEvent, update(),
            update({id: 'quote', kind: 'quote_published', status: 'awaiting_quote_approval'})
        ])]);
        expect(fixture.componentInstance.notices.map(notice => notice.status)).toEqual(['under_review', 'awaiting_quote_approval']);
        fixture.destroy();
    }));
});
