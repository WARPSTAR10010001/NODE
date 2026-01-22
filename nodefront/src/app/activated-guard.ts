import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth-service';

export const activatedGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.user === null) {
    const st = await auth.status();
    if (!st.loggedIn) return router.parseUrl('/login');
  }

  if (!auth.user?.isActivated) return router.parseUrl('/pending');
  return true;
};