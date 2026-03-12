import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environments/environment';

export interface Category {
  id: number;
  name: string;
  description: string;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  list(): Observable<{ categories: Category[] }> {
    return this.http.get<{ categories: Category[] }>(`${this.base}/categories`);
  }

  create(category: { name: string; description?: string }): Observable<{ category: Category }> {
    return this.http.post<{ category: Category }>(`${this.base}/categories`, category);
  }

  update(id: number, changes: Partial<Category>): Observable<{ category: Category }> {
    return this.http.patch<{ category: Category }>(`${this.base}/categories/${id}`, changes);
  }

  delete(id: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/categories/${id}`);
  }
}