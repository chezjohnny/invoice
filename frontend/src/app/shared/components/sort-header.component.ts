import { Component, computed, input, output } from '@angular/core';
import { Sort } from '../sort';

/** Sortable column header: `<th appSortHeader="name" [sort]="store.sort()" (sortChange)="…">`. */
@Component({
  selector: 'th[appSortHeader]',
  host: { '[attr.aria-sort]': 'ariaSort()' },
  template: `
    <button type="button" class="group inline-flex items-center gap-1 cursor-pointer hover:text-base-content"
      (click)="sortChange.emit(appSortHeader())">
      <ng-content />
      <span class="text-[0.6rem]" aria-hidden="true"
        [class.opacity-0]="!active()" [class.group-hover:opacity-30]="!active()">
        {{ active()?.order === 'desc' ? '▼' : '▲' }}
      </span>
    </button>
  `,
})
export class SortHeaderComponent {
  readonly appSortHeader = input.required<string>();
  readonly sort = input.required<Sort | null>();
  readonly sortChange = output<string>();

  protected readonly active = computed(() => {
    const sort = this.sort();
    return sort?.key === this.appSortHeader() ? sort : null;
  });

  protected readonly ariaSort = computed(() => {
    const active = this.active();
    if (!active) return 'none';
    return active.order === 'asc' ? 'ascending' : 'descending';
  });
}
