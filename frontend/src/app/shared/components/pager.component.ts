import { Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';

const WINDOW = 5;

/**
 * The page buttons to show: centred on the current page, but shifted near
 * either end so that there are always WINDOW of them when there are that many pages.
 */
export function pageWindow(page: number, pages: number): number[] {
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), pages - WINDOW + 1));
  const end = Math.min(pages, start + WINDOW - 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/** First/last plus a window of 5 page buttons around the current page; hidden on a single page. */
@Component({
  selector: 'app-pager',
  template: `
    @if (pages() > 1) {
      <div class="flex justify-center mt-4">
        <div class="join">
          <button type="button" class="join-item btn btn-sm"
            [disabled]="page() === 1" [title]="t().common.firstPage" [attr.aria-label]="t().common.firstPage"
            (click)="pageChange.emit(1)">«</button>
          @for (p of range(); track p) {
            <button type="button" class="join-item btn btn-sm"
              [class.btn-active]="page() === p"
              (click)="pageChange.emit(p)">{{ p }}</button>
          }
          <button type="button" class="join-item btn btn-sm"
            [disabled]="page() === pages()" [title]="t().common.lastPage" [attr.aria-label]="t().common.lastPage"
            (click)="pageChange.emit(pages())">»</button>
        </div>
      </div>
    }
  `,
})
export class PagerComponent {
  readonly page = input.required<number>();
  readonly pages = input.required<number>();
  readonly pageChange = output<number>();

  protected readonly t = inject(I18nService).T;

  protected readonly range = computed(() => pageWindow(this.page(), this.pages()));
}
