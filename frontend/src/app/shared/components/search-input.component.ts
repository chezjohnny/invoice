import { Component, DestroyRef, booleanAttribute, inject, input, linkedSignal, output } from '@angular/core';
import { inputValue } from '../events';
import { AutofocusDirective } from '../autofocus.directive';

// One or two letters match too much to be worth a reload of the list.
const MIN_LENGTH = 3;

/**
 * List search box, the first item of a view's filter row. It searches once typing
 * pauses and at least MIN_LENGTH characters are typed, at once on Enter, and
 * clears the search as soon as the box is emptied.
 */
@Component({
  selector: 'app-search-input',
  imports: [AutofocusDirective],
  host: { class: 'w-full sm:max-w-xs' },
  template: `
    <label class="input w-full flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-40 shrink-0" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11"/>
      </svg>
      <input type="text" autocomplete="off" [placeholder]="placeholder()" [value]="text()" [appAutofocus]="autofocus()" (input)="onInput($event)"
        (keydown.enter)="search(text())" />
    </label>
  `,
})
export class SearchInputComponent {
  readonly placeholder = input.required<string>();
  readonly value = input('');
  /** A list's own search, ready to type into when the page opens. */
  readonly autofocus = input(false, { transform: booleanAttribute });
  readonly valueChange = output<string>();

  // What is typed. The search comes back trimmed: while it still matches, the
  // text is kept as typed, or a space just typed ("pinot ") would be erased.
  protected readonly text = linkedSignal<string, string>({
    source: this.value,
    computation: (value, previous) =>
      previous !== undefined && previous.value.trim() === value ? previous.value : value,
  });

  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  protected onInput(event: Event): void {
    const value = inputValue(event);
    this.text.set(value);
    clearTimeout(this.timer);
    const length = value.trim().length;
    if (length === 0) this.search(value);
    else if (length >= MIN_LENGTH) this.timer = setTimeout(() => this.search(value), 300);
  }

  protected search(value: string): void {
    clearTimeout(this.timer);
    this.valueChange.emit(value.trim());
  }
}
