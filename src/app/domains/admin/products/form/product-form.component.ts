import { ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CategoryService } from 'app/core/category/category.service';
import { ProductService } from 'app/core/product/product.service';
import { Category } from 'app/shared/models/category.model';
import { Product } from 'app/shared/models/product.model';
import { formValueToProduct, productToFormValue, slugify, validateImageFile } from 'app/domains/admin/products/product-form.utils';

/**
 * A rejected upload, kept for display: the i18n key from `validateImageFile` plus the file
 * name it interpolates.
 */
interface ImageError
{
    key: string;
    params: { name: string };
}

/**
 * Create and edit form for `/admin/products/new` and `/admin/products/:id/edit`.
 *
 * One component serves both routes, and it is in edit mode exactly when the route resolved a
 * `product`. Validation follows the sign-up form: a `mat-error` per rule, and an invalid
 * submit marks everything touched and returns before any HTTP call.
 *
 * Images are kept outside the `FormGroup` as data URLs (or the seed data's asset paths).
 * They go to the mock API's in-memory store only. The cart drops `images` when it builds a
 * line, so no base64 ever reaches localStorage.
 */
@Component({
    selector     : 'admin-product-form',
    templateUrl  : './product-form.component.html',
    encapsulation: ViewEncapsulation.None
})
export class ProductFormComponent implements OnInit, OnDestroy
{
    readonly slugPattern: RegExp = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    readonly hexPattern: RegExp = /^#[0-9a-fA-F]{6}$/;

    form: FormGroup;
    product: Product | null = null;
    categories$: Observable<Category[]>;

    images: string[] = [];
    imageErrors: ImageError[] = [];

    submitted: boolean = false;
    saveError: string;

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _activatedRoute: ActivatedRoute,
        private _changeDetectorRef: ChangeDetectorRef,
        private _categoryService: CategoryService,
        private _formBuilder: FormBuilder,
        private _productService: ProductService,
        private _router: Router
    )
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    get isEdit(): boolean
    {
        return !!this.product;
    }

    get colors(): FormArray
    {
        return this.form.get('colors') as FormArray;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void
    {
        this.product = this._activatedRoute.snapshot.data.product ?? null;
        this.categories$ = this._categoryService.ensureLoaded();

        this.form = this._formBuilder.group({
            namePt       : ['', Validators.required],
            nameEn       : [''],
            nameDe       : [''],
            descriptionPt: [''],
            descriptionEn: [''],
            descriptionDe: [''],
            slug         : ['', [Validators.required, Validators.pattern(this.slugPattern)]],
            categoryId   : ['', Validators.required],
            price        : [null, [Validators.required, Validators.min(0.01)]],
            dimensions   : this._formBuilder.group({
                width : [null, Validators.min(0.01)],
                height: [null, Validators.min(0.01)],
                depth : [null, Validators.min(0.01)]
            }, {validators: this._validateDimensions}),
            stock        : [0, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]],
            colors       : this._formBuilder.array([]),
            madeToOrder  : [false],
            active       : [true],
            featured     : [false]
        });

        if ( this.product )
        {
            const value = productToFormValue(this.product);

            value.colors.forEach(color => this.addColor(color.name, color.hex));
            this.form.patchValue(value);
            this.images = [...(this.product.images ?? [])];
        }
        else
        {
            // Generate the slug from the Portuguese name until the admin edits the slug
            // by hand. Create mode only: renaming an existing product must not silently
            // change its public URL.
            this.form.get('namePt').valueChanges
                .pipe(takeUntil(this._unsubscribeAll))
                .subscribe((name: string) => {
                    const slug = this.form.get('slug');

                    if ( !slug.dirty )
                    {
                        slug.setValue(slugify(name));
                    }
                });
        }
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void
    {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Append a colour row.
     *
     * @param name
     * @param hex
     */
    addColor(name: string = '', hex: string = '#ffffff'): void
    {
        this.colors.push(this._formBuilder.group({
            name: [name, Validators.required],
            hex : [hex, [Validators.required, Validators.pattern(this.hexPattern)]]
        }));
    }

    /**
     * Remove a colour row.
     *
     * @param index
     */
    removeColor(index: number): void
    {
        this.colors.removeAt(index);
    }

    /**
     * Read the picked files into data URLs, rejecting the ones `validateImageFile` refuses.
     *
     * @param input
     */
    uploadImages(input: HTMLInputElement): void
    {
        this.imageErrors = [];

        Array.from(input.files ?? []).forEach((file) => {
            const error = validateImageFile(file);

            if ( error )
            {
                this.imageErrors.push({key: error, params: {name: file.name}});

                return;
            }

            const reader = new FileReader();

            reader.onload = () => {
                if ( typeof reader.result !== 'string' )
                {
                    this.imageErrors.push({key: 'productForm.imageReadError', params: {name: file.name}});
                    this._changeDetectorRef.markForCheck();

                    return;
                }

                this.images = [...this.images, reader.result];
                this._changeDetectorRef.markForCheck();
            };

            reader.onerror = () => {
                this.imageErrors.push({key: 'productForm.imageReadError', params: {name: file.name}});
                this._changeDetectorRef.markForCheck();
            };

            reader.readAsDataURL(file);
        });

        // Clear the input so picking the same file again still fires `change`.
        input.value = '';
    }

    /**
     * Remove an image.
     *
     * @param index
     */
    removeImage(index: number): void
    {
        this.images = this.images.filter((_, i) => i !== index);
    }

    /**
     * Validate, then create or update.
     */
    save(): void
    {
        this.submitted = true;
        this.saveError = null;

        if ( this.form.invalid || this.images.length === 0 )
        {
            this.form.markAllAsTouched();

            return;
        }

        const payload = formValueToProduct(this.form.getRawValue(), this.images);
        const request$: Observable<Product> = this.isEdit
            ? this._productService.updateProduct(this.product.id, payload)
            : this._productService.createProduct(payload);

        this.form.disable();

        request$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(
                () => {
                    this._router.navigate(['/admin/products'], {state: {flash: 'admin.products.saved'}});
                },
                (error: HttpErrorResponse) => {
                    this.form.enable();
                    this.saveError = error?.status === 409 ? 'admin.products.slugTaken' : 'admin.products.saveError';
                }
            );
    }

    /**
     * Track by function for ngFor loops
     *
     * @param index
     */
    trackByIndex(index: number): number
    {
        return index;
    }

    /**
     * Dimensions are optional, but once one is provided all three must be positive values.
     *
     * @param control
     * @private
     */
    private _validateDimensions(control: AbstractControl): ValidationErrors | null
    {
        const values = [control.get('width').value, control.get('height').value, control.get('depth').value];
        const hasAnyValue = values.some(value => value !== null && value !== undefined && value !== '');
        const hasAllValues = values.every(value => value !== null && value !== undefined && value !== '');

        return hasAnyValue && !hasAllValues ? {incompleteDimensions: true} : null;
    }
}
