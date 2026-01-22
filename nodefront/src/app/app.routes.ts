import { Routes } from '@angular/router';
import { authGuard } from './auth-guard';
import { activatedGuard } from './activated-guard';
import { minRoleGuard } from './role-guard';
import { LoginComponent } from './login-component/login-component';

export const routes: Routes = [
    {
        path: 'login',
        component: LoginComponent
    },
    {
        path: '**',
        redirectTo: 'devices'
    }
];