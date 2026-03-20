import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, of, switchMap, takeUntil } from 'rxjs';

import { Category, CategoryService } from '../category-service';
import { Device, DeviceListResponse, DeviceService } from '../device-service';
import { Location, LocationService } from '../location-service';
import { NetworkEnvironment, NetworkEnvironmentService } from '../network-environment-service';
import {
  OverlayFilterField,
  OverlayFilterPayload,
  OverlaySelectOption,
  OverlayService
} from '../overlay-service';
import { Status, StatusService } from '../status-service';

type SortDirection = 'asc' | 'desc';

type SortField =
  | 'inventoryNumber'
  | 'name'
  | 'assignedToUsername'
  | 'categoryName'
  | 'statusName'
  | 'locationCity'
  | 'networkEnvironmentName'
  | 'createdAt'
  | 'lastEditAt';

type FilterState = {
  inventoryNumber: string;
  name: string;
  assignedToUsername: string;
  categoryId: string;
  statusId: string;
  locationId: string;
  networkEnvironmentId: string;
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
};

const DEVICE_PAGE_FETCH_SIZE = 200;
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_SORT_FIELD: SortField = 'inventoryNumber';
const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';

@Component({
  selector: 'app-devices-component',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './devices-component.html',
  styleUrls: ['./devices-component.css']
})
export class DevicesComponent implements OnInit, OnDestroy {
  protected readonly pageSizeOptions = [10, 25, 50];

  devices: Device[] = [];
  allDevices: Device[] = [];
  filteredDevices: Device[] = [];
  categories: Category[] = [];
  statuses: Status[] = [];
  locations: Location[] = [];
  networkEnvironments: NetworkEnvironment[] = [];
  total = 0;
  page = 1;
  pageSize = DEFAULT_PAGE_SIZE;
  loading = false;
  searchTerm = '';

  private readonly destroy$ = new Subject<void>();
  private readonly dateFormatter = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  private filters: FilterState = this.createEmptyFilters();
  private draftFilters: FilterState = this.createEmptyFilters();
  private sortField: SortField = DEFAULT_SORT_FIELD;
  private draftSortField: SortField = DEFAULT_SORT_FIELD;
  private sortDirection: SortDirection = DEFAULT_SORT_DIRECTION;
  private draftSortDirection: SortDirection = DEFAULT_SORT_DIRECTION;

  constructor(
    private deviceService: DeviceService,
    private categoryService: CategoryService,
    private statusService: StatusService,
    private locationService: LocationService,
    private networkEnvironmentService: NetworkEnvironmentService,
    private overlayService: OverlayService
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openFilterOverlay(): void {
    this.draftFilters = { ...this.filters };
    this.draftSortField = this.sortField;
    this.draftSortDirection = this.sortDirection;

    this.overlayService.showOverlay('filter', undefined, this.buildFilterOverlayPayload());
  }

  resetAllFilters(): void {
    this.filters = this.createEmptyFilters();
    this.draftFilters = this.createEmptyFilters();
    this.sortField = DEFAULT_SORT_FIELD;
    this.draftSortField = DEFAULT_SORT_FIELD;
    this.sortDirection = DEFAULT_SORT_DIRECTION;
    this.draftSortDirection = DEFAULT_SORT_DIRECTION;
    this.page = 1;
    this.applyFiltersAndSorting();
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.page = page;
    this.sliceCurrentPage();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.sliceCurrentPage();
  }

  onSearchChange(): void {
    this.page = 1;
    this.applyFiltersAndSorting();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.onSearchChange();
  }

  routeSegment(device: Device): string {
    return device.inventoryNumber;
  }

  formatAssignedUser(device: Device): string {
    return device.assignedToUsername || 'Nicht zugewiesen';
  }

  formatDate(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date);
  }

