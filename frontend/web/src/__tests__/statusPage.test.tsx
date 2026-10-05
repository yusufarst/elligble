import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { StatusPage } from '@/components/ui/status-page';
import { SubmitConfirmModal } from '../components/SubmitConfirmModal.tsx';

// One page for the session screens and every state of the exam focus shell, and the shared
// dialog for the submit confirmation (UI-SYSTEM-002 part 1, audit C2).

describe('status page', () => {
  it('is the page: a level-one heading, the exam it is about, the text, then the actions', () => {
    render(
      <StatusPage title="Siap Memulai Ujian" subtitle="Matematika Wajib" role="status" live="polite" actions={<button type="button">Mulai Ujian Sekarang</button>}>
        <p>Pastikan Anda sudah siap.</p>
      </StatusPage>,
    );
    const page = screen.getByRole('main');
    const card = within(page).getByRole('status');
    expect(card.getAttribute('aria-live')).toBe('polite');
    const order = [
      within(card).getByRole('heading', { level: 1, name: 'Siap Memulai Ujian' }),
      within(card).getByText('Matematika Wajib'),
      within(card).getByText('Pastikan Anda sudah siap.'),
      within(card).getByRole('button', { name: 'Mulai Ujian Sekarang' }),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1].compareDocumentPosition(order[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(order[3].closest('[data-slot="action-group"]')).toBeTruthy();
  });

  it('shows only what it is given', () => {
    const { container } = render(<StatusPage title="Memuat..." />);
    expect(screen.getByRole('heading', { level: 1, name: 'Memuat...' })).toBeTruthy();
    expect(container.querySelector('[data-slot="status-page-subtitle"]')).toBeNull();
    expect(container.querySelector('[data-slot="card-content"]')).toBeNull();
    expect(container.querySelector('[data-slot="action-group"]')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('submit confirmation', () => {
  const props = { totalQuestions: 3, answeredCount: 2, unansweredCount: 1, onConfirm: () => {} };

  it('starts on "Batal" and sends only after the declaration, which starts unchecked each time', async () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<SubmitConfirmModal {...props} isOpen isSubmitting={false} onCancel={() => {}} onConfirm={onConfirm} />);
    const dialog = await screen.findByRole('dialog', { name: 'Konfirmasi Pengumpulan Ujian' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Batal' }));
    const send = within(dialog).getByRole('button', { name: 'Kirim Jawaban Sekarang' }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.click(within(dialog).getByRole('checkbox'));
    expect(send.disabled).toBe(false);
    fireEvent.click(send);
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(<SubmitConfirmModal {...props} isOpen={false} isSubmitting={false} onCancel={() => {}} onConfirm={onConfirm} />);
    rerender(<SubmitConfirmModal {...props} isOpen isSubmitting={false} onCancel={() => {}} onConfirm={onConfirm} />);
    expect((within(await screen.findByRole('dialog')).getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
  });

  it('Escape cancels, but not while the answers are being sent; a tap outside does nothing', async () => {
    const onCancel = vi.fn();
    const { rerender } = render(<SubmitConfirmModal {...props} isOpen isSubmitting onCancel={onCancel} />);
    await screen.findByRole('dialog');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape', code: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();

    rerender(<SubmitConfirmModal {...props} isOpen isSubmitting={false} onCancel={onCancel} />);
    fireEvent.pointerDown(document.body);
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape', code: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the counts, the "Ragu-ragu" reminder and a failed attempt to send', async () => {
    render(<SubmitConfirmModal {...props} flaggedCount={1} isOpen isSubmitting={false} errorMessage="Gagal mengumpulkan ujian." onCancel={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Belum Dijawab').nextElementSibling?.textContent).toBe('1');
    expect(within(dialog).getByText('Ditandai Ragu-ragu').nextElementSibling?.textContent).toBe('1');
    expect(within(dialog).getByRole('alert').textContent).toBe('Gagal mengumpulkan ujian.');
  });
});
