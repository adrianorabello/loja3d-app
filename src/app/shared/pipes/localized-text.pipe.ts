import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { I18nService } from 'app/core/i18n/i18n.service';
import { AppLanguage } from 'app/core/i18n/i18n.types';
import { LocalizedText, resolveLocalizedText } from 'app/shared/models/localized-text.model';

/**
 * Resolves a `LocalizedText` record for the active UI language.
 *
 * Use this rather than indexing the record directly: the missing-translation fallback then
 * lives in one place (`resolveLocalizedText`), so a half-translated product shows its
 * Portuguese name to an English visitor instead of rendering an empty string.
 *
 * **Deliberately impure.** A pure pipe cannot work here: switching the language does not
 * change the `LocalizedText` object's reference, so Angular would never re-run the
 * transform and every product name would stay frozen in the previous language. The
 * in-repo precedent is ngx-translate's own `TranslatePipe`, which is impure for exactly
 * this reason and is already running in every template in the app.
 *
 * Two things keep the cost of impurity down:
 *
 *   1. Results are memoised per `(record, language)`, so the steady-state cost on each
 *      change-detection pass is a `Map` lookup, not a string rebuild.
 *   2. It injects `ChangeDetectorRef` and marks the host view dirty when the language
 *      changes, which is what lets `OnPush` components — `ProductCardComponent` in a grid
 *      of them — re-render on a language switch without being marked dirty by anything else.
 */
@Pipe({
    name: 'localizedText',
    pure: false
})
export class LocalizedTextPipe implements PipeTransform, OnDestroy
{
    private _language: AppLanguage;
    private _cache: Map<LocalizedText, string> = new Map<LocalizedText, string>();
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _i18nService: I18nService,
        private _changeDetectorRef: ChangeDetectorRef
    )
    {
        this._language = this._i18nService.language;

        this._i18nService.language$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((language) => {

                if ( language === this._language )
                {
                    return;
                }

                this._language = language;

                // Values memoised against the previous language are now wrong.
                this._cache.clear();

                // Required for OnPush hosts: without this an impure pipe still never runs,
                // because no change-detection pass reaches the component.
                this._changeDetectorRef.markForCheck();
            });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

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
     * Transform
     *
     * @param value
     */
    transform(value: LocalizedText | null | undefined): string
    {
        if ( !value )
        {
            return '';
        }

        if ( this._cache.has(value) )
        {
            return this._cache.get(value);
        }

        const resolved = resolveLocalizedText(value, this._language);

        this._cache.set(value, resolved);

        return resolved;
    }
}
