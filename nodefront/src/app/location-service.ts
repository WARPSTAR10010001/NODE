import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environments/environment';

export interface Location {
  id: number;
  city: string;
  address: string;
  houseNumber?: string;
  room?: string;
}

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  list(): Observable<{ locations: Location[] }> {
    return this.http.get<{ locations: Location[] }>(`${this.base}/locations`);
  }

  create(location: { city: string; address: string; houseNumber?: string | null; room?: string | null }): Observable<{ location: Location }> {
    return this.http.post<{ location: Location }>(`${this.base}/locations`, location);
  }

  update(id: number, changes: Partial<Location>): Observable<{ location: Location }> {
    return this.http.patch<{ location: Location }>(`${this.base}/locations/${id}`, changes);
  }

  delete(id: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/locations/${id}`);
  }
}
