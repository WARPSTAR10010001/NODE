import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { AuthService, User } from '../auth-service';
import { Device, DeviceListResponse, DeviceService } from '../device-service';
import { OverlayService } from '../overlay-service';
import { UserService, UserRecord } from '../user-service';

type DashboardLink = {
  label: string;
  subtitle: string;
  route: string;
};

type DashboardFact = {
  title: string;
  detail: string;
};

type RecentDevice = {
  inventoryNumber: string;
  name: string;
  lastViewedAt: string;
};

const DEVICE_PAGE_FETCH_SIZE = 200;
const QUICK_FACTS_BATCH_SIZE = 3;
const RECENT_DEVICES_STORAGE_KEY = 'node.dashboard.recentDevices';

@Component({
  selector: 'app-dashboard-component',
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-component.html',
  styleUrl: './dashboard-component.css',
})

export class DashboardComponent implements OnInit {
  loading = true;
  error = false;
  quickLinks: DashboardLink[] = [];
  allFacts: DashboardFact[] = [];
  facts: DashboardFact[] = [];
  recentDevices: RecentDevice[] = [];
  userData!: User | null;
  username = "";
  resolvable = false;

  constructor(
    public auth: AuthService,
    private deviceService: DeviceService,
    private overlay: OverlayService,
    private user: UserService
  ) { }

  ngOnInit(): void {
    this.buildQuickLinks();
    this.loadRecentDevices();
    this.loadFacts();

    this.userData = this.auth.user;
    if (this.userData) {
      this.username = this.userData.username;
      this.tryResolve(this.userData);
    }
  }

  tryResolve(userData: User): void {
    this.user.resolveLdapUser(userData.username).subscribe({
      next: (response) => {
        if (response && response.user) {
          this.username = response.user.displayName || response.user.username;
          this.resolvable = true;
          console.log("Erfolgreich aufgelöst:", this.username);
        }
      },
      error: (err) => {
        console.error("Fehler bei der Namensauflösung:", err);
        this.username = userData.username;
        this.resolvable = false;
      }
    });
  }

  get hasRecentDevices(): boolean {
    return this.recentDevices.length >= 3;
  }

  get canEditDevices(): boolean {
    return (this.auth.loggedRole() ?? 0) >= 1;
  }

  clearRecentDevices(): void {
    const confirmed = window.confirm('Gerätechronik wirklich löschen?');
    if (!confirmed) {
      return;
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(RECENT_DEVICES_STORAGE_KEY);
    }

    this.recentDevices = [];
  }

  private buildQuickLinks(): void {
    const links: DashboardLink[] = [
      {
        label: 'Geräteübersicht',
        subtitle: 'Direkt in die Übersicht und Suche springen.',
        route: '/devices'
      },
      {
        label: 'Dokumentation',
        subtitle: 'Regeln, Hinweise und Arbeitsabläufe nachschlagen.',
        route: '/docs'
      },
      {
        label: 'Changelog',
        subtitle: 'Die letzten Änderungen an NODE ansehen.',
        route: '/changelog'
      }
    ];

    if ((this.auth.loggedRole() ?? 0) >= 1) {
      links.push(
        {
          label: 'Erstellung',
          subtitle: 'Neue Einträge, Kategorien und Status anlegen.',
          route: '/create'
        },
        {
          label: 'Verwalten',
          subtitle: 'Kerndaten pflegen und bestehende Werte anpassen.',
          route: '/manage'
        }
      );
    }

    if (this.auth.loggedRole() === 2) {
      links.push({
        label: 'Adminpanel',
        subtitle: 'Rollen, Freigaben und Nutzerverwaltung öffnen.',
        route: '/admin'
      });
    }

    this.quickLinks = links;
  }

  private loadFacts(): void {
    this.loading = true;
    this.error = false;

    this.deviceService.list({ page: 1, pageSize: DEVICE_PAGE_FETCH_SIZE })
      .pipe(
        switchMap((firstPage) => {
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
        })
      )
      .subscribe({
        next: (responses: DeviceListResponse[]) => {
          const devices = responses.flatMap((response) => response.items);
          this.allFacts = this.buildFacts(devices);
          this.refreshFacts();
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load dashboard facts:', error);
          this.error = true;
          this.loading = false;
          this.facts = [];
          this.overlay.showOverlay('error', 'Dashboard-Daten konnten nicht geladen werden.');
        }
      });
  }

