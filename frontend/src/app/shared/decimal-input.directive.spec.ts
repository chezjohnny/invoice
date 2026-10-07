import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField, form } from '@angular/forms/signals';
import { DecimalInputDirective, parseDecimal } from './decimal-input.directive';

describe('parseDecimal', () => {
  it('reads a comma or a point, and Swiss thousands', () => {
    expect(['12,50', '12.5', ' 12,5 ', ",5", "1'250.50", '1 250,50'].map(parseDecimal))
      .toEqual([12.5, 12.5, 12.5, 0.5, 1250.5, 1250.5]);
    expect(parseDecimal('')).toBeNull();
  });

  it('refuses what is not a number', () => {
    expect(['abc', '12,5,0', '1.2.3', ',', '12a'].map(parseDecimal)).toEqual([undefined, undefined, undefined, undefined, undefined]);
  });
});

@Component({
  imports: [DecimalInputDirective, FormField],
  template: `<input appDecimal [formField]="priceForm.price" />`,
})
class PriceHost {
  readonly model = signal<{ price: number | null }>({ price: 20 });
  readonly priceForm = form(this.model);
}

describe('DecimalInputDirective', () => {
  let fixture: ComponentFixture<PriceHost>;
  const input = () => fixture.nativeElement.querySelector('input') as HTMLInputElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(PriceHost);
    await fixture.whenStable();
  });

  async function type(text: string): Promise<void> {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  it('is a text field without arrows, showing the model', () => {
    expect(input().type).toBe('text');
    expect(input().inputMode).toBe('decimal');
    expect(input().value).toBe('20');
  });

  it('keeps what is typed and gives the model a number', async () => {
    await type('12,5');
    expect(fixture.componentInstance.model().price).toBe(12.5);
    expect(input().value).toBe('12,5');
    await type('');
    expect(fixture.componentInstance.model().price).toBeNull();
  });

  it('makes the field invalid on text, the model unchanged', async () => {
    await type('12,5');
    await type('douze');
    expect(fixture.componentInstance.model().price).toBe(12.5);
    expect(fixture.componentInstance.priceForm.price().invalid()).toBe(true);
  });

  it('shows a value set from the code', async () => {
    fixture.componentInstance.model.set({ price: 7.8 });
    await fixture.whenStable();
    expect(input().value).toBe('7.8');
  });
});
