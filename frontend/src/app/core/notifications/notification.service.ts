import { Injectable, signal } from '@angular/core';

export type NotificationKind = 'error' | 'success' | 'info' | 'warning';

export interface Notification {
  id: number;
  kind: NotificationKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private seq = 0;
  readonly notifications = signal<Notification[]>([]);

  error(message: string): void {
    this.push('error', message, 7000);
  }

  success(message: string): void {
    this.push('success', message, 4000);
  }

  info(message: string): void {
    this.push('info', message, 4000);
  }

  dismiss(id: number): void {
    this.notifications.update((list) => list.filter((n) => n.id !== id));
  }

  private push(kind: NotificationKind, message: string, timeoutMs: number): void {
    const id = ++this.seq;
    this.notifications.update((list) => [...list, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), timeoutMs);
  }
}
