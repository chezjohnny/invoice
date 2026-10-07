import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArticleData } from './article.model';
import { ArticleFormComponent } from './article-form.component';

describe('ArticleFormComponent', () => {
  let fixture: ComponentFixture<ArticleFormComponent>;
  let saved: ArticleData[];
  const field = (id: string) => fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ArticleFormComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(ArticleFormComponent);
    saved = [];
    fixture.componentInstance.saved.subscribe((data) => saved.push(data));
    await fixture.whenStable();
  });

  async function type(id: string, value: string): Promise<void> {
    field(id).value = value;
    field(id).dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function save(): Promise<void> {
    (fixture.nativeElement.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('shows what is missing instead of saving', async () => {
    await type('article-name', '   ');
    await save();
    expect(saved).toEqual([]);
    const errors = [...fixture.nativeElement.querySelectorAll('.text-error')].map((e) => e.textContent.trim());
    expect(errors.length).toBe(2); // the name, the price
    expect(field('article-name').classList).toContain('input-error');
  });

  it('saves the article, its VAT percent as a rate', async () => {
    await type('article-name', ' Pinot Noir ');
    await type('article-price', '24.5');
    await type('article-vat', '3.7');
    await save();
    expect(saved).toEqual([
      { name: 'Pinot Noir', description: '', unitPrice: 24.5, vatRateOverride: 0.037, stockQuantity: 0 },
    ]);
  });

  it('refuses a VAT rate over 100 %', async () => {
    await type('article-name', 'Pinot Noir');
    await type('article-price', '24.5');
    await type('article-vat', '150');
    await save();
    expect(saved).toEqual([]);
  });

  it('edits an article, its rate shown as a percent', async () => {
    fixture.componentRef.setInput('article', {
      id: 'a1', name: 'Chasselas', description: '', unitPrice: 12, vatRateOverride: 0.037,
      stockQuantity: 5, isArchived: false,
    });
    await fixture.whenStable();
    expect(field('article-vat').value).toBe('3.7');
    await save();
    expect(saved[0]).toMatchObject({ name: 'Chasselas', unitPrice: 12, vatRateOverride: 0.037, stockQuantity: 5 });
  });
});
