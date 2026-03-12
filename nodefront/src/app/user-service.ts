import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environments/environment';

export interface User { id: number; adGuid: string; username: string; role: number; isActivated: boolean; }

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly base = environment.apiBaseUrl;
  constructor(private http: HttpClient) { }

  list(q?: string): Observable<{ users: User[] }> {
    return this.http.get<{ users: User[] }>(`${this.base}/users`, { params: q ? { q } : {} });
  }
}