import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { DeviceService } from '../device-service';
import { Category, CategoryService } from '../category-service';
import { Status, StatusService } from '../status-service';
import { Location, LocationService } from '../location-service';
import { NetworkEnvironment, NetworkEnvironmentService } from '../network-environment-service';

type EntityType =
  | 'device'
  | 'category'
  | 'status'
  | 'location'
  | 'network-environment';

@Component({
  selector: 'app-create-component',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './create-component.html',
  styleUrls: ['./create-component.css']
})
export class CreateComponent implements OnInit {
  categories: Category[] = [];
  statuses: Status[] = [];
  locations: Location[] = [];
  networkEnvironments: NetworkEnvironment[] = [];
  entityType: EntityType = 'device';
  form!: FormGroup;
  submitting = false;

  constructor(
    private fb: FormBuilder,
    private deviceService: DeviceService,
    private categoryService: CategoryService,
    private statusService: StatusService,
    private locationService: LocationService,
    private networkEnvService: NetworkEnvironmentService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadLookups();
    this.buildForm();
  }

  private loadLookups(): void {
    this.categoryService.list().subscribe({
      next: (res) => this.categories = res.categories,
      error: (err) => console.error('Load categories failed', err)
    });

    this.statusService.list().subscribe({
      next: (res) => this.statuses = res.statuses,
      error: (err) => console.error('Load statuses failed', err)
    });

    this.locationService.list().subscribe({
      next: (res) => this.locations = res.locations,
      error: (err) => console.error('Load locations failed', err)
    });

    this.networkEnvService.list().subscribe({
      next: (res) => this.networkEnvironments = res.networkEnvironments,
      error: (err) => console.error('Load network envs failed', err)
    });
  }

  onTypeChange(type: EntityType): void {
    this.entityType = type;
    this.buildForm();
  }

  private buildForm(): void {
    switch (this.entityType) {
      case 'device':
        this.form = this.fb.group({
          inventoryNumber: ['', [Validators.required, Validators.minLength(3)]],
          name: ['', Validators.required],
          manufacturer: [''],
          model: [''],
          serialNumber: [''],
          categoryId: [null, Validators.required],
          statusId: [null, Validators.required],
          purchase: [''],
          price: [null],
          supplier: [''],
          depreciationId: [null],
          accountingType: ['konsumtiv', Validators.required],
          locationId: [null],
          networkEnvironmentId: [null],
          patchPanelLabel: [''],
          ipAddress: [''],
          notes: ['']
        });
        break;

      case 'category':
        this.form = this.fb.group({
          name: ['', Validators.required],
          description: ['']
        });
        break;

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
  }

  get f() {
    return this.form.controls;
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting) return;

    this.submitting = true;

    switch (this.entityType) {
      case 'device':
        this.deviceService.create(this.form.value).subscribe({
          next: () => {
            this.submitting = false;
            this.router.navigate(['/devices']);
          },
          error: (err) => {
            this.submitting = false;
            console.error('Create device failed', err);
          }
        });
        break;

      case 'category':
        this.categoryService.create(this.form.value).subscribe({
          next: () => {
            this.submitting = false;
            this.router.navigate(['/devices']);
          },
          error: (err) => {
            this.submitting = false;
            console.error('Create category failed', err);
          }
        });
        break;

      case 'status':
        this.statusService.create(this.form.value).subscribe({
          next: () => {
            this.submitting = false;
            this.router.navigate(['/devices']);
          },
          error: (err) => {
            this.submitting = false;
            console.error('Create status failed', err);
          }
        });
        break;

      case 'location':
        this.locationService.create(this.form.value).subscribe({
          next: () => {
            this.submitting = false;
            this.router.navigate(['/devices']);
          },
          error: (err) => {
            this.submitting = false;
            console.error('Create location failed', err);
          }
        });
        break;

      case 'network-environment':
        this.networkEnvService.create(this.form.value).subscribe({
          next: () => {
            this.submitting = false;
            this.router.navigate(['/devices']);
          },
          error: (err) => {
            this.submitting = false;
            console.error('Create network env failed', err);
          }
        });
        break;
    }
  }
}