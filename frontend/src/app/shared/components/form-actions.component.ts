import { Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * A form's buttons, stuck to the bottom of the screen within thumb reach on a
 * phone: cancel, any projected extra action, then submit. Place it inside the form.
 */
@Component({
  selector: 'app-form-actions',
  host: {
    class: 'sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 mt-6 py-3 bg-base-100 border-t border-base-200',
  },
  template: `
    <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">{{ t().common.cancel }}</button>
    <ng-content />
    <button type="submit" class="btn btn-primary">{{ submitLabel() ?? t().common.save }}</button>
  `,
})
export class FormActionsComponent {
  /** Defaults to "Save". */
  readonly submitLabel = input<string>();
  readonly cancelled = output<void>();

  protected readonly t = inject(I18nService).T;
}
