import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environments/environment';

export interface Depreciation {
  id: number;
  time: number;
  scale: 'months' | 'years';
}

@Injectable({ providedIn: 'root' })
export class DepreciationService {
  private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  list(): Observable<{ depreciations: Depreciation[] }> {
    return this.http.get<{ depreciations: Depreciation[] }>(`${this.base}/depreciations`);
  }
}
