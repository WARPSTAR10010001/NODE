import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { AuthService } from '../auth-service';
import { OverlayService } from '../overlay-service';
import { UserService } from '../user-service';

@Component({
  selector: 'app-pending-component',
  imports: [CommonModule],
  templateUrl: './pending-component.html',
  styleUrl: './pending-component.css',
})
export class PendingComponent implements OnInit {
  displayName = '';
  username = '';
  loading = false;

  constructor (
    private router: Router,
    private auth: AuthService,
    private overlay: OverlayService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.loadCurrentUserDisplay();
  }

  async retryStatusCheck(): Promise<void> {
    this.loading = true;

    try {
      const status = await this.auth.status();

      if (!status.loggedIn || !status.user) {
        await this.router.navigate(['/login']);
        return;
      }

      this.loadCurrentUserDisplay();

      if (status.user.isActivated) {
        await this.router.navigate(['/dashboard']);
        return;
      }

      this.overlay.showOverlay('info', 'Es liegt weiterhin keine Freischaltung vor. Bitte versuchen Sie es später erneut.');
    } catch (error) {
      console.error('Retry pending status failed', error);
      this.overlay.showOverlay('error', 'Die aktuellen Nutzerdaten konnten nicht geladen werden.');
    } finally {
      this.loading = false;
    }
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }

  private loadCurrentUserDisplay(): void {
    const user = this.auth.user;
    if (!user?.username) {
      this.displayName = '';
      this.username = '';
      return;
    }

    this.username = this.normalizeLoginName(user.username).toUpperCase();
    this.displayName = this.username;

    this.userService.searchLdap(this.username)
      .subscribe({
        next: (results) => {
          const exactMatch = results.find(
            (entry) => this.normalizeLoginName(entry.username).toLowerCase() === this.username.toLowerCase()
          );
          this.displayName = exactMatch?.displayName?.trim() || this.username;
        },
        error: () => {
          this.displayName = this.username;
        }
      });
  }

  private normalizeLoginName(username: string): string {
    return String(username || '').split('@')[0].trim();
  }
}
