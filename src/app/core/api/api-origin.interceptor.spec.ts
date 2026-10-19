import { HttpClient, HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_ORIGIN } from 'app/core/api/api.config';
import { ApiOriginInterceptor } from 'app/core/api/api-origin.interceptor';

describe('ApiOriginInterceptor', () => {
    function setup(origin: string): {http: HttpClient; ctrl: HttpTestingController} {
        TestBed.configureTestingModule({
            imports  : [HttpClientTestingModule],
            providers: [
                {provide: API_ORIGIN, useValue: origin},
                {provide: HTTP_INTERCEPTORS, useClass: ApiOriginInterceptor, multi: true}
            ]
        });
        return {http: TestBed.inject(HttpClient), ctrl: TestBed.inject(HttpTestingController)};
    }

    afterEach(() => TestBed.inject(HttpTestingController).verify());

    it('prefixes relative api/ requests with the origin', () => {
        const {http, ctrl} = setup('https://api.example.com');
        http.get('api/clara-rosa/products').subscribe();
        http.get('/api/auth/sign-in').subscribe();
        ctrl.expectOne('https://api.example.com/api/clara-rosa/products');
        ctrl.expectOne('https://api.example.com/api/auth/sign-in');
    });

    it('leaves assets, i18n and absolute URLs untouched', () => {
        const {http, ctrl} = setup('https://api.example.com');
        http.get('./assets/i18n/pt-BR.json').subscribe();
        http.get('assets/images/logo.svg').subscribe();
        http.get('https://other.example.com/api/x').subscribe();
        ctrl.expectOne('./assets/i18n/pt-BR.json');
        ctrl.expectOne('assets/images/logo.svg');
        ctrl.expectOne('https://other.example.com/api/x');
    });

    it('is a no-op when the origin is empty', () => {
        const {http, ctrl} = setup('');
        http.get('api/clara-rosa/products').subscribe();
        ctrl.expectOne('api/clara-rosa/products');
    });
});
