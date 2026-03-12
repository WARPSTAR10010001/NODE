import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from './environments/environment';
import { Router } from '@angular/router';
import { OverlayService } from './overlay-service';

export type Role = 0 | 1 | 2;

export interface User {
  id: number;
  adGuid: string;
  username: string;
  role: Role;
  isActivated: boolean;
  lastLogin: string;
}

export interface AuthStatusResponse {
  loggedIn: boolean;
  user: User | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private base = environment.apiBaseUrl;
  private readonly _user$ = new BehaviorSubject<User | null>(null);
  user$ = this._user$.asObservable();
  isLoggedIn = signal<boolean>(false);
  loggedRole = signal<any>(undefined);
  activated = signal<any>(false);

  constructor(
    private http: HttpClient,
    private router: Router,
    private overlay: OverlayService
  ) {}

  get user(): User | null {
    return this._user$.value;
  }

  async status(): Promise<AuthStatusResponse> {
    const res = await firstValueFrom(this.http.get<AuthStatusResponse>(`${this.base}/auth/status`));
    this._user$.next(res.user);
    this.isLoggedIn.set(res.loggedIn);
    this.loggedRole.set(res.user?.role);
    this.activated.set(res.user?.isActivated);
    return res;
  }

  async login(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ loggedIn: boolean; user: User }>(`${this.base}/auth/login`, { username, password })
    );
    this.isLoggedIn.set(res.loggedIn);
    this.loggedRole.set(res.user?.role);
    this.activated.set(res.user?.isActivated);
    this._user$.next(res.user);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/auth/logout`, {}));
    this._user$.next(null);
    this.isLoggedIn.set(false);
    this.loggedRole.set(undefined);
    this.router.navigate(['/login']);
    this.overlay.showOverlay("success", "Sie wurden erfolgreich abgemeldet.");
  }
}