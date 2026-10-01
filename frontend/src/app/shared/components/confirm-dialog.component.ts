import { Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/** Modal asking to confirm a destructive action; render it with `@if` while pending. */
@Component({
  selector: 'app-confirm-dialog',
  template: `
    <dialog class="modal modal-open" (keydown.escape)="cancelled.emit()">
      <div class="modal-box max-w-sm">
        <h3 class="text-lg font-semibold">{{ title() }}</h3>
        <p class="py-4 text-sm text-base-content/70">{{ message() }}</p>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">
            {{ t().common.cancel }}
          </button>
          <button type="button" class="btn btn-error" (click)="confirmed.emit()">
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" (click)="cancelled.emit()"></div>
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input.required<string>();
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly t = inject(I18nService).T;
}
