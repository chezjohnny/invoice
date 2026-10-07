import { Component, computed, inject, input } from '@angular/core';
import { FieldTree } from '@angular/forms/signals';
import { I18nService } from '../../core/i18n/i18n.service';
import { showsError } from '../form-errors';

/** The first error of a field, under it, once shown (see showsError). */
@Component({
  selector: 'app-field-error',
  template: `
    @if (message(); as text) {
      <p class="fieldset-label text-error mt-1">{{ text }}</p>
    }
  `,
})
export class FieldErrorComponent {
  readonly field = input.required<FieldTree<unknown>>();

  private readonly t = inject(I18nService).T;

  protected readonly message = computed(() => {
    if (!showsError(this.field())) return null;
    // A number field holding text has a parse error without a message of ours.
    return this.field()().errors()[0]?.message ?? this.t().common.invalidValue;
  });
}
