import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Role } from './auth-service';

export function minRoleGuard(minRole: Role): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (auth.user === null) {
      const st = await auth.status();
      if (!st.loggedIn) return router.parseUrl('/login');
    }

    if (!auth.user?.isActivated) return router.parseUrl('/pending');
    if ((auth.user?.role ?? 0) < minRole) return router.parseUrl('/devices');
    return true;
  };
}