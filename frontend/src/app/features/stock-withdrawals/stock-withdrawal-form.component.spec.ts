import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Article } from '../articles/article.model';
import { StockWithdrawalFormComponent } from './stock-withdrawal-form.component';
import { StockWithdrawalCreate } from './stock-withdrawal.model';

const ARTICLES: Article[] = [
  { id: 'a1', name: 'Pinot Noir', description: '', unitPrice: 20, vatRateOverride: null, stockQuantity: 10, isArchived: false },
  { id: 'a2', name: 'Chasselas', description: '', unitPrice: 15, vatRateOverride: null, stockQuantity: 4, isArchived: false },
];

describe('StockWithdrawalFormComponent', () => {
  let fixture: ComponentFixture<StockWithdrawalFormComponent>;
  let saved: StockWithdrawalCreate[];
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [StockWithdrawalFormComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(StockWithdrawalFormComponent);
    fixture.componentRef.setInput('articles', ARTICLES);
    saved = [];
    fixture.componentInstance.saved.subscribe((data) => saved.push(data));
    await fixture.whenStable();
  });

  async function pick(text: string): Promise<void> {
    const box = element().querySelector('[role="combobox"]') as HTMLInputElement;
    box.dispatchEvent(new Event('focus'));
    box.value = text;
    box.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
  }

  async function save(): Promise<void> {
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('needs an article', async () => {
    await save();
    expect(saved).toEqual([]);
  });

  it('withdraws the article picked by name, which can be changed', async () => {
    await pick('chass');
    expect(element().textContent).toContain('Chasselas');
    expect(element().querySelector('[role="combobox"]')).toBeNull();

    (element().querySelector('button[aria-label]') as HTMLButtonElement).click();
    await fixture.whenStable();
    await pick('pinot');
    await save();
    expect(saved.map((s) => s.articleId)).toEqual(['a1']);
  });
});
