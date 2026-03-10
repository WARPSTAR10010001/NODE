import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type OverlayType =
  | 'style'
  | 'error'
  | 'success'
  | 'info';

export interface OverlayState {
  show: boolean;
  type: OverlayType;
  message?: string;
  payload?: any;
}

@Injectable({ providedIn: 'root' })
export class OverlayService {
  private stateSubject = new BehaviorSubject<OverlayState>({ show: false, type: 'info' });
  public overlay$ = this.stateSubject.asObservable();

  showOverlay(
    type: OverlayType,
    message?: string,
    payload?: any,
    extra?: Partial<OverlayState>
  ) {
    this.stateSubject.next({
      show: true,
      type,
      message,
      payload,
      ...(extra || {})
    });
  }

  hideOverlay() {
    const cur = this.stateSubject.value;
    this.stateSubject.next({ ...cur, show: false });
  }

  get current(): OverlayState {
    return this.stateSubject.value;
  }
}