import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { CategoryService } from 'app/core/category/category.service';
import { ProductService } from 'app/core/product/product.service';
import { Product } from 'app/shared/models/product.model';
import { AdminProductsModule } from '../products.module';
import { ProductFormComponent } from './product-form.component';

describe('Product photo persistence form', () => {
    let fixture: ComponentFixture<ProductFormComponent>;
    let component: ProductFormComponent;
    let result: Subject<Product>;
    let products: jasmine.SpyObj<ProductService>;

    beforeEach(() => {
        products = jasmine.createSpyObj('ProductService', ['createProduct']);
        result = new Subject<Product>();
        products.createProduct.and.returnValue(result);
        TestBed.configureTestingModule({
            imports: [AdminProductsModule, RouterTestingModule, NoopAnimationsModule,
                MatIconTestingModule, TranslateModule.forRoot()],
            providers: [
                {provide: ActivatedRoute, useValue: {snapshot: {data: {}}}},
                {provide: CategoryService, useValue: {ensureLoaded: () => of([])}},
                {provide: ProductService, useValue: products}
            ]
        });
        fixture = TestBed.createComponent(ProductFormComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        component.form.patchValue({namePt: 'Photo test', categoryId: 'test', price: 10});
        component.images = ['assets/images/logo/printoy-purple.svg',
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='];
    });

    afterEach(() => fixture.destroy());

    it('sends preview data and existing image URLs and prevents duplicate saves', () => {
        component.save();
        component.save();
        expect(products.createProduct).toHaveBeenCalledTimes(1);
        expect(products.createProduct.calls.mostRecent().args[0].images).toEqual(component.images);
        expect(component.form.disabled).toBeTrue();
        const navigate = spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
        result.next({...products.createProduct.calls.mostRecent().args[0], id: '1', createdAt: '2026-11-02'});
        expect(navigate).toHaveBeenCalled();
    });

    for (const [status, key] of [[413, 'productForm.imageStorageLimit'], [422, 'productForm.imageRejected'],
        [415, 'productForm.imageRejected'], [503, 'admin.products.saveError']] as const)
    {
        it(`preserves the draft and explains image error ${status}`, () => {
            const images = [...component.images];
            component.save();
            result.error(new HttpErrorResponse({status}));
            fixture.detectChanges();
            expect(component.saveError).toBe(key);
            expect(component.form.enabled).toBeTrue();
            expect(component.form.value.namePt).toBe('Photo test');
            expect(component.images).toEqual(images);
            expect(fixture.nativeElement.querySelector('fuse-alert').textContent).toContain(key);
        });
    }

    it('does not save while a selected photo is still being read', () => {
        component.pendingImageReads = 1;
        component.save();
        expect(products.createProduct).not.toHaveBeenCalled();
    });
});
