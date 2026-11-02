import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { MatMenuTrigger } from '@angular/material/menu';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { AuthService } from 'app/core/auth/auth.service';
import { CartService } from 'app/core/cart/cart.service';
import { UserService } from 'app/core/user/user.service';
import { StorefrontLayoutModule } from './storefront.module';
import { StorefrontLayoutComponent } from './storefront.component';

describe('Storefront header navigation', () => {
    let fixture: ComponentFixture<StorefrontLayoutComponent>;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                StorefrontLayoutModule, HttpClientTestingModule, RouterTestingModule,
                NoopAnimationsModule, MatIconTestingModule, TranslateModule.forRoot()
            ],
            providers: [
                {provide: AuthService, useValue: {check: () => of(false)}},
                {provide: CartService, useValue: {count$: of(0)}},
                {provide: FuseMediaWatcherService, useValue: {onMediaChange$: of({matchingAliases: ['md']})}}
            ]
        });
        fixture = TestBed.createComponent(StorefrontLayoutComponent);
        fixture.detectChanges();
    });

    afterEach(() => fixture.destroy());

    function openMore(): MatMenuTrigger
    {
        const button = fixture.debugElement.query(By.css('nav button'));
        const trigger = button.injector.get(MatMenuTrigger);
        trigger.openMenu();
        fixture.detectChanges();
        return trigger;
    }

    it('shows Home, Products and More in order, moving custom-print links into the dropdown', () => {
        const links = fixture.nativeElement.querySelectorAll('nav a');
        expect(links.length).toBe(2);
        expect(links[0].getAttribute('href')).toBe('/');
        expect(links[1].getAttribute('href')).toBe('/products');
        expect(fixture.nativeElement.querySelector('nav button').textContent).toContain('nav.more');
        const trigger = openMore();
        const items = Array.from(document.querySelectorAll<HTMLAnchorElement>('.mat-menu-panel a'));
        expect(items.map(item => item.getAttribute('href'))).toEqual(['/account/requests/new', '/account/requests']);
        trigger.closeMenu();
    });

    it('keeps profile and admin links role-aware inside More', () => {
        TestBed.inject(UserService).user = {id: 'admin', name: 'Admin', email: 'admin@example.com', role: 'ADMIN'};
        fixture.detectChanges();
        const trigger = openMore();
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('.mat-menu-panel a')).map(a => a.getAttribute('href'));
        expect(links).toContain('/account/profile');
        expect(links).toContain('/admin/products');
        trigger.closeMenu();
    });

    it('offers the same More menu on mobile and closes the drawer after navigation', () => {
        fixture.componentInstance.toggleMobileMenu();
        fixture.detectChanges();
        const mobile = fixture.nativeElement.querySelector('header > div.border-t');
        expect(mobile.querySelectorAll('a')[0].getAttribute('href')).toBe('/');
        expect(mobile.querySelectorAll('a')[1].getAttribute('href')).toBe('/products');
        expect(mobile.querySelector('button').textContent).toContain('nav.more');
        fixture.componentInstance.closeMobileMenu();
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('header > div.border-t')).toBeNull();
    });
});
