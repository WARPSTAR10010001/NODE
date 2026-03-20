import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Category, CategoryService } from '../category-service';
import { Status, StatusService } from '../status-service';
import { Location, LocationService } from '../location-service';
import { NetworkEnvironment, NetworkEnvironmentService } from '../network-environment-service';
import { OverlayService } from '../overlay-service';

type ManageType = 'category' | 'status' | 'location' | 'network-environment';
type ManageItem = Category | Status | Location | NetworkEnvironment;

@Component({
  selector: 'app-manage-component',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './manage-component.html',
  styleUrl: './manage-component.css',
})
export class ManageComponent implements OnInit {
  protected readonly options: Array<{ id: ManageType; label: string }> = [
    { id: 'category', label: 'Kategorien' },
    { id: 'status', label: 'Status' },
    { id: 'location', label: 'Standorte' },
    { id: 'network-environment', label: 'Netzwerkumgebungen' }
  ];

  type: ManageType = 'category';
  items: ManageItem[] = [];
  loading = false;
  editingId: number | null = null;
  draft: Record<string, string> = {};

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private categoryService: CategoryService,
    private statusService: StatusService,
    private locationService: LocationService,
    private networkEnvironmentService: NetworkEnvironmentService,
    private overlay: OverlayService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const param = params.get('type');
      this.type = this.isManageType(param) ? param : 'category';
      this.load();
    });
  }

  get title(): string {
    return this.options.find((option) => option.id === this.type)?.label ?? 'Verwaltung';
  }

  onTypeChange(type: ManageType): void {
    this.router.navigate(['/manage', type]);
  }

  isLocation(item: ManageItem): item is Location {
    return this.type === 'location';
  }

  startEdit(item: ManageItem): void {
    this.editingId = item.id;
    if (this.type === 'location') {
      const location = item as Location;
      this.draft = {
        city: location.city ?? '',
        address: location.address ?? '',
        houseNumber: location.houseNumber ?? '',
        room: location.room ?? ''
      };
      return;
    }

    const base = item as Category | Status | NetworkEnvironment;
    this.draft = {
      name: base.name ?? '',
      description: 'description' in base ? (base.description ?? '') : ''
    };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.draft = {};
  }

  save(item: ManageItem): void {
    if (this.editingId !== item.id) return;

    switch (this.type) {
      case 'category':
        this.categoryService.update(item.id, {
          name: this.draft['name'],
          description: this.draft['description']
        }).subscribe({
          next: () => this.finishMutation('Kategorie aktualisiert.'),
          error: (error) => this.handleError(error, 'Kategorie konnte nicht aktualisiert werden.')
        });
        break;
      case 'status':
        this.statusService.update(item.id, {
          name: this.draft['name'],
          description: this.draft['description']
        }).subscribe({
          next: () => this.finishMutation('Status aktualisiert.'),
          error: (error) => this.handleError(error, 'Status konnte nicht aktualisiert werden.')
        });
        break;
      case 'location':
        this.locationService.update(item.id, {
          city: this.draft['city'],
          address: this.draft['address'],
          houseNumber: this.draft['houseNumber'],
          room: this.draft['room']
        }).subscribe({
          next: () => this.finishMutation('Standort aktualisiert.'),
          error: (error) => this.handleError(error, 'Standort konnte nicht aktualisiert werden.')
        });
        break;
      case 'network-environment':
        this.networkEnvironmentService.update(item.id, {
          name: this.draft['name']
        }).subscribe({
          next: () => this.finishMutation('Netzwerkumgebung aktualisiert.'),
          error: (error) => this.handleError(error, 'Netzwerkumgebung konnte nicht aktualisiert werden.')
        });
        break;
    }
  }

  remove(item: ManageItem): void {
    if (!window.confirm('Eintrag wirklich löschen?')) return;

    switch (this.type) {
      case 'category':
        this.categoryService.delete(item.id).subscribe({
          next: () => this.finishMutation('Kategorie gelöscht.'),
          error: (error) => this.handleError(error, 'Kategorie konnte nicht gelöscht werden.')
        });
        break;
      case 'status':
        this.statusService.delete(item.id).subscribe({
          next: () => this.finishMutation('Status gelöscht.'),
          error: (error) => this.handleError(error, 'Status konnte nicht gelöscht werden.')
        });
        break;
      case 'location':
        this.locationService.delete(item.id).subscribe({
          next: () => this.finishMutation('Standort gelöscht.'),
          error: (error) => this.handleError(error, 'Standort konnte nicht gelöscht werden.')
        });
        break;
      case 'network-environment':
        this.networkEnvironmentService.delete(item.id).subscribe({
          next: () => this.finishMutation('Netzwerkumgebung gelöscht.'),
          error: (error) => this.handleError(error, 'Netzwerkumgebung konnte nicht gelöscht werden.')
        });
        break;
    }
  }

  private load(): void {
    this.loading = true;
    this.cancelEdit();

    switch (this.type) {
      case 'category':
        this.categoryService.list().subscribe({
          next: ({ categories }) => this.setItems(categories),
          error: (error) => this.handleLoadError(error)
        });
        break;
      case 'status':
        this.statusService.list().subscribe({
          next: ({ statuses }) => this.setItems(statuses),
          error: (error) => this.handleLoadError(error)
        });
        break;
      case 'location':
        this.locationService.list().subscribe({
          next: ({ locations }) => this.setItems(locations),
          error: (error) => this.handleLoadError(error)
        });
        break;
      case 'network-environment':
        this.networkEnvironmentService.list().subscribe({
          next: ({ networkEnvironments }) => this.setItems(networkEnvironments),
          error: (error) => this.handleLoadError(error)
        });
        break;
    }
  }

  private setItems(items: ManageItem[]): void {
    this.items = items;
    this.loading = false;
  }

  private finishMutation(message: string): void {
    this.cancelEdit();
    this.load();
    this.overlay.showOverlay('success', message);
  }

  private handleLoadError(error: unknown): void {
    this.loading = false;
    this.handleError(error, 'Daten konnten nicht geladen werden.');
  }

  private handleError(error: unknown, fallbackMessage: string): void {
    console.error(error);
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

  private isManageType(value: string | null): value is ManageType {
    return value === 'category' || value === 'status' || value === 'location' || value === 'network-environment';
  }
}
