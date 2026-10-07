import { Directive, model, output } from '@angular/core';
import { FormValueControl, transformedValue } from '@angular/forms/signals';

const DECIMAL = /^-?(\d+([.,]\d*)?|[.,]\d+)$/;

/** "12,50", "12.5", "1'250.50" → a number; "" → null; anything else → undefined. */
export function parseDecimal(text: string): number | null | undefined {
  const compact = text.replace(/[\s']/g, '');
  if (compact === '') return null;
  return DECIMAL.test(compact) ? Number(compact.replace(',', '.')) : undefined;
}

/**
 * A price or a percent typed as text: a comma is a decimal point, as people
 * type it here, and there are no spinner arrows, which make no sense for an
 * amount. A number input would turn "12,50" into nothing in some browsers.
 */
@Directive({
  selector: 'input[appDecimal]',
  host: {
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    '[value]': 'raw()',
    '(input)': 'raw.set($any($event.target).value)',
    '(blur)': 'touch.emit()',
  },
})
export class DecimalInputDirective implements FormValueControl<number | null> {
  readonly value = model<number | null>(null);
  readonly touch = output<void>();

  protected readonly raw = transformedValue(this.value, {
    parse: (text: string) => {
      const value = parseDecimal(text);
      return value === undefined ? { error: { kind: 'parse' } } : { value };
    },
    format: (value) => (value == null ? '' : String(value)),
  });
}
