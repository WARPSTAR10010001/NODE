import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environments/environment';

export interface NetworkEnvironment {
  id: number;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class NetworkEnvironmentService {
  private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  list(): Observable<{ networkEnvironments: NetworkEnvironment[] }> {
    return this.http.get<{ networkEnvironments: NetworkEnvironment[] }>(`${this.base}/network-environments`);
  }

  create(env: { name: string }): Observable<{ networkEnvironment: NetworkEnvironment }> {
    return this.http.post<{ networkEnvironment: NetworkEnvironment }>(`${this.base}/network-environments`, env);
  }

  update(id: number, changes: Partial<NetworkEnvironment>): Observable<{ networkEnvironment: NetworkEnvironment }> {
    return this.http.patch<{ networkEnvironment: NetworkEnvironment }>(`${this.base}/network-environments/${id}`, changes);
  }

  delete(id: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/network-environments/${id}`);
  }
}