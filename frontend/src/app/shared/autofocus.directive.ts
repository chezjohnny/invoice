import { Directive, ElementRef, afterEveryRender, booleanAttribute, inject, input } from '@angular/core';

/**
 * Puts the cursor in this field once the page shows it. Only with a mouse or a
 * trackpad: on a phone, focusing opens the keyboard over half the screen.
 */
@Directive({ selector: '[appAutofocus]' })
export class AutofocusDirective {
  readonly appAutofocus = input(true, { transform: booleanAttribute });

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // Not the first render: a form projected into the editor page is created at
    // once but only enters the document when its data has loaded.
    const watch = afterEveryRender(() => {
      if (!element.isConnected) return;
      watch.destroy();
      if (this.appAutofocus() && globalThis.matchMedia?.('(pointer: fine)').matches) {
        element.focus();
      }
    });
  }
}
