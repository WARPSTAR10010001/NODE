import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../auth-service';
import { OverlayService } from '../overlay-service';
import { UserService } from '../user-service';

const ADMIN_REVIEWED_AT_KEY = 'node.admin.lastApprovalReviewAt';

@Component({
  selector: 'app-login-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './login-component.html',
  styleUrls: ['./login-component.css'],
})
export class LoginComponent {
  username = '';
  password = '';

  loading = false;
  error: string | null = null;

  constructor(
    private auth: AuthService,
    private router: Router,
    private overlay: OverlayService,
    private userService: UserService
  ) {}

  async submit() {
    if (this.username.trim().length === 0 || this.password.trim().length === 0) {
      this.overlay.showOverlay('error', 'Bitte füllen Sie das Anmeldeformular aus.');
    }
    this.error = null;

    if (!this.username.trim() || !this.password) {
      this.error = 'Bitte Nutzername und Passwort eingeben.';
      return;
    }

    this.loading = true;
    try {
      await this.auth.login(`${this.username.trim().toLowerCase()}@rheinberg.krzn.de`, this.password);

      const user = this.auth.user;

      if (user && !user.isActivated) {
        await this.router.navigateByUrl('/pending');
        this.overlay.showOverlay('info', 'Ihre Anmeldung war erfolgreich, jedoch müssen Sie von einem Systemadmin freigeschaltet werden.');
      } else {
        await this.router.navigateByUrl('/dashboard');

        if (user?.role === 2) {
          const users = await firstValueFrom(this.userService.getUsers());
          const lastReviewedAt = this.getLastApprovalReviewAt();
          const pendingCount = users.filter((entry) => {
            if (entry.isActivated || !entry.previouslyLoggedIn) {
              return false;
            }

            const createdAt = new Date(entry.createdAt);
            if (Number.isNaN(createdAt.getTime())) {
              return false;
            }

            return !lastReviewedAt || createdAt > lastReviewedAt;
          }).length;

          if (pendingCount > 0) {
            this.overlay.showOverlay('info', `Es sind neue Freigabeanfragen vorhanden (${pendingCount}).`);
            return;
          }
        }

        this.overlay.showOverlay('success', 'Sie wurden erfolgreich angemeldet.');
      }
    } catch (e: any) {
      const msg =
        e?.error?.error ||
        e?.error?.message ||
        (e?.status === 401 ? 'Ungültiger Nutzername oder Passwort.' : null) ||
        (e?.status === 500 ? 'Server/LDAP-Fehler.' : null) ||
        'Login fehlgeschlagen.';
      this.error = msg;
      this.overlay.showOverlay('error', msg);
    } finally {
      this.loading = false;
    }
  }

  private getLastApprovalReviewAt(): Date | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const rawValue = localStorage.getItem(ADMIN_REVIEWED_AT_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = new Date(rawValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
}
