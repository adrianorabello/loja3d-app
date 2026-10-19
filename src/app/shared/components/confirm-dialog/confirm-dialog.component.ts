import { ChangeDetectionStrategy, Component, Inject, ViewEncapsulation } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

/**
 * Data accepted by `ConfirmDialogComponent`. Translation KEYS, not strings, so the dialog
 * carries no language awareness; `messageParams` feeds interpolation such as `{{name}}`.
 */
export interface ConfirmDialogData
{
    titleKey: string;
    messageKey: string;
    messageParams?: Record<string, unknown>;
    confirmKey?: string;
    cancelKey?: string;
}

/**
 * Generic confirm / cancel dialog, opened through `MatDialog`. Closes with `true` on
 * confirm and `false` on cancel (or `undefined` if dismissed by backdrop/Escape), so
 * callers should treat only a strict `true` as consent.
 */
@Component({
    selector       : 'confirm-dialog',
    encapsulation  : ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template       : `
        <h2 mat-dialog-title>{{ data.titleKey | translate }}</h2>
        <mat-dialog-content>
            {{ data.messageKey | translate: data.messageParams }}
        </mat-dialog-content>
        <mat-dialog-actions align="end">
            <button id="confirm-dialog-cancel" mat-button [mat-dialog-close]="false">
                {{ (data.cancelKey || 'common.cancel') | translate }}
            </button>
            <button id="confirm-dialog-confirm" mat-flat-button color="warn" [mat-dialog-close]="true">
                {{ (data.confirmKey || 'common.confirm') | translate }}
            </button>
        </mat-dialog-actions>
    `
})
export class ConfirmDialogComponent
{
    constructor(@Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData)
    {
    }
}
