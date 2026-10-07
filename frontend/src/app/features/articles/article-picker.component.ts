import { CurrencyPipe } from '@angular/common';
import { Component, booleanAttribute, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { AutofocusDirective } from '../../shared/autofocus.directive';
import { inputValue } from '../../shared/events';
import { searchKey } from '../../shared/search-key';
import { Article } from './article.model';

// A short list to scan; the rest is counted, to tell when to type more.
const MAX_RESULTS = 10;
let nextId = 0;

/**
 * Finds an article by typing part of its name: the matches show with their
 * price and stock, to pick with the mouse or the keyboard (arrows, Enter,
 * Escape). Each pick is emitted and the box emptied, ready for the next one.
 */
@Component({
  selector: 'app-article-picker',
  imports: [AutofocusDirective, CurrencyPipe],
  host: { class: 'block relative' },
  template: `
    <input class="input w-full" type="text" role="combobox" autocomplete="off"
      [id]="inputId()" [appAutofocus]="autofocus()"
      [class.input-error]="invalid()" [attr.aria-invalid]="invalid()"
      aria-autocomplete="list" [attr.aria-controls]="listId"
      [attr.aria-label]="placeholder()" [placeholder]="placeholder()"
      [attr.aria-expanded]="open()"
      [attr.aria-activedescendant]="open() ? listId + '-' + active() : null"
      [value]="query()"
      (input)="onInput(inputValue($event))" (keydown)="onKey($event)"
      (focus)="focused.set(true)" (blur)="focused.set(false)" />
    @if (open()) {
      <div class="absolute z-50 w-full bg-base-100 border border-base-300 rounded-box shadow-lg mt-1 overflow-hidden">
        <ul [id]="listId" role="listbox" class="max-h-60 overflow-y-auto">
          @for (a of results(); track a.id; let k = $index) {
            <li role="option" [id]="listId + '-' + k" [attr.aria-selected]="k === active()"
              class="px-3 py-2 cursor-pointer text-sm flex justify-between gap-2"
              [class.bg-base-200]="k === active()"
              (mouseenter)="active.set(k)"
              (mousedown)="$event.preventDefault(); pick(a)">
              <span class="truncate">{{ a.name }}</span>
              <span class="text-base-content/50 text-xs shrink-0 tabular-nums">
                {{ a.unitPrice | currency:'CHF':'code':'1.2-2' }} · {{ a.stockQuantity }}
              </span>
            </li>
          }
        </ul>
        <!-- Outside the scrolling list: always in sight -->
        @if (more() > 0) {
          <p [id]="listId + '-more'" class="px-3 py-1.5 text-xs text-base-content/50 border-t border-base-200">
            {{ (more() === 1 ? t().articles.moreArticle : t().articles.moreArticles).replace('{count}', '' + more()) }}
          </p>
        }
      </div>
    }
  `,
})
export class ArticlePickerComponent {
  readonly articles = input<Article[]>([]);
  readonly placeholder = input.required<string>();
  /** For a <label for>. */
  readonly inputId = input<string | null>(null);
  readonly autofocus = input(false, { transform: booleanAttribute });
  readonly invalid = input(false);
  readonly picked = output<Article>();

  protected readonly t = inject(I18nService).T;
  protected readonly inputValue = inputValue;
  protected readonly listId = `article-picker-${nextId++}`;

  protected readonly query = signal('');
  protected readonly focused = signal(false);
  protected readonly active = signal(0);
  private readonly matches = computed(() => {
    const words = searchKey(this.query()).split(' ').filter(Boolean);
    if (words.length === 0) return [];
    return this.articles().filter((a) => words.every((w) => searchKey(a.name).includes(w)));
  });
  protected readonly results = computed(() => this.matches().slice(0, MAX_RESULTS));
  /** Matching articles left out of the list. */
  protected readonly more = computed(() => this.matches().length - this.results().length);
  protected readonly open = computed(() => this.focused() && this.results().length > 0);

  protected onInput(value: string): void {
    this.query.set(value);
    this.active.set(0);
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.results().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.active.update((k) => Math.min(k + 1, count - 1));
        this.revealActive();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.active.update((k) => Math.max(k - 1, 0));
        this.revealActive();
        break;
      case 'Enter':
        // Never submits the form around: Enter picks the article.
        event.preventDefault();
        if (count > 0) this.pick(this.results()[this.active()]);
        break;
      case 'Escape':
        this.query.set('');
        break;
    }
  }

  protected pick(article: Article): void {
    this.picked.emit(article);
    this.query.set('');
    this.active.set(0);
  }

  // The list scrolls: keep the option chosen with the arrows in sight.
  private revealActive(): void {
    document.getElementById(`${this.listId}-${this.active()}`)?.scrollIntoView({ block: 'nearest' });
  }
}
