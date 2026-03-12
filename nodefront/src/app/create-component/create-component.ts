import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

import { DeviceService } from '../device-service';
import { CategoryService, Category } from '../category-service';
import { StatusService, Status } from '../status-service';
import { LocationService, Location } from '../location-service';
import { NetworkEnvironmentService, NetworkEnvironment } from '../network-environment-service';
import { UserService, User } from '../user-service';

@Component({
  selector: 'app-create-component',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './create-component.html',
  styleUrls: ['./create-component.css']
})
export class CreateComponent implements OnInit {
  selectedType: string = 'device';
  form!: FormGroup;
  submitting = false;

  categories: Category[] = [];
  statuses: Status[] = [];
  locations: Location[] = [];
  networkEnvs: NetworkEnvironment[] = [];
  users: User[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private deviceService: DeviceService,
    private categoryService: CategoryService,
    private statusService: StatusService,
    private locationService: LocationService,
    private networkService: NetworkEnvironmentService,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.loadAllDropdowns();
    this.initForm();
  }

  loadAllDropdowns() {
    this.categoryService.list().subscribe(res => this.categories = res.categories);
    this.statusService.list().subscribe(res => this.statuses = res.statuses);
    this.locationService.list().subscribe(res => this.locations = res.locations); // Prüfe hier im Network-Tab ob "houseNumber" geliefert wird
    this.networkService.list().subscribe(res => this.networkEnvs = res.networkEnvironments);
    this.userService.list().subscribe(res => this.users = res.users);
  }

  initForm() {
    if (this.selectedType === 'device') {
      this.form = this.fb.group({
        inventoryNumber: ['', Validators.required],
        name: ['', Validators.required],
        manufacturer: [''],
        model: [''],
        serialNumber: [''],
        categoryId: ['', Validators.required],
        statusId: ['', Validators.required],
        locationId: [null],
        assignedToUserId: [null],
        networkEnvironmentId: [null],
        accountingType: ['konsumtiv'],
        purchase: [null],
        price: [null],
        supplier: [''],
        // Abschreibung
        depreciationValue: [null], 
        depreciationScale: ['years'],
        // Netzwerk
        ipAddress: [''],
        macAddressesRaw: [''], // Hilfsfeld für String-Eingabe
        patchPanelLabel: [''],
        notes: ['']
      });
    } else {
      this.form = this.fb.group({
        name: ['', Validators.required],
        description: ['']
      });
    }
  }

  onTypeChange(event: any) {
    this.selectedType = event.target.value;
    this.initForm();
  }

  onSubmit() {
    if (this.form.invalid || this.submitting) return;
    this.submitting = true;

    let val = { ...this.form.value };

    if (this.selectedType === 'device') {
      // Mac-Adressen von String zu Array konvertieren
      val.macAddresses = val.macAddressesRaw ? val.macAddressesRaw.split(',').map((s: string) => s.trim()) : [];
      delete val.macAddressesRaw;
    }

    let obs$: Observable<any> | undefined;
    switch (this.selectedType) {
      case 'device': obs$ = this.deviceService.create(val); break;
      case 'category': obs$ = this.categoryService.create(val); break;
      case 'status': obs$ = this.statusService.create(val); break;
      case 'location': obs$ = this.locationService.create(val); break;
      case 'network-environment': obs$ = this.networkService.create(val); break;
    }

    if (obs$) {
      obs$.subscribe({
        next: () => {
          this.submitting = false;
          // Hier Overlay Erfolg
          this.router.navigate(['/devices']);
        },
        error: (err) => {
          this.submitting = false;
          console.error('Fehler:', err);
          // Hier Overlay Fehler (z.B. 404 wenn URL falsch oder 400 wenn Mac-Format falsch)
        }
      });
    }
  }
}