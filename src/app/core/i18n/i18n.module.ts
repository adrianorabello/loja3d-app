import { NgModule } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { DEFAULT_LANGUAGE } from 'app/core/i18n/i18n.types';

/**
 * Factory for the dictionary loader.
 *
 * Dictionaries live in `src/assets/i18n/` and are served from `/assets/i18n/` —
 * `src/assets` is already declared in both the build and test asset arrays of
 * `angular.json`, so no build configuration change is needed.
 *
 * Note: this fetch goes through `HttpClient`, so it passes both
 * `FuseMockApiInterceptor` (no handler matches, so it falls through to the network)
 * and `AuthInterceptor` (which adds an Authorization header to a static asset —
 * harmless, just noisy in the Network tab).
 */
export function translateHttpLoaderFactory(http: HttpClient): TranslateLoader
{
    return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

/**
 * Root translation module.
 *
 * Imported by `CoreModule` rather than `AppModule`: `CoreModule` is already the
 * single-import root-services module (it throws if injected twice) and already
 * imports `HttpClientModule`, so the `forRoot` providers land in root exactly once.
 *
 * Feature modules do NOT import this. They get the `translate` pipe and directive
 * from `SharedModule`, which re-exports a plain `TranslateModule`.
 */
@NgModule({
    imports: [
        TranslateModule.forRoot({
            defaultLanguage: DEFAULT_LANGUAGE,
            loader         : {
                provide   : TranslateLoader,
                useFactory: translateHttpLoaderFactory,
                deps      : [HttpClient]
            }
        })
    ],
    exports: [
        TranslateModule
    ]
})
export class I18nModule
{
}
