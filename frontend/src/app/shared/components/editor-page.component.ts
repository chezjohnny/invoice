import { Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/**
 * The frame of a form page: back button, spinner while loading, then the form,
 * full width on a phone and as a card on a wider screen.
 */
@Component({
  selector: 'app-editor-page',
  template: `
    <div class="p-4 md:p-6 mx-auto" [class]="wide() ? 'max-w-3xl' : 'max-w-2xl'">
      <button type="button" class="btn btn-ghost btn-sm mb-4 -ml-2" (click)="back.emit()">
        ← {{ t().common.back }}
      </button>
      @if (loading()) {
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      } @else {
        <div class="md:card md:bg-base-100 md:shadow md:p-6">
          <ng-content />
        </div>
      }
    </div>
  `,
})
export class EditorPageComponent {
  readonly loading = input(false);
  /** Room for a table of lines, as on the invoice. */
  readonly wide = input(false);
  readonly back = output<void>();

  protected readonly t = inject(I18nService).T;
}
