import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';
export type Contrast = "contrast" | "no-contrast";

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  themeKey = "theme";
  contrastKey = "contrast";

  currentThemeSubject = new BehaviorSubject<Theme>('light');
  currentContrastSubject = new BehaviorSubject<Contrast>("no-contrast");

  currentTheme$ = this.currentThemeSubject.asObservable();
  currentContrast$ = this.currentContrastSubject.asObservable();

  constructor() {
    const savedThemeRaw = localStorage.getItem(this.themeKey);
    const theme = this.sanitizeTheme(savedThemeRaw);
    this.setTheme(theme, false);

    const savedContrastRaw = localStorage.getItem(this.contrastKey);
    const contrast = this.sanitizeContrast(savedContrastRaw);
    this.setContrast(contrast, false);
  }

  private sanitizeTheme(raw: string | null): Theme {
    if (raw === 'light' || raw === 'dark') return raw;
    if (raw) localStorage.setItem(this.themeKey, 'light');
    return 'light';
  }

  private sanitizeContrast(raw: string | null): Contrast {
    if (raw === 'contrast' || raw === 'no-contrast') return raw;
    if (raw) localStorage.setItem(this.contrastKey, 'no-contrast');
    return 'no-contrast';
  }

  setTheme(theme: Theme, save = true) {
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);

    this.currentThemeSubject.next(theme);

    if (save) {
      localStorage.setItem(this.themeKey, theme);
    }
  }

  getTheme(): Theme {
    return this.currentThemeSubject.value;
  }

  setContrast(contrast: Contrast, save = true) {
    document.body.classList.remove('contrast', 'no-contrast');
    document.body.classList.add(contrast);

    this.currentContrastSubject.next(contrast);

    if (save) {
      localStorage.setItem(this.contrastKey, contrast);
    }
  }

  getContrast(): Contrast {
    return this.currentContrastSubject.value;
  }
}