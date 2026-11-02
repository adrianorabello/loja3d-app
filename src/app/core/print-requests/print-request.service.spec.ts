import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PrintRequestService } from './print-request.service';
import { requestStage, PrintRequest } from './print-request.model';
import { FormControl } from '@angular/forms';
import { referenceLinksValidator } from 'app/domains/print-requests/request-create.component';

describe('PrintRequestService', () => {
    let service: PrintRequestService;
    let http: HttpTestingController;
    beforeEach(() => {
        TestBed.configureTestingModule({imports: [HttpClientTestingModule]});
        service = TestBed.inject(PrintRequestService);
        http = TestBed.inject(HttpTestingController);
    });
    afterEach(() => http.verify());

    it('requests server pagination, filters and sorting in the correct scope', () => {
        service.list(true, {page: 2, pageSize: 10, q: 'PT-', status: 'submitted', sort: 'oldest'}).subscribe();
        const request = http.expectOne(req => req.url === 'api/v1/admin/print-requests');
        expect(request.request.params.get('page')).toBe('2');
        expect(request.request.params.get('pageSize')).toBe('10');
        expect(request.request.params.get('q')).toBe('PT-');
        expect(request.request.params.get('sort')).toBe('oldest');
        request.flush({items: [], total: 0, page: 2, pageSize: 10});
    });

    it('sends the request and quote versions for customer approval', () => {
        const request = {id: 'request-1', version: 5} as PrintRequest;
        service.action(request, 'approve_quote', '', 2).subscribe();
        const action = http.expectOne('api/v1/print-requests/request-1/actions');
        expect(action.request.body).toEqual({version: 5, action: 'approve_quote', message: '', quoteVersion: 2});
        action.flush({});
    });

    it('omits empty optional filters rather than sending an invalid status enum', () => {
        service.list(false, {page: 1, pageSize: 10, q: '', status: '', sort: 'newest'}).subscribe();
        const request = http.expectOne(req => req.url === 'api/v1/print-requests');
        expect(request.request.params.has('status')).toBeFalse();
        expect(request.request.params.has('q')).toBeFalse();
        request.flush({items: [], total: 0, page: 1, pageSize: 10});
    });

    it('does not hide errors or treat stale mutations as success', () => {
        let failed = false;
        service.message(false, {id: 'request-1', version: 1} as PrintRequest, 'More details')
            .subscribe(() => fail('Expected conflict'), error => failed = error.status === 409);
        http.expectOne('api/v1/print-requests/request-1/messages').flush({detail: 'Changed'}, {status: 409, statusText: 'Conflict'});
        expect(failed).toBeTrue();
    });

    it('maps detailed statuses to the six real stages without claiming payment is production', () => {
        expect(requestStage('submitted')).toBe(0);
        expect(requestStage('awaiting_quote_approval')).toBe(1);
        expect(requestStage('payment_verification')).toBe(2);
        expect(requestStage('payment_confirmed')).toBe(2);
        expect(requestStage('production_paused')).toBe(3);
        expect(requestStage('shipped')).toBe(4);
        expect(requestStage('delivered')).toBe(5);
    });

    it('accepts only bounded HTTP(S) reference links without embedded credentials', () => {
        for (const links of ['', 'https://example.com/model.stl\nhttp://example.com/image.png']) {
            expect(referenceLinksValidator(new FormControl(links))).toBeNull();
        }
        for (const links of ['javascript:alert(1)', 'ftp://example.com/file', 'https://user:pass@example.com',
            Array(6).fill('https://example.com').join('\n'), 'not a link']) {
            expect(referenceLinksValidator(new FormControl(links))).toEqual({links: true});
        }
    });
});
