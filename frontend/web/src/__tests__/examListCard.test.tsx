import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ExamFact, ExamFacts, ExamList, ExamListCard } from '../components/ExamListCard.tsx';
import { Metric, MetricList } from '@/components/ui/metric';
import { ActionGroup } from '@/components/ui/action-group';
import { StatusBadge } from '@/components/ui/status-badge';

// One exam card, metric box and action group for every role (plan §10.1.6/9, UI-SYSTEM-003
// part 3): the student, teacher and proctor lists once had three card styles, two metric box
// styles and actions that ran out of the card.

describe('exam list card', () => {
  it('is a list of articles with the subject as the heading and the status beside it', () => {
    render(
      <ExamList>
        <li>
          <ExamListCard title="Kimia" status={<StatusBadge tone="active">Berlangsung</StatusBadge>} className="teacher-exam-card" data-testid="exam-1">
            <ExamFacts>
              <p>X-E2E · Ulangan Harian</p>
              <ExamFact label="Durasi">45 menit</ExamFact>
            </ExamFacts>
          </ExamListCard>
        </li>
      </ExamList>
    );
    const list = screen.getByRole('list');
    const card = within(list).getByRole('article');
    expect(card.classList.contains('teacher-exam-card')).toBe(true);
    expect(card.getAttribute('data-testid')).toBe('exam-1');
    expect(within(card).getByRole('heading', { level: 2, name: 'Kimia' })).toBeTruthy();
    expect(within(card).getByText('Berlangsung').getAttribute('data-tone')).toBe('active');
    expect(within(card).getByText('Durasi:')).toBeTruthy();
    expect(within(card).getByText('45 menit')).toBeTruthy();
  });

  it('takes a level-three heading inside a section of its own', () => {
    render(<ExamListCard headingLevel="h3" title="Sejarah" />);
    expect(screen.getByRole('heading', { level: 3, name: 'Sejarah' })).toBeTruthy();
  });
});

describe('metric boxes', () => {
  it('pair each label with its value in a labelled term list', () => {
    render(
      <MetricList aria-label="Kemajuan pelaksanaan ujian">
        <Metric label="Peserta" value={32} />
        <Metric label="Waktu pelaksanaan" value="08.00 sampai 10.00 WIB" valueClassName="text-sm font-medium" />
      </MetricList>
    );
    const list = screen.getByLabelText('Kemajuan pelaksanaan ujian');
    expect(list.tagName).toBe('DL');
    const term = within(list).getByText('Peserta');
    expect(term.tagName).toBe('DT');
    expect(term.nextElementSibling?.tagName).toBe('DD');
    expect(term.nextElementSibling?.textContent).toBe('32');
    expect(within(list).getByText('08.00 sampai 10.00 WIB').className).toContain('text-sm');
  });
});

describe('action group', () => {
  it('stacks below 640 px and wraps from there, so no action runs out of its card', () => {
    render(<ActionGroup role="group" aria-label="Kendali ujian"><button type="button">Jeda Ujian</button></ActionGroup>);
    const group = screen.getByRole('group', { name: 'Kendali ujian' });
    expect(group.className).toContain('flex-col');
    expect(group.className).toContain('sm:flex-row');
    expect(group.className).toContain('sm:flex-wrap');
  });
});
