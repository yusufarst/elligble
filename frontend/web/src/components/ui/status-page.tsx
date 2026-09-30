import * as React from 'react';

import { ActionGroup } from '@/components/ui/action-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * A page without navigation, its content centered on the muted canvas: sign-in and the other
 * session screens, and the states of the exam focus shell (FRONTEND_DESIGN_SYSTEM §50).
 */
function CenteredPage({ children }: { children: React.ReactNode }) {
  return (
    <main
      data-slot="centered-page"
      className="flex min-h-dvh items-start justify-center bg-muted px-4 pb-8 pt-[max(2rem,env(safe-area-inset-top))] sm:items-center"
    >
      <div className="w-full max-w-[540px]">{children}</div>
    </main>
  );
}

/**
 * A page that says one thing (UI-SYSTEM-002): its level-one heading, the exam it is about when
 * known, a few lines on what it means, then at most the actions that help. One card for the
 * session screens and every state of the exam focus shell (launch, paused, locked, submitted,
 * time up, refusals and errors), so the student's exam looks like the rest of ELLIGBLE.
 */
function StatusPage({
  title,
  subtitle,
  role,
  live,
  children,
  actions,
}: {
  title: string;
  /** What the page is about, such as the exam's subject. */
  subtitle?: React.ReactNode;
  role?: 'alert' | 'status';
  live?: 'polite' | 'assertive';
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <CenteredPage>
      <Card data-slot="status-page" role={role} aria-live={live}>
        <CardHeader>
          <CardTitle level="h1">{title}</CardTitle>
          {subtitle && <p data-slot="status-page-subtitle" className="m-0 text-lg font-medium text-foreground">{subtitle}</p>}
        </CardHeader>
        {children && <CardContent className="gap-3 text-sm leading-relaxed text-muted-foreground [&_p]:m-0">{children}</CardContent>}
        {actions && <ActionGroup>{actions}</ActionGroup>}
      </Card>
    </CenteredPage>
  );
}

export { CenteredPage, StatusPage };
