import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environments/environment';

export interface Device {
  id: number;
  inventoryNumber: string;
  name: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  categoryId: number;
  statusId: number;
  purchase?: string;
  price?: number;
  supplier?: string;
  depreciationId?: number;
  accountingType: 'konsumtiv' | 'investiv';
  assignedToUserId?: number;
  locationId?: number;
  networkEnvironmentId?: number;
  patchPanelLabel?: string;
  ipAddress?: string;
  macAddresses?: string[];
  leaseDurationMonths?: number;
  contractType?: 'purchase' | 'pay-per-page' | 'lease';
  notes?: string;
  createdBy?: number;
  createdAt: string;
  lastEditBy?: number;
  lastEditAt: string;
  categoryName?: string;
  statusName?: string;
  locationCity?: string;
  locationAddress?: string;
  locationHouseNumber?: string;
  locationRoom?: string;
  networkEnvironmentName?: string;
  assignedToUsername?: string;
  depreciationTime?: number;
  depreciationScale?: string;
  depreciationEnd?: string;
  latestTestId?: number;
  latestTestTester?: string;
  latestTestLastTest?: string;
  latestTestResult?: string;
  latestTestNextPeriod?: number;
  latestTestScale?: string;
  latestTestNextAt?: string;
}

export interface DeviceListResponse {
  page: number;
  pageSize: number;
  total: number;
  items: Device[];
}

@Injectable({
  providedIn: 'root'
})

export class DeviceService {
  private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) { }

  list(opts: {
    q?: string;
    statusId?: number;
    categoryId?: number;
    locationId?: number;
    assignedToUserId?: number;
    page?: number;
    pageSize?: number;
    sort?: 'lastEditAt' | 'createdAt' | 'inventoryNumber' | 'name';
    order?: 'asc' | 'desc';
  } = {}): Observable<DeviceListResponse> {
    let params = new HttpParams();
    Object.entries(opts).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.http.get<DeviceListResponse>(`${this.base}/devices`, { params });
  }

  get(id: number): Observable<{ device: Device }> {
    return this.http.get<{ device: Device }>(`${this.base}/devices/${id}`);
  }

  create(device: Omit<Device, 'id' | 'createdAt' | 'lastEditAt'>): Observable<{ device: Device }> {
    return this.http.post<{ device: Device }>(`${this.base}/devices`, device);
  }

  update(id: number, changes: Partial<Device>): Observable<{ device: Device }> {
    return this.http.patch<{ device: Device }>(`${this.base}/devices/${id}`, changes);
  }

  delete(id: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/devices/${id}`);
  }
}