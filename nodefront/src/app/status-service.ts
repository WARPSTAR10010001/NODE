import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environments/environment';

export interface Status {
  id: number;
  name: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class StatusService {
  private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  list(): Observable<{ statuses: Status[] }> {
    return this.http.get<{ statuses: Status[] }>(`${this.base}/statuses`);
  }

  create(status: { name: string; description?: string }): Observable<{ status: Status }> {
    return this.http.post<{ status: Status }>(`${this.base}/statuses`, status);
  }

  update(id: number, changes: Partial<Status>): Observable<{ status: Status }> {
    return this.http.patch<{ status: Status }>(`${this.base}/statuses/${id}`, changes);
  }

  delete(id: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/statuses/${id}`);
  }
}