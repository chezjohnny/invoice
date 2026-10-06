import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  function render() {
    TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
      providers: [provideZonelessChangeDetection()],
    });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput('title', 'Delete');
    fixture.componentRef.setInput('message', 'Sure?');
    fixture.componentRef.setInput('confirmLabel', 'Delete');
    fixture.detectChanges();
    const cancelled = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelled);
    return { element: fixture.nativeElement as HTMLElement, cancelled };
  }

  it('cancels on Escape while the focus is still outside the dialog', () => {
    const { cancelled } = render();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(cancelled).toHaveBeenCalledOnce();
  });

  it('cancels on a click on the backdrop', () => {
    const { element, cancelled } = render();
    element.querySelector<HTMLButtonElement>('.modal-backdrop')!.click();
    expect(cancelled).toHaveBeenCalledOnce();
  });
});
