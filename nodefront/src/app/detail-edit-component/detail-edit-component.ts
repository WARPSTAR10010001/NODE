import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, forkJoin, map, of, switchMap, takeUntil, tap, throwError } from 'rxjs';

import { Category, CategoryService } from '../category-service';
import { Device, DeviceService, ElectronicTestPayload } from '../device-service';
import { Location, LocationService } from '../location-service';
import { NetworkEnvironment, NetworkEnvironmentService } from '../network-environment-service';
import { OverlayService } from '../overlay-service';
import { Status, StatusService } from '../status-service';
import { LdapUser, UserRecord, UserService } from '../user-service';

const OPTIONAL_MAC_PATTERN = /^$|^([0-9A-Fa-f]{2}([-:])){5}[0-9A-Fa-f]{2}$/;

@Component({
  selector: 'app-detail-edit-component',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './detail-edit-component.html',
  styleUrl: './detail-edit-component.css',
})
export class DetailEditComponent implements OnInit, OnDestroy {
  device: Device | null = null;
  form!: UntypedFormGroup;
  categories: Category[] = [];
  statuses: Status[] = [];
  locations: Location[] = [];
  networkEnvironments: NetworkEnvironment[] = [];
  ldapResults: LdapUser[] = [];
  ldapLoading = false;
  assignedSearch = '';
  nextTestPreview = '-';
  loading = true;
  saving = false;
  deleting = false;
  errorMessage = '';
  private readonly displayNameMap = new Map<string, string>();

