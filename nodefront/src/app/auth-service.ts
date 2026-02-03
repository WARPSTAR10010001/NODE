import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from './environments/environment';
import { Router } from '@angular/router';

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

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  get user(): User | null {
    return this._user$.value;
  }

  async status(): Promise<AuthStatusResponse> {
    const res = await firstValueFrom(this.http.get<AuthStatusResponse>(`${this.base}/auth/status`));
    this._user$.next(res.user);
    this.isLoggedIn.set(res.loggedIn);
    return res;
  }

  async login(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<{ loggedIn: boolean; user: User }>(`${this.base}/auth/login`, { username, password })
    );
    this.isLoggedIn.set(res.loggedIn);
    this._user$.next(res.user);
  }

  async logout(): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/auth/logout`, {}));
    this._user$.next(null);
    this.isLoggedIn.set(false);
    this.router.navigate(['/login']);
  }
}