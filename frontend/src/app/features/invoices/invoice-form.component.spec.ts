import { provideZonelessChangeDetection } from '@angular/core';
import { CdkDropList } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Article } from '../articles/article.model';
import { Customer } from '../customers/customer.model';
import { Invoice, InvoiceCreate, InvoiceLine } from './invoice.model';
import { InvoiceFormComponent } from './invoice-form.component';

const CUSTOMER: Customer = {
  id: 'c1', firstName: 'Jean', lastName: 'Dupont', addressLine1: '', addressLine2: null,
  postalCode: '', city: '', country: 'CH', email: null, phones: [], isArchived: false,
};

function article(id: string, name: string, vatRateOverride: number | null = null): Article {
  return { id, name, description: '', unitPrice: 20, vatRateOverride, stockQuantity: 10, isArchived: false };
}

describe('InvoiceFormComponent article picker', () => {
  let fixture: ComponentFixture<InvoiceFormComponent>;
  let saved: InvoiceCreate[];

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [InvoiceFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: INVOICE_SERVICE, useValue: { list: async () => ({ items: [] }) } },
      ],
    });
    fixture = TestBed.createComponent(InvoiceFormComponent);
    fixture.componentRef.setInput('customer', CUSTOMER);
    fixture.componentRef.setInput('articles', [article('a1', 'Pinot Noir'), article('a2', 'Chasselas', 0.026)]);
    fixture.componentRef.setInput('defaultVatRate', 0.081);
    saved = [];
    fixture.componentInstance.saved.subscribe((data) => saved.push(data));
    await fixture.whenStable();
  });

  const picker = () => fixture.nativeElement.querySelector('[role="combobox"]') as HTMLInputElement;

  async function type(text: string): Promise<void> {
    picker().dispatchEvent(new Event('focus'));
    picker().value = text;
    picker().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function press(key: string): Promise<void> {
    picker().dispatchEvent(new KeyboardEvent('keydown', { key }));
    await fixture.whenStable();
  }

  async function save(): Promise<InvoiceCreate> {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    return saved[saved.length - 1];
  }

  it('adds the article picked with the keyboard, with its own or the default VAT', async () => {
    await type('chass');
    await press('Enter');
    await type('pinot');
    const options = fixture.nativeElement.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);
    (options[0] as HTMLElement).dispatchEvent(new MouseEvent('mousedown'));
    await fixture.whenStable();

    expect(picker().value).toBe('');
    const lines = (await save()).lines;
    expect(lines.map((l) => [l.articleId, l.vatRateSnapshot])).toEqual([['a2', 0.026], ['a1', 0.081]]);
  });

  it('lists 10 articles at most and counts the others', async () => {
    const many = Array.from({ length: 13 }, (_, i) => article(`v${i}`, `Fendant ${2010 + i}`));
    fixture.componentRef.setInput('articles', many);
    await type('fendant');
    expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(10);
    expect(fixture.nativeElement.querySelector('[id$="-more"]').textContent).toContain('3');
  });

  it('raises the quantity of an article picked again', async () => {
    for (let i = 0; i < 2; i++) {
      await type('pinot');
      await press('Enter');
    }
    const lines = (await save()).lines;
    expect(lines.length).toBe(1);
    expect(lines[0].quantity).toBe(2);
  });

  it('adds a free-text line from its button, at the default VAT, which needs a description, its price typed with a comma', async () => {
    const button = [...fixture.nativeElement.querySelectorAll('button')]
      .find((b: HTMLButtonElement) => b.textContent?.includes('+')) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    await save();
    expect(saved.length).toBe(0);

    const description = fixture.nativeElement.querySelector('input[type="text"]:not([role])') as HTMLInputElement;
    description.value = 'Livraison';
    description.dispatchEvent(new Event('input'));
    const price = fixture.nativeElement.querySelector('input[inputmode="decimal"]') as HTMLInputElement;
    price.value = '15,50';
    price.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const lines = (await save()).lines;
    expect(lines).toEqual([
      { articleId: null, descriptionSnapshot: 'Livraison', quantity: 1, unitPriceSnapshot: 15.5, vatRateSnapshot: 0.081, offered: false },
    ]);
  });

  it('offers bottles of an article on a line of their own, at 0 without VAT, and takes them back', async () => {
    await type('pinot');
    await press('Enter');
    const element = fixture.nativeElement as HTMLElement;
    const quantities = () => [...element.querySelectorAll<HTMLInputElement>('input[type="number"]')];
    quantities()[0].value = '12';
    quantities()[0].dispatchEvent(new Event('input'));
    const gift = () => element.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    expect(gift().getAttribute('aria-pressed')).toBe('false');
    gift().click();
    await fixture.whenStable();
    expect(gift().getAttribute('aria-pressed')).toBe('true');

    // The offered row has its own quantity, and neither price nor VAT to edit.
    expect(quantities().map((q) => q.value)).toEqual(['12', '1']);
    expect(element.querySelectorAll('input[inputmode="decimal"]').length).toBe(3); // the sold price and VAT, the discount
    quantities()[1].value = '2';
    quantities()[1].dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(quantities().map((q) => q.value)).toEqual(['12', '2']);
    // Picked again, it is sold, not offered.
    await type('pinot');
    await press('Enter');

    expect((await save()).lines).toEqual([
      { articleId: 'a1', descriptionSnapshot: 'Pinot Noir', quantity: 13, unitPriceSnapshot: 20, vatRateSnapshot: 0.081, offered: false },
      { articleId: 'a1', descriptionSnapshot: 'Pinot Noir', quantity: 2, unitPriceSnapshot: 0, vatRateSnapshot: null, offered: true },
    ]);
    // 15 asked of the 10 in stock, sold and offered alike: said on both lines.
    const warnings = [...element.querySelectorAll('.tooltip-warning')].map((w) => w.getAttribute('data-tip'));
    expect(warnings).toEqual(['Stock insuffisant : 10 en stock', 'Stock insuffisant : 10 en stock']);

    // The gift again: no longer offered.
    gift().click();
    await fixture.whenStable();
    expect(gift().getAttribute('aria-pressed')).toBe('false');
    expect((await save()).lines.map((l) => [l.quantity, l.offered])).toEqual([[13, false]]);
  });

  it('removes a sold line with its offered lines, an offered line alone', async () => {
    await type('pinot');
    await press('Enter');
    await type('chass');
    await press('Enter');
    const element = fixture.nativeElement as HTMLElement;
    const gifts = () => [...element.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')];
    const crosses = () => [...element.querySelectorAll<HTMLButtonElement>('button.text-error')];
    const lines = async () => (await save()).lines.map((l) => [l.articleId, l.offered]);
    gifts()[0].click();
    await fixture.whenStable();
    gifts()[1].click();
    await fixture.whenStable();
    expect(await lines()).toEqual([['a1', false], ['a1', true], ['a2', false], ['a2', true]]);

    crosses()[3].click(); // Chasselas offered: the gift alone
    await fixture.whenStable();
    expect(await lines()).toEqual([['a1', false], ['a1', true], ['a2', false]]);
    crosses()[0].click(); // Pinot sold: its gift along
    await fixture.whenStable();
    expect(await lines()).toEqual([['a2', false]]);
  });

  it('moves a line by drag and drop or the arrow keys, its offered bottles along with it', async () => {
    await type('pinot');
    await press('Enter');
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-pressed]')!.click();
    await fixture.whenStable();
    await type('chass');
    await press('Enter');
    const element = fixture.nativeElement as HTMLElement;
    const handles = () => [...element.querySelectorAll<HTMLButtonElement>('[cdkDragHandle]')];
    const quantities = () => [...element.querySelectorAll<HTMLInputElement>('input[type="number"]')];
    const order = async () => (await save()).lines.map((l) => [l.articleId, l.quantity, l.offered]);

    // Two blocks: Pinot and its gift, then Chasselas; the gift has no handle of its own.
    expect(handles().length).toBe(2);
    fixture.debugElement.query(By.directive(CdkDropList))
      .triggerEventHandler('cdkDropListDropped', { previousIndex: 1, currentIndex: 0 });
    await fixture.whenStable();

    // Its fields follow each line: Pinot's quantity changed after the move is Pinot's.
    quantities()[1].value = '6';
    quantities()[1].dispatchEvent(new Event('input'));
    expect(await order()).toEqual([['a2', 1, false], ['a1', 6, false], ['a1', 1, true]]);

    handles()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    await fixture.whenStable();
    expect(await order()).toEqual([['a1', 6, false], ['a1', 1, true], ['a2', 1, false]]);
  });

  it('edits an invoice: its values shown, a discount over 100 % refused', async () => {
    fixture.componentRef.setInput('invoice', {
      id: 'i1', customerId: 'c1', customerName: '', invoiceNumber: null, status: 'draft',
      issueDate: null, dueDate: null, paidAt: null, discountPercent: 5, notes: 'Livrer le soir', paymentMethod: 'twint',
      reminders: [],
      lines: [{ id: 'l1', articleId: 'a1', descriptionSnapshot: 'Pinot Noir', quantity: 3, unitPriceSnapshot: 18, vatRateSnapshot: 0.081, offered: false }],
    } satisfies Invoice);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect((element.querySelector('#invoice-payment-method') as HTMLSelectElement).value).toBe('twint');
    const discount = element.querySelector('#invoice-discount') as HTMLInputElement;
    expect(discount.value).toBe('5');

    discount.value = '120';
    discount.dispatchEvent(new Event('input'));
    await save();
    expect(saved.length).toBe(0);
    expect(element.querySelector('.text-error')?.textContent).toBeTruthy();

    discount.value = '10';
    discount.dispatchEvent(new Event('input'));
    expect(await save()).toEqual({
      customerId: 'c1', discountPercent: 10, notes: 'Livrer le soir', paymentMethod: 'twint',
      lines: [{ articleId: 'a1', descriptionSnapshot: 'Pinot Noir', quantity: 3, unitPriceSnapshot: 18, vatRateSnapshot: 0.081, offered: false }],
    });
  });
});

