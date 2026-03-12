import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-pending-component',
  imports: [],
  templateUrl: './pending-component.html',
  styleUrl: './pending-component.css',
})
export class PendingComponent {
  constructor (
    private router: Router
  ) {}
  
  navigateDashboard() {
    this.router.navigate(['/dashboard']);
  }
}
