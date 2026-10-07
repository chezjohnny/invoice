import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AutofocusDirective } from './autofocus.directive';

@Component({
  imports: [AutofocusDirective],
  template: `<input id="field" [appAutofocus]="enabled()" />`,
})
class HostComponent {
  readonly enabled = signal(true);
}

describe('AutofocusDirective', () => {
  async function render(pointer: 'fine' | 'coarse', enabled = true): Promise<HTMLElement> {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === `(pointer: ${pointer})` }));
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.enabled.set(enabled);
    await fixture.whenStable();
    return fixture.nativeElement.querySelector('#field');
  }

  afterEach(() => vi.unstubAllGlobals());

  it('focuses the field with a mouse or a trackpad', async () => {
    const field = await render('fine');
    expect(document.activeElement).toBe(field);
  });

  it('leaves it alone on a touch screen, where the keyboard would cover the page', async () => {
    const field = await render('coarse');
    expect(document.activeElement).not.toBe(field);
  });

  it('can be turned off', async () => {
    const field = await render('fine', false);
    expect(document.activeElement).not.toBe(field);
  });
});
