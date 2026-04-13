import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, switchMap, takeUntil, throwError } from 'rxjs';

import { AuthService } from '../auth-service';
import { Device, DeviceService } from '../device-service';
import { OverlayService } from '../overlay-service';

@Component({
  selector: 'app-detail-view-component',
  imports: [CommonModule, RouterLink],
  templateUrl: './detail-view-component.html',
  styleUrl: './detail-view-component.css',
})
export class DetailViewComponent implements OnInit, OnDestroy {
  device: Device | null = null;
  loading = true;
  deleting = false;
  errorMessage = '';

  private readonly destroy$ = new Subject<void>();
  private readonly dateFormatter = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  private readonly currencyFormatter = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private deviceService: DeviceService,
    private overlay: OverlayService,
    private authService: AuthService
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

          return this.deviceService.get(matchedDevice.id);
        })
      )
      .subscribe({
        next: ({ device }) => {
          this.device = device;
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load device details', error);
          this.errorMessage = error instanceof Error
            ? error.message
            : 'Die Detailansicht konnte nicht geladen werden.';
          this.loading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get canEditDevice(): boolean {
    return (this.authService.loggedRole() ?? 0) >= 1;
  }

  get hasDevice(): boolean {
    return this.device !== null;
  }

  formatDate(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date);
  }

  formatPrice(value?: number): string {
    if (value === undefined || value === null) return '-';
    return this.currencyFormatter.format(value);
  }

  formatAssignedUser(): string {
    return this.device?.assignedToUsername || 'Nicht zugewiesen';
  }

  formatLocation(): string {
    if (!this.device) return '-';

    const parts = [
      this.device.locationCity,
      this.device.locationAddress,
      this.device.locationHouseNumber,
      this.device.locationRoom ? `Raum ${this.device.locationRoom}` : null
    ].filter(Boolean);

    return parts.length ? parts.join(', ') : '-';
  }

  formatDepreciation(): string {
    if (!this.device?.depreciationTime) return '-';

    const scale = this.device.depreciationScale === 'years'
      ? 'Jahre'
      : this.device.depreciationScale === 'months'
        ? 'Monate'
        : '';

    return [this.device.depreciationTime, scale].filter(Boolean).join(' ');
  }

  formatMacAddresses(): string {
    if (!this.device?.macAddresses?.length) return '-';
    return this.device.macAddresses.join(', ');
  }

  formatContractType(): string {
    switch (this.device?.contractType) {
      case 'purchase':
        return 'Kauf';
      case 'lease':
        return 'Leasing';
      case 'pay-per-page':
        return 'Pay per Page';
      default:
        return '-';
    }
  }

  formatAccountingType(): string {
    switch (this.device?.accountingType) {
      case 'investiv':
        return 'Investiv';
      case 'konsumtiv':
        return 'Konsumtiv';
      default:
        return '-';
    }
  }

  formatLatestTestResult(): string {
    switch (this.device?.latestTestResult) {
      case 'pass':
        return 'Bestanden';
      case 'fail':
        return 'Nicht bestanden';
      default:
        return '-';
    }
  }

  formatTestInterval(): string {
    if (!this.device?.latestTestNextPeriod) return '-';

    const scale = this.device.latestTestScale === 'years' ? 'Jahre' : 'Monate';
    return `${this.device.latestTestNextPeriod} ${scale}`;
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
        error: (error) => {
          console.error('Delete device failed', error);
          this.deleting = false;
          this.overlay.showOverlay('error', 'Gerät konnte nicht gelöscht werden.');
        }
      });
  }

  goBack(): void {
    this.router.navigate(['/devices']);
  }
}
