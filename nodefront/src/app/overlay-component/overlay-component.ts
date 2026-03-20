import { Component, HostListener, OnInit, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { OverlayFilterPayload, OverlayService, OverlayState } from '../overlay-service';
import { Contrast, Theme, ThemeService } from '../theme-service';

@Component({
  selector: 'app-overlay-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './overlay-component.html',
  styleUrl: './overlay-component.css',
})
export class OverlayComponent implements OnInit {
  overlayState: OverlayState = { show: false, type: 'info' };
  selectedTheme: Theme = 'light';
  selectedContrast: Contrast = 'no-contrast';

  constructor(
    private overlay: OverlayService,
    private theme: ThemeService,
    private renderer: Renderer2,
    private router: Router
  ) {}

  ngOnInit() {
    this.selectedTheme = this.theme.getTheme();
    this.selectedContrast = this.theme.getContrast();

    this.theme.currentTheme$.subscribe((value) => this.selectedTheme = value);
    this.theme.currentContrast$.subscribe((value) => this.selectedContrast = value);

    this.overlay.overlay$.subscribe((state) => {
      this.overlayState = state;
      this.renderer.setStyle(document.body, 'overflow', state.show ? 'hidden' : '');
    });
  }

  close() {
    this.overlay.hideOverlay();
  }

  navigate(route?: string) {
    this.close();
    if (route) {
      this.router.navigate([route]);
    }
  }

  get filterPayload(): OverlayFilterPayload | null {
    if (this.overlayState.type !== 'filter' || !this.overlayState.payload) {
      return null;
    }

    return this.overlayState.payload as OverlayFilterPayload;
  }

  get generalFilterFields() {
    return (this.filterPayload?.fields || []).filter((field) =>
      !['createdFrom', 'createdTo', 'updatedFrom', 'updatedTo'].includes(field.key)
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

  @HostListener('document:keydown.escape')
  onEscHandler() {
    this.close();
  }

  changeTheme(theme: Theme) { this.theme.setTheme(theme); }
  changeContrast(contrast: Contrast) { this.theme.setContrast(contrast); }
}
