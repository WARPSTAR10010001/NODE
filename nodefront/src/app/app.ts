import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { AuthService } from './auth-service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  constructor(
    public auth: AuthService,
    private router: Router
  ) {}

  navigateLogin(logout: boolean) {
    if (logout) {
      this.auth.logout();
    }
    this.router.navigate(['/login']);
  }
}
