import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchInputComponent } from './search-input.component';

describe('SearchInputComponent', () => {
  let fixture: ComponentFixture<SearchInputComponent>;
  let emitted: string[];
  const box = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [SearchInputComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(SearchInputComponent);
    fixture.componentRef.setInput('placeholder', 'Search');
    emitted = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  function type(text: string): void {
    box().value = text;
    box().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('keeps a space just typed when the trimmed search comes back', () => {
    type('pinot ');
    vi.advanceTimersByTime(300);
    expect(emitted).toEqual(['pinot']);

    // The list echoes the search back, trimmed, as the URL does.
    fixture.componentRef.setInput('value', 'pinot');
    fixture.detectChanges();
    expect(box().value).toBe('pinot ');
  });

  it('takes a different search from outside, e.g. back in the browser', () => {
    type('pinot ');
    fixture.componentRef.setInput('value', 'gamay');
    fixture.detectChanges();
    expect(box().value).toBe('gamay');
  });

  it('waits for 3 characters, unless Enter is pressed', () => {
    type('pi');
    vi.advanceTimersByTime(300);
    expect(emitted).toEqual([]);

    box().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(emitted).toEqual(['pi']);

    type('pin');
    vi.advanceTimersByTime(300);
    expect(emitted).toEqual(['pi', 'pin']);
  });

  it('clears the search at once when the box is emptied', () => {
    type('pinot');
    vi.advanceTimersByTime(300);
    type('');
    expect(emitted).toEqual(['pinot', '']);
  });

  it('emits nothing once destroyed mid-typing', () => {
    type('pino');
    fixture.destroy();
    vi.advanceTimersByTime(300);
    expect(emitted).toEqual([]);
  });
});
