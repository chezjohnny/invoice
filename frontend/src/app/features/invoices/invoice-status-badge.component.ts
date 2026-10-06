import { Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { InvoiceStatus } from './invoice.model';

const BADGE: Record<InvoiceStatus, string> = {
  draft: 'badge-neutral', issued: 'badge-info', paid: 'badge-success', cancelled: 'badge-error',
};

/** An invoice status as a soft colored badge, in the UI language. */
@Component({
  selector: 'app-invoice-status-badge',
  template: `<span class="badge badge-sm badge-soft" [class]="badge()">{{ t().status[status()] }}</span>`,
})
export class InvoiceStatusBadgeComponent {
  readonly status = input.required<InvoiceStatus>();

  protected readonly t = inject(I18nService).T;
  protected readonly badge = computed(() => BADGE[this.status()]);
}
