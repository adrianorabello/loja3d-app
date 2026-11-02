import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { FuseAlertModule } from '@fuse/components/alert';
import { SharedModule } from 'app/shared/shared.module';
import { SharedComponentsModule } from 'app/shared/components/shared-components.module';
import { RequestListComponent } from './request-list.component';
import { RequestCreateComponent } from './request-create.component';
import { RequestDetailComponent } from './request-detail.component';
import { RequestWorkflowComponent } from './request-workflow.component';
import { RoleGuard } from 'app/core/auth/guards/role.guard';

const routes: Routes = [
    {path: '', pathMatch: 'full', component: RequestListComponent},
    {path: 'new', component: RequestCreateComponent, canActivate: [RoleGuard], data: {roles: ['CUSTOMER']}},
    {path: ':id', component: RequestDetailComponent}
];

@NgModule({
    declarations: [RequestListComponent, RequestCreateComponent, RequestDetailComponent, RequestWorkflowComponent],
    imports: [
        RouterModule, SharedModule, SharedComponentsModule,
        MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule,
        MatTableModule, MatPaginatorModule, MatProgressBarModule, MatDialogModule, MatIconModule, FuseAlertModule
    ],
    exports: [RequestListComponent, RequestCreateComponent, RequestDetailComponent]
})
class PrintRequestPagesModule {}

@NgModule({imports: [PrintRequestPagesModule, RouterModule.forChild(routes)]})
export class PrintRequestsModule {}

@NgModule({
    imports: [
        PrintRequestPagesModule,
        RouterModule.forChild([
            {path: '', pathMatch: 'full', component: RequestListComponent},
            {path: ':id', component: RequestDetailComponent}
        ])
    ]
})
export class AdminPrintRequestsModule {}
