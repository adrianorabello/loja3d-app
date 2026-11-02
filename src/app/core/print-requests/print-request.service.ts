import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    CreatePrintRequest, PrintRequest, PrintRequestPage, PublishQuote, RequestAction,
    RequestQuery, RequestTransition
} from './print-request.model';

@Injectable({providedIn: 'root'})
export class PrintRequestService
{
    constructor(private _http: HttpClient) {}

    list(admin: boolean, query: RequestQuery): Observable<PrintRequestPage>
    {
        let params = new HttpParams();
        Object.entries(query).forEach(([key, value]) => {
            if ( value !== '' ) { params = params.set(key, String(value)); }
        });

        return this._http.get<PrintRequestPage>(this.base(admin), {params});
    }

    get(admin: boolean, id: string): Observable<PrintRequest>
    {
        return this._http.get<PrintRequest>(`${this.base(admin)}/${encodeURIComponent(id)}`);
    }

    create(payload: CreatePrintRequest): Observable<PrintRequest>
    {
        return this._http.post<PrintRequest>(this.base(false), payload);
    }

    message(admin: boolean, request: PrintRequest, message: string): Observable<PrintRequest>
    {
        return this._http.post<PrintRequest>(`${this.base(admin)}/${encodeURIComponent(request.id)}/messages`,
            {version: request.version, message});
    }

    action(request: PrintRequest, action: RequestAction, message: string, quoteVersion?: number): Observable<PrintRequest>
    {
        return this._http.post<PrintRequest>(`${this.base(false)}/${encodeURIComponent(request.id)}/actions`,
            {version: request.version, action, message, ...(quoteVersion === undefined ? {} : {quoteVersion})});
    }

    quote(id: string, payload: PublishQuote): Observable<PrintRequest>
    {
        return this._http.post<PrintRequest>(`${this.base(true)}/${encodeURIComponent(id)}/quote`, payload);
    }

    transition(id: string, payload: RequestTransition): Observable<PrintRequest>
    {
        return this._http.post<PrintRequest>(`${this.base(true)}/${encodeURIComponent(id)}/transition`, payload);
    }

    private base(admin: boolean): string
    {
        return `api/v1/${admin ? 'admin/' : ''}print-requests`;
    }
}
