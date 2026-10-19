import { DEFAULT_CURRENCY_CODE, LOCALE_ID, NgModule, Optional, SkipSelf } from '@angular/core';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { MatIconRegistry } from '@angular/material/icon';
import { AuthService } from 'app/core/auth/auth.service';
import { AuthInterceptor } from 'app/core/auth/auth.interceptor';
import { API_BASE_URL, API_ORIGIN } from 'app/core/api/api.config';
import { ApiOriginInterceptor } from 'app/core/api/api-origin.interceptor';
import { I18nModule } from 'app/core/i18n/i18n.module';
import { DEFAULT_LANGUAGE } from 'app/core/i18n/i18n.types';
import { environment } from 'environments/environment';

// Side-effect import: registers the locale data (pt-BR, en, de) that the pinned LOCALE_ID needs at bootstrap.
import 'app/shared/pipes/app-currency.pipe';


@NgModule({
    imports  : [
        HttpClientModule,
        I18nModule
    ],
    providers: [
        AuthService,
        {
            provide : HTTP_INTERCEPTORS,
            useClass: ApiOriginInterceptor,
            multi   : true
        },
        {
            provide : HTTP_INTERCEPTORS,
            useClass: AuthInterceptor,
            multi   : true
        },
        {
            provide : API_ORIGIN,
            useValue: environment.apiOrigin
        },
        {
            provide : API_BASE_URL,
            useValue: environment.apiBaseUrl
        },
        {
            // Pinned, not switched at runtime: Angular resolves LOCALE_ID once at
            // bootstrap. Use `appCurrency` (not `currency`) for prices that must follow the language.
            provide : LOCALE_ID,
            useValue: DEFAULT_LANGUAGE
        },
        {
            // Makes `{{ price | currency }}` render EUR without repeating the code
            // at every call site.
            provide : DEFAULT_CURRENCY_CODE,
            useValue: 'EUR'
        }
    ],
    exports  : [
        I18nModule
    ]
})
export class CoreModule
{
    /**
     * Constructor
     */
    constructor(
        private _domSanitizer: DomSanitizer,
        private _matIconRegistry: MatIconRegistry,
        @Optional() @SkipSelf() parentModule?: CoreModule
    )
    {
        // Do not allow multiple injections
        if ( parentModule )
        {
            throw new Error('CoreModule has already been loaded. Import this module in the AppModule only.');
        }

        // Register icon sets
        this._matIconRegistry.addSvgIconSet(this._domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/material-twotone.svg'));
        this._matIconRegistry.addSvgIconSetInNamespace('mat_outline', this._domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/material-outline.svg'));
        this._matIconRegistry.addSvgIconSetInNamespace('mat_solid', this._domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/material-solid.svg'));
        this._matIconRegistry.addSvgIconSetInNamespace('iconsmind', this._domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/iconsmind.svg'));
        this._matIconRegistry.addSvgIconSetInNamespace('feather', this._domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/feather.svg'));
        this._matIconRegistry.addSvgIconSetInNamespace('heroicons_outline', this._domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/heroicons-outline.svg'));
        this._matIconRegistry.addSvgIconSetInNamespace('heroicons_solid', this._domSanitizer.bypassSecurityTrustResourceUrl('assets/icons/heroicons-solid.svg'));
    }
}
