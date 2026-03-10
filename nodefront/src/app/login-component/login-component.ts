import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth-service';
import { OverlayService } from '../overlay-service';

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
    private overlay: OverlayService
  ) {}

  async submit() {
    if (this.username.trim().length === 0 || this.password.trim().length === 0) {
      this.overlay.showOverlay("error", "Bitte füllen Sie das Anmeldeformular aus.");
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
        this.overlay.showOverlay("info", "Ihre Anmeldung war erfolgreich, jedoch müssen Sie von einem Systemadmin freigeschaltet werden.");
      } else {
        await this.router.navigateByUrl('/devices');
        this.overlay.showOverlay("success", "Sie wurden erfolgreich angemeldet.");
      }
    } catch (e: any) {
      const msg =
        e?.error?.error ||
        e?.error?.message ||
        (e?.status === 401 ? 'Ungültiger Nutzername oder Passwort.' : null) ||
        (e?.status === 500 ? 'Server/LDAP-Fehler.' : null) ||
        'Login fehlgeschlagen.';
      this.error = msg;
      this.overlay.showOverlay("error", msg);
    } finally {
      this.loading = false;
    }
  }
}