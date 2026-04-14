import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormGroup,
  Validators
} from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, switchMap, takeUntil, tap, of } from 'rxjs';

import { DeviceService } from '../device-service';
import { Category, CategoryService } from '../category-service';
import { Status, StatusService } from '../status-service';
import { Location, LocationService } from '../location-service';
import { NetworkEnvironment, NetworkEnvironmentService } from '../network-environment-service';
import { LdapUser, UserService } from '../user-service';
import { OverlayService } from '../overlay-service';

type EntityType =
  | 'device'
  | 'category'
  | 'status'
  | 'location'
  | 'network-environment';

type EntityOption = {
  id: EntityType;
  label: string;
};

const OPTIONAL_MAC_PATTERN = /^$|^([0-9A-Fa-f]{2}([-:])){5}[0-9A-Fa-f]{2}$/;

@Component({
  selector: 'app-create-component',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './create-component.html',
  styleUrls: ['./create-component.css']
})
export class CreateComponent implements OnInit, OnDestroy {
  protected readonly entityOptions: EntityOption[] = [
    { id: 'device', label: 'Gerät' },
    { id: 'category', label: 'Kategorie' },
    { id: 'status', label: 'Status' },
    { id: 'location', label: 'Standort' },
    { id: 'network-environment', label: 'Netzwerkumgebung' }
  ];

  categories: Category[] = [];
  statuses: Status[] = [];
  locations: Location[] = [];
  networkEnvironments: NetworkEnvironment[] = [];
  entityType: EntityType = 'device';
  form!: UntypedFormGroup;
  submitting = false;
  ldapResults: LdapUser[] = [];
  ldapLoading = false;
  assignedSearch = '';
  nextTestPreview = '-';

