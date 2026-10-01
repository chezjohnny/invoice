import { Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

/** Page buttons around the current page, plus the total; hidden on a single page. */
@Component({
  selector: 'app-pager',
  template: `
    @if (pages() > 1) {
      <div class="flex justify-center items-center gap-4 mt-4">
        <div class="join">
          @for (p of range(); track p) {
            <button type="button" class="join-item btn btn-sm"
              [class.btn-active]="page() === p"
              (click)="pageChange.emit(p)">{{ p }}</button>
          }
        </div>
        <span class="text-sm text-base-content/50">
          {{ total() }} {{ t().common.results }}
        </span>
      </div>
    }
  `,
})
export class PagerComponent {
  readonly page = input.required<number>();
  readonly pages = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  protected readonly t = inject(I18nService).T;

  protected readonly range = computed(() => {
    const range: number[] = [];
    const last = Math.min(this.pages(), this.page() + 2);
    for (let p = Math.max(1, this.page() - 2); p <= last; p++) range.push(p);
    return range;
  });
}
