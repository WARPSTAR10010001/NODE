import { Component, OnInit, HostListener, Renderer2 } from '@angular/core';
import { OverlayService, OverlayState } from '../overlay-service';
import { ThemeService, Theme, Contrast } from '../theme-service';

@Component({
  selector: 'app-overlay-component',
  templateUrl: './overlay-component.html',
  styleUrl: './overlay-component.css',
})
export class OverlayComponent implements OnInit {
  constructor(
    private overlay: OverlayService,
    private theme: ThemeService,
    private renderer: Renderer2
  ) {}

  overlayState: OverlayState = { show: false, type: 'info' };
  selectedTheme: Theme = 'light';
  selectedContrast: Contrast = 'no-contrast';

  ngOnInit() {
    this.selectedTheme = this.theme.getTheme();
    this.selectedContrast = this.theme.getContrast();

    this.theme.currentTheme$.subscribe(v => this.selectedTheme = v);
    this.theme.currentContrast$.subscribe(v => this.selectedContrast = v);

    this.overlay.overlay$.subscribe(state => {
      this.overlayState = state;
      this.renderer.setStyle(document.body, "overflow", state.show ? "hidden" : "");
    });
  }

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