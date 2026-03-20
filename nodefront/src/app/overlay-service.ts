import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type OverlayType =
  | 'style'
  | 'error'
  | 'success'
  | 'info'
  | 'filter';

export interface OverlayAction {
  label: string;
  route?: string;
  closeOnly?: boolean;
}

export interface OverlaySelectOption {
  label: string;
  value: string;
}

export interface OverlayFilterField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select';
  value: string;
  placeholder?: string;
  options?: OverlaySelectOption[];
}

export interface OverlayFilterPayload {
  title: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  sortOptions: OverlaySelectOption[];
  fields: OverlayFilterField[];
  onFieldChange: (key: string, value: string) => void;
  onSortFieldChange: (value: string) => void;
  onSortDirectionChange: (value: 'asc' | 'desc') => void;
  onReset: () => void;
  onApply: () => void;
}

export interface OverlayState {
  show: boolean;
  type: OverlayType;
  message?: string;
  payload?: unknown;
  actions?: OverlayAction[];
}

@Injectable({ providedIn: 'root' })
export class OverlayService {
  private stateSubject = new BehaviorSubject<OverlayState>({ show: false, type: 'info' });
  public overlay$ = this.stateSubject.asObservable();

  showOverlay(
    type: OverlayType,
    message?: string,
    payload?: unknown,
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
