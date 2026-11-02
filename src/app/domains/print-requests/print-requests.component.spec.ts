import { ComponentFixture, fakeAsync, flush, TestBed, tick } from '@angular/core/testing';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { PrintRequestsModule } from './print-requests.module';
import { RequestCreateComponent } from './request-create.component';
import { RequestDetailComponent } from './request-detail.component';
import { RequestListComponent } from './request-list.component';
import { RequestWorkflowComponent } from './request-workflow.component';
import { PrintRequest, REQUEST_STATUSES } from 'app/core/print-requests/print-request.model';
import { AuthService } from 'app/core/auth/auth.service';
import { AuthInterceptor } from 'app/core/auth/auth.interceptor';

function sampleRequest(): PrintRequest
{
    return {
        id: 'request-1', reference: 'PT-TEST', ownerId: 'customer-1', customerName: 'Customer',
        customerEmail: 'customer@example.com', title: 'Custom phone stand', description: 'A useful custom stand',
        quantity: 2, dimensions: '10 x 8 x 5 cm', material: 'PLA', color: 'Blue', referenceLinks: [],
        status: 'awaiting_quote_approval', version: 4, createdAt: '2026-10-20T12:00:00Z', updatedAt: '2026-10-20T12:00:00Z',
        quotes: [{version: 1, amountCents: 1299, currency: 'EUR', scope: 'Two stands', leadDays: 5,
            validUntil: '2099-10-25T12:00:00Z', createdAt: '2026-10-20T12:00:00Z'}],
        history: [], allowedTransitions: [], allowedActions: ['approve_quote', 'request_changes', 'cancel']
    };
}

