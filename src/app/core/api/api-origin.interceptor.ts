import { Inject, Injectable } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ORIGIN } from 'app/core/api/api.config';

/**
 * Prefixes the backend origin to relative `api/...` requests.
 *
 * Locally the dev proxy serves `/api`; on a static host (Vercel) there is no proxy, so
 * the origin is injected at build time. Assets, i18n files and absolute URLs are untouched.
 */
@Injectable()
export class ApiOriginInterceptor implements HttpInterceptor
{
    constructor(@Inject(API_ORIGIN) private _origin: string)
    {
    }

    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>>
    {
        if ( !this._origin || !/^\/?api\//.test(req.url) )
        {
            return next.handle(req);
        }

        return next.handle(req.clone({url: `${this._origin}/${req.url.replace(/^\//, '')}`}));
    }
}
