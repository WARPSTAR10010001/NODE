import { Component, OnInit, HostListener } from '@angular/core';
import { OverlayService, OverlayState } from '../overlay-service';
import { ThemeService, Theme, Contrast } from '../theme-service';

@Component({
  selector: 'app-overlay-component',
  templateUrl: './overlay-component.html',
  styleUrl: './overlay-component.css',
})
export class OverlayComponent {
  constructor(
    private overlay: OverlayService,
    private theme: ThemeService,
  ) { }

  overlayState: OverlayState = { show: false, type: 'info' };
  selectedTheme: Theme = 'light';
  selectedContrast: Contrast = 'no-contrast';

  close() {
    this.overlay.hideOverlay();
  }

  @HostListener('document:keydown.escape')
  onEscHandler() {
    this.close();
  }

  changeTheme(theme: Theme) { this.theme.setTheme(theme); }
  changeContrast(contrast: Contrast) { this.theme.setContrast(contrast); }
}