  get activeFilterCount(): number {
    return Object.values(this.filters).filter((value) => value.trim().length > 0).length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get visiblePages(): number[] {
    const start = Math.max(1, this.page - 2);
    const end = Math.min(this.totalPages, start + 4);
    const adjustedStart = Math.max(1, end - 4);
    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  }

  get startItem(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }

  private loadData(): void {
    this.loading = true;

    forkJoin({
      firstPage: this.deviceService.list({ page: 1, pageSize: DEVICE_PAGE_FETCH_SIZE }),
      categories: this.categoryService.list(),
      statuses: this.statusService.list(),
      locations: this.locationService.list(),
      networkEnvironments: this.networkEnvironmentService.list()
    })
      .pipe(
        switchMap(({ firstPage, categories, statuses, locations, networkEnvironments }) => {
          this.categories = categories.categories;
          this.statuses = statuses.statuses;
          this.locations = locations.locations;
          this.networkEnvironments = networkEnvironments.networkEnvironments;

          const totalPages = Math.ceil(firstPage.total / DEVICE_PAGE_FETCH_SIZE);
          if (totalPages <= 1) {
            return of([firstPage]);
          }

          const additionalRequests = Array.from({ length: totalPages - 1 }, (_, index) =>
            this.deviceService.list({
              page: index + 2,
              pageSize: DEVICE_PAGE_FETCH_SIZE
            })
          );

          return forkJoin([of(firstPage), ...additionalRequests]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (responses: DeviceListResponse[]) => {
          this.allDevices = responses.flatMap((response) => response.items);
          this.applyFiltersAndSorting();
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load devices:', error);
          this.loading = false;
        }
      });
  }

  private buildFilterOverlayPayload(): OverlayFilterPayload {
    return {
      title: 'Filter & Sortierung',
      sortField: this.draftSortField,
      sortDirection: this.draftSortDirection,
      sortOptions: this.getSortOptions(),
      fields: this.getFilterFields(),
      onFieldChange: (key, value) => {
        this.draftFilters = {
          ...this.draftFilters,
          [key]: value
        };
        this.refreshFilterOverlay();
      },
      onSortFieldChange: (value) => {
        this.draftSortField = value as SortField;
        this.refreshFilterOverlay();
      },
      onSortDirectionChange: (value) => {
        this.draftSortDirection = value;
        this.refreshFilterOverlay();
      },
      onReset: () => {
        this.draftFilters = this.createEmptyFilters();
        this.draftSortField = DEFAULT_SORT_FIELD;
        this.draftSortDirection = DEFAULT_SORT_DIRECTION;
        this.refreshFilterOverlay();
      },
      onApply: () => {
        this.filters = { ...this.draftFilters };
        this.sortField = this.draftSortField;
        this.sortDirection = this.draftSortDirection;
        this.page = 1;
        this.applyFiltersAndSorting();
      }
    };
  }

  private refreshFilterOverlay(): void {
    if (this.overlayService.current.type !== 'filter' || !this.overlayService.current.show) {
      return;
    }

    this.overlayService.showOverlay('filter', undefined, this.buildFilterOverlayPayload());
  }

  private getFilterFields(): OverlayFilterField[] {
    return [
      {
        key: 'inventoryNumber',
        label: 'Node-Bezeichnung',
        type: 'text',
        value: this.draftFilters.inventoryNumber,
        placeholder: 'z. B. NODE-12345678'
      },
      {
        key: 'name',
        label: 'Name',
        type: 'text',
        value: this.draftFilters.name,
        placeholder: 'Gerätename'
      },
      {
        key: 'assignedToUsername',
        label: 'Zugewiesen an',
        type: 'select',
        value: this.draftFilters.assignedToUsername,
        options: this.buildAssignedUserOptions()
      },
      {
        key: 'categoryId',
        label: 'Kategorie',
        type: 'select',
        value: this.draftFilters.categoryId,
        options: [
          { value: '', label: 'Alle Kategorien' },
          ...this.categories.map((category) => ({
            value: String(category.id),
            label: category.name
          }))
        ]
      },
      {
        key: 'statusId',
        label: 'Status',
        type: 'select',
        value: this.draftFilters.statusId,
        options: [
          { value: '', label: 'Alle Status' },
          ...this.statuses.map((status) => ({
            value: String(status.id),
            label: status.name
          }))
        ]
      },
      {
        key: 'locationId',
        label: 'Standort',
        type: 'select',
        value: this.draftFilters.locationId,
        options: [
          { value: '', label: 'Alle Standorte' },
          ...this.locations.map((location) => ({
            value: String(location.id),
            label: this.formatLocation(location)
          }))
        ]
      },
      {
        key: 'networkEnvironmentId',
        label: 'Netzwerkumgebung',
        type: 'select',
        value: this.draftFilters.networkEnvironmentId,
        options: [
          { value: '', label: 'Alle Netzwerkumgebungen' },
          ...this.networkEnvironments.map((networkEnvironment) => ({
            value: String(networkEnvironment.id),
            label: networkEnvironment.name
          }))
        ]
      },
      {
        key: 'createdFrom',
        label: 'Erstellt ab',
        type: 'date',
        value: this.draftFilters.createdFrom
      },
      {
        key: 'createdTo',
        label: 'Erstellt bis',
        type: 'date',
        value: this.draftFilters.createdTo
      },
      {
        key: 'updatedFrom',
        label: 'Geändert ab',
        type: 'date',
        value: this.draftFilters.updatedFrom
      },
      {
        key: 'updatedTo',
        label: 'Geändert bis',
        type: 'date',
        value: this.draftFilters.updatedTo
      }
    ];
  }

  private getSortOptions(): OverlaySelectOption[] {
    return [
      { value: 'inventoryNumber', label: 'Node-Bezeichnung' },
      { value: 'name', label: 'Name' },
      { value: 'assignedToUsername', label: 'Zugewiesen an' },
      { value: 'categoryName', label: 'Kategorie' },
      { value: 'statusName', label: 'Status' },
      { value: 'locationCity', label: 'Standort' },
      { value: 'networkEnvironmentName', label: 'Netzwerkumgebung' },
      { value: 'createdAt', label: 'Erstellt am' },
      { value: 'lastEditAt', label: 'Geändert am' }
    ];
  }

  private buildAssignedUserOptions(): OverlaySelectOption[] {
    const labels = Array.from(new Set(
      this.allDevices
        .map((device) => device.assignedToUsername || '')
        .filter((value) => value.trim().length > 0)
    )).sort((a, b) => a.localeCompare(b, 'de-DE', { sensitivity: 'base' }));

    return [
      { value: '', label: 'Alle Nutzer' },
      ...labels.map((label) => ({ value: label, label }))
    ];
  }

  private formatLocation(location: Location): string {
    return [location.city, location.address, location.houseNumber].filter(Boolean).join(', ');
  }

  private createEmptyFilters(): FilterState {
    return {
      inventoryNumber: '',
      name: '',
      assignedToUsername: '',
      categoryId: '',
      statusId: '',
      locationId: '',
      networkEnvironmentId: '',
      createdFrom: '',
      createdTo: '',
      updatedFrom: '',
      updatedTo: ''
    };
  }

  private applyFiltersAndSorting(): void {
    const filtered = this.allDevices
      .filter((device) => this.matchesFilters(device))
      .sort((first, second) => this.compareDevices(first, second));

    this.filteredDevices = filtered;
    this.total = filtered.length;

    if (this.page > this.totalPages) {
      this.page = this.totalPages;
    }

    this.sliceCurrentPage();
  }

  private sliceCurrentPage(): void {
    const start = (this.page - 1) * this.pageSize;
    this.devices = this.filteredDevices.slice(start, start + this.pageSize);
  }

  private matchesFilters(device: Device): boolean {
    if (this.searchTerm.trim().length > 0 && !this.matchesSearch(device)) {
      return false;
    }

    if (this.filters.inventoryNumber && !this.matchesText(device.inventoryNumber, this.filters.inventoryNumber)) {
      return false;
    }

    if (this.filters.name && !this.matchesText(device.name, this.filters.name)) {
      return false;
    }

    if (this.filters.assignedToUsername && (device.assignedToUsername || '') !== this.filters.assignedToUsername) {
      return false;
    }

    if (this.filters.categoryId && String(device.categoryId || '') !== this.filters.categoryId) {
      return false;
    }

    if (this.filters.statusId && String(device.statusId || '') !== this.filters.statusId) {
      return false;
    }

    if (this.filters.locationId && String(device.locationId || '') !== this.filters.locationId) {
      return false;
    }

    if (this.filters.networkEnvironmentId && String(device.networkEnvironmentId || '') !== this.filters.networkEnvironmentId) {
      return false;
    }

    if (!this.matchesDateRange(device.createdAt, this.filters.createdFrom, this.filters.createdTo)) {
      return false;
    }

    if (!this.matchesDateRange(device.lastEditAt, this.filters.updatedFrom, this.filters.updatedTo)) {
      return false;
    }

    return true;
  }

  private matchesSearch(device: Device): boolean {
    const search = this.searchTerm.trim().toLowerCase();
    return String(device.inventoryNumber || '').toLowerCase().includes(search)
      || String(device.name || '').toLowerCase().includes(search);
  }

  private matchesText(value: string | undefined, filter: string): boolean {
    return String(value || '').toLowerCase().includes(filter.toLowerCase());
  }

  private matchesDateRange(value: string | undefined, from: string, to: string): boolean {
    if (!value) {
      return !from && !to;
    }

    const current = new Date(value).getTime();
    if (Number.isNaN(current)) {
      return false;
    }

    if (from) {
      const fromTime = new Date(from).getTime();
      if (!Number.isNaN(fromTime) && current < fromTime) {
        return false;
      }
    }

    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      const toTime = toDate.getTime();
      if (!Number.isNaN(toTime) && current > toTime) {
        return false;
      }
    }

    return true;
  }

  private compareDevices(first: Device, second: Device): number {
    const firstValue = this.sortValue(first, this.sortField);
    const secondValue = this.sortValue(second, this.sortField);

    const result = typeof firstValue === 'number' && typeof secondValue === 'number'
      ? firstValue - secondValue
      : String(firstValue).localeCompare(String(secondValue), 'de-DE', {
        numeric: true,
        sensitivity: 'base'
      });

    return this.sortDirection === 'asc' ? result : -result;
  }

  private sortValue(device: Device, field: SortField): string | number {
    switch (field) {
      case 'createdAt':
      case 'lastEditAt': {
        const time = new Date(device[field]).getTime();
        return Number.isNaN(time) ? 0 : time;
      }
      default:
        return String(device[field] || '');
    }
  }
}
