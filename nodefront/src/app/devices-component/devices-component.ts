import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  switchMap,
  takeUntil,
  tap
} from 'rxjs';

import { AuthService } from '../auth-service';
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
import { LdapUser, UserService } from '../user-service';

type SortDirection = 'asc' | 'desc';

type SortField =
  | 'assignedToUsername'
  | 'categoryName'
  | 'statusName'
  | 'locationCity'
  | 'networkEnvironmentName'
  | 'latestTestTester'
  | 'latestTestResult'
  | 'latestTestLastTest'
  | 'latestTestNextAt'
  | 'createdAt'
  | 'lastEditAt';

type FilterState = {
  assignedToDisplay: string;
  assignedToUsername: string;
  categoryId: string;
  statusId: string;
  locationId: string;
  networkEnvironmentId: string;
  latestTestTester: string;
  latestTestResult: string;
  latestTestScale: string;
  latestTestNextPeriod: string;
  latestTestLastFrom: string;
  latestTestLastTo: string;
  latestTestNextFrom: string;
  latestTestNextTo: string;
  createdFrom: string;
  createdTo: string;
  updatedFrom: string;
  updatedTo: string;
};

const DEVICE_PAGE_FETCH_SIZE = 200;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SORT_FIELD: SortField = 'lastEditAt';
const DEFAULT_SORT_DIRECTION: SortDirection = 'desc';

@Component({
  selector: 'app-devices-component',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './devices-component.html',
  styleUrls: ['./devices-component.css']
})
export class DevicesComponent implements OnInit, OnDestroy {
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
  ldapResults: LdapUser[] = [];
  ldapLoading = false;
  private readonly displayNameMap = new Map<string, string>();

