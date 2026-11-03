import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { Subject } from 'rxjs';
import { FuseNavigationItem, FuseNavigationService } from '@fuse/components/navigation';
import { FuseVerticalNavigationBasicItemComponent } from '@fuse/components/navigation/vertical/components/basic/basic.component';
import {
    compactNavigation, defaultNavigation, futuristicNavigation, horizontalNavigation
} from 'app/mock-api/common/navigation/data';

@Component({
    template: `
        <fuse-vertical-navigation-basic-item *ngFor="let item of items"
            [item]="item" name="test"></fuse-vertical-navigation-basic-item>
        <router-outlet></router-outlet>
    `
})
class ProductNavigationHostComponent
{
    items: FuseNavigationItem[] = [];
}

@Component({template: ''})
class ProductRouteComponent {}

describe('Product sidebar active state', () => {
    let fixture: ComponentFixture<ProductNavigationHostComponent>;
    const refreshed = new Subject<boolean>();

    beforeEach(() => {
        TestBed.configureTestingModule({
            declarations: [ProductNavigationHostComponent, ProductRouteComponent, FuseVerticalNavigationBasicItemComponent],
            imports: [
                CommonModule,
                MatIconTestingModule,
                RouterTestingModule.withRoutes([
                    {path: 'admin/products/new', component: ProductRouteComponent},
                    {path: 'admin/products/:id/edit', component: ProductRouteComponent},
                    {path: 'admin/products', component: ProductRouteComponent}
                ])
            ],
            providers: [
                {provide: FuseNavigationService, useValue: {getComponent: () => ({onRefreshed: refreshed})}}
            ]
        });
        fixture = TestBed.createComponent(ProductNavigationHostComponent);
    });

    afterEach(() => fixture.destroy());

    for (const [name, navigation] of [
        ['default', defaultNavigation], ['compact', compactNavigation],
        ['futuristic', futuristicNavigation], ['horizontal', horizontalNavigation]
    ] as const)
    {
        it(`highlights only the current product destination in ${name} navigation`, fakeAsync(() => {
            fixture.componentInstance.items = navigation.find(item => item.id === 'admin.products').children;
            fixture.detectChanges();
            const router = TestBed.inject(Router);
            const activeLinks = (): string[] =>
                Array.from<HTMLAnchorElement>(fixture.nativeElement.querySelectorAll('.fuse-vertical-navigation-item-active'))
                    .map(link => link.getAttribute('href'));

            for (const path of ['/admin/products', '/admin/products/new', '/admin/products'])
            {
                router.navigateByUrl(path);
                tick();
                fixture.detectChanges();
                tick();
                expect(activeLinks()).toEqual([path]);
            }

            router.navigateByUrl('/admin/products/example/edit');
            tick();
            fixture.detectChanges();
            tick();
            expect(activeLinks()).toEqual([]);
        }));
    }
});
