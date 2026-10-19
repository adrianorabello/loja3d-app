import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

/**
 * Generic "nothing here" panel, used for an empty catalogue result and an empty cart.
 *
 * Takes translation KEYS rather than resolved strings so the copy stays in the dictionaries
 * and the component carries no language awareness of its own. The action is optional: with
 * no `actionKey` the button is not rendered at all.
 */
@Component({
    selector       : 'empty-state',
    templateUrl    : './empty-state.component.html',
    encapsulation  : ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent
{
    @Input() icon: string = 'heroicons_outline:search';
    @Input() titleKey: string;
    @Input() bodyKey: string;
    @Input() actionKey: string;

    @Output() readonly action: EventEmitter<void> = new EventEmitter<void>();
}