  private readonly destroy$ = new Subject<void>();
  private readonly assignedSearch$ = new Subject<string>();
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
    private overlayService: OverlayService,
    private userService: UserService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.setupLdapSearch();
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
    this.ldapResults = [];
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
    if (!device.assignedToUsername) return 'Nicht zugewiesen';
    const displayName = this.displayNameMap.get(device.assignedToUsername);
    return displayName ? `${displayName} (${device.assignedToUsername})` : device.assignedToUsername;
  }

  formatDate(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date);
  }

  get activeFilterCount(): number {
    return Object.entries(this.filters)
      .filter(([key, value]) => key !== 'assignedToDisplay' && value.trim().length > 0)
      .length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  get visiblePages(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  get startItem(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }

  get canEditDevices(): boolean {
    return (this.authService.loggedRole() ?? 0) >= 1;
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
          this.enrichAssignedUsers(this.allDevices)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.applyFiltersAndSorting();
                this.loading = false;
              },
              error: () => {
                this.applyFiltersAndSorting();
                this.loading = false;
              }
            });
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
        if (key === 'assignedToDisplay') {
          this.onAssignedFilterChange(value);
          return;
        }

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
        this.ldapResults = [];
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
        key: 'assignedToDisplay',
        label: 'Zugewiesen an',
        type: 'autocomplete',
        value: this.draftFilters.assignedToDisplay,
        placeholder: 'LDAP-Nutzer suchen',
        options: this.ldapResults.map((result) => ({
          value: result.username,
          label: `${result.displayName} (${result.username})`
        }))
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
        key: 'latestTestTester',
        label: 'Letzter Tester',
        type: 'text',
        value: this.draftFilters.latestTestTester,
        placeholder: 'Nach Tester suchen'
      },
      {
        key: 'latestTestResult',
        label: 'Testergebnis',
        type: 'select',
        value: this.draftFilters.latestTestResult,
        options: [
          { value: '', label: 'Alle Ergebnisse' },
          { value: 'pass', label: 'Bestanden' },
          { value: 'fail', label: 'Nicht bestanden' }
        ]
      },
      {
        key: 'latestTestScale',
        label: 'Testintervall Einheit',
        type: 'select',
        value: this.draftFilters.latestTestScale,
        options: [
          { value: '', label: 'Alle Einheiten' },
          { value: 'months', label: 'Monate' },
          { value: 'years', label: 'Jahre' }
        ]
      },
      {
        key: 'latestTestNextPeriod',
        label: 'Testintervall',
        type: 'number',
        value: this.draftFilters.latestTestNextPeriod,
        placeholder: 'z. B. 12'
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
      },
      {
        key: 'latestTestLastFrom',
        label: 'Letzter Test ab',
        type: 'date',
        value: this.draftFilters.latestTestLastFrom
      },
      {
        key: 'latestTestLastTo',
        label: 'Letzter Test bis',
        type: 'date',
        value: this.draftFilters.latestTestLastTo
      },
      {
        key: 'latestTestNextFrom',
        label: 'Nächster Test ab',
        type: 'date',
        value: this.draftFilters.latestTestNextFrom
      },
      {
        key: 'latestTestNextTo',
        label: 'Nächster Test bis',
        type: 'date',
        value: this.draftFilters.latestTestNextTo
      }
    ];
  }

  private getSortOptions(): OverlaySelectOption[] {
    return [
      { value: 'assignedToUsername', label: 'Zugewiesen an' },
      { value: 'categoryName', label: 'Kategorie' },
      { value: 'statusName', label: 'Status' },
      { value: 'locationCity', label: 'Standort' },
      { value: 'networkEnvironmentName', label: 'Netzwerkumgebung' },
      { value: 'latestTestTester', label: 'Letzter Tester' },
      { value: 'latestTestResult', label: 'Testergebnis' },
      { value: 'latestTestLastTest', label: 'Letzter Test' },
      { value: 'latestTestNextAt', label: 'Nächster Test' },
      { value: 'createdAt', label: 'Erstellt am' },
      { value: 'lastEditAt', label: 'Geändert am' }
    ];
  }

  private formatLocation(location: Location): string {
    return [location.city, location.address, location.houseNumber].filter(Boolean).join(', ');
  }

  private createEmptyFilters(): FilterState {
    return {
      assignedToDisplay: '',
      assignedToUsername: '',
      categoryId: '',
      statusId: '',
      locationId: '',
      networkEnvironmentId: '',
      latestTestTester: '',
      latestTestResult: '',
      latestTestScale: '',
      latestTestNextPeriod: '',
      latestTestLastFrom: '',
      latestTestLastTo: '',
      latestTestNextFrom: '',
      latestTestNextTo: '',
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

    if (!this.matchesAssignedUserFilter(device)) return false;

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

    if (
      this.filters.latestTestTester
      && !String(device.latestTestTester || '').toLowerCase().includes(this.filters.latestTestTester.toLowerCase())
    ) {
      return false;
    }

    if (this.filters.latestTestResult && String(device.latestTestResult || '') !== this.filters.latestTestResult) {
      return false;
    }

    if (this.filters.latestTestScale && String(device.latestTestScale || '') !== this.filters.latestTestScale) {
      return false;
    }

    if (this.filters.latestTestNextPeriod && String(device.latestTestNextPeriod || '') !== this.filters.latestTestNextPeriod) {
      return false;
    }

    if (!this.matchesDateRange(device.createdAt, this.filters.createdFrom, this.filters.createdTo)) {
      return false;
    }

    if (!this.matchesDateRange(device.lastEditAt, this.filters.updatedFrom, this.filters.updatedTo)) {
      return false;
    }

    if (!this.matchesDateRange(device.latestTestLastTest, this.filters.latestTestLastFrom, this.filters.latestTestLastTo)) {
      return false;
    }

    if (!this.matchesDateRange(device.latestTestNextAt, this.filters.latestTestNextFrom, this.filters.latestTestNextTo)) {
      return false;
    }

    return true;
  }

  private matchesSearch(device: Device): boolean {
    const search = this.searchTerm.trim().toLowerCase();
    return String(device.inventoryNumber || '').toLowerCase().includes(search)
      || String(device.name || '').toLowerCase().includes(search);
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
      case 'lastEditAt':
      case 'latestTestLastTest':
      case 'latestTestNextAt': {
        const time = new Date(device[field] || '').getTime();
        return Number.isNaN(time) ? 0 : time;
      }
      default:
        return String(device[field] || '');
    }
  }

  private onAssignedFilterChange(value: string): void {
    this.draftFilters = {
      ...this.draftFilters,
      assignedToDisplay: value
    };

    const selected = this.ldapResults.find(
      (result) => `${result.displayName} (${result.username})` === value
    );

    if (selected) {
      this.draftFilters = {
        ...this.draftFilters,
        assignedToDisplay: `${selected.displayName} (${selected.username})`,
        assignedToUsername: selected.username
      };
      this.ldapResults = [];
      this.refreshFilterOverlay();
      return;
    }

    this.draftFilters = {
      ...this.draftFilters,
      assignedToUsername: ''
    };

    this.assignedSearch$.next(value);
  }

  private matchesAssignedUserFilter(device: Device): boolean {
    if (this.filters.assignedToUsername) {
      return (device.assignedToUsername || '').toLowerCase() === this.filters.assignedToUsername.toLowerCase();
    }

    if (!this.filters.assignedToDisplay.trim()) {
      return true;
    }

    const filter = this.filters.assignedToDisplay.trim().toLowerCase();
    const username = String(device.assignedToUsername || '').toLowerCase();
    const displayName = String(this.displayNameMap.get(device.assignedToUsername || '') || '').toLowerCase();
    const combined = displayName ? `${displayName} (${username})` : username;

    return combined.includes(filter) || username.includes(filter) || displayName.includes(filter);
  }

  private enrichAssignedUsers(devices: Device[]) {
    const usernames = devices
      .map((device) => device.assignedToUsername)
      .filter((value): value is string => !!value)
      .filter((value, index, array) => array.indexOf(value) === index);

    if (usernames.length === 0) {
      this.displayNameMap.clear();
      return of(devices);
    }

    return forkJoin(
      usernames.map((username) =>
        this.userService.searchLdap(username).pipe(
          map((results) => ({
            username,
            displayName: results.find((result) => result.username.toLowerCase() === username.toLowerCase())?.displayName?.trim() || ''
          }))
        )
      )
    ).pipe(
      map((entries) => {
        this.displayNameMap.clear();
        entries.forEach((entry) => {
          if (entry.displayName) {
            this.displayNameMap.set(entry.username, entry.displayName);
          }
        });
        return devices;
      })
    );
  }

  private setupLdapSearch(): void {
    this.assignedSearch$
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        tap((query) => {
          this.ldapLoading = query.trim().length >= 2;
          if (query.trim().length < 2) {
            this.ldapResults = [];
            this.refreshFilterOverlay();
          }
        }),
        switchMap((query) => {
          if (query.trim().length < 2) {
            return of([] as LdapUser[]);
          }

          return this.userService.searchLdap(query);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (results) => {
          this.ldapResults = results;
          this.ldapLoading = false;
          this.refreshFilterOverlay();
        },
        error: (error) => {
          console.error('LDAP search failed', error);
          this.ldapLoading = false;
          this.ldapResults = [];
          this.refreshFilterOverlay();
        }
      });
  }
}
