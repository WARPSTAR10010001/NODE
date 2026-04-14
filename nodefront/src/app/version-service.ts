import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VersionService {
  private version: string = "0.6.0";
  private summary: string = "MISC";
  private versionKey = 'node_last_logged_version';

  getVersion(withV = false): string {
    if (withV === false) {
      return `V${this.version}`;
    } else if (withV === true) {
      return `${this.version}`;
    }
    return "";
  }

  getDisplayVersion(): string {
    const parts = this.version.split('.');
    if (parts.length < 2) return this.version;
    return `${parts[0]}.${parts[1]}.0`;
  }

  getUpdateSummary(): string {
    return this.summary;
  }

  shouldShowUpdateOverlay(): boolean {
    const lastVersion = localStorage.getItem(this.versionKey);
    if (!lastVersion) return true;

    const currentParts = this.version.split('.');
    const lastParts = lastVersion.split('.');

    if (currentParts[0] !== lastParts[0]) {
      return true;
    }

    if (currentParts[1] !== lastParts[1]) {
      return true;
    }

    return false;
  }

  acknowledgeCurrentVersion(): void {
    localStorage.setItem(this.versionKey, this.version);
  }
}