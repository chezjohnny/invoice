import { Component, input, output } from '@angular/core';

/** List search box, the first item of a view's filter row; emits once typing pauses. */
@Component({
  selector: 'app-search-input',
  host: { class: 'w-full sm:max-w-xs' },
  template: `
    <label class="input w-full flex items-center gap-2">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-40 shrink-0" viewBox="0 0 16 16">
        <path fill-rule="evenodd" d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11"/>
      </svg>
      <input type="text" [placeholder]="placeholder()" [value]="value()" (input)="onInput($event)" />
    </label>
  `,
})
export class SearchInputComponent {
  readonly placeholder = input.required<string>();
  readonly value = input('');
  readonly search = output<string>();

  private timer?: ReturnType<typeof setTimeout>;

  protected onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.search.emit(value.trim()), 300);
  }
}
