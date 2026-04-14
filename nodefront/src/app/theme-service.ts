import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';
export type Accent = 'blue' | 'green' | 'pink' | 'orange' | 'purple' | 'cyan';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  themeKey = "theme";
  accentKey = "accent"

  currentThemeSubject = new BehaviorSubject<Theme>('light');
  currentAccentSubject = new BehaviorSubject<Accent>('blue');

  currentTheme$ = this.currentThemeSubject.asObservable();
  currentAccent$ = this.currentAccentSubject.asObservable();

  constructor() {
    const savedThemeRaw = localStorage.getItem(this.themeKey);
    const theme = this.sanitizeTheme(savedThemeRaw);
    this.setTheme(theme, false);

    const savedAccentRaw = localStorage.getItem(this.accentKey);
    const accent = this.sanitizeAccent(savedAccentRaw);
    this.setAccent(accent, false);
  }

  private sanitizeTheme(raw: string | null): Theme {
    if (raw === 'light' || raw === 'dark') return raw;
    if (raw) localStorage.setItem(this.themeKey, 'light');
    return 'light';
  }

  private sanitizeAccent(raw: string | null) {
    if (raw === 'blue' || raw === 'green' || raw === 'pink' || raw === 'orange' || raw === 'purple' || raw == 'cyan') return raw;
    if (raw) localStorage.setItem(this.accentKey, 'blue');
    return 'blue';
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

  setAccent(accent: Accent, save = true) {
    document.body.classList.remove('blue', 'green', 'pink', 'orange', 'purple', 'cyan');
    document.body.classList.add(accent);

    this.currentAccentSubject.next(accent);

    if (save) {
      localStorage.setItem(this.accentKey, accent);
    }
  }

  getAccent(): Accent {
    return this.currentAccentSubject.value;
  }
}