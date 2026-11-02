import { Component, Input } from '@angular/core';
import { SafeUrl } from '@angular/platform-browser';
import { User } from 'app/core/user/user.model';
import { UserAvatarService } from 'app/core/user/user-avatar.service';

@Component({
    selector: 'app-user-avatar',
    template: `
        <ng-container *ngIf="avatars.state$ | async as state">
            <img *ngIf="state.url && state.url !== failedUrl; else fallback" class="avatar-image"
                [src]="state.url" [alt]="user?.name || ''" (error)="onImageError(state.url)">
            <ng-template #fallback>
                <mat-icon class="avatar-icon" svgIcon="heroicons_outline:user-circle" aria-hidden="true"></mat-icon>
            </ng-template>
            <span *ngIf="state.error || (failedUrl && failedUrl === state.url)" class="sr-only" role="status">
                {{ 'customerAccount.photoLoadError' | translate }}
            </span>
        </ng-container>
    `,
    styles: [`
        :host { display: block; width: 100%; height: 100%; }
        .avatar-image { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
        .avatar-icon { width: 100%; height: 100%; }
    `]
})
export class UserAvatarComponent
{
    @Input() user: User;
    failedUrl: string | SafeUrl;

    constructor(public avatars: UserAvatarService) {}

    onImageError(url: string | SafeUrl): void
    {
        this.failedUrl = url;
        console.error('Could not display the profile photo.');
    }
}
