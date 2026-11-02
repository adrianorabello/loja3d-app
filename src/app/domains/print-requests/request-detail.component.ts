import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';
import { AbstractControl, FormBuilder, FormGroup, FormGroupDirective, ValidationErrors, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject } from 'rxjs';
import { filter, finalize, takeUntil } from 'rxjs/operators';
import { PrintRequestService } from 'app/core/print-requests/print-request.service';
import {
    PrintQuote, PrintRequest, RequestAction, requestStage, RequestStatus
} from 'app/core/print-requests/print-request.model';
import { ConfirmDialogComponent } from 'app/shared/components/confirm-dialog/confirm-dialog.component';

function optionalHttpUrl(control: AbstractControl): ValidationErrors | null
{
    if ( !control.value?.trim() ) { return null; }
    try
    {
        const url = new URL(control.value);
        return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? null : {url: true};
    }
    catch { return {url: true}; }
}

@Component({selector: 'print-request-detail', templateUrl: './request-detail.component.html'})
export class RequestDetailComponent implements OnInit, OnDestroy
{
    @ViewChild('messageFormDirective') messageFormDirective: FormGroupDirective;
    @ViewChild('transitionFormDirective') transitionFormDirective: FormGroupDirective;
    readonly admin: boolean;
    readonly basePath: string;
    request: PrintRequest;
    loading = false;
    saving = false;
    confirming = false;
    error = '';
    success = '';
    messageForm: FormGroup;
    quoteForm: FormGroup;
    transitionForm: FormGroup;
    private _id: string;
    private _destroy = new Subject<void>();

    constructor(
        route: ActivatedRoute, fb: FormBuilder, private _service: PrintRequestService, private _dialog: MatDialog
    )
    {
        this.admin = route.snapshot.pathFromRoot.some(snapshot => snapshot.data.printRequestsAdmin === true);
        this.basePath = this.admin ? '/admin/requests' : '/account/requests';
        this._id = route.snapshot.paramMap.get('id');
        this.messageForm = fb.group({message: ['', [Validators.required, Validators.maxLength(5000)]]});
        this.quoteForm = fb.group({
            amount: [null, [Validators.required, Validators.min(0.01), Validators.max(1000000)]],
            scope: ['', [Validators.required, Validators.maxLength(5000)]],
            leadDays: [7, [Validators.required, Validators.min(1), Validators.max(365), Validators.pattern(/^\d+$/)]],
            validUntil: ['', Validators.required]
        });
        this.transitionForm = fb.group({
            status: ['', Validators.required],
            message: ['', [Validators.required, Validators.maxLength(5000)]],
            trackingUrl: ['', [optionalHttpUrl, Validators.maxLength(2048)]],
            estimatedShipping: ['']
        });
    }

    ngOnInit(): void { this.load(); }

    ngOnDestroy(): void
    {
        this._destroy.next();
        this._destroy.complete();
    }

    get currentStage(): number { return this.request ? requestStage(this.request.status) : 0; }
    get latestQuote(): PrintQuote { return this.request?.quotes[this.request.quotes.length - 1]; }
    get canQuote(): boolean
    {
        return this.admin && ['under_review', 'quote_changes_requested', 'awaiting_quote_approval'].includes(this.request?.status);
    }

    can(action: RequestAction): boolean { return !this.admin && this.request.allowedActions.includes(action); }

    load(): void
    {
        if ( this.loading || this.saving ) { return; }
        this.loading = true;
        this.error = '';
        this._service.get(this.admin, this._id)
            .pipe(finalize(() => this.loading = false), takeUntil(this._destroy))
            .subscribe(request => this.request = request, (error: HttpErrorResponse) => this.showError(error));
    }

    sendMessage(): void
    {
        if ( this.messageForm.invalid ) { this.messageForm.markAllAsTouched(); return; }
        this.save(this._service.message(this.admin, this.request, this.messageForm.value.message.trim()),
            () => this.messageFormDirective.resetForm());
    }

    customerAction(action: RequestAction): void
    {
        if ( this.saving || this.confirming || !this.can(action) ) { return; }
        if ( action !== 'approve_quote' && this.messageForm.invalid )
        {
            this.messageForm.markAllAsTouched();
            this.error = 'requests.reasonRequired';
            return;
        }
        const reviewedRequest = this.request;
        const reviewedQuoteVersion = this.latestQuote?.version;
        const message = this.messageForm.value.message?.trim() || '';
        this.confirming = true;
        this._dialog.open(ConfirmDialogComponent, {
            data: {
                titleKey: 'requests.actions.' + action,
                messageKey: action === 'approve_quote' ? 'requests.approveConfirm' : 'requests.actionConfirm',
                confirmKey: 'common.confirm'
            }
        }).afterClosed().pipe(finalize(() => this.confirming = false), filter(result => result === true), takeUntil(this._destroy))
            .subscribe(() => this.save(
                this._service.action(reviewedRequest, action, message, reviewedQuoteVersion),
                () => this.messageFormDirective.resetForm()
            ));
    }

    publishQuote(): void
    {
        if ( this.quoteForm.invalid ) { this.quoteForm.markAllAsTouched(); return; }
        const value = this.quoteForm.getRawValue();
        const expiration = new Date(value.validUntil);
        if ( !Number.isFinite(expiration.getTime()) || expiration.getTime() <= Date.now() )
        {
            this.error = 'requests.expirationError';
            return;
        }
        this.save(this._service.quote(this._id, {
            version: this.request.version, amountCents: Math.round(Number(value.amount) * 100), currency: 'EUR',
            scope: value.scope.trim(), leadDays: Number(value.leadDays), validUntil: expiration.toISOString()
        }));
    }

    transition(): void
    {
        if ( this.transitionForm.invalid ) { this.transitionForm.markAllAsTouched(); return; }
        const value: {status: RequestStatus; message: string; trackingUrl: string; estimatedShipping: string} = this.transitionForm.getRawValue();
        const trackingUrl = value.trackingUrl.trim();
        this.save(this._service.transition(this._id, {
            version: this.request.version, status: value.status, message: value.message.trim(),
            ...(trackingUrl ? {trackingUrl} : {}),
            ...(value.estimatedShipping ? {estimatedShipping: value.estimatedShipping} : {})
        }), () => this.transitionFormDirective.resetForm());
    }

    private save(operation: Observable<PrintRequest>, onSuccess?: () => void): void
    {
        if ( this.saving || this.loading ) { return; }
        this.saving = true;
        this.error = '';
        this.success = '';
        operation.pipe(finalize(() => this.saving = false), takeUntil(this._destroy))
            .subscribe(request => {
                this.request = request;
                this.success = 'requests.saved';
                if ( onSuccess ) { onSuccess(); }
            }, (error: HttpErrorResponse) => this.showError(error));
    }

    private showError(error: HttpErrorResponse): void
    {
        this.error = error.status === 409 ? 'requests.conflict'
            : error.status === 404 ? 'requests.notFound'
                : error.status === 403 ? 'requests.forbidden'
                    : error.status === 422 || error.status === 400 ? 'requests.invalid' : 'requests.saveError';
    }
}
