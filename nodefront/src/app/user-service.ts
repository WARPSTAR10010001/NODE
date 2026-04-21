import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environments/environment';
import { map } from 'rxjs/operators';

export interface LdapUser {
  username: string;
  displayName: string;
  email?: string;
}

export interface UserRecord {
  id: number;
  username: string;
  displayName?: string;
  role: number;
  isActivated: boolean;
  previouslyLoggedIn: boolean;
  createdAt: string;
  lastLogin?: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiUrl = `${environment.apiBaseUrl}/users`;

  constructor(private http: HttpClient) { }

  getUsers(): Observable<UserRecord[]> {
    return this.http.get<UserRecord[]>(this.apiUrl);
  }

  searchLdap(query: string): Observable<LdapUser[]> {
    return this.http.get<LdapUser[]>(`${environment.apiBaseUrl}/ldap/search`, {
      params: { q: query }
    });
  }

  resolveLdapUser(username: string): Observable<{ user: UserRecord }> {
    return this.http.post<{ user: UserRecord }>(`${this.apiUrl}/resolve-ldap`, { username });
  }

  updateRole(id: number, role: 0 | 1 | 2): Observable<{ user: UserRecord }> {
    return this.http.patch<{ user: UserRecord }>(`${this.apiUrl}/${id}/role`, { role });
  }

  setActivation(id: number, activated: boolean): Observable<{ user: UserRecord }> {
    return this.http.patch<{ user: UserRecord }>(`${this.apiUrl}/${id}/activate`, { activated });
  }
}