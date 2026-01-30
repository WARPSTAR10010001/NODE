import { Routes } from '@angular/router';

import { LoginComponent } from './login-component/login-component';
import { PendingComponent } from './pending-component/pending-component';
import { DevicesComponent } from './devices-component/devices-component';
import { AdminComponent } from './admin-component/admin-component';

import { authGuard } from './auth-guard';
import { activatedGuard } from './activated-guard';
import { minRoleGuard } from './role-guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, title: 'Login - NODE' },

  { path: 'pending', canActivate: [authGuard], component: PendingComponent, title: 'Freigabe - NODE' },

  {
    path: '',
    canActivate: [authGuard, activatedGuard],
    children: [
      { path: 'devices', component: DevicesComponent, title: 'Geräte - NODE' },

      { path: 'admin/users', canActivate: [minRoleGuard(2)], component: AdminComponent, title: 'Userverwaltung - NODE' },

      { path: '', pathMatch: 'full', redirectTo: 'devices' },
    ],
  },

  { path: '**', redirectTo: 'devices' },
];
