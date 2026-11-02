import { Component, Input } from '@angular/core';
import { REQUEST_STAGES, requestStage, RequestStatus } from 'app/core/print-requests/print-request.model';

@Component({
    selector: 'print-request-workflow',
    templateUrl: './request-workflow.component.html',
    styleUrls: ['./request-workflow.component.css']
})
export class RequestWorkflowComponent
{
    @Input() status?: RequestStatus;

    readonly stages = REQUEST_STAGES;

    get label(): string
    {
        return this.status ? 'requests.progress' : 'requests.processOverview';
    }

    isCurrent(index: number): boolean
    {
        if ( !this.status ) { return index === 0; }
        return !['cancelled', 'rejected', 'delivered'].includes(this.status) && index === requestStage(this.status);
    }

    isComplete(index: number): boolean
    {
        if ( !this.status || ['cancelled', 'rejected'].includes(this.status) ) { return false; }
        return this.status === 'delivered' || index < requestStage(this.status);
    }

    stageLabel(index: number): string
    {
        if ( !this.status ) { return index === 0 ? 'requests.preparing' : 'requests.upcoming'; }
        if ( this.isComplete(index) ) { return 'requests.complete'; }
        return this.isCurrent(index) ? 'requests.current' : 'requests.pending';
    }
}
