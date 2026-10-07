import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  it('adds a free-text line from its button, at the default VAT, which needs a description', async () => {
    const button = [...fixture.nativeElement.querySelectorAll('button')]
      .find((b: HTMLButtonElement) => b.textContent?.includes('+')) as HTMLButtonElement;
    button.click();
    await fixture.whenStable();
    await save();
    expect(saved.length).toBe(0);

    const description = fixture.nativeElement.querySelector('input[type="text"]:not([role])') as HTMLInputElement;
    description.value = 'Livraison';
    description.dispatchEvent(new Event('input'));
    const price = fixture.nativeElement.querySelector('input[step="0.01"]') as HTMLInputElement;
    price.value = '15';
    price.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const lines = (await save()).lines;
    expect(lines).toEqual([
      { articleId: null, descriptionSnapshot: 'Livraison', quantity: 1, unitPriceSnapshot: 15, vatRateSnapshot: 0.081 },
    ]);
  });
});

describe('InvoiceFormComponent suggestions', () => {
  function line(articleId: string | null, descriptionSnapshot: string): InvoiceLine {
    return { id: descriptionSnapshot, articleId, descriptionSnapshot, quantity: 1, unitPriceSnapshot: 12, vatRateSnapshot: null };
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
