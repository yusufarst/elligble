import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Page, PageHeader } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { QuestionNumberButton, questionNumberState } from '../components/QuestionNumberButton.tsx';
import type { SaveState } from '../types/assessment.ts';

// One page frame and title for the role shell, the action dock on the shared Button and one
// question number button for both question lists (UI-SYSTEM-002 part 2, audit C2 and C3).

afterEach(() => {
  cleanup();
  document.title = 'ELLIGBLE';
});

describe('page frame', () => {
  it('has one width per variant, the standard one by default', () => {
    render(
      <>
        <Page data-testid="standard" />
        <Page data-testid="focused" width="focused" />
        <Page data-testid="narrow" width="narrow" />
      </>,
    );
    const widths = ['standard', 'focused', 'narrow'].map(id => {
      const page = screen.getByTestId(id);
      expect(page.tagName).toBe('MAIN');
      return [page.dataset.width, page.className.match(/max-w-\[\d+px\]/)?.[0]];
    });
    expect(widths).toEqual([
      ['standard', 'max-w-[960px]'],
      ['focused', 'max-w-[720px]'],
      ['narrow', 'max-w-[540px]'],
    ]);
  });

  it('names the browser tab after the page title and gives it back when the page goes', () => {
    const { rerender, unmount } = render(<Page><PageHeader title="Pelaksanaan Ujian" /></Page>);
    expect(screen.getByRole('heading', { level: 1, name: 'Pelaksanaan Ujian' })).toBeTruthy();
    expect(document.title).toBe('Pelaksanaan Ujian · ELLIGBLE');
    rerender(<Page><PageHeader title="Hasil Ujian" /></Page>);
    expect(document.title).toBe('Hasil Ujian · ELLIGBLE');
    unmount();
    expect(document.title).toBe('ELLIGBLE');
  });

  it('keeps the product name for a page without a title', () => {
    render(<PageHeader title="" />);
    expect(document.title).toBe('ELLIGBLE');
  });

  it('puts the lines under the title and the actions beside it', () => {
    render(
      <PageHeader title="Pemantauan Peserta" actions={<Button>Kirim Pesan</Button>}>
        <p>Matematika Wajib</p>
      </PageHeader>,
    );
    const header = screen.getByRole('banner');
    const title = within(header).getByRole('heading', { level: 1 });
    const line = within(header).getByText('Matematika Wajib');
    const action = within(header).getByRole('button', { name: 'Kirim Pesan' });
    expect(title.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('action dock button', () => {
  it('is the shared Button with the dock size: a 44 px tile on a phone, inline from 1024 px', () => {
    render(<Button variant="secondary" size="dock" aria-label="Soal Berikutnya"><span>Berikut</span></Button>);
    const button = screen.getByRole('button', { name: 'Soal Berikutnya' });
    expect(button.dataset.slot).toBe('button');
    for (const cls of ['min-h-11', 'flex-col', 'lg:flex-row', 'lg:min-h-10']) expect(button.classList.contains(cls)).toBe(true);
    // The fixed default height of the other sizes does not apply.
    expect(button.classList.contains('h-11')).toBe(false);
  });
});

describe('question number button', () => {
  const state = (over: Partial<ReturnType<typeof questionNumberState>> = {}) => ({ current: false, answered: false, unresolved: false, flagged: false, ...over });

  it('derives its state from the answers, their saving and the "Ragu-ragu" marks', () => {
    const selected = { a: 'x', b: 'y' };
    const saves: Record<string, SaveState> = { b: { status: 'failed' } };
    expect(questionNumberState('a', 0, 0, selected, saves, { a: true })).toEqual({ current: true, answered: true, unresolved: false, flagged: true });
    expect(questionNumberState('b', 1, 0, selected, saves, {})).toEqual({ current: false, answered: true, unresolved: true, flagged: false });
    expect(questionNumberState('c', 2, 0, selected, saves, {})).toEqual({ current: false, answered: false, unresolved: false, flagged: false });
  });

  it('says every state in its name and shows it without relying on color', () => {
    const cases: Array<[ReturnType<typeof state>, string, string[]]> = [
      [state(), 'Pindah ke soal nomor 3, status belum dijawab', []],
      [state({ current: true, answered: true }), 'Pindah ke soal nomor 3, status sudah dijawab', ['•', '✓']],
      [state({ answered: true, unresolved: true }), 'Pindah ke soal nomor 3, status sedang disinkronisasi atau gagal', ['!']],
      [state({ flagged: true }), 'Pindah ke soal nomor 3, status belum dijawab, ditandai ragu-ragu', []],
    ];
    for (const [s, name, marks] of cases) {
      const { unmount } = render(<QuestionNumberButton number={3} state={s} onSelect={() => {}} />);
      const button = screen.getByRole('button', { name });
      expect(button.getAttribute('aria-current')).toBe(s.current ? 'true' : null);
      expect(button.textContent).toBe(['3', ...marks].join(''));
      expect(!!button.querySelector('.flag-corner')).toBe(s.flagged);
      expect(button.className.includes('min-h-11') && button.className.includes('min-w-11')).toBe(true);
      unmount();
    }
  });

  it('selects its question', () => {
    const onSelect = vi.fn();
    render(<QuestionNumberButton number={1} state={state()} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
