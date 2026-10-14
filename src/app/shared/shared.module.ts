import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';

/**
 * Shared module.
 *
 * Deliberately Material-free — that is the house convention in this codebase, and each
 * feature module imports the Mat modules it actually uses. Clara Rosa's Material-using
 * presentational widgets live in `SharedComponentsModule` instead, so the Material
 * dependency stays opt-in.
 *
 * `TranslateModule` is re-exported here (as a plain module, not `forChild`) because every
 * lazy feature module already imports `SharedModule`. That makes the `translate` pipe and
 * directive available application-wide with no per-module boilerplate, all sharing the
 * single root `TranslateService` configured by `I18nModule`.
 */
@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        TranslateModule
    ],
    exports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        TranslateModule
    ]
})
export class SharedModule
{
}
