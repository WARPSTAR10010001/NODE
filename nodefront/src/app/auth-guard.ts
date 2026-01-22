import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth-service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.user === null) {
    const st = await auth.status();
    if (!st.loggedIn) return router.parseUrl('/login');
  }

  return true;
};