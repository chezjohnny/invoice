import { Component, inject } from '@angular/core';
import { NotificationService } from '../core/notifications/notification.service';

@Component({
  selector: 'app-toasts',
  template: `
    <div class="toast toast-end toast-bottom z-50">
      @for (n of notify.notifications(); track n.id) {
        <div
          class="alert shadow-lg"
          [class.alert-error]="n.kind === 'error'"
          [class.alert-success]="n.kind === 'success'"
          [class.alert-warning]="n.kind === 'warning'"
          [class.alert-info]="n.kind === 'info'"
          role="alert"
        >
          <span class="text-sm">{{ n.message }}</span>
          <button
            class="btn btn-ghost btn-xs btn-square"
            (click)="notify.dismiss(n.id)"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class Toasts {
  protected readonly notify = inject(NotificationService);
}
