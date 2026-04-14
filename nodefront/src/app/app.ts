import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { AuthService } from './auth-service';
import { VersionService } from './version-service';
import { OverlayAccountPayload, OverlayService } from './overlay-service';
import { OverlayComponent } from "./overlay-component/overlay-component";
import { UserService } from './user-service';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, OverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit, OnDestroy {
  accountDisplayName = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    public auth: AuthService,
    private router: Router,
    public version: VersionService,
    private overlay: OverlayService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.auth.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        if (!user?.username) {
          this.accountDisplayName = '';
          return;
        }

        const loginName = this.normalizeLoginName(user.username);
        this.accountDisplayName = loginName.toUpperCase();

        this.userService.searchLdap(loginName)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (results) => {
              const exactMatch = results.find(
                (entry) => this.normalizeLoginName(entry.username).toLowerCase() === loginName.toLowerCase()
              );
              this.accountDisplayName = exactMatch?.displayName?.trim() || loginName.toUpperCase();
            },
            error: () => {
              this.accountDisplayName = loginName.toUpperCase();
            }
          });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigateLogin(logout: boolean) {
    if (logout) {
      this.auth.logout();
    }
    this.router.navigate(['/login']);
  }

  navigateChangelog() {
    this.router.navigate(['/changelog']);
  }

  navigateAdmin() {
    this.router.navigate(['/admin']);
  }

  navigateCreate() {
    this.router.navigate(['/create']);
  }

  navigateDocumentation() {
    this.router.navigate(['/docs']);
  }

  navigateDashboard() {
    this.router.navigate(['/dashboard']);
  }

  openStyleOverlay() {
    this.overlay.showOverlay("style");
  }

  openAccountOverlay() {
    const user = this.auth.user;
    if (!user) {
      return;
    }

    const loginName = this.normalizeLoginName(user.username);
    const payload: OverlayAccountPayload = {
      displayName: this.accountDisplayName || loginName.toUpperCase(),
      username: loginName.toUpperCase(),
      loginName: user.username,
      isActivated: user.isActivated,
      role: user.role
    };

    this.overlay.showOverlay('account', undefined, payload);
  }

  private normalizeLoginName(username: string): string {
    return String(username || '').split('@')[0].trim();
  }

  @HostListener("document:keydown.shift.q", ["$event"])
  onShiftQHandler(event: Event) {
    this.openStyleOverlay();
  }

  @HostListener('document:keydown', ['$event'])
  handleKey(event: KeyboardEvent) {
    if (event.altKey && event.code === 'Period') {
      event.preventDefault();
      this.openDebugOverlay();
    }
  }

  openDebugOverlay() {
    this.overlay.showOverlay("debug");
  }
}
