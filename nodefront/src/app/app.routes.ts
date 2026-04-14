import { Routes } from '@angular/router';

import { LoginComponent } from './login-component/login-component';
import { PendingComponent } from './pending-component/pending-component';
import { DevicesComponent } from './devices-component/devices-component';
import { AdminComponent } from './admin-component/admin-component';
import { ChangelogComponent } from './changelog-component/changelog-component';
import { CreateComponent } from './create-component/create-component';
import { DocumentationComponent } from './documentation-component/documentation-component';
import { DashboardComponent } from './dashboard-component/dashboard-component';
import { ManageComponent } from './manage-component/manage-component';
import { DetailViewComponent } from './detail-view-component/detail-view-component';
import { DetailEditComponent } from './detail-edit-component/detail-edit-component';

import { authGuard } from './auth-guard';
import { activatedGuard } from './activated-guard';
import { minRoleGuard } from './role-guard';
import { DetailLogsComponent } from './detail-logs-component/detail-logs-component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    title: 'Login • NODE'
  },
  {
    path: 'changelog',
    component: ChangelogComponent,
    title: 'Changelog • NODE'
  },
  {
    path: 'docs',
    component: DocumentationComponent,
    title: 'Dokumentation • NODE'
  },
  {
    path: 'pending',
    canActivate: [authGuard],
    component: PendingComponent,
    title: 'Freigabe • NODE'
  },
  {
    path: '',
    canActivate: [authGuard, activatedGuard],
    children: [
      {
        path: 'devices',
        component: DevicesComponent,
        title: 'Geräte • NODE'
      },
      {
        path: 'devices/:inventoryNumber',
        component: DetailViewComponent,
        title: 'Details • NODE'
      },
      {
        path: 'devices/:inventoryNumber/edit',
        component: DetailEditComponent,
        canActivate: [minRoleGuard(1)],
        title: 'Bearbeiten • NODE'
      },
      {
        path: 'devices/:inventoryNumber/logs',
        component: DetailLogsComponent,
        canActivate: [minRoleGuard(1)],
        title: 'Logs • NODE'
      },
      {
        path: 'dashboard',
        component: DashboardComponent,
        title: 'Dashboard • NODE'
      },
      {
        path: 'admin',
        canActivate: [minRoleGuard(2)],
        component: AdminComponent,
        title: 'Nutzerverwaltung • NODE'
      },
      {
        path: 'create',
        canActivate: [minRoleGuard(1)],
        component: CreateComponent,
        title: 'Erstellen • NODE'
      },
      {
        path: 'manage',
        canActivate: [minRoleGuard(1)],
        component: ManageComponent,
        title: 'Verwalten • NODE'
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
