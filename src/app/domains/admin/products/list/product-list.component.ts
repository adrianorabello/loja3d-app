import { Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { forkJoin, Subject } from 'rxjs';
import { debounceTime, filter, finalize, switchMap, takeUntil } from 'rxjs/operators';
import { CategoryService } from 'app/core/category/category.service';
import { I18nService } from 'app/core/i18n/i18n.service';
import { ProductService } from 'app/core/product/product.service';
import { matchesQuery } from 'app/core/product/product.utils';
import { ConfirmDialogComponent, ConfirmDialogData } from 'app/shared/components/confirm-dialog/confirm-dialog.component';
import { resolveLocalizedText } from 'app/shared/models/localized-text.model';
import { Category } from 'app/shared/models/category.model';
import { PRODUCT_IMAGE_PLACEHOLDER, Product } from 'app/shared/models/product.model';

type ProductStatusFilter = 'all' | 'active' | 'inactive';

interface ProductListFilter
{
    query: string;
    status: ProductStatusFilter;
}

/**
 * Admin product table at `/admin/products`.
 *
 * Uses the unfiltered admin endpoint, so inactive products are listed too. The catalogue is
 * small and fully loaded, so search, sort and paging all run client-side through a
 * `MatTableDataSource` rather than the demo inventory's server-side `merge(sort, page)`.
 *
 * The form reports a successful save through router state (`flash`), because the list is a
 * different component and the message must survive the navigation back here.
 */
@Component({
    selector     : 'admin-product-list',
    templateUrl  : './product-list.component.html',
    encapsulation: ViewEncapsulation.None
})
export class ProductListComponent implements OnInit, OnDestroy
{
    readonly displayedColumns: string[] = ['product', 'price', 'dimensions', 'status', 'actions'];
    readonly placeholder: string = PRODUCT_IMAGE_PLACEHOLDER;

    dataSource: MatTableDataSource<Product> = new MatTableDataSource<Product>([]);
    searchControl: FormControl = new FormControl('');
    statusControl: FormControl = new FormControl('all');
    isLoading: boolean = true;
    loadFailed: boolean = false;

    message: string;
    messageParams: any;
    messageType: 'success' | 'error' = 'success';

    private _categories: Category[] = [];
    private _messageTimer: any;
    private _unsubscribeAll: Subject<any> = new Subject<any>();
    private _updatingProductIds: Set<string> = new Set<string>();

    /**
     * Constructor
     */
    constructor(
        private _productService: ProductService,
        private _categoryService: CategoryService,
        private _i18nService: I18nService,
        private _matDialog: MatDialog,
        private _router: Router
    )
    {
        // Must be read in the constructor: the navigation is over by ngOnInit.
        const flash = this._router.getCurrentNavigation()?.extras?.state?.flash;

        if ( flash )
        {
            this._flash(flash);
        }
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * The table lives inside an `*ngIf`, so sort and paginator arrive (and can re-arrive)
     * after init. Setters wire them whenever they appear.
     */
    @ViewChild(MatSort)
    set sort(sort: MatSort)
    {
        this.dataSource.sort = sort;
    }

    @ViewChild(MatPaginator)
    set paginator(paginator: MatPaginator)
    {
        this.dataSource.paginator = paginator;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void
    {
        // Search across every language, the same rule the storefront uses.
        this.dataSource.filterPredicate = (product, rawFilter) => {
            const criteria: ProductListFilter = JSON.parse(rawFilter);
            const matchesStatus = criteria.status === 'all'
                || product.active === (criteria.status === 'active');

            return matchesStatus && matchesQuery(product, criteria.query);
        };

        // Sort on what the admin actually sees: the name and category in the active language.
        this.dataSource.sortingDataAccessor = (product, column) => {
            switch ( column )
            {
                case 'product':
                case 'name':
                    return resolveLocalizedText(product.name, this._i18nService.language).toLocaleLowerCase();
                case 'category':
                    return this.categoryName(product.categoryId).toLocaleLowerCase();
                case 'status':
                case 'active':
                    return product.active ? 1 : 0;
                default:
                    return product[column];
            }
        };

        this.searchControl.valueChanges
            .pipe(debounceTime(200), takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyFilters());

        this.statusControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyFilters());

        this.applyFilters();

        this.load();
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void
    {
        clearTimeout(this._messageTimer);
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Fetch products and categories together, so the category column never renders ids.
     */
    load(): void
    {
        this.isLoading = true;
        this.loadFailed = false;

        forkJoin([this._productService.getAllProducts(), this._categoryService.ensureLoaded()])
            .pipe(
                finalize(() => this.isLoading = false),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(
                ([products, categories]) => {
                    this._categories = categories;
                    this.dataSource.data = products;
                },
                () => this.loadFailed = true
            );
    }

    /**
     * Display name of a category, in the active language.
     *
     * @param categoryId
     */
    categoryName(categoryId: string): string
    {
        const category = this._categories.find(item => item.id === categoryId);

        return category ? resolveLocalizedText(category.name, this._i18nService.language) : categoryId;
    }

    /**
     * Format dimensions for the table, including their unit. Legacy products have none.
     *
     * @param product
     */
    dimensionsLabel(product: Product): string
    {
        const dimensions = product.dimensions;

        return dimensions
            ? `${dimensions.width} × ${dimensions.height} × ${dimensions.depth} ${dimensions.unit}`
            : '—';
    }

    /**
     * Apply the current search and status controls together.
     */
    applyFilters(): void
    {
        this.dataSource.filter = JSON.stringify({
            query : (this.searchControl.value ?? '').trim(),
            status: this.statusControl.value as ProductStatusFilter
        });
        this.dataSource.paginator?.firstPage();
    }

    /**
     * Whether a status update is currently pending for this row.
     *
     * @param product
     */
    isUpdating(product: Product): boolean
    {
        return this._updatingProductIds.has(product.id);
    }

    /**
     * Toggle storefront visibility and update the row only after the API confirms the change.
     *
     * @param product
     */
    toggleActive(product: Product): void
    {
        if ( this.isUpdating(product) )
        {
            return;
        }

        const active = !product.active;
        this._updatingProductIds.add(product.id);

        this._productService.updateProduct(product.id, {active})
            .pipe(
                finalize(() => this._updatingProductIds.delete(product.id)),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(
                (updated) => {
                    this.dataSource.data = this.dataSource.data.map(item => item.id === updated.id ? updated : item);
                    this._flash(active ? 'admin.products.activated' : 'admin.products.deactivated');
                },
                () => this._flash('admin.products.statusUpdateError', null, 'error')
            );
    }

    /**
     * Ask for confirmation, then delete.
     *
     * Only a strict `true` counts as consent: dismissing the dialog with Escape or the
     * backdrop yields `undefined`.
     *
     * @param product
     */
    deleteProduct(product: Product): void
    {
        const data: ConfirmDialogData = {
            titleKey     : 'admin.products.deleteTitle',
            messageKey   : 'admin.products.deleteConfirm',
            messageParams: {name: resolveLocalizedText(product.name, this._i18nService.language)},
            confirmKey   : 'common.delete'
        };

        this._matDialog.open(ConfirmDialogComponent, {data, autoFocus: false})
            .afterClosed()
            .pipe(
                filter(confirmed => confirmed === true),
                switchMap(() => this._productService.deleteProduct(product.id)),
                takeUntil(this._unsubscribeAll)
            )
            .subscribe(
                () => {
                    this.dataSource.data = this.dataSource.data.filter(item => item.id !== product.id);
                    this._flash('admin.products.deleted');
                },
                () => this._flash('admin.products.deleteError', null, 'error')
            );
    }

    /**
     * Track by function for ngFor loops
     *
     * @param index
     * @param item
     */
    trackByFn(index: number, item: Product): string
    {
        return item.id;
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Show a transient message.
     *
     * @param key
     * @param params
     * @param type
     */
    private _flash(key: string, params: any = null, type: 'success' | 'error' = 'success'): void
    {
        this.message = key;
        this.messageParams = params;
        this.messageType = type;

        clearTimeout(this._messageTimer);
        this._messageTimer = setTimeout(() => {
            this.message = null;
            this.messageParams = null;
        }, 3000);
    }
}
