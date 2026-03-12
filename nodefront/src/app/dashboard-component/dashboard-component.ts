import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth-service';

@Component({
  selector: 'app-dashboard-component',
  imports: [RouterLink],
  templateUrl: './dashboard-component.html',
  styleUrl: './dashboard-component.css',
})
export class DashboardComponent {
  constructor(
    public auth: AuthService
  ) {}
}