  private buildFacts(devices: Device[]): DashboardFact[] {
    if (devices.length === 0) {
      return [
        {
          title: 'Noch ist das Inventar leer.',
          detail: 'Sobald die ersten Einträge angelegt sind, tauchen hier automatisch passende Statistiken auf.'
        }
      ];
    }

    const locationCounts = new Map<string, number>();
    const statusCounts = new Map<string, number>();
    const cityCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();
    const manufacturerCounts = new Map<string, number>();
    const networkCounts = new Map<string, number>();
    let devicesWithoutLocation = 0;
    let investiveCount = 0;
    let devicesWithAssignee = 0;
    let devicesWithIpAddress = 0;
    let devicesWithSerialNumber = 0;
    let devicesWithManufacturer = 0;
    let devicesWithMacAddress = 0;
    let devicesWithTests = 0;
    let overdueTests = 0;
    let testsDueSoon = 0;
    let devicesWithoutNotes = 0;
    let leasedDevices = 0;
    let purchasedDevices = 0;
    let payPerPageDevices = 0;
    let devicesPurchasedThisYear = 0;
    let devicesEditedThisMonth = 0;

    const now = new Date();
    const currentYear = now.getFullYear();
    const nextThirtyDays = new Date();
    nextThirtyDays.setDate(nextThirtyDays.getDate() + 30);

    devices.forEach((device) => {
      const locationLabel = this.formatLocation(device);
      if (locationLabel) {
        locationCounts.set(locationLabel, (locationCounts.get(locationLabel) ?? 0) + 1);
      } else {
        devicesWithoutLocation += 1;
      }

      const statusLabel = device.statusName?.trim();
      if (statusLabel) {
        statusCounts.set(statusLabel, (statusCounts.get(statusLabel) ?? 0) + 1);
      }

      const categoryLabel = device.categoryName?.trim();
      if (categoryLabel) {
        categoryCounts.set(categoryLabel, (categoryCounts.get(categoryLabel) ?? 0) + 1);
      }

      const manufacturerLabel = device.manufacturer?.trim();
      if (manufacturerLabel) {
        manufacturerCounts.set(manufacturerLabel, (manufacturerCounts.get(manufacturerLabel) ?? 0) + 1);
        devicesWithManufacturer += 1;
      }

      const networkLabel = device.networkEnvironmentName?.trim();
      if (networkLabel) {
        networkCounts.set(networkLabel, (networkCounts.get(networkLabel) ?? 0) + 1);
      }

      const cityLabel = device.locationCity?.trim();
      if (cityLabel) {
        cityCounts.set(cityLabel, (cityCounts.get(cityLabel) ?? 0) + 1);
      }

      if (device.accountingType === 'investiv') {
        investiveCount += 1;
      }

      if (device.assignedToUsername?.trim()) {
        devicesWithAssignee += 1;
      }

      if (device.ipAddress?.trim()) {
        devicesWithIpAddress += 1;
      }

      if (device.serialNumber?.trim()) {
        devicesWithSerialNumber += 1;
      }

      if (device.macAddresses?.length) {
        devicesWithMacAddress += 1;
      }

      if (device.latestTestId) {
        devicesWithTests += 1;
      }

      if (device.latestTestNextAt) {
        const nextTestDate = new Date(device.latestTestNextAt);
        if (!Number.isNaN(nextTestDate.getTime())) {
          if (nextTestDate < now) {
            overdueTests += 1;
          } else if (nextTestDate <= nextThirtyDays) {
            testsDueSoon += 1;
          }
        }
      }

      if (!device.notes?.trim()) {
        devicesWithoutNotes += 1;
      }

      if (device.contractType === 'lease') {
        leasedDevices += 1;
      } else if (device.contractType === 'purchase') {
        purchasedDevices += 1;
      } else if (device.contractType === 'pay-per-page') {
        payPerPageDevices += 1;
      }

      if (device.purchase) {
        const purchaseDate = new Date(device.purchase);
        if (!Number.isNaN(purchaseDate.getTime()) && purchaseDate.getFullYear() === currentYear) {
          devicesPurchasedThisYear += 1;
        }
      }

      if (device.lastEditAt) {
        const lastEditDate = new Date(device.lastEditAt);
        if (
          !Number.isNaN(lastEditDate.getTime())
          && lastEditDate.getFullYear() === now.getFullYear()
          && lastEditDate.getMonth() === now.getMonth()
        ) {
          devicesEditedThisMonth += 1;
        }
      }
    });

    const topLocation = this.findTopEntry(locationCounts);
    const topStatus = this.findTopEntry(statusCounts);
    const topCity = this.findTopEntry(cityCounts);
    const topCategory = this.findTopEntry(categoryCounts);
    const topManufacturer = this.findTopEntry(manufacturerCounts);
    const topNetwork = this.findTopEntry(networkCounts);
    const latestDevice = [...devices]
      .filter((device) => !!device.lastEditAt)
      .sort((first, second) => new Date(second.lastEditAt).getTime() - new Date(first.lastEditAt).getTime())[0];
    const latestPurchasedDevice = [...devices]
      .filter((device) => !!device.purchase)
      .sort((first, second) => new Date(second.purchase || '').getTime() - new Date(first.purchase || '').getTime())[0];
    const uniqueCities = new Set(
      devices
        .map((device) => device.locationCity?.trim())
        .filter((city): city is string => !!city)
    );
    const konsumtivCount = devices.length - investiveCount;
    const devicesWithoutAssignee = devices.length - devicesWithAssignee;
    const devicesWithoutIp = devices.length - devicesWithIpAddress;
    const devicesWithoutSerial = devices.length - devicesWithSerialNumber;
    const devicesWithoutMac = devices.length - devicesWithMacAddress;
    const devicesWithoutTests = devices.length - devicesWithTests;
    const devicesWithNotes = devices.length - devicesWithoutNotes;

    return [
      {
        title: `Momentan sind ${devices.length} Geräte im Inventar erfasst.`,
        detail: `${uniqueCities.size || 1} Städte oder Standorte tauchen aktuell im Bestand auf.`
      },
      {
        title: topCity
          ? `Die meisten Geräte stehen aktuell in ${topCity.label}.`
          : 'Momentan ist noch kein Ort direkt an Geräte gebunden.',
        detail: topCity
          ? `${topCity.count} Einträge sind aktuell diesem Ort zugeordnet.`
          : 'Sobald Standorte gepflegt sind, tauchen hier automatisch ortsbezogene Hinweise auf.'
      },
      {
        title: topStatus
          ? `Der häufigste Status ist gerade ${topStatus.label}.`
          : 'Momentan hat noch kein Gerät einen auswertbaren Statusnamen.',
        detail: topStatus
          ? `${topStatus.count} Geräte teilen sich gerade diesen Stand.`
          : 'Die Geräte haben aktuell noch keine auswertbaren Statusnamen.'
      },
      {
        title: devicesWithoutLocation > 0
          ? `${devicesWithoutLocation} Geräte haben momentan noch keinen Standort.`
          : 'Es gibt momentan kein Gerät ohne Standort.',
        detail: devicesWithoutLocation > 0
          ? 'Genau die Einträge, bei denen Standortpflege direkt sichtbar hilft.'
          : 'Sauber gepflegt: Jedes Gerät hat bereits einen Standort hinterlegt.'
      },
      {
        title: `Aktuell laufen ${investiveCount} Geräte investiv.`,
        detail: `${konsumtivCount} Geräte sind im Moment konsumtiv hinterlegt.`
      },
      {
        title: latestDevice
          ? `${latestDevice.name || latestDevice.inventoryNumber} wurde zuletzt bearbeitet.`
          : 'Gerade gibt es noch keinen Verlauf mit gültigem Zeitstempel.',
        detail: latestDevice?.lastEditAt
          ? `Letzte Änderung am ${this.formatDate(latestDevice.lastEditAt)}.`
          : 'Es gibt noch keinen gültigen Zeitstempel für Änderungen.'
      },
      {
        title: topCategory
          ? `Am häufigsten taucht gerade die Kategorie ${topCategory.label} auf.`
          : 'Momentan ist noch keine Kategorie auswertbar.',
        detail: topCategory
          ? `${topCategory.count} Geräte gehören aktuell zu dieser Kategorie.`
          : 'Sobald Kategorien gepflegt sind, erscheinen sie hier automatisch.'
      },
      {
        title: devicesWithAssignee > 0
          ? `${devicesWithAssignee} Geräte sind aktuell einer Person zugewiesen.`
          : 'Momentan ist noch kein Gerät einer Person zugewiesen.',
        detail: devicesWithAssignee > 0
          ? `${devicesWithoutAssignee} Geräte laufen aktuell noch ohne direkte Zuordnung.`
          : 'Alle Zuordnungen sind derzeit noch offen.'
      },
      {
        title: devicesWithIpAddress > 0
          ? `${devicesWithIpAddress} Geräte haben bereits eine IP-Adresse eingetragen.`
          : 'Momentan ist noch keine IP-Adresse im Inventar hinterlegt.',
        detail: devicesWithIpAddress > 0
          ? `${devicesWithoutIp} Geräte stehen aktuell noch ohne IP-Adresse da.`
          : 'Netzwerkdaten können ergänzt werden, sobald sie verfügbar sind.'
      },
      {
        title: devicesWithSerialNumber > 0
          ? `${devicesWithSerialNumber} Geräte haben schon eine Seriennummer hinterlegt.`
          : 'Aktuell hat noch kein Gerät eine Seriennummer eingetragen.',
        detail: devicesWithSerialNumber > 0
          ? `${devicesWithoutSerial} Geräte warten noch auf diese Angabe.`
          : 'Sobald Seriennummern gepflegt werden, taucht hier ein genauerer Überblick auf.'
      },
      {
        title: topLocation
          ? `Der größte Standort-Cluster liegt gerade bei ${topLocation.label}.`
          : 'Momentan gibt es noch keinen auswertbaren Standort-Cluster.',
        detail: topLocation
          ? `${topLocation.count} Geräte teilen sich aktuell genau diesen Standort.`
          : 'Mit vollständigen Standortdaten lässt sich das hier besser ablesen.'
      },
      {
        title: topManufacturer
          ? `${topManufacturer.label} ist aktuell der häufigste Hersteller im Bestand.`
          : 'Momentan ist noch kein Hersteller sauber auswertbar.',
        detail: topManufacturer
          ? `${topManufacturer.count} Geräte laufen derzeit unter diesem Hersteller.`
          : 'Mit gepflegten Herstellerdaten wird dieser Überblick automatisch aussagekräftiger.'
      },
      {
        title: topNetwork
          ? `Die Netzwerkumgebung ${topNetwork.label} ist aktuell am stärksten belegt.`
          : 'Momentan ist noch keine Netzwerkumgebung auswertbar.',
        detail: topNetwork
          ? `${topNetwork.count} Geräte hängen aktuell in dieser Umgebung.`
          : 'Sobald Netzwerkumgebungen gepflegt sind, taucht hier ein genauerer Überblick auf.'
      },
      {
        title: devicesWithManufacturer > 0
          ? `${devicesWithManufacturer} Geräte haben bereits einen Hersteller eingetragen.`
          : 'Momentan fehlt bei allen Geräten noch der Hersteller.',
        detail: `${devices.length - devicesWithManufacturer} Geräte stehen aktuell noch ohne Hersteller da.`
      },
      {
        title: devicesWithMacAddress > 0
          ? `${devicesWithMacAddress} Geräte haben schon mindestens eine MAC-Adresse hinterlegt.`
          : 'Momentan ist noch keine MAC-Adresse im Bestand hinterlegt.',
        detail: `${devicesWithoutMac} Geräte warten aktuell noch auf diese Netzwerkangabe.`
      },
      {
        title: devicesWithTests > 0
          ? `${devicesWithTests} Geräte haben bereits dokumentierte Prüfdaten.`
          : 'Momentan gibt es noch keine dokumentierte Geräteprüfung.',
        detail: `${devicesWithoutTests} Geräte laufen aktuell noch ohne hinterlegte Prüfhistorie.`
      },
      {
        title: overdueTests > 0
          ? `${overdueTests} Geräte haben aktuell eine überfällige Prüfung.`
          : 'Momentan ist keine Prüfung überfällig.',
        detail: overdueTests > 0
          ? 'Hier lohnt sich ein schneller Blick in die Geräteübersicht mit Prüfungsfilter.'
          : 'Die aktuell gepflegten Prüftermine liegen alle noch innerhalb des Zeitfensters.'
      },
      {
        title: testsDueSoon > 0
          ? `${testsDueSoon} Geräte müssen in den nächsten 30 Tagen geprüft werden.`
          : 'In den nächsten 30 Tagen steht aktuell keine Prüfung an.',
        detail: testsDueSoon > 0
          ? 'Das ist ein guter Kandidat für die nächste technische Prüfrunde.'
          : 'Der Momentane Prüfkalender ist für den kommenden Monat ruhig.'
      },
      {
        title: devicesWithoutNotes > 0
          ? `${devicesWithoutNotes} Geräte haben momentan noch keine Notizen.`
          : 'Jedes Gerät hat aktuell mindestens eine Notiz hinterlegt.',
        detail: devicesWithoutNotes > 0
          ? `${devicesWithNotes} Geräte sind bereits mit zusätzlichen Hinweisen dokumentiert.`
          : 'Die Dokumentation ist im Moment durchgehend ergänzt.'
      },
      {
        title: leasedDevices > 0
          ? `${leasedDevices} Geräte laufen aktuell als Leasing.`
          : 'Momentan ist kein Gerät als Leasing markiert.',
        detail: `${purchasedDevices} Geräte sind als Kauf und ${payPerPageDevices} als Pay per Page gepflegt.`
      },
      {
        title: devicesPurchasedThisYear > 0
          ? `${devicesPurchasedThisYear} Geräte wurden im laufenden Jahr gekauft.`
          : 'Für das laufende Jahr ist aktuell noch kein Kaufdatum hinterlegt.',
        detail: devicesPurchasedThisYear > 0
          ? 'Damit lässt sich der aktuelle Beschaffungsjahrgang schnell abschätzen.'
          : 'Sobald neue Kaufdaten erfasst werden, tauchen sie hier automatisch auf.'
      },
      {
        title: devicesEditedThisMonth > 0
          ? `${devicesEditedThisMonth} Geräte wurden in diesem Monat bearbeitet.`
          : 'In diesem Monat wurde bisher noch kein Gerät bearbeitet.',
        detail: devicesEditedThisMonth > 0
          ? 'Das zeigt recht gut, wie viel Bewegung gerade im Inventar steckt.'
          : 'Sobald es neue Änderungen gibt, erscheint hier automatisch ein Überblick.'
      },
      {
        title: latestPurchasedDevice
          ? `${latestPurchasedDevice.name || latestPurchasedDevice.inventoryNumber} ist das zuletzt gekaufte Gerät im Bestand.`
          : 'Momentan gibt es noch kein auswertbares Kaufdatum.',
        detail: latestPurchasedDevice?.purchase
          ? `Kaufdatum: ${this.formatDate(latestPurchasedDevice.purchase)}.`
          : 'Sobald Kaufdaten gepflegt sind, taucht hier automatisch das jüngste Gerät auf.'
      }
    ];
  }

