import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DeviceService, DeviceListResponse, Device } from '../device-service';
import { Subject, takeUntil } from 'rxjs';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-devices-component',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './devices-component.html',
  styleUrls: ['./devices-component.css']
})

export class DevicesComponent implements OnInit, OnDestroy {
  devices: Device[] = [];
  total = 0;
  page = 1;
  pageSize = 25;
  loading = false;
  search = '';
  sort: 'lastEditAt' | 'createdAt' | 'inventoryNumber' | 'name' = 'lastEditAt';
  order: 'asc' | 'desc' = 'desc';

  private destroy$ = new Subject<void>();

  constructor(private device: DeviceService) { }

  ngOnInit(): void {
    this.loadDevices();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDevices(): void {
    this.loading = true;
    const opts = {
      page: this.page,
      pageSize: this.pageSize,
      q: this.search || undefined,
      sort: this.sort,
      order: this.order
    };

    this.device.list(opts)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: DeviceListResponse) => {
          this.devices = res.items;
          this.total = res.total;
          this.loading = false;
        },
        error: (err) => {
          console.error('Failed to load devices:', err);
          this.loading = false;
        }
      });
  }

  onSearch(): void {
    this.page = 1;
    this.loadDevices();
  }

  clearSearch(): void {
    this.search = '';
  }

  onPageChange(page: number): void {
    this.page = page;
    this.loadDevices();
  }

  onSort(column: 'lastEditAt' | 'createdAt' | 'inventoryNumber' | 'name'): void {
    if (this.sort === column) {
      this.order = this.order === 'asc' ? 'desc' : 'asc';
    } else {
      this.sort = column;
      this.order = 'desc';
    }
    this.loadDevices();
  }

  sortIcon(column: string): string {
    if (this.sort !== column) return '';
    return this.order === 'asc' ? '↑' : '↓';
  }

  get pages(): number[] {
    const totalPages = Math.ceil(this.total / this.pageSize);
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  get totalPages(): number {
    return Math.ceil(this.total / this.pageSize);
  }

  get startItem(): number {
    return (this.page - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }
}