import { Component, HostListener, OnInit, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OverlayAccountPayload, OverlayFilterPayload, OverlayService, OverlayState } from '../overlay-service';
import { Accent, Theme, ThemeService } from '../theme-service';
import { AuthService } from '../auth-service';
import { VersionService } from '../version-service';

@Component({
  selector: 'app-overlay-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './overlay-component.html',
  styleUrl: './overlay-component.css',
})
export class OverlayComponent implements OnInit {
  overlayState: OverlayState = { show: false, type: 'info' };
  selectedTheme: Theme = 'light';
  selectedAccent: Accent = 'blue';
  readonly accentOptions: Array<{ value: Accent; label: string; previewClass: string }> = [
    { value: 'blue', label: 'Blau', previewClass: 'accent-blue' },
    { value: 'green', label: 'Grün', previewClass: 'accent-green' },
    { value: 'pink', label: 'Pink', previewClass: 'accent-pink' },
    { value: 'orange', label: 'Orange', previewClass: 'accent-orange' },
    { value: 'purple', label: 'Violett', previewClass: 'accent-purple' }
  ];

  constructor(
    private overlay: OverlayService,
    private theme: ThemeService,
    private renderer: Renderer2,
    private router: Router,
    private auth: AuthService,
    public version: VersionService
  ) { }

  ngOnInit() {
    this.selectedTheme = this.theme.getTheme();
    this.selectedAccent = this.theme.getAccent();

    this.theme.currentTheme$.subscribe((value) => this.selectedTheme = value);
    this.theme.currentAccent$.subscribe((value) => this.selectedAccent = value);

    this.overlay.overlay$.subscribe((state) => {
      this.overlayState = state;
      this.renderer.setStyle(document.body, 'overflow', state.show ? 'hidden' : '');
    });
  }

  close() {
    this.overlay.hideOverlay();
  }

  closeUpdate() {
    this.close();
    this.version.acknowledgeCurrentVersion();
  }

  navigateChangelog() {
    this.closeUpdate();
    this.navigate('/changelog');
  }

  navigate(route?: string, queryParams?: Record<string, string>) {
    this.close();
    if (route) {
      this.router.navigate([route], { queryParams });
    }
  }

  get filterPayload(): OverlayFilterPayload | null {
    if (this.overlayState.type !== 'filter' || !this.overlayState.payload) {
      return null;
    }

    return this.overlayState.payload as OverlayFilterPayload;
  }

  get accountPayload(): OverlayAccountPayload | null {
    if (this.overlayState.type !== 'account' || !this.overlayState.payload) {
      return null;
    }

    return this.overlayState.payload as OverlayAccountPayload;
  }

  get generalFilterFields() {
    return (this.filterPayload?.fields || []).filter((field) =>
      ![
        'latestTestTester',
        'latestTestResult',
        'latestTestScale',
        'latestTestNextPeriod',
        'createdFrom',
        'createdTo',
        'updatedFrom',
        'updatedTo',
        'latestTestLastFrom',
        'latestTestLastTo',
        'latestTestNextFrom',
        'latestTestNextTo'
      ].includes(field.key)
    );
  }

  get createdDateFields() {
    return (this.filterPayload?.fields || []).filter((field) =>
      ['createdFrom', 'createdTo'].includes(field.key)
    );
  }

  get updatedDateFields() {
    return (this.filterPayload?.fields || []).filter((field) =>
      ['updatedFrom', 'updatedTo'].includes(field.key)
    );
  }

  get technicalReviewFields() {
    return (this.filterPayload?.fields || []).filter((field) =>
      [
        'latestTestTester',
        'latestTestResult',
        'latestTestScale',
        'latestTestNextPeriod',
        'latestTestLastFrom',
        'latestTestLastTo',
        'latestTestNextFrom',
        'latestTestNextTo'
      ].includes(field.key)
    );
  }

  applyFilterOverlay() {
    this.filterPayload?.onApply();
    this.close();
  }

  resetFilterOverlay() {
    this.filterPayload?.onReset();
  }

  updateFilterField(key: string, value: string) {
    this.filterPayload?.onFieldChange(key, value);
  }

  updateSortField(value: string) {
    this.filterPayload?.onSortFieldChange(value);
  }

  updateSortDirection(value: string) {
    this.filterPayload?.onSortDirectionChange(value === 'desc' ? 'desc' : 'asc');
  }

  logout() {
    this.close();
    this.auth.logout();
  }

  getRoleLabel(role?: number): string {
    if (role === 2) return 'Admin';
    if (role === 1) return 'Editor';
    if (role === 0) return 'Viewer';
    return '-';
  }

  @HostListener('document:keydown.escape')
  onEscHandler() {
    if (this.overlayState.type === "update") {
      this.closeUpdate();
    } else {
      this.close();
    }
  }

  changeTheme(theme: Theme) { this.theme.setTheme(theme); }
  changeAccent(accent: Accent) { this.theme.setAccent(accent); }

  onAccentChange(newAccent: Accent) {
    this.theme.setAccent(newAccent);
  }

  clearData() {
    if (confirm("Sollen alle Daten gelöscht werden? Bitte diese Aktion nur durchführen wenn Sie durch einen Systemadmin dazu aufgefordert wurden!")) {
      this.theme.setTheme("light", false);
      this.theme.setAccent("blue", false);

      localStorage.clear();

      this.auth.logout();

      this.close();

      if (this.auth.isLoggedIn()) {
        this.overlay.showOverlay("info", "Alle Browserdaten wurden erfolgreich gelöscht und Sie wurden abgemeldet.");
      } else {
        this.overlay.showOverlay("info", "Alle Browserdaten wurden erfolgreich gelöscht.");
      }
    }
  }

  getDebugInfo() {
    const ua = navigator.userAgent;

    const os = this.detectOS(ua);
    const browser = this.detectBrowser(ua);

    return {
      os,
      browser: browser.name,
      version: browser.version,
      userAgent: ua
    };
  }

  private detectOS(ua: string): string {
    if (ua.includes('Windows NT 10.0')) return 'Windows 10/11';
    if (ua.includes('Windows NT 6.3')) return 'Windows 8.1';
    if (ua.includes('Windows NT 6.2')) return 'Windows 8';
    if (ua.includes('Windows NT 6.1')) return 'Windows 7';

    if (ua.includes('Mac OS X')) return 'macOS';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS / iPadOS';
    if (ua.includes('Linux')) return 'Linux';

    return 'Unknown OS';
  }

  private detectBrowser(ua: string): { name: string; version: string } {
    let match;

    if ((match = ua.match(/Edg\/([\d.]+)/))) {
      return { name: 'Edge', version: match[1] };
    }

    if ((match = ua.match(/Chrome\/([\d.]+)/))) {
      return { name: 'Chrome', version: match[1] };
    }

    if ((match = ua.match(/Firefox\/([\d.]+)/))) {
      return { name: 'Firefox', version: match[1] };
    }

    if ((match = ua.match(/Version\/([\d.]+).*Safari/))) {
      return { name: 'Safari', version: match[1] };
    }

    return { name: 'Unknown', version: '0' };
  }
}
