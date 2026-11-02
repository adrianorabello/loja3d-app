import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { PrintRequestService } from 'app/core/print-requests/print-request.service';
import { PrintRequest, REQUEST_STATUSES, RequestQuery } from 'app/core/print-requests/print-request.model';

@Component({
    selector: 'print-request-list',
    templateUrl: './request-list.component.html'
})
export class RequestListComponent implements OnInit, OnDestroy
{
    readonly admin: boolean;
    readonly basePath: string;
    readonly statuses = REQUEST_STATUSES;
    readonly columns: string[];
    filters: FormGroup;
    items: PrintRequest[] = [];
    total = 0;
    pageIndex = 0;
    pageSize = 10;
    loading = false;
    error = '';
    private _destroy = new Subject<void>();

    constructor(route: ActivatedRoute, fb: FormBuilder, private _service: PrintRequestService)
    {
        this.admin = route.snapshot.pathFromRoot.some(snapshot => snapshot.data.printRequestsAdmin === true);
        this.basePath = this.admin ? '/admin/requests' : '/account/requests';
        this.columns = this.admin
            ? ['reference', 'title', 'customer', 'status', 'updatedAt']
            : ['reference', 'title', 'status', 'updatedAt'];
        this.filters = fb.group({q: [''], status: [''], sort: ['newest']});
    }

    ngOnInit(): void { this.load(); }

    ngOnDestroy(): void
    {
        this._destroy.next();
        this._destroy.complete();
    }

    search(): void
    {
        this.pageIndex = 0;
        this.load();
    }

    changePage(event: PageEvent): void
    {
        this.pageIndex = event.pageIndex;
        this.pageSize = event.pageSize;
        this.load();
    }

    load(): void
    {
        if ( this.loading ) { return; }
        this.loading = true;
        this.error = '';
        const query: RequestQuery = {...this.filters.getRawValue(), page: this.pageIndex + 1, pageSize: this.pageSize};
        this._service.list(this.admin, query)
            .pipe(finalize(() => this.loading = false), takeUntil(this._destroy))
            .subscribe(result => {
                this.items = result.items;
                this.total = result.total;
            }, (error: HttpErrorResponse) => {
                this.error = error.status === 403 ? 'requests.forbidden' : 'requests.loadError';
            });
    }
}