  private assignedSearch$ = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private fb: UntypedFormBuilder,
    private deviceService: DeviceService,
    private categoryService: CategoryService,
    private statusService: StatusService,
    private locationService: LocationService,
    private networkEnvService: NetworkEnvironmentService,
    private userService: UserService,
    private overlay: OverlayService
  ) { }

  ngOnInit(): void {
    this.loadLookups();
    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        const type = params.get('type');
        if (this.isEntityType(type) && type !== this.entityType) {
          this.entityType = type;
          this.buildForm();
          return;
        }

        if (!this.form) {
          this.buildForm();
        }
      });
    this.setupLdapSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get macAddresses(): UntypedFormArray {
    return this.form.get('macAddresses') as UntypedFormArray;
  }

  onTypeChange(type: EntityType): void {
    this.entityType = type;
    this.buildForm();
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

  formatLocation(location: Location): string {
    return [location.city, location.address, location.houseNumber].filter(Boolean).join(', ');
  }

  controlInvalid(name: string): boolean {
    const control = this.form.get(name);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  macControlInvalid(index: number): boolean {
    const control = this.macAddresses.at(index);
    return !!control && control.invalid && (control.dirty || control.touched);
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

  deleteForm() {
    if (confirm("Formular wirklich leeren?")) {
      this.clearForm();
    }
  }

  clearForm(showOverlay = true): void {
    this.buildForm();
    this.assignedSearch = '';
    this.ldapResults = [];
    this.nextTestPreview = '-';
    if (showOverlay) {
      this.overlay.showOverlay('info', 'Formular wurde geleert.');
    }
  }

  onSubmit(): void {
    if (this.submitting) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const missingFields = this.getMissingRequiredFields();
      const message = missingFields.length > 0
        ? `Bitte fülle folgende Pflichtfelder aus: ${missingFields.join(', ')}.`
        : 'Bitte fülle alle Pflichtfelder aus.';
      this.overlay.showOverlay('error', message);
      return;
    }

    this.submitting = true;

    switch (this.entityType) {
      case 'device':
        this.deviceService.create(this.buildDevicePayload()).subscribe({
          next: ({ device }) => this.handleSuccess(`Gerät "${device.name}" wurde erstellt.`),
          error: (error) => this.handleError('Create device failed', error, 'Gerät konnte nicht erstellt werden.')
        });
        break;
      case 'category':
        this.categoryService.create(this.buildNameDescriptionPayload()).subscribe({
          next: ({ category }) => this.handleSuccess(`Kategorie "${category.name}" wurde erstellt.`, 'category'),
          error: (error) => this.handleError('Create category failed', error, 'Kategorie konnte nicht erstellt werden.')
        });
        break;
      case 'status':
        this.statusService.create(this.buildNameDescriptionPayload()).subscribe({
          next: ({ status }) => this.handleSuccess(`Status "${status.name}" wurde erstellt.`, 'status'),
          error: (error) => this.handleError('Create status failed', error, 'Status konnte nicht erstellt werden.')
        });
        break;
      case 'location':
        this.locationService.create(this.buildLocationPayload()).subscribe({
          next: ({ location }) => this.handleSuccess(`Standort "${this.formatLocation(location)}" wurde erstellt.`, 'location'),
          error: (error) => this.handleError('Create location failed', error, 'Standort konnte nicht erstellt werden.')
        });
        break;
      case 'network-environment':
        this.networkEnvService.create(this.buildNameOnlyPayload()).subscribe({
          next: ({ networkEnvironment }) => this.handleSuccess(`Netzwerkumgebung "${networkEnvironment.name}" wurde erstellt.`, 'network-environment'),
          error: (error) => this.handleError('Create network environment failed', error, 'Netzwerkumgebung konnte nicht erstellt werden.')
        });
        break;
    }
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

  private loadLookups(): void {
    this.categoryService.list().subscribe({
      next: (res) => (this.categories = res.categories),
      error: (err) => this.handleError('Load categories failed', err, 'Kategorien konnten nicht geladen werden.')
    });
    this.statusService.list().subscribe({
      next: (res) => (this.statuses = res.statuses),
      error: (err) => this.handleError('Load statuses failed', err, 'Status konnten nicht geladen werden.')
    });
    this.locationService.list().subscribe({
      next: (res) => (this.locations = res.locations),
      error: (err) => this.handleError('Load locations failed', err, 'Standorte konnten nicht geladen werden.')
    });
    this.networkEnvService.list().subscribe({
      next: (res) => (this.networkEnvironments = res.networkEnvironments),
      error: (err) => this.handleError('Load network environments failed', err, 'Netzwerkumgebungen konnten nicht geladen werden.')
    });
  }

  private buildForm(): void {
    switch (this.entityType) {
      case 'device':
        this.form = this.fb.group({
          name: ['', Validators.required],
          manufacturer: [''],
          model: [''],
          serialNumber: [''],
          categoryId: [null, Validators.required],
          statusId: [null, Validators.required],
          purchase: [''],
          price: [null],
          supplier: [''],
          depreciationTime: [null],
          depreciationScale: [''],
          accountingType: ['konsumtiv', Validators.required],
          assignedToUserId: [null],
          locationId: [null],
          networkEnvironmentId: [null],
          patchPanelLabel: [''],
          ipAddress: [''],
          macAddresses: this.fb.array([this.createMacAddressControl()]),
          leaseDurationMonths: [null],
          contractType: [''],
          latestTestTester: [''],
          latestTestLastTest: [''],
          latestTestResult: [''],
          latestTestNextPeriod: [null],
          latestTestScale: ['months'],
          notes: ['']
        });
        this.setupNextTestPreview();
        break;
      case 'category':
      case 'status':
        this.form = this.fb.group({
          name: ['', Validators.required],
          description: ['']
        });
        break;
      case 'location':
        this.form = this.fb.group({
          city: ['', Validators.required],
          address: ['', Validators.required],
          houseNumber: [''],
          room: ['']
        });
        break;
      case 'network-environment':
        this.form = this.fb.group({
          name: ['', Validators.required]
        });
        break;
    }

    if (this.entityType !== 'device') {
      this.nextTestPreview = '-';
    }
  }

  private createMacAddressControl(value = '') {
    return this.fb.control(value, Validators.pattern(OPTIONAL_MAC_PATTERN));
  }

  private buildDevicePayload() {
    const raw = this.form.getRawValue();
    const macAddresses = this.macAddresses.controls
      .map((control) => String(control.value ?? '').trim())
      .filter(Boolean);

    return {
      name: this.normalizeText(raw.name) ?? '',
      manufacturer: this.normalizeText(raw.manufacturer),
      model: this.normalizeText(raw.model),
      serialNumber: this.normalizeText(raw.serialNumber),
      categoryId: this.normalizeNumber(raw.categoryId),
      statusId: this.normalizeNumber(raw.statusId),
      purchase: raw.purchase || null,
      price: this.normalizeNumber(raw.price),
      supplier: this.normalizeText(raw.supplier),
      depreciationTime: this.normalizeNumber(raw.depreciationTime),
      depreciationScale: this.normalizeText(raw.depreciationScale),
      accountingType: raw.accountingType || 'konsumtiv',
      assignedToUserId: this.normalizeNumber(raw.assignedToUserId),
      locationId: this.normalizeNumber(raw.locationId),
      networkEnvironmentId: this.normalizeNumber(raw.networkEnvironmentId),
      patchPanelLabel: this.normalizeText(raw.patchPanelLabel),
      ipAddress: this.normalizeText(raw.ipAddress),
      macAddresses: macAddresses.length ? macAddresses : null,
      leaseDurationMonths: this.normalizeNumber(raw.leaseDurationMonths),
      contractType: this.normalizeText(raw.contractType),
      latestTestTester: this.normalizeText(raw.latestTestTester),
      latestTestLastTest: raw.latestTestLastTest || null,
      latestTestResult: this.normalizeText(raw.latestTestResult),
      latestTestNextPeriod: this.normalizeNumber(raw.latestTestNextPeriod),
      latestTestScale: this.normalizeText(raw.latestTestScale),
      notes: this.normalizeText(raw.notes)
    };
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
    if (this.entityType !== 'device') {
      this.nextTestPreview = '-';
      return;
    }

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

  private buildNameDescriptionPayload() {
    const raw = this.form.getRawValue();
    return {
      name: this.normalizeText(raw.name) ?? '',
      description: this.normalizeText(raw.description) ?? ''
    };
  }

  private buildLocationPayload() {
    const raw = this.form.getRawValue();
    return {
      city: this.normalizeText(raw.city) ?? '',
      address: this.normalizeText(raw.address) ?? '',
      houseNumber: this.normalizeText(raw.houseNumber),
      room: this.normalizeText(raw.room)
    };
  }

  private buildNameOnlyPayload() {
    const raw = this.form.getRawValue();
    return {
      name: this.normalizeText(raw.name) ?? ''
    };
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

  private isEntityType(value: string | null): value is EntityType {
    return value === 'device'
      || value === 'category'
      || value === 'status'
      || value === 'location'
      || value === 'network-environment';
  }

  private getMissingRequiredFields(): string[] {
    const requiredFieldLabels = this.getRequiredFieldLabels();

    return Object.entries(requiredFieldLabels)
      .filter(([controlName]) => this.form.get(controlName)?.invalid)
      .map(([, label]) => label);
  }

  private getRequiredFieldLabels(): Record<string, string> {
    switch (this.entityType) {
      case 'device':
        return {
          name: 'Name',
          categoryId: 'Kategorie',
          statusId: 'Status'
        };
      case 'category':
      case 'status':
      case 'network-environment':
        return {
          name: 'Name'
        };
      case 'location':
        return {
          city: 'Stadt',
          address: 'Adresse'
        };
      default:
        return {};
    }
  }

  private handleSuccess(message: string, manageType?: 'category' | 'status' | 'location' | 'network-environment'): void {
    this.submitting = false;
    this.loadLookups();
    this.clearForm(false);
    this.overlay.showOverlay('success', message, null, {
      actions: [
        { label: 'Schließen', closeOnly: true },
        {
          label: 'Zur Übersicht',
          route: manageType ? '/manage' : '/devices',
          queryParams: manageType && manageType !== 'category' ? { type: manageType } : {}
        }
      ]
    });
  }

  private handleError(logMessage: string, error: unknown, fallbackMessage: string): void {
    this.submitting = false;
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