describe('Print request pages', () => {
    let http: HttpTestingController;
    const snapshot = {paramMap: convertToParamMap({id: 'request-1'}), pathFromRoot: [{data: {}}]};

    beforeEach(() => {
        snapshot.pathFromRoot = [{data: {}}];
        TestBed.configureTestingModule({
            imports: [
                PrintRequestsModule, RouterTestingModule, HttpClientTestingModule,
                NoopAnimationsModule, MatIconTestingModule, TranslateModule.forRoot()
            ],
            providers: [
                {provide: ActivatedRoute, useValue: {snapshot}},
                AuthService,
                {provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true}
            ]
        });
        http = TestBed.inject(HttpTestingController);
    });
    afterEach(() => http.verify());

    function detail(): ComponentFixture<RequestDetailComponent>
    {
        const fixture = TestBed.createComponent(RequestDetailComponent);
        fixture.detectChanges();
        http.expectOne('api/v1/print-requests/request-1').flush(sampleRequest());
        fixture.detectChanges();
        return fixture;
    }

    it('shows six upcoming process stages without claiming saved progress', () => {
        const fixture = TestBed.createComponent(RequestCreateComponent);
        fixture.detectChanges();
        const stages = fixture.nativeElement.querySelectorAll('[data-workflow-stage]');
        expect(stages.length).toBe(6);
        expect(stages[0].textContent).toContain('requests.preparing');
        expect(Array.from(stages).slice(1).every((stage: HTMLElement) => stage.textContent.includes('requests.upcoming'))).toBeTrue();
        expect(fixture.nativeElement.querySelector('[aria-current="step"]')).toBeNull();
        expect(fixture.nativeElement.textContent).not.toContain('requests.complete');
        expect(fixture.nativeElement.querySelectorAll('h1').length).toBe(1);
        expect(fixture.nativeElement.querySelectorAll('form').length).toBe(1);
        expect(fixture.nativeElement.querySelector('mat-error')).toBeNull();
    });

    it('shares the illustrated workflow between draft and customer/admin details', () => {
        const creation = TestBed.createComponent(RequestCreateComponent);
        creation.detectChanges();
        expect(creation.nativeElement.querySelector('print-request-workflow')).not.toBeNull();
        for (const admin of [false, true])
        {
            snapshot.pathFromRoot = [{data: {printRequestsAdmin: admin}}];
            const fixture = TestBed.createComponent(RequestDetailComponent);
            fixture.detectChanges();
            http.expectOne(`api/v1/${admin ? 'admin/' : ''}print-requests/request-1`).flush({
                ...sampleRequest(), status: 'awaiting_payment'
            });
            fixture.detectChanges();
            const workflow: HTMLElement = fixture.nativeElement.querySelector('print-request-workflow');
            expect(workflow).not.toBeNull();
            const stages = workflow.querySelectorAll('[data-workflow-stage]');
            expect(stages.length).toBe(6);
            expect(stages[0].textContent).toContain('requests.complete');
            expect(stages[1].textContent).toContain('requests.complete');
            expect(stages[2].getAttribute('aria-current')).toBe('step');
            expect(stages[3].textContent).toContain('requests.pending');
            expect(workflow.querySelectorAll('.workflow-illustration').length).toBe(6);
            expect(workflow.querySelectorAll('.workflow-complete').length).toBe(2);
            fixture.destroy();
        }
    });

    it('uses the prototype illustrations and palette for completed, current and pending stages', () => {
        const fixture = TestBed.createComponent(RequestWorkflowComponent);
        fixture.componentInstance.status = 'in_production';
        fixture.detectChanges();
        const illustrations: NodeListOf<SVGElement> = fixture.nativeElement.querySelectorAll('.workflow-illustration');
        expect(Array.from(illustrations).map(icon => icon.getAttribute('data-illustration')))
            .toEqual(['request', 'quote', 'payment', 'production', 'shipping', 'delivery']);
        const paperPaths = [
            'M26 10h34l12 12v40H26z', null, 'M19 24h58v37H19z',
            'M20 10h56v52H20zM27 17h42v31H27z',
            'M12 25h38v29H12zM50 34h17l12 12v8H50z',
            'M19 23l29-13 29 13v37H19z'
        ];
        illustrations.forEach((icon, index) => {
            expect(icon.getAttribute('viewBox')).toBe('0 0 96 72');
            expect(icon.getAttribute('aria-hidden')).toBe('true');
            expect(icon.querySelector('.workflow-paper')).not.toBeNull();
            if ( paperPaths[index] ) { expect(icon.querySelector('.workflow-paper').getAttribute('d')).toBe(paperPaths[index]); }
        });
        expect(illustrations[1].querySelector('rect.workflow-paper').getAttribute('width')).toBe('39');
        expect(fixture.nativeElement.querySelectorAll('.workflow-complete').length).toBe(3);
        const tiles: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.workflow-art');
        expect(getComputedStyle(tiles[0]).backgroundColor).toBe('rgb(226, 249, 244)');
        expect(getComputedStyle(tiles[0]).borderColor).toBe('rgb(184, 232, 223)');
        expect(getComputedStyle(tiles[3]).backgroundColor).toBe('rgb(233, 238, 255)');
        expect(getComputedStyle(tiles[3]).borderColor).toBe('rgb(57, 87, 200)');
        expect(getComputedStyle(tiles[4]).backgroundColor).toBe('rgb(245, 247, 251)');
        expect(getComputedStyle(illustrations[3].querySelector('.workflow-accent')).stroke).toBe('rgb(240, 72, 114)');
        expect(getComputedStyle(fixture.nativeElement.querySelector('.workflow-complete')).backgroundColor).toBe('rgb(40, 122, 92)');
        expect(fixture.nativeElement.querySelector('.workflow-current-label').textContent).toContain('requests.current');
        fixture.destroy();
    });

    it('renders all real statuses and updates completed/current/pending stages on input changes', () => {
        const fixture = TestBed.createComponent(RequestWorkflowComponent);
        const expectedStages = [0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 5, 0, 0];
        REQUEST_STATUSES.forEach((status, index) => {
            fixture.componentInstance.status = status;
            fixture.detectChanges();
            const terminal = ['cancelled', 'rejected', 'delivered'].includes(status);
            const stages: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('[data-workflow-stage]');
            const current = fixture.nativeElement.querySelectorAll('[aria-current="step"]');
            expect(current.length).toBe(terminal ? 0 : 1);
            expect(fixture.nativeElement.querySelectorAll('.workflow-current-border').length).toBe(terminal ? 0 : 1);
            if ( !terminal ) { expect(stages[expectedStages[index]].getAttribute('aria-current')).toBe('step'); }
            const completed = Array.from(stages).filter(stage => stage.textContent.includes('requests.complete'));
            expect(completed.length).toBe(status === 'delivered' ? 6 : terminal ? 0 : expectedStages[index]);
        });
        fixture.componentInstance.status = undefined;
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[aria-current="step"]')).toBeNull();
        expect(fixture.nativeElement.textContent).toContain('requests.preparing');
        expect(fixture.nativeElement.textContent).not.toContain('requests.complete');
        expect(fixture.nativeElement.querySelectorAll('.workflow-current-border').length).toBe(1);
    });

    it('updates the draft summary safely and translates empty optional values', () => {
        const translate = TestBed.inject(TranslateService);
        translate.setTranslation('en', {requests: {notProvided: 'Not provided', linkCount: '{{count}} reference links'}});
        translate.use('en');
        const fixture = TestBed.createComponent(RequestCreateComponent);
        fixture.detectChanges();
        const summary = (field: string): HTMLElement => fixture.nativeElement.querySelector(`[data-draft-field="${field}"] dd`);
        expect(summary('material').textContent).toBe('Not provided');
        expect(summary('color').textContent).toBe('Not provided');
        const input: HTMLInputElement = fixture.nativeElement.querySelector('[formControlName="title"]');
        input.value = '<b>My stand</b>';
        input.dispatchEvent(new Event('input'));
        fixture.componentInstance.form.patchValue({
            quantity: 2, dimensions: ' 1 cm ', material: 'PLA',
            referenceLinks: 'https://example.com/one\n\n https://example.com/two '
        });
        fixture.detectChanges();
        expect(summary('title').textContent).toBe('<b>My stand</b>');
        expect(summary('title').querySelector('b')).toBeNull();
        expect(summary('dimensions').textContent).toBe('1 cm');
        expect(summary('quantity').textContent).toBe('2');
        expect(summary('material').textContent).toBe('PLA');
        expect(summary('referenceLinks').textContent).toBe('2 reference links');
    });

    it('uses the actual control validity for the draft checklist including optional links', () => {
        const fixture = TestBed.createComponent(RequestCreateComponent);
        fixture.detectChanges();
        const checklist = (field: string): HTMLElement => fixture.nativeElement.querySelector(`[data-checklist-field="${field}"]`);
        expect(checklist('title').textContent).toContain('requests.needsInput');
        expect(checklist('referenceLinks').textContent).toContain('requests.ready');
        fixture.componentInstance.form.patchValue({title: 'A stand', referenceLinks: 'not-a-url'});
        fixture.detectChanges();
        expect(checklist('title').textContent).toContain('requests.ready');
        expect(checklist('referenceLinks').textContent).toContain('requests.needsInput');
        expect(fixture.nativeElement.querySelector('mat-error')).toBeNull();
    });

    it('keeps the summary and form input after a network failure and allows retry', () => {
        spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
        const fixture = TestBed.createComponent(RequestCreateComponent);
        fixture.detectChanges();
        fixture.componentInstance.form.setValue({
            title: 'My stand', description: 'Please print a phone stand', quantity: 1,
            dimensions: '1 cm', material: '', color: '', referenceLinks: ''
        });
        fixture.nativeElement.querySelector('button[type="submit"]').click();
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('fieldset').disabled).toBeTrue();
        expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeTrue();
        fixture.componentInstance.submit();
        http.expectOne('api/v1/print-requests').error(new ErrorEvent('network'));
        fixture.detectChanges();
        expect(fixture.componentInstance.error).toBe('requests.saveError');
        expect(fixture.nativeElement.querySelector('fieldset').disabled).toBeFalse();
        expect(fixture.nativeElement.querySelector('[data-draft-field="title"] dd').textContent).toBe('My stand');
        fixture.nativeElement.querySelector('button[type="submit"]').click();
        http.expectOne('api/v1/print-requests').flush(sampleRequest(), {status: 201, statusText: 'Created'});
    });

    it('creates a persisted request with reference links and navigates to the saved ID', () => {
        const navigate = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
        const fixture = TestBed.createComponent(RequestCreateComponent);
        fixture.detectChanges();
        fixture.componentInstance.form.setValue({
            title: 'Custom stand', description: 'A custom stand for my phone', quantity: 2,
            dimensions: '10 x 8 x 5 cm', material: 'PLA', color: 'Blue', referenceLinks: 'https://example.com/model.stl'
        });
        fixture.componentInstance.submit();
        fixture.componentInstance.submit();
        const request = http.expectOne('api/v1/print-requests');
        expect(request.request.body.referenceLinks).toEqual(['https://example.com/model.stl']);
        expect(request.request.body.quantity).toBe(2);
        request.flush(sampleRequest(), {status: 201, statusText: 'Created'});
        expect(navigate).toHaveBeenCalledWith(['/account/requests', 'request-1']);
    });

    it('preserves creation input and displays explicit backend errors', () => {
        const fixture = TestBed.createComponent(RequestCreateComponent);
        const component = fixture.componentInstance;
        component.form.setValue({
            title: 'Custom stand', description: 'A custom stand for my phone', quantity: 1,
            dimensions: '10 cm', material: '', color: '', referenceLinks: ''
        });
        component.submit();
        http.expectOne('api/v1/print-requests').flush({detail: 'Invalid'}, {status: 422, statusText: 'Invalid'});
        expect(component.form.value.title).toBe('Custom stand');
        expect(component.error).toBe('requests.invalid');
        expect(component.saving).toBeFalse();
    });

    it('blocks the screenshot dimensions value and shows a field-level correction', () => {
        const fixture = TestBed.createComponent(RequestCreateComponent);
        fixture.detectChanges();
        fixture.componentInstance.form.setValue({
            title: 'Request 01', description: 'please print it', quantity: 1,
            dimensions: '1', material: '1', color: '1', referenceLinks: ''
        });
        fixture.nativeElement.querySelector('button[type="submit"]').click();
        fixture.detectChanges();
        http.expectNone('api/v1/print-requests');
        expect(fixture.componentInstance.form.get('dimensions').hasError('minlength')).toBeTrue();
        expect(fixture.nativeElement.querySelector('mat-error').textContent).toContain('requests.dimensionsError');
        expect(fixture.componentInstance.form.value.title).toBe('Request 01');
    });

    it('matches required text minimums after trimming and rejects whitespace-only values', () => {
        spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
        const fixture = TestBed.createComponent(RequestCreateComponent);
        const component = fixture.componentInstance;
        component.form.setValue({
            title: 'abc', description: '1234567890', quantity: 1,
            dimensions: 'ab', material: '', color: '', referenceLinks: ''
        });
        for (const [field, minimum] of [['title', 3], ['description', 10], ['dimensions', 2]] as const)
        {
            const control = component.form.get(field);
            for (const invalid of ['   ', ` ${'x'.repeat(minimum - 1)} `])
            {
                control.setValue(invalid);
                component.submit();
                expect(control.invalid).toBeTrue();
                http.expectNone('api/v1/print-requests');
            }
            control.setValue(` ${'x'.repeat(minimum)} `);
            expect(control.valid).toBeTrue();
        }
        component.submit();
        const request = http.expectOne('api/v1/print-requests');
        expect(request.request.body.title).toBe('xxx');
        expect(request.request.body.description).toBe('xxxxxxxxxx');
        expect(request.request.body.dimensions).toBe('xx');
        request.flush(sampleRequest(), {status: 201, statusText: 'Created'});
    });

    it('highlights backend validation fields, keeps input and allows correction and retry', () => {
        spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
        const fixture = TestBed.createComponent(RequestCreateComponent);
        fixture.detectChanges();
        const component = fixture.componentInstance;
        component.form.setValue({
            title: 'Request 01', description: 'please print it', quantity: 1,
            dimensions: '1 cm', material: '1', color: '1', referenceLinks: ''
        });
        fixture.nativeElement.querySelector('button[type="submit"]').click();
        http.expectOne('api/v1/print-requests').flush({
            detail: [{loc: ['body', 'dimensions'], msg: 'Invalid dimensions'}]
        }, {status: 422, statusText: 'Invalid'});
        fixture.detectChanges();
        expect(component.form.get('dimensions').hasError('server')).toBeTrue();
        expect(fixture.nativeElement.querySelector('mat-error').textContent).toContain('requests.dimensionsError');
        expect(component.form.value.description).toBe('please print it');
        component.form.get('dimensions').setValue('2 cm');
        component.submit();
        http.expectOne('api/v1/print-requests').flush(sampleRequest(), {status: 201, statusText: 'Created'});
        expect(component.error).toBe('');
    });

    it('submits the form with the backend login token and navigates only after creation', () => {
        const auth = TestBed.inject(AuthService);
        const previousToken = auth.accessToken;
        const token = `header.${btoa(JSON.stringify({exp: Math.floor(Date.now() / 1000) + 3600}))}.signature`;
        const navigate = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
        try
        {
            auth.signIn({email: 'customer@example.com', password: 'Test-password-123'}).subscribe();
            http.expectOne('api/auth/sign-in').flush({
                access_token: token, token_type: 'bearer',
                user: {id: 'customer-1', email: 'customer@example.com', name: 'Customer', role: 'CUSTOMER'}
            });
            const fixture = TestBed.createComponent(RequestCreateComponent);
            fixture.detectChanges();
            fixture.componentInstance.form.setValue({
                title: 'Custom stand', description: 'A custom stand for my phone', quantity: 1,
                dimensions: '10 cm', material: '', color: '', referenceLinks: ''
            });
            fixture.nativeElement.querySelector('button[type="submit"]').click();
            const request = http.expectOne('api/v1/print-requests');
            expect(request.request.method).toBe('POST');
            expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
            expect(navigate).not.toHaveBeenCalled();
            request.flush(sampleRequest(), {status: 201, statusText: 'Created'});
            expect(navigate).toHaveBeenCalledWith(['/account/requests', 'request-1']);
        }
        finally
        {
            if ( previousToken ) { auth.accessToken = previousToken; }
            else { localStorage.removeItem('access_token'); }
        }
    });

    it('shows the real quotation, six stages and server-authorized customer actions', () => {
        const fixture = detail();
        expect(fixture.componentInstance.latestQuote.amountCents).toBe(1299);
        expect(fixture.nativeElement.querySelectorAll('[aria-current="step"]').length).toBe(1);
        expect(fixture.componentInstance.currentStage).toBe(1);
        expect(fixture.componentInstance.can('approve_quote')).toBeTrue();
        expect(fixture.componentInstance.canQuote).toBeFalse();
    });

    it('requires a customer explanation for cancellation and does not mutate prematurely', () => {
        const fixture = detail();
        fixture.componentInstance.customerAction('cancel');
        expect(fixture.componentInstance.error).toBe('requests.reasonRequired');
        http.expectNone('api/v1/print-requests/request-1/actions');
    });

    it('sends the current quotation version only after the confirmation dialog', fakeAsync(() => {
        const fixture = detail();
        fixture.componentInstance.customerAction('approve_quote');
        http.expectNone('api/v1/print-requests/request-1/actions');
        TestBed.inject(MatDialog).openDialogs[0].close(true);
        fixture.detectChanges();
        tick();
        const request = http.expectOne('api/v1/print-requests/request-1/actions');
        expect(request.request.body.quoteVersion).toBe(1);
        expect(request.request.body.version).toBe(4);
        request.flush({...sampleRequest(), status: 'awaiting_payment', version: 5, allowedActions: ['cancel']});
        expect(fixture.componentInstance.request.version).toBe(5);
        flush();
    }));

    it('preserves unsent text after a stale-version error and can reload current state', () => {
        const fixture = detail();
        fixture.componentInstance.messageForm.setValue({message: 'Updated dimensions'});
        fixture.componentInstance.sendMessage();
        http.expectOne('api/v1/print-requests/request-1/messages').flush({detail: 'Stale'}, {status: 409, statusText: 'Conflict'});
        expect(fixture.componentInstance.error).toBe('requests.conflict');
        expect(fixture.componentInstance.messageForm.value.message).toBe('Updated dimensions');
        fixture.componentInstance.load();
        http.expectOne('api/v1/print-requests/request-1').flush({...sampleRequest(), version: 5});
        expect(fixture.componentInstance.request.version).toBe(5);
    });

    it('clears successful messages without showing a new required-field error', () => {
        const fixture = detail();
        fixture.componentInstance.messageForm.setValue({message: 'Extra measurements'});
        const form: HTMLFormElement = fixture.nativeElement.querySelector('form');
        form.dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
        http.expectOne('api/v1/print-requests/request-1/messages').flush({...sampleRequest(), version: 5});
        fixture.detectChanges();
        expect(fixture.componentInstance.messageFormDirective.submitted).toBeFalse();
        expect(fixture.componentInstance.messageForm.pristine).toBeTrue();
        expect(fixture.nativeElement.querySelector('mat-error')).toBeNull();
    });

    it('shows a not-found state without request data for an inaccessible ID', () => {
        const fixture = TestBed.createComponent(RequestDetailComponent);
        fixture.detectChanges();
        http.expectOne('api/v1/print-requests/request-1').flush({detail: 'Missing'}, {status: 404, statusText: 'Not Found'});
        fixture.detectChanges();
        expect(fixture.componentInstance.error).toBe('requests.notFound');
        expect(fixture.componentInstance.request).toBeUndefined();
    });

    it('loads the customer list using server pagination and resets the page for a new search', () => {
        const fixture = TestBed.createComponent(RequestListComponent);
        fixture.detectChanges();
        const request = http.expectOne(req => req.url === 'api/v1/print-requests');
        expect(request.request.params.get('page')).toBe('1');
        request.flush({items: [], total: 0, page: 1, pageSize: 10});
        fixture.componentInstance.pageIndex = 2;
        fixture.componentInstance.filters.patchValue({q: 'stand'});
        fixture.componentInstance.search();
        const search = http.expectOne(req => req.url === 'api/v1/print-requests');
        expect(search.request.params.get('page')).toBe('1');
        expect(search.request.params.get('q')).toBe('stand');
        search.flush({items: [], total: 0, page: 1, pageSize: 10});
    });

    it('uses admin endpoints and sends quotation prices as integer cents', () => {
        snapshot.pathFromRoot = [{data: {printRequestsAdmin: true}}];
        const fixture = TestBed.createComponent(RequestDetailComponent);
        fixture.detectChanges();
        http.expectOne('api/v1/admin/print-requests/request-1').flush({
            ...sampleRequest(), status: 'under_review', quotes: [], allowedActions: [],
            allowedTransitions: ['information_required', 'rejected', 'cancelled']
        });
        const component = fixture.componentInstance;
        expect(component.admin).toBeTrue();
        expect(component.canQuote).toBeTrue();
        expect(component.can('approve_quote')).toBeFalse();
        component.quoteForm.setValue({amount: 12.35, scope: 'Two stands in PLA', leadDays: 5, validUntil: '2099-10-25T12:00'});
        component.publishQuote();
        const quote = http.expectOne('api/v1/admin/print-requests/request-1/quote');
        expect(quote.request.body.amountCents).toBe(1235);
        expect(quote.request.body.currency).toBe('EUR');
        expect(quote.request.body.version).toBe(4);
        quote.flush(sampleRequest());
    });

    it('allows shipment without tracking, but validates any supplied link', () => {
        snapshot.pathFromRoot = [{data: {printRequestsAdmin: true}}];
        const fixture = TestBed.createComponent(RequestDetailComponent);
        fixture.detectChanges();
        http.expectOne('api/v1/admin/print-requests/request-1').flush({
            ...sampleRequest(), status: 'in_production', allowedActions: [], allowedTransitions: ['shipped']
        });
        fixture.detectChanges();
        const component = fixture.componentInstance;
        component.transitionForm.setValue({status: 'shipped', message: 'Packed and shipped', trackingUrl: '', estimatedShipping: ''});
        component.transitionForm.patchValue({trackingUrl: 'not-a-url'});
        component.transition();
        expect(component.transitionForm.invalid).toBeTrue();
        http.expectNone('api/v1/admin/print-requests/request-1/transition');
        component.transitionForm.patchValue({trackingUrl: '   '});
        component.transition();
        const transition = http.expectOne('api/v1/admin/print-requests/request-1/transition');
        expect(transition.request.body.message).toBe('Packed and shipped');
        expect(transition.request.body.version).toBe(4);
        expect(transition.request.body.trackingUrl).toBeUndefined();
        transition.flush({...sampleRequest(), status: 'shipped', version: 5});
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('a[href="https://example.com/track/123"]')).toBeNull();
    });

    it('does not silently approve a different quote loaded while confirmation is open', fakeAsync(() => {
        const fixture = detail();
        fixture.componentInstance.customerAction('approve_quote');
        fixture.componentInstance.request = {
            ...sampleRequest(), version: 7,
            quotes: [{...sampleRequest().quotes[0], version: 2, amountCents: 2000}]
        };
        TestBed.inject(MatDialog).openDialogs[0].close(true);
        fixture.detectChanges();
        tick();
        const approval = http.expectOne('api/v1/print-requests/request-1/actions');
        expect(approval.request.body.version).toBe(4);
        expect(approval.request.body.quoteVersion).toBe(1);
        approval.flush({detail: 'Changed'}, {status: 409, statusText: 'Conflict'});
        expect(fixture.componentInstance.error).toBe('requests.conflict');
        flush();
    }));
});
