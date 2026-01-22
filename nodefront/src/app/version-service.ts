import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class VersionService {
  private version: string = "V0.1.0";

  getVersion(): string {
    return this.version;
  }
}