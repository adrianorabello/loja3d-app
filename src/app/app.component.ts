import { Component, OnInit } from '@angular/core';
import { I18nService } from 'app/core/i18n/i18n.service';

@Component({
    selector   : 'app-root',
    templateUrl: './app.component.html',
    styleUrls  : ['./app.component.scss']
})
export class AppComponent implements OnInit
{
    /**
     * Constructor
     */
    constructor(private _i18nService: I18nService)
    {
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void
    {
        // Resolve the startup language (stored preference, else pt-BR) and load its
        // dictionary. Done here rather than in an APP_INITIALIZER so the first paint is
        // not blocked on an HTTP fetch — templates render keys for a few milliseconds and
        // then resolve, which is preferable to a blank screen.
        this._i18nService.init();
    }
}
