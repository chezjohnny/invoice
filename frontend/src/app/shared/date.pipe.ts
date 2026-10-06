import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';
import { formatShortDate } from './dates';

/**
 * An ISO date in the short natural form of the UI language: `{{ inv.dueDate | naturalDate }}`.
 * Impure so that it follows a language switch; null shows a dash.
 */
@Pipe({ name: 'naturalDate', pure: false })
export class NaturalDatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(isoDate: string | null | undefined): string {
    return isoDate ? formatShortDate(isoDate, this.i18n.locale()) : '—';
  }
}