  refreshFacts(): void {
    if (this.allFacts.length <= QUICK_FACTS_BATCH_SIZE) {
      this.facts = [...this.allFacts];
      return;
    }

    const shuffled = [...this.allFacts];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    this.facts = shuffled.slice(0, QUICK_FACTS_BATCH_SIZE);
  }

  private findTopEntry(entries: Map<string, number>): { label: string; count: number } | null {
    let topLabel = '';
    let topCount = 0;

    entries.forEach((count, label) => {
      if (count > topCount) {
        topLabel = label;
        topCount = count;
      }
    });

    return topCount > 0 ? { label: topLabel, count: topCount } : null;
  }

  private formatLocation(device: Device): string {
    return [
      device.locationCity,
      device.locationAddress,
      device.locationHouseNumber,
      device.locationRoom
    ]
      .filter((value) => !!value)
      .join(', ');
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'unbekannt';
    }

    return new Intl.DateTimeFormat('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }

  private loadRecentDevices(): void {
    if (typeof localStorage === 'undefined') {
      this.recentDevices = [];
      return;
    }

    try {
      const rawValue = localStorage.getItem(RECENT_DEVICES_STORAGE_KEY);
      if (!rawValue) {
        this.recentDevices = [];
        return;
      }

      const parsed = JSON.parse(rawValue);
      this.recentDevices = Array.isArray(parsed) ? parsed.slice(0, 3) : [];
    } catch {
      this.recentDevices = [];
    }
  }

  version() {
    this.overlay.showOverlay("update");
  }
}