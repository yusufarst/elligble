import * as React from 'react';

import { cardSurface } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// One card per exam on the student, teacher and proctor lists (plan §10.1.6/10, UI-SYSTEM-003
// part 3; audit M11): the shared card surface, the subject as the heading with its status on
// the right, the facts in quiet secondary text, then what the role does with the exam. Roles
// differ in what the card holds, never in how it looks.

export function ExamList({ className, ...props }: React.ComponentProps<'ul'>) {
  // role="list": WebKit drops the list semantics of a list without markers otherwise.
  return <ul role="list" data-slot="exam-list" className={cn('m-0 flex list-none flex-col gap-4 p-0', className)} {...props} />;
}

export function ExamListCard({
  title,
  headingLevel = 'h2',
  status,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'article'>, 'title'> & { title: React.ReactNode; headingLevel?: 'h2' | 'h3'; status?: React.ReactNode }) {
  const Heading = headingLevel;
  return (
    <article data-slot="exam-card" className={cn(cardSurface, 'gap-4', className)} {...props}>
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-border pb-3">
        <Heading className="m-0 text-lg font-semibold leading-snug">{title}</Heading>
        {status}
      </header>
      {children}
    </article>
  );
}

/** The exam's facts (class, window, participants, notes): quiet secondary lines. */
export function ExamFacts({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="exam-facts" className={cn('flex flex-col gap-1 text-sm text-muted-foreground [&_p]:m-0', className)} {...props} />;
}

/** One fact; a label, where one helps, reads before the value. */
export function ExamFact({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <p>
      {label && <span className="font-medium">{label}: </span>}
      <span className={label ? 'text-foreground' : undefined}>{children}</span>
    </p>
  );
}
