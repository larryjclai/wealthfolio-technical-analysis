import { renderToStaticMarkup } from 'react-dom/server';
import { Sheet } from '@wealthfolio/ui';
import { describe, expect, it } from 'vitest';
import { parseSnapshot } from '../src/alerts/alert-history';
import type { StopState } from '../src/alerts/TrailingStopStore';
import { createTrailingStop } from '../src/alerts/trailing-stop';
import { NotificationIndicator } from '../src/components/NotificationCenter';
import { bar, history, instrument } from './fixtures';

const state: StopState = {
  ...parseSnapshot(null), ready: true, error: null, checking: false,
  lastAttemptAt: null, lastCompletedAt: null,
};
const rule = createTrailingStop(instrument, 'Test', 20, history([bar('2026-09-16', 100)]));
const render = (changes: Partial<StopState> = {}, expanded = false, marketData: { failures: string[]; warnings: string[] } = { failures: [], warnings: [] }) => renderToStaticMarkup(
  <Sheet open={expanded}>
    <NotificationIndicator state={{ ...state, ...changes }} marketData={marketData} onClick={() => {}} expanded={expanded} />
  </Sheet>,
);

describe('Reminder indicator severity', () => {
  it('keeps a neutral, accessible entry when there are no pending issues', () => {
    const output = render();
    expect(output).toContain('data-severity="info"');
    expect(output).toContain('aria-label="提醒中心"');
    expect(output).toContain('aria-haspopup="dialog"');
    expect(output).toContain('aria-expanded="false"');
  });
  it('shows unacknowledged stop triggers as red, even when data also needs review', () => {
    const output = render({ rules: [{ ...rule, triggeredAt: '2026-09-18' }], failures: { TEST: 'offline' } }, true);
    expect(output).toContain('data-severity="error"');
    expect(output).toContain('1 筆移動停利待確認');
    expect(output).toContain('有資料需要確認');
    expect(output).toContain('aria-expanded="true"');
  });
  it('clears the red indicator after acknowledgment while retaining a data warning', () => {
    const rules = [{ ...rule, triggeredAt: '2026-09-18', acknowledged: true }];
    expect(render({ rules })).toContain('data-severity="info"');
    expect(render({ rules, failures: { TEST: 'offline' } })).toContain('data-severity="warning"');
    expect(render({ rules })).not.toContain('移動停利待確認');
  });
  it('shows split-related review as yellow without inventing a stop trigger', () => {
    const output = render({ rules: [{ ...rule, needsReview: '請核對拆股後價格' }] });
    expect(output).toContain('data-severity="warning"');
    expect(output).not.toContain('移動停利待確認');
  });
  it('makes failed settings load or save visible as red with an explicit reason', () => {
    const output = render({ error: 'storage unavailable', ready: false });
    expect(output).toContain('data-severity="error"');
    expect(output).toContain('提醒設定發生錯誤');
    expect(output).not.toContain('移動停利待確認');
  });
  it.each([
    { failures: ['TEST：offline'], warnings: [] },
    { failures: [], warnings: ['最新日 K 尚未確認收盤'] },
  ])('shows overview market failures or notices alone as yellow: %j', marketData => {
    const output = render({}, false, marketData);
    expect(output).toContain('data-severity="warning"');
    expect(output).toContain('行情注意事項');
    expect(output).not.toContain('移動停利待確認');
  });
  it('includes the market failure and notice counts in its accessible label', () => {
    const output = render({}, false, { failures: ['TEST：offline'], warnings: ['未收盤', '異常日 K'] });
    const label = output.match(/aria-label="([^"]*)"/)?.[1];
    expect(label).toContain('行情注意事項');
    expect(label).toContain('1 檔暫無行情');
    expect(label).toContain('2 筆資料提示');
  });
  it.each([
    { rules: [{ ...rule, triggeredAt: '2026-09-18' }] },
    { error: 'storage unavailable' },
  ])('keeps stop triggers or settings failures red when overview quotes also need attention: %j', changes => {
    const output = render(changes, false, { failures: ['TEST：offline'], warnings: ['未收盤'] });
    expect(output).toContain('data-severity="error"');
    expect(output).toContain('行情注意事項');
  });
  it('downgrades to yellow after acknowledging a stop while overview market issues remain', () => {
    const marketData = { failures: ['TEST：offline'], warnings: ['未收盤'] };
    expect(render({ rules: [{ ...rule, triggeredAt: '2026-09-18' }] }, false, marketData)).toContain('data-severity="error"');
    const output = render({ rules: [{ ...rule, triggeredAt: '2026-09-18', acknowledged: true }] }, false, marketData);
    expect(output).toContain('data-severity="warning"');
    expect(output).toContain('行情注意事項');
    expect(output).not.toContain('移動停利待確認');
  });
});
