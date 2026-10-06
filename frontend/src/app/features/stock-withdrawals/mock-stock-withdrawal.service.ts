import { Injectable } from '@angular/core';
import {
  IStockWithdrawalService, StockWithdrawalListParams,
} from '../../core/tokens/stock-withdrawal-service.token';
import { Page } from '../../core/models/page.model';
import { sortItems } from '../../shared/sort';
import { StockWithdrawal, StockWithdrawalCreate } from './stock-withdrawal.model';

// Article ids and names match MockArticleService.
const ARTICLE_NAMES: Record<string, string> = {
  '1': 'Château Margaux 2018',
  '2': 'Pinot Noir Vaudois 2021',
  '3': 'Champagne Brut Nature',
  '4': 'Caisse bois personnalisée',
};

const INITIAL: StockWithdrawal[] = [
  {
    id: '1', articleId: '2', articleName: ARTICLE_NAMES['2'], date: '2026-09-12',
    quantity: 6, reason: 'tasting', note: 'Caves ouvertes',
  },
  {
    id: '2', articleId: '3', articleName: ARTICLE_NAMES['3'], date: '2026-09-20',
    quantity: 1, reason: 'loss', note: 'Bouteille cassée',
  },
  {
    id: '3', articleId: '1', articleName: ARTICLE_NAMES['1'], date: '2026-10-01',
    quantity: 2, reason: 'promotion', note: 'Tombola du club',
  },
];

@Injectable()
export class MockStockWithdrawalService implements IStockWithdrawalService {
  private withdrawals = structuredClone(INITIAL);
  private nextId = INITIAL.length + 1;

  list(params: StockWithdrawalListParams): Promise<Page<StockWithdrawal>> {
    const search = (params.search ?? '').toLowerCase();
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;
    const filtered = this.withdrawals
      .filter((w) => (!params.reason || w.reason === params.reason)
        && (!search || w.articleName.toLowerCase().includes(search)))
      .sort((a, b) => b.date.localeCompare(a.date));
    const sorted = sortItems(filtered, params.sort, {
      date: (w) => w.date,
      article: (w) => w.articleName.toLowerCase(),
      quantity: (w) => w.quantity,
      reason: (w) => w.reason,
    });
    const total = sorted.length;
    const items = sorted.slice((page - 1) * perPage, page * perPage);
    const pages = Math.max(1, Math.ceil(total / perPage));
    return Promise.resolve({ items, total, page, perPage, pages });
  }

  create(data: StockWithdrawalCreate): Promise<StockWithdrawal> {
    const withdrawal = {
      ...data, id: String(this.nextId++), articleName: ARTICLE_NAMES[data.articleId] ?? '',
    };
    this.withdrawals.push(withdrawal);
    return Promise.resolve(withdrawal);
  }

  delete(id: string): Promise<void> {
    this.withdrawals = this.withdrawals.filter((w) => w.id !== id);
    return Promise.resolve();
  }
}
