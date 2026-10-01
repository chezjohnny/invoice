import { Component, computed, input } from '@angular/core';

// Heroicons (outline, MIT), inlined to avoid an icon dependency for a handful of glyphs.
const PATHS = {
  edit: 'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10',
  archive: 'm20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z',
  restore: 'M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3',
  issue: 'M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5',
  cancel: 'm9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  delete: 'm14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',
} as const;

// Not an outline glyph: a sheet with a red "PDF" badge, the generic file-type
// icon (Adobe's Acrobat logo is a trademark reserved for its own products).
export type IconName = keyof typeof PATHS | 'pdf';

@Component({
  selector: 'app-icon',
  host: { class: 'inline-flex', 'aria-hidden': 'true' },
  template: `
    @if (name() === 'pdf') {
      <svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24">
        <path d="M14 2.75H6.75A1.75 1.75 0 0 0 5 4.5v15a1.75 1.75 0 0 0 1.75 1.75h10.5A1.75 1.75 0 0 0 19 19.5V7.75Zm0 0v5h5"
          fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
        <rect x="1.5" y="11.5" width="17" height="8.5" rx="1.5" style="fill: var(--color-error)" />
        <text x="10" y="18.1" text-anchor="middle" font-size="7" font-weight="700"
          font-family="ui-sans-serif, system-ui, sans-serif" style="fill: var(--color-error-content)">PDF</text>
      </svg>
    } @else {
      <svg xmlns="http://www.w3.org/2000/svg" class="size-4" fill="none" viewBox="0 0 24 24"
        stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" [attr.d]="path()" />
      </svg>
    }
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();

  protected readonly path = computed(() => {
    const name = this.name();
    return name === 'pdf' ? '' : PATHS[name];
  });
}
