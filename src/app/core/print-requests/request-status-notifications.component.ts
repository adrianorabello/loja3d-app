import { Component, OnDestroy, OnInit } from '@angular/core';
import { EMPTY, Observable, Subject, Subscription, timer } from 'rxjs';
import { catchError, distinctUntilChanged, exhaustMap, expand, map, reduce, switchMap, takeUntil, tap } from 'rxjs/operators';
import { AuthService } from 'app/core/auth/auth.service';
import { AuthUtils } from 'app/core/auth/auth.utils';
import { UserService } from 'app/core/user/user.service';
import { PrintRequestService } from './print-request.service';
import { PrintRequest, RequestQuery, RequestStatus } from './print-request.model';
import { environment } from 'environments/environment';

interface RequestStatusNotice
{
    id: string;
    requestId: string;
    reference: string;
    title: string;
    status: RequestStatus;
}

@Component({
    selector: 'request-status-notifications',
    templateUrl: './request-status-notifications.component.html'
})
export class RequestStatusNotificationsComponent implements OnInit, OnDestroy
{
    notices: RequestStatusNotice[] = [];
    pollingError = false;
    private _seen = new Set<string>();
    private _initialized = false;
    private _startedAt = 0;
    private _dismissTimers = new Map<string, Subscription>();
    private _destroy = new Subject<void>();

    constructor(private _users: UserService, private _auth: AuthService, private _requests: PrintRequestService) {}

    ngOnInit(): void
    {
        this._users.user$.pipe(
            distinctUntilChanged((previous, current) => previous?.id === current?.id && previous?.role === current?.role),
            switchMap(user => {
                this.reset();
                if ( !user || user.role !== 'CUSTOMER' || environment.useMockApi ) { return EMPTY; }
                this._startedAt = Date.now();
                return timer(0, 15000).pipe(
                    exhaustMap(() => {
                        if ( !this._auth.accessToken || AuthUtils.isTokenExpired(this._auth.accessToken) )
                        {
                            this.reset();
                            return EMPTY;
                        }
                        return this.loadRequests().pipe(
                            tap(requests => {
                                this.pollingError = false;
                                this.process(requests);
                            }),
                            catchError((error: unknown) => {
                                this.pollingError = true;
                                console.error('Could not check print request status updates.', error);
                                return EMPTY;
                            })
                        );
                    })
                );
            }),
            takeUntil(this._destroy)
        ).subscribe();
    }

    ngOnDestroy(): void
    {
        this._destroy.next();
        this._destroy.complete();
        this.reset();
    }

    dismiss(id: string): void
    {
        this._dismissTimers.get(id)?.unsubscribe();
        this._dismissTimers.delete(id);
        this.notices = this.notices.filter(notice => notice.id !== id);
    }

    private loadRequests(): Observable<PrintRequest[]>
    {
        const query: RequestQuery = {page: 1, pageSize: 100, q: '', status: '', sort: 'newest'};
        const requests: PrintRequest[] = [];
        return this._requests.list(false, query).pipe(
            expand(page => page.page * page.pageSize < page.total
                ? this._requests.list(false, {...query, page: page.page + 1})
                : EMPTY),
            map(page => page.items),
            reduce((all, items) => all.concat(items), requests)
        );
    }

    private process(requests: PrintRequest[]): void
    {
        for (const request of requests)
        {
            request.history.forEach((event, index) => {
                const id = `${request.id}:${event.id}`;
                const previous = request.history[index - 1];
                if ( this._initialized && !this._seen.has(id) && event.actorRole === 'admin'
                    && previous && previous.status !== event.status && Date.parse(event.createdAt) >= this._startedAt )
                {
                    this.notices = [...this.notices, {
                        id, requestId: request.id, reference: request.reference, title: request.title, status: event.status
                    }];
                    this._dismissTimers.set(id, timer(10000).subscribe(() => this.dismiss(id)));
                }
                this._seen.add(id);
            });
        }
        this._initialized = true;
    }

    private reset(): void
    {
        this._dismissTimers.forEach(subscription => subscription.unsubscribe());
        this._dismissTimers.clear();
        this._seen.clear();
        this.notices = [];
        this.pollingError = false;
        this._initialized = false;
    }
}
