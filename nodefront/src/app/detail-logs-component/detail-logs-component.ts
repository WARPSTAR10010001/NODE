import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, map, of, switchMap, takeUntil, throwError } from 'rxjs';

import { Device, DeviceLogEntry, DeviceService } from '../device-service';
import { OverlayService } from '../overlay-service';
import { LdapUser, UserService } from '../user-service';

const RECENT_DEVICES_STORAGE_KEY = 'node.dashboard.recentDevices';

@Component({
  selector: 'app-detail-logs-component',
  imports: [CommonModule],
  templateUrl: './detail-logs-component.html',
  styleUrl: './detail-logs-component.css',
})
export class DetailLogsComponent implements OnInit, OnDestroy {
  device: Device | null = null;
  logs: DeviceLogEntry[] = [];
  loading = true;
  errorMessage = '';

  private readonly destroy$ = new Subject<void>();
  private readonly displayNameMap = new Map<string, string>();
  private readonly dateFormatter = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private deviceService: DeviceService,
    private overlay: OverlayService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
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
          this.device = null;
          this.logs = [];

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
            deviceResponse: this.deviceService.get(matchedDevice.id),
            logsResponse: this.deviceService.getLogs(matchedDevice.inventoryNumber)
          });
        }),
        switchMap(({ deviceResponse, logsResponse }) => this.enrichLogs(deviceResponse.device, logsResponse.items))
      )
      .subscribe({
        next: ({ device, logs }) => {
          this.device = device;
          this.logs = logs;
          this.rememberRecentDevice(device);
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load device logs', error);
          this.errorMessage = error instanceof Error
            ? error.message
            : 'Das Änderungsprotokoll konnte nicht geladen werden.';
          this.loading = false;
          this.overlay.showOverlay('error', this.errorMessage);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get hasDevice(): boolean {
    return this.device !== null;
  }

  formatDate(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date);
  }

  formatLogValue(value: string | number | null | undefined): string {
    if (value === undefined || value === null || value === '') return '-';
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime()) && value.includes('T')) {
        return this.dateFormatter.format(parsed);
      }
    }
    return String(value);
  }

  formatChangeValue(field: string, value: string | number | null | undefined): string {
    if (field === 'assignedToUserId' && typeof value === 'string' && value.trim()) {
      return this.formatChangedBy(value);
    }

    return this.formatLogValue(value);
  }

  formatChangedBy(username?: string): string {
    if (!username) return '-';
    const shortUsername = this.toShortUsername(username);
    const displayName = this.displayNameMap.get(shortUsername);
    return displayName ? `${displayName} (${shortUsername.toUpperCase()})` : username;
  }

  formatLogAuditLine(username?: string, date?: string): string {
    const userLabel = this.formatChangedBy(username);
    const dateLabel = this.formatDate(date);

    if (userLabel === '-' && dateLabel === '-') return '-';
    if (userLabel === '-') return dateLabel;
    if (dateLabel === '-') return userLabel;
    return `${userLabel} • ${dateLabel}`;
  }

  goBackToDevice(): void {
    if (!this.device) {
      this.router.navigate(['/devices']);
      return;
    }

    this.router.navigate(['/devices', this.device.inventoryNumber]);
  }

  goBackToOverview(): void {
    this.router.navigate(['/devices']);
  }

  private enrichLogs(device: Device, logs: DeviceLogEntry[]) {
    const usernames = [
      ...logs.map((entry) => entry.changedByUsername),
      ...logs.flatMap((entry) =>
        entry.changes
          .filter((change) => change.field === 'assignedToUserId')
          .flatMap((change) => [change.before, change.after])
      )
    ]
      .filter((value): value is string => !!value)
      .filter((value, index, array) => array.indexOf(value) === index);

    if (usernames.length === 0) {
      this.displayNameMap.clear();
      return of({ device, logs });
    }

    return forkJoin(
      usernames.map((username) =>
        this.userService.searchLdap(this.toShortUsername(username)).pipe(
          map((results) => ({ username, displayName: this.findExactDisplayName(results, username) }))
        )
      )
    ).pipe(
      map((entries) => {
        this.displayNameMap.clear();
        entries.forEach((entry) => {
          if (entry.displayName) {
            this.displayNameMap.set(this.toShortUsername(entry.username), entry.displayName);
          }
        });

        return { device, logs };
      })
    );
  }

  private findExactDisplayName(results: LdapUser[], username: string): string | null {
    const shortUsername = this.toShortUsername(username);
    const exactMatch = results.find((result) => this.toShortUsername(result.username) === shortUsername);
    return exactMatch?.displayName?.trim() || null;
  }

  private toShortUsername(username?: string): string {
    return String(username || '').split('@')[0].trim().toLowerCase();
  }

  private rememberRecentDevice(device: Device): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const entry = {
      inventoryNumber: device.inventoryNumber,
      name: device.name || device.inventoryNumber,
      lastViewedAt: this.dateFormatter.format(new Date())
    };

    try {
      const rawValue = localStorage.getItem(RECENT_DEVICES_STORAGE_KEY);
      const parsed = rawValue ? JSON.parse(rawValue) : [];
      const recentDevices = Array.isArray(parsed) ? parsed : [];
      const merged = [
        entry,
        ...recentDevices.filter((item) => item?.inventoryNumber !== entry.inventoryNumber)
      ].slice(0, 3);

      localStorage.setItem(RECENT_DEVICES_STORAGE_KEY, JSON.stringify(merged));
    } catch {
    }
  }
}
