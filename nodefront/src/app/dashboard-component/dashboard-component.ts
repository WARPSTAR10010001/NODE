import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { AuthService } from '../auth-service';
import { Device, DeviceListResponse, DeviceService } from '../device-service';

type DashboardLink = {
  label: string;
  subtitle: string;
  route: string;
};

type DashboardFact = {
  title: string;
  detail: string;
};

const DEVICE_PAGE_FETCH_SIZE = 200;

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
  facts: DashboardFact[] = [];

  constructor(
    public auth: AuthService,
    private deviceService: DeviceService
  ) {}

  ngOnInit(): void {
    this.buildQuickLinks();
    this.loadFacts();
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
          this.facts = this.pickRandomFacts(this.buildFacts(devices));
          this.loading = false;
        },
        error: (error) => {
          console.error('Failed to load dashboard facts:', error);
          this.error = true;
          this.loading = false;
          this.facts = [];
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
    let devicesWithoutLocation = 0;
    let investiveCount = 0;
    let devicesWithAssignee = 0;
    let devicesWithIpAddress = 0;
    let devicesWithSerialNumber = 0;

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
    });

    const topLocation = this.findTopEntry(locationCounts);
    const topStatus = this.findTopEntry(statusCounts);
    const topCity = this.findTopEntry(cityCounts);
    const topCategory = this.findTopEntry(categoryCounts);
    const latestDevice = [...devices]
      .filter((device) => !!device.lastEditAt)
      .sort((first, second) => new Date(second.lastEditAt).getTime() - new Date(first.lastEditAt).getTime())[0];
    const uniqueCities = new Set(
      devices
        .map((device) => device.locationCity?.trim())
        .filter((city): city is string => !!city)
    );
    const konsumtivCount = devices.length - investiveCount;

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
          ? `${devices.length - devicesWithAssignee} Geräte laufen aktuell noch ohne direkte Zuordnung.`
          : 'Alle Zuordnungen sind derzeit noch offen.'
      },
      {
        title: devicesWithIpAddress > 0
          ? `${devicesWithIpAddress} Geräte haben bereits eine IP-Adresse eingetragen.`
          : 'Momentan ist noch keine IP-Adresse im Inventar hinterlegt.',
        detail: devicesWithIpAddress > 0
          ? `${devices.length - devicesWithIpAddress} Geräte stehen aktuell noch ohne IP-Adresse da.`
          : 'Netzwerkdaten können ergänzt werden, sobald sie verfügbar sind.'
      },
      {
        title: devicesWithSerialNumber > 0
          ? `${devicesWithSerialNumber} Geräte haben schon eine Seriennummer hinterlegt.`
          : 'Aktuell hat noch kein Gerät eine Seriennummer eingetragen.',
        detail: devicesWithSerialNumber > 0
          ? `${devices.length - devicesWithSerialNumber} Geräte warten noch auf diese Angabe.`
          : 'Sobald Seriennummern gepflegt werden, taucht hier ein genauerer Überblick auf.'
      },
      {
        title: topLocation
          ? `Der größte Standort-Cluster liegt gerade bei ${topLocation.label}.`
          : 'Momentan gibt es noch keinen auswertbaren Standort-Cluster.',
        detail: topLocation
          ? `${topLocation.count} Geräte teilen sich aktuell genau diesen Standort.`
          : 'Mit vollständigen Standortdaten lässt sich das hier besser ablesen.'
      }
    ];
  }

  private pickRandomFacts(facts: DashboardFact[]): DashboardFact[] {
    if (facts.length <= 3) {
      return facts;
    }

    const shuffled = [...facts];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }

    return shuffled.slice(0, 3);
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
}
