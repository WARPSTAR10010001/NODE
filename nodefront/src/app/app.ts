import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { AuthService } from './auth-service';
import { VersionService } from './version-service';
import { OverlayService } from './overlay-service';
import { OverlayComponent } from "./overlay-component/overlay-component";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, OverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  constructor(
    public auth: AuthService,
    private router: Router,
    public version: VersionService,
    private overlay: OverlayService
  ) {}

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

  openStyleOverlay() {
    this.overlay.showOverlay("style");
  }
}