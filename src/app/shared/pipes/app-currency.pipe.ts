import { formatCurrency, getCurrencySymbol, registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import localePt from '@angular/common/locales/pt';
import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { I18nService } from 'app/core/i18n/i18n.service';
import { AppLanguage } from 'app/core/i18n/i18n.types';

// Registered here so the pipe works wherever it is declared, not only after CoreModule loads.
registerLocaleData(localePt, 'pt-BR');
registerLocaleData(localeEn);
registerLocaleData(localeDe);

/**
 * Currency formatting that follows the active UI language (`€ 12,50`, `€12.50`, `12,50 €`).
 *
 * Angular's own `currency` pipe is pure and bound to the bootstrap `LOCALE_ID`, so it
 * would not react to a language switch. The currency itself is always EUR.
 */
@Pipe({
    name: 'appCurrency',
    pure: false
})
export class AppCurrencyPipe implements PipeTransform, OnDestroy
{
    private _language: AppLanguage;
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _i18nService: I18nService,
        private _changeDetectorRef: ChangeDetectorRef
    )
    {
        this._language = this._i18nService.language;

        this._i18nService.language$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((language) => {
                this._language = language;
                this._changeDetectorRef.markForCheck();
            });
    }

    ngOnDestroy(): void
    {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    transform(value: number | null | undefined): string
    {
        if ( value === null || value === undefined || isNaN(value) )
        {
            return '';
        }

        return formatCurrency(value, this._language, getCurrencySymbol('EUR', 'narrow', this._language), 'EUR');
    }
}
