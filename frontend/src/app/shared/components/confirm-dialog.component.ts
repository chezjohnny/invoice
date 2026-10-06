import { Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/** Modal asking to confirm an action, destructive by default; render it with `@if` while pending. */
@Component({
  selector: 'app-confirm-dialog',
  // On the document: the button that opened the dialog keeps the focus.
  host: { '(document:keydown.escape)': 'cancelled.emit()' },
  template: `
    <dialog class="modal modal-open">
      <div class="modal-box max-w-sm">
        <h3 class="text-lg font-semibold">{{ title() }}</h3>
        <p class="py-4 text-sm text-base-content/70">{{ message() }}</p>
        <div class="modal-action">
          <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">
            {{ t().common.cancel }}
          </button>
          <button type="button" class="btn" [class]="confirmClass()" (click)="confirmed.emit()">
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
      <button type="button" class="modal-backdrop" tabindex="-1" [attr.aria-label]="t().common.cancel"
        (click)="cancelled.emit()"></button>
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input.required<string>();
  /** Red by default: most confirmations guard a destructive action. */
  readonly confirmClass = input('btn-error');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly t = inject(I18nService).T;
}
