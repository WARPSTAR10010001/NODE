import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VersionService {
  private version: string = "V0.2.0I3";

  getVersion(): string {
    return this.version;
  }
}