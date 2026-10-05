import React from 'react';
import type { InboxMessage } from '../types/assessment.ts';
import { formatTime } from '../lib/format.ts';

// Supervisor messages on the student's exam screen (D04.1-77C/G, D04.5-58/59): a compact
// notice in the header area that never takes the focus or covers the question, the choices,
// the timer, the navigation or the save state, and a list to reread every message.

export const ExamMessageNotice: React.FC<{
  notice: { message: InboxMessage; more: number };
  onDismiss(): void;
}> = ({ notice, onDismiss }) => (
  <div className="broadcast-banner" role="status" aria-live="polite">
    <div className="broadcast-banner-box">
      <div className="broadcast-banner-body">
        <span className="broadcast-banner-label">Pesan pengawas, {formatTime(notice.message.sentAt)}</span>
        <span className="broadcast-banner-text">{notice.message.text}</span>
        {notice.more > 0 && (
          <span className="broadcast-banner-more">{notice.more} pesan lain dapat dibaca di Daftar Soal.</span>
        )}
      </div>
      <button type="button" className="broadcast-banner-dismiss" onClick={onDismiss}>Tutup</button>
    </div>
  </div>
);

export const ExamMessageList: React.FC<{ messages: InboxMessage[]; title?: string; limit?: number }> = ({
  messages,
  title = 'Pesan Pengawas',
  limit,
}) => {
  if (messages.length === 0) return null;
  const shown = limit ? messages.slice(0, limit) : messages;
  return (
    <section className="exam-messages" aria-label={title}>
      <h2 className="exam-messages-title">{title}</h2>
      <ul className="exam-messages-list">
        {shown.map(m => (
          <li key={m.id} className="exam-message">
            <span className="exam-message-time">{formatTime(m.sentAt)}</span>
            <span className="exam-message-text">{m.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
