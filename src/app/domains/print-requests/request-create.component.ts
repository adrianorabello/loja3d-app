import { Component, OnDestroy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';
import { PrintRequestService } from 'app/core/print-requests/print-request.service';
import { CreatePrintRequest } from 'app/core/print-requests/print-request.model';

type DraftField = 'title' | 'description' | 'quantity' | 'dimensions' | 'material' | 'color' | 'referenceLinks';

function referenceLinks(value: string): string[]
{
    return value.split(/\r?\n/).map(link => link.trim()).filter(Boolean);
}

function requiredTrimmedMinLength(minimum: number): ValidatorFn
{
    return (control: AbstractControl): ValidationErrors | null => {
        const value = String(control.value || '').trim();
        if ( !value ) { return {required: true}; }
        return value.length < minimum ? {minlength: {requiredLength: minimum, actualLength: value.length}} : null;
    };
}

export function referenceLinksValidator(control: AbstractControl): ValidationErrors | null
{
    const links = referenceLinks(String(control.value || ''));
    if ( links.length > 5 ) { return {links: true}; }
    for (const link of links)
    {
        try
        {
            const url = new URL(link);
            if ( !['http:', 'https:'].includes(url.protocol) || url.username || url.password || link.length > 2048 )
            {
                return {links: true};
            }
        }
        catch
        {
            return {links: true};
        }
    }

    return null;
}

@Component({selector: 'print-request-create', templateUrl: './request-create.component.html'})
export class RequestCreateComponent implements OnDestroy
{
    form: FormGroup;
    saving = false;
    error = '';
    readonly summaryFields: DraftField[] = ['title', 'quantity', 'dimensions', 'material', 'color'];
    readonly checklistFields: DraftField[] = ['title', 'description', 'quantity', 'dimensions', 'referenceLinks'];
    private _destroy = new Subject<void>();

    constructor(fb: FormBuilder, private _service: PrintRequestService, private _router: Router)
    {
        this.form = fb.group({
            title: ['', [requiredTrimmedMinLength(3), Validators.maxLength(150)]],
            description: ['', [requiredTrimmedMinLength(10), Validators.maxLength(5000)]],
            quantity: [1, [Validators.required, Validators.min(1), Validators.max(1000), Validators.pattern(/^\d+$/)]],
            dimensions: ['', [requiredTrimmedMinLength(2), Validators.maxLength(200)]],
            material: ['', Validators.maxLength(100)],
            color: ['', Validators.maxLength(100)],
            referenceLinks: ['', referenceLinksValidator]
        });
    }

    ngOnDestroy(): void
    {
        this._destroy.next();
        this._destroy.complete();
    }

    draftValue(field: DraftField): string
    {
        const value: unknown = this.form.controls[field].value;
        return value === null || value === undefined ? '' : String(value).trim();
    }

    get referenceLinkCount(): number
    {
        return referenceLinks(this.draftValue('referenceLinks')).length;
    }

    draftLabel(field: DraftField): string
    {
        return `requests.${field === 'referenceLinks' ? 'links' : field}`;
    }

    submit(): void
    {
        if ( this.saving || this.form.invalid )
        {
            this.form.markAllAsTouched();
            return;
        }
        const value = this.form.getRawValue();
        const payload: CreatePrintRequest = {
            title: value.title.trim(), description: value.description.trim(), quantity: Number(value.quantity),
            dimensions: value.dimensions.trim(), material: value.material.trim(), color: value.color.trim(),
            referenceLinks: referenceLinks(value.referenceLinks)
        };
        this.saving = true;
        this.error = '';
        this._service.create(payload)
            .pipe(finalize(() => this.saving = false), takeUntil(this._destroy))
            .subscribe(request => this._router.navigate(['/account/requests', request.id]), (error: HttpErrorResponse) => {
                this.error = error.status === 422 ? 'requests.invalid' : 'requests.saveError';
                if ( error.status === 422 && Array.isArray(error.error?.detail) )
                {
                    for (const detail of error.error.detail)
                    {
                        const location: unknown = detail?.loc;
                        if ( Array.isArray(location) && location[0] === 'body' && typeof location[1] === 'string' )
                        {
                            const control = this.form.controls[location[1]];
                            if ( control )
                            {
                                control.setErrors({...control.errors, server: true});
                                control.markAsTouched();
                            }
                        }
                    }
                }
            });
    }
}
