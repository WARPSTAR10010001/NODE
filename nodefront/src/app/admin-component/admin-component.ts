import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, map, of, Subject, switchMap, takeUntil } from 'rxjs';

import { OverlayService } from '../overlay-service';
import { LdapUser, UserRecord, UserService } from '../user-service';

type ActivationFilter = 'pending' | 'active';
type RoleFilter = '' | '0' | '1' | '2';
type RoleValue = 0 | 1 | 2;
const ADMIN_REVIEWED_AT_KEY = 'node.admin.lastApprovalReviewAt';

type UserRow = UserRecord & {
  displayName: string;
  activationDraft: 'true' | 'false';
  roleDraft: '0' | '1' | '2';
  originalActivation: 'true' | 'false';
  originalRole: '0' | '1' | '2';
  saving: boolean;
};

@Component({
  selector: 'app-admin-component',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-component.html',
  styleUrl: './admin-component.css',
})
export class AdminComponent implements OnInit, OnDestroy {
  users: UserRow[] = [];
  filteredUsers: UserRow[] = [];
  loading = true;
  searchTerm = '';
  activationFilter: ActivationFilter = 'pending';
  roleFilter: RoleFilter = '';
  private readonly dateFormatter = new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  private readonly destroy$ = new Subject<void>();

  constructor(
    private userService: UserService,
    private overlay: OverlayService
  ) {}

  ngOnInit(): void {
    this.markApprovalRequestsAsReviewed();
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(): void {
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  onActivationFilterChange(value: ActivationFilter): void {
    this.activationFilter = value;
    if (value !== 'active') {
      this.roleFilter = '';
    }
    this.applyFilters();
  }

  onRoleFilterChange(value: RoleFilter): void {
    this.roleFilter = value;
    this.applyFilters();
  }

  saveUser(user: UserRow): void {
    if (user.saving || !this.hasPendingChanges(user)) return;

    const activated = user.activationDraft === 'true';
    const role = Number(user.roleDraft) as RoleValue;

    user.saving = true;

    forkJoin({
      activation: this.userService.setActivation(user.id, activated),
      role: this.userService.updateRole(user.id, role)
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ activation, role: roleResponse }) => {
          user.isActivated = activation.user.isActivated;
          user.role = roleResponse.user.role;
          user.activationDraft = String(user.isActivated) as 'true' | 'false';
          user.roleDraft = String(user.role) as '0' | '1' | '2';
          user.originalActivation = user.activationDraft;
          user.originalRole = user.roleDraft;
          user.saving = false;
          this.applyFilters();
          this.overlay.showOverlay('success', 'Nutzer wurde gespeichert.');
        },
        error: (error) => {
          user.saving = false;
          console.error('Save user failed', error);
          this.overlay.showOverlay('error', this.extractApiError(error) || 'Nutzer konnte nicht gespeichert werden.');
        }
      });
  }

  trackByUserId(_index: number, user: UserRow): number {
    return user.id;
  }

  userLabel(user: UserRow): string {
    const shortUsername = this.toShortUsername(user.username);
    return user.displayName
      ? `${user.displayName} (${shortUsername})`
      : shortUsername;
  }

  statusLabel(user: UserRow): string {
    if (!user.isActivated) {
      return 'Nicht freigeschaltet';
    }

    return `Freigeschaltet (${this.roleLabel(user.role)})`;
  }

  formatLastLogin(value?: string): string {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : this.dateFormatter.format(date);
  }

  hasPendingChanges(user: UserRow): boolean {
    return user.activationDraft !== user.originalActivation
      || user.roleDraft !== user.originalRole;
  }

  get hasUsers(): boolean {
    return this.filteredUsers.length > 0;
  }

  private roleLabel(role: number): string {
    switch (role) {
      case 2:
        return 'Admin';
      case 1:
        return 'Editor';
      default:
        return 'Viewer';
    }
  }

  private loadUsers(): void {
    this.loading = true;

    this.userService.getUsers()
      .pipe(
        switchMap((users) => this.enrichUsers(users)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (users) => {
          this.users = users;
          this.applyFilters();
          this.loading = false;
        },
        error: (error) => {
          console.error('Load users failed', error);
          this.loading = false;
          this.overlay.showOverlay('error', 'Nutzer konnten nicht geladen werden.');
        }
      });
  }

  private enrichUsers(users: UserRecord[]) {
    const uniqueUsernames = users
      .map((user) => user.username)
      .filter((value, index, array) => array.indexOf(value) === index);

    if (uniqueUsernames.length === 0) {
      return of([] as UserRow[]);
    }

    return forkJoin(
      uniqueUsernames.map((username) =>
        this.userService.searchLdap(this.toShortUsername(username)).pipe(
          map((results) => ({
            username,
            displayName: this.findExactDisplayName(results, username)
          }))
        )
      )
    ).pipe(
      map((entries) => {
        const displayNameMap = new Map<string, string>();
        entries.forEach((entry) => {
          if (entry.displayName) {
            displayNameMap.set(entry.username, entry.displayName);
          }
        });

        return users.map((user) => ({
          ...user,
          displayName: displayNameMap.get(user.username) || '',
          activationDraft: String(user.isActivated) as 'true' | 'false',
          roleDraft: String(user.role) as '0' | '1' | '2',
          originalActivation: String(user.isActivated) as 'true' | 'false',
          originalRole: String(user.role) as '0' | '1' | '2',
          saving: false
        }));
      })
    );
  }

  private findExactDisplayName(results: LdapUser[], username: string): string {
    const shortUsername = this.toShortUsername(username);
    const exactMatch = results.find((result) => result.username.toLowerCase() === shortUsername.toLowerCase());
    return exactMatch?.displayName?.trim() || '';
  }

  private toShortUsername(username: string): string {
    return String(username || '').split('@')[0].trim().toLowerCase();
  }

  private applyFilters(): void {
    const search = this.searchTerm.trim().toLowerCase();

    this.filteredUsers = this.users.filter((user) => {
      if (!user.previouslyLoggedIn) {
        return false;
      }

      const activationMatches = this.activationFilter === 'pending'
        ? !user.isActivated
        : user.isActivated;

      if (!activationMatches) return false;

      if (this.activationFilter === 'active' && this.roleFilter && String(user.role) !== this.roleFilter) {
        return false;
      }

      if (!search) {
        return true;
      }

      return user.username.toLowerCase().includes(search)
        || user.displayName.toLowerCase().includes(search);
    });
  }

  private extractApiError(error: unknown): string | null {
    if (typeof error !== 'object' || error === null || !('error' in error)) return null;
    const candidate = (error as { error?: unknown }).error;
    if (typeof candidate === 'string') return candidate;
    if (typeof candidate === 'object' && candidate !== null && 'error' in candidate) {
      const nested = (candidate as { error?: unknown }).error;
      return typeof nested === 'string' ? nested : null;
    }
    return null;
  }

  private markApprovalRequestsAsReviewed(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(ADMIN_REVIEWED_AT_KEY, new Date().toISOString());
  }
}