describe('InvoiceFormComponent suggestions', () => {
  function line(articleId: string | null, descriptionSnapshot: string): InvoiceLine {
    return { id: descriptionSnapshot, articleId, descriptionSnapshot, quantity: 1, unitPriceSnapshot: 12, vatRateSnapshot: null, offered: false };
  }

  it('greys out archived articles, linked or only named, and offers the active ones', async () => {
    const recent: Invoice = {
      id: 'i1', customerId: 'c1', customerName: '', invoiceNumber: '2601011', status: 'paid',
      issueDate: null, dueDate: null, paidAt: null, discountPercent: 0, notes: '', paymentMethod: null,
      reminders: [],
      lines: [
        line('old', 'Gamaret 2019'), // linked to an archived article
        line(null, 'Fendant 2018'), // named after an archived article
        line(null, 'pinot noir'), // named after an active article
        line(null, 'Livraison'), // plain free text
      ],
    };
    TestBed.configureTestingModule({
      imports: [InvoiceFormComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: INVOICE_SERVICE, useValue: { list: async () => ({ items: [recent] }) } },
      ],
    });
    const fixture = TestBed.createComponent(InvoiceFormComponent);
    fixture.componentRef.setInput('customer', CUSTOMER);
    fixture.componentRef.setInput('articles', [article('a1', 'Pinot Noir')]);
    fixture.componentRef.setInput('archivedArticles', [article('old', 'Gamaret 2019'), article('a9', 'Fendant 2018')]);
    await fixture.whenStable();

    const buttons = [...fixture.nativeElement.querySelectorAll('.rounded-lg button')] as HTMLButtonElement[];
    const shown = buttons.map((b) => [b.textContent?.trim(), b.disabled]);
    expect(shown).toEqual([
      ['Gamaret 2019', true],
      ['Fendant 2018', true],
      ['+ Pinot Noir', false],
      ['+ Livraison', false],
    ]);
  });
});