  private readonly destroy$ = new Subject<void>();
  private readonly assignedSearch$ = new Subject<string>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: UntypedFormBuilder,
    private deviceService: DeviceService,
    private categoryService: CategoryService,
    private statusService: StatusService,
    private locationService: LocationService,
    private networkEnvironmentService: NetworkEnvironmentService,
    private userService: UserService,
    private overlay: OverlayService
  ) { }

  ngOnInit(): void {
    this.setupLdapSearch();
    this.loadDevice();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get macAddresses(): UntypedFormArray {
    return this.form.get('macAddresses') as UntypedFormArray;
  }

  controlInvalid(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  macControlInvalid(index: number): boolean {
    const control = this.macAddresses.at(index);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  formatLocation(location: Location): string {
    return [location.city, location.address, location.houseNumber].filter(Boolean).join(', ');
  }

  formatCreatedBy(): string {
    return this.formatUserLabel(this.device?.createdByUsername);
  }

  formatLastEditedBy(): string {
    return this.formatUserLabel(this.device?.lastEditByUsername);
  }

  onAssignedSearchChange(value: string): void {
    this.assignedSearch = value;

    const selected = this.ldapResults.find(
      (result) => `${result.displayName} (${result.username})` === value
    );

    if (selected) {
      this.selectLdapUser(selected);
      return;
    }

    this.form.get('assignedToUserId')?.setValue(null);
    this.assignedSearch$.next(value);
  }

  selectLdapUser(user: LdapUser): void {
    this.ldapLoading = true;
    this.userService.resolveLdapUser(user.username)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ user: resolved }) => {
          this.form.get('assignedToUserId')?.setValue(resolved.id);
          this.assignedSearch = `${user.displayName} (${user.username})`;
          this.ldapResults = [];
          this.ldapLoading = false;
        },
        error: (error) => {
          this.ldapLoading = false;
          this.handleError('Resolve LDAP user failed', error, 'LDAP-Nutzer konnte nicht übernommen werden.');
        }
      });
  }

  clearAssignedUser(): void {
    this.form.get('assignedToUserId')?.setValue(null);
    this.assignedSearch = '';
    this.ldapResults = [];
  }

  addMacAddress(value = ''): void {
    this.macAddresses.push(this.createMacAddressControl(value));
  }

  removeMacAddress(index: number): void {
    this.macAddresses.removeAt(index);
    if (this.macAddresses.length === 0) {
      this.addMacAddress();
    }
  }

  save(): void {
    if (!this.device || this.form.invalid || this.saving) return;

    const electronicTestError = this.validateElectronicTestSection();
    if (electronicTestError) {
      this.overlay.showOverlay('error', electronicTestError);
      return;
    }

    this.saving = true;

    this.deviceService.update(this.device.id, this.buildDevicePayload())
      .pipe(
        switchMap(() => {
          const testPayload = this.buildElectronicTestPayload();
          if (!testPayload) {
            return of(null);
          }

          if (this.device?.latestTestId) {
            return this.deviceService.updateElectronicTest(this.device.latestTestId, testPayload);
          }

          return this.deviceService.createElectronicTest(this.device!.id, testPayload);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          this.saving = false;
          this.overlay.showOverlay('success', 'Gerät wurde gespeichert.', null, {
            actions: [
              { label: 'Schließen', closeOnly: true },
              { label: 'Zur Detailansicht', route: `/devices/${this.device!.inventoryNumber}` }
            ]
          });
        },
        error: (error) => this.handleError('Save device failed', error, 'Gerät konnte nicht gespeichert werden.')
      });
  }

  goBack(): void {
    if (!this.device) {
      this.router.navigate(['/devices']);
      return;
    }

    this.router.navigate(['/devices', this.device.inventoryNumber]);
  }

  goToOverview(): void {
    this.router.navigate(['/devices']);
  }

  deleteDevice(): void {
    if (!this.device || this.deleting) return;

    const confirmed = confirm(
      `Gerät "${this.device.name}" mit der Inventarnummer "${this.device.inventoryNumber}" wirklich löschen?`
    );

    if (!confirmed) return;

    this.deleting = true;

    this.deviceService.delete(this.device.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.deleting = false;
          this.overlay.showOverlay('success', 'Gerät wurde gelöscht.', null, {
            actions: [
              {
                label: 'Zur Geräteübersicht',
                route: '/devices'
              }
            ]
          });
        },
        error: (error) => this.handleError('Delete device failed', error, 'Gerät konnte nicht gelöscht werden.')
      });
  }

  private loadDevice(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap((params) => {
          const inventoryNumber = params.get('inventoryNumber')?.trim();
          if (!inventoryNumber) {
            return throwError(() => new Error('Keine Inventarnummer in der URL gefunden.'));
          }

          this.loading = true;
          this.errorMessage = '';

          return this.deviceService.list({
            q: inventoryNumber,
            page: 1,
            pageSize: 50
          });
        }),
        switchMap((response) => {
          const inventoryNumber = this.route.snapshot.paramMap.get('inventoryNumber')?.trim();
          const matchedDevice = response.items.find((item) => item.inventoryNumber === inventoryNumber);

          if (!matchedDevice) {
            return throwError(() => new Error('Gerät konnte nicht gefunden werden.'));
          }

          return forkJoin({
            device: this.deviceService.get(matchedDevice.id),
            users: this.userService.getUsers(),
            categories: this.categoryService.list(),
            statuses: this.statusService.list(),
            locations: this.locationService.list(),
            networkEnvironments: this.networkEnvironmentService.list()
          });
        })
      )
      .subscribe({
        next: ({ device, users, categories, statuses, locations, networkEnvironments }) => {
          this.device = this.hydrateDeviceUsers(device.device, users);
          this.categories = categories.categories;
          this.statuses = statuses.statuses;
          this.locations = locations.locations;
          this.networkEnvironments = networkEnvironments.networkEnvironments;
          this.enrichDeviceUsers(this.device)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.buildForm(this.device!);
                this.loading = false;
              },
              error: () => {
                this.buildForm(this.device!);
                this.loading = false;
              }
            });
        },
        error: (error) => {
          console.error('Failed to load editable device', error);
          this.errorMessage = error instanceof Error
            ? error.message
            : 'Die Bearbeitungsansicht konnte nicht geladen werden.';
          this.loading = false;
        }
      });
  }

  private buildForm(device: Device): void {
    this.form = this.fb.group({
      name: [device.name || '', Validators.required],
      manufacturer: [device.manufacturer || ''],
      model: [device.model || ''],
      serialNumber: [device.serialNumber || ''],
      categoryId: [device.categoryId ?? null, Validators.required],
      statusId: [device.statusId ?? null, Validators.required],
      purchase: [this.toDateInputValue(device.purchase)],
      price: [device.price ?? null],
      supplier: [device.supplier || ''],
      depreciationTime: [device.depreciationTime ?? null],
      depreciationScale: [device.depreciationScale || ''],
      accountingType: [device.accountingType || 'konsumtiv', Validators.required],
      assignedToUserId: [device.assignedToUserId ?? null],
      locationId: [device.locationId ?? null],
      networkEnvironmentId: [device.networkEnvironmentId ?? null],
      patchPanelLabel: [device.patchPanelLabel || ''],
      ipAddress: [device.ipAddress || ''],
      macAddresses: this.fb.array(
        (device.macAddresses?.length ? device.macAddresses : ['']).map((mac) => this.createMacAddressControl(mac))
      ),
      leaseDurationMonths: [device.leaseDurationMonths ?? null],
      contractType: [device.contractType || ''],
      latestTestTester: [device.latestTestTester || ''],
      latestTestLastTest: [this.toDateInputValue(device.latestTestLastTest)],
      latestTestResult: [device.latestTestResult || ''],
      latestTestNextPeriod: [device.latestTestNextPeriod ?? null],
      latestTestScale: [device.latestTestScale || 'months'],
      notes: [device.notes || '']
    });

    this.assignedSearch = device.assignedToUsername
      ? this.formatUserLabel(device.assignedToUsername)
      : '';

    this.setupNextTestPreview();
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
        },
        error: (error) => {
          this.ldapLoading = false;
          this.handleError('LDAP search failed', error, 'LDAP-Suche konnte nicht geladen werden.');
        }
      });
  }

  private setupNextTestPreview(): void {
    this.updateNextTestPreview();

    this.form.get('latestTestLastTest')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateNextTestPreview());

    this.form.get('latestTestNextPeriod')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateNextTestPreview());

    this.form.get('latestTestScale')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateNextTestPreview());
  }

  private updateNextTestPreview(): void {
    const lastTest = this.form?.get('latestTestLastTest')?.value;
    const nextPeriod = this.normalizeNumber(this.form?.get('latestTestNextPeriod')?.value);
    const scale = this.form?.get('latestTestScale')?.value || 'months';

    if (!lastTest || !nextPeriod) {
      this.nextTestPreview = '-';
      return;
    }

    const baseDate = new Date(lastTest);
    if (Number.isNaN(baseDate.getTime())) {
      this.nextTestPreview = '-';
      return;
    }

    if (scale === 'years') {
      baseDate.setFullYear(baseDate.getFullYear() + nextPeriod);
    } else {
      baseDate.setMonth(baseDate.getMonth() + nextPeriod);
    }

    this.nextTestPreview = Number.isNaN(baseDate.getTime())
      ? '-'
      : baseDate.toLocaleDateString('de-DE');
  }

  private hydrateDeviceUsers(device: Device, users: UserRecord[]): Device {
    const usernameById = new Map<number, string>();
    users.forEach((user) => usernameById.set(user.id, user.username));

    return {
      ...device,
      assignedToUsername: device.assignedToUsername || this.resolveUsername(device.assignedToUserId, usernameById),
      createdByUsername: device.createdByUsername || this.resolveUsername(device.createdBy, usernameById),
      lastEditByUsername: device.lastEditByUsername || this.resolveUsername(device.lastEditBy, usernameById)
    };
  }

  private enrichDeviceUsers(device: Device) {
    const usernames = [
      device.assignedToUsername,
      device.createdByUsername,
      device.lastEditByUsername
    ]
      .filter((value): value is string => !!value)
      .filter((value, index, array) => array.indexOf(value) === index);

    if (usernames.length === 0) {
      this.displayNameMap.clear();
      return of(device);
    }

    return forkJoin(
      usernames.map((username) =>
        this.userService.searchLdap(username).pipe(
          map((results) => ({ username, displayName: this.findExactDisplayName(results, username) }))
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
        return device;
      })
    );
  }

  private findExactDisplayName(results: LdapUser[], username: string): string | null {
    const exactMatch = results.find((result) => result.username.toLowerCase() === username.toLowerCase());
    return exactMatch?.displayName?.trim() || null;
  }

  private resolveUsername(id: number | undefined, usernameById: Map<number, string>): string | undefined {
    if (!id) return undefined;
    return usernameById.get(id);
  }

  private formatUserLabel(username?: string): string {
    if (!username) return '-';
    const displayName = this.displayNameMap.get(username);
    return displayName ? `${displayName} (${username})` : username;
  }

  private buildDevicePayload(): Partial<Device> {
    const raw = this.form.getRawValue();
    const macAddresses = this.macAddresses.controls
      .map((control) => String(control.value ?? '').trim())
      .filter(Boolean);

    return {
      name: this.normalizeText(raw.name) ?? '',
      manufacturer: this.normalizeText(raw.manufacturer),
      model: this.normalizeText(raw.model),
      serialNumber: this.normalizeText(raw.serialNumber),
      categoryId: this.normalizeNumber(raw.categoryId) ?? undefined,
      statusId: this.normalizeNumber(raw.statusId) ?? undefined,
      purchase: raw.purchase || null,
      price: this.normalizeNumber(raw.price) ?? undefined,
      supplier: this.normalizeText(raw.supplier),
      depreciationId: undefined,
      depreciationTime: this.normalizeNumber(raw.depreciationTime) ?? undefined,
      depreciationScale: this.normalizeText(raw.depreciationScale) ?? undefined,
      accountingType: raw.accountingType || 'konsumtiv',
      assignedToUserId: this.normalizeNumber(raw.assignedToUserId) ?? undefined,
      locationId: this.normalizeNumber(raw.locationId) ?? undefined,
      networkEnvironmentId: this.normalizeNumber(raw.networkEnvironmentId) ?? undefined,
      patchPanelLabel: this.normalizeText(raw.patchPanelLabel),
      ipAddress: this.normalizeText(raw.ipAddress) ?? undefined,
      macAddresses: macAddresses.length ? macAddresses : null,
      leaseDurationMonths: this.normalizeNumber(raw.leaseDurationMonths) ?? undefined,
      contractType: this.normalizeText(raw.contractType) ?? undefined,
      notes: this.normalizeText(raw.notes)
    } as Partial<Device>;
  }

  private buildElectronicTestPayload(): ElectronicTestPayload | null {
    const raw = this.form.getRawValue();
    const tester = this.normalizeText(raw.latestTestTester);
    const lastTest = raw.latestTestLastTest || null;
    const lastTestResult = this.normalizeText(raw.latestTestResult);
    const nextTestPeriod = this.normalizeNumber(raw.latestTestNextPeriod);
    const scale = (this.normalizeText(raw.latestTestScale) || 'months') as 'months' | 'years';

    if (!tester && !lastTest && !lastTestResult && !nextTestPeriod) {
      return null;
    }

    return {
      tester: tester ?? '',
      lastTest: lastTest ?? '',
      lastTestResult: (lastTestResult || 'pass') as 'pass' | 'fail',
      nextTestPeriod: nextTestPeriod ?? 0,
      scale
    };
  }

  private validateElectronicTestSection(): string | null {
    const payload = this.buildElectronicTestPayload();
    if (!payload) return null;

    if (!payload.tester || !payload.lastTest || !payload.lastTestResult || !payload.nextTestPeriod) {
      return 'Für die Prüfungssektion bitte letzter Tester, letzter Test, Testergebnis und Testintervall vollständig ausfüllen.';
    }

    return null;
  }

  private createMacAddressControl(value = '') {
    return this.fb.control(value, Validators.pattern(OPTIONAL_MAC_PATTERN));
  }

  private toDateInputValue(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private normalizeText(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : null;
  }

  private normalizeNumber(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private handleError(logMessage: string, error: unknown, fallbackMessage: string): void {
    this.saving = false;
    this.ldapLoading = false;
    this.deleting = false;
    console.error(logMessage, error);
    this.overlay.showOverlay('error', this.extractApiError(error) || fallbackMessage);
  }

  private extractApiError(error: unknown): string | null {
    if (typeof error !== 'object' || error === null || !('error' in error)) return null;
    const candidate = (error as { error?: unknown }).error;
    if (typeof candidate === 'string') return candidate;
    if (typeof candidate === 'object' && candidate !== null && 'error' in candidate) {
      const nested = (candidate as { error?: unknown }).error;
      return typeof nested === 'string' ? nested : null;
    }
    return null;
  }
}
