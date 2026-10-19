import { ChangeDetectionStrategy, Component, EventEmitter, Output } from '@angular/core';

@Component({
    selector       : 'home-custom-banner',
    templateUrl    : './home-custom-banner.component.html',
    styleUrls      : ['./home-custom-banner.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeCustomBannerComponent
{
    @Output() readonly requestQuote: EventEmitter<void> = new EventEmitter<void>();
}
