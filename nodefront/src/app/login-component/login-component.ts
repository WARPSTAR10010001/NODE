import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth-service';

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

  constructor(private auth: AuthService, private router: Router) {}

  async submit() {
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
      } else {
        await this.router.navigateByUrl('/devices');
      }
    } catch (e: any) {
      const msg =
        e?.error?.error ||
        e?.error?.message ||
        (e?.status === 401 ? 'Ungültiger Nutzername oder Passwort.' : null) ||
        (e?.status === 500 ? 'Server/LDAP-Fehler.' : null) ||
        'Login fehlgeschlagen.';
      this.error = msg;
    } finally {
      this.loading = false;
    }
  }
}