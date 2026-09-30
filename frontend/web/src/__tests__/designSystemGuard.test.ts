/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';

// Guards of the UI/UX consistency contract (plan §10.1, UI-SYSTEM-001): every CSS variable a
// screen uses exists in the shared tokens; hard-coded colors outside the token file never
// grow (the counts below only go down as screens move to tokens); and the text and action
// color pairs of the tokens keep WCAG AA contrast (4.5:1), which the destructive buttons once
// missed (white on #ef4444 is 3.8:1).

const raw = {
  ...import.meta.glob('../**/*.css', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob(['../**/*.{ts,tsx}', '!../__tests__/**', '!../**/*.d.ts'], { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>;
const sources = Object.entries(raw).map(([path, text]) => ({ path: path.replace(/^\.\.\//, ''), text }));
const tokenCss = raw['../styles/design-tokens.css'];

/** Hard-coded colors allowed per file today; lower a count when a file moves to tokens. */
const HARD_CODED_COLOR_CEILING: Record<string, number> = {
  // The destructive button's white text (shadcn foreground).
  'styles/globals.css': 1,
  // The exam focus workspace still carries its own palette, mostly equal to token values;
  // it converges with the token convergence task (UI-SYSTEM-005).
  'styles/workstation.css': 160,
};

function hardCodedColors(path: string, text: string): number {
  if (path.endsWith('.css')) return (text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).length;
  // Tailwind arbitrary values and string literals in components.
  return (text.match(/\[#[0-9a-fA-F]{3,8}\]|["']#[0-9a-fA-F]{3,8}["']/g) ?? []).length;
}

function tokenValue(name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(tokenCss);
  if (!match) throw new Error(`token ${name} has no hex value`);
  return match[1];
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('design system guard (§10.1)', () => {
  it('every CSS variable in use is defined by the shared tokens', () => {
    const defined = new Set(sources.filter(s => s.path.endsWith('.css')).flatMap(s => [...s.text.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1])));
    const undefinedUses = sources.flatMap(s =>
      [...s.text.matchAll(/var\((--[a-z0-9-]+)/g)].map(m => m[1]).filter(name => !defined.has(name) && !name.startsWith('--tw-')).map(name => `${s.path}: ${name}`)
    );
    expect(undefinedUses).toEqual([]);
  });

  it('hard-coded colors outside the token file never grow', () => {
    const over = sources
      .filter(s => s.path !== 'styles/design-tokens.css')
      .map(s => ({ path: s.path, count: hardCodedColors(s.path, s.text), ceiling: HARD_CODED_COLOR_CEILING[s.path] ?? 0 }))
      .filter(s => s.count > s.ceiling)
      .map(s => `${s.path}: ${s.count} hard-coded colors (at most ${s.ceiling}); use a token from design-tokens.css`);
    expect(over).toEqual([]);
  });

  it('status badges come from the shared primitive, never from page stylesheets', () => {
    // The exam focus shell keeps its save state, timer and legend until UI-SYSTEM-002.
    const pageBadges = sources
      .filter(s => s.path.endsWith('.css') && s.path !== 'styles/workstation.css')
      .flatMap(s => [...s.text.matchAll(/\.([a-z0-9-]*(?:badge|pill|chip)[a-z0-9-]*)\s*[{,.:\s]/g)].map(m => `${s.path}: .${m[1]}`));
    expect(pageBadges).toEqual([]);
  });

  it('loading, error and empty states come from the shared pattern, never from page stylesheets', () => {
    // The exam focus shell keeps its full-screen states until UI-SYSTEM-002.
    const pageStates = sources
      .filter(s => s.path.endsWith('.css') && s.path !== 'styles/workstation.css')
      .flatMap(s => [...s.text.matchAll(/\.([a-z0-9-]*(?:state-card|state-message|state-title|state-body|loading-state|retry-button|empty-state|error-state)[a-z0-9-]*)\s*[{,.:\s]/g)].map(m => `${s.path}: .${m[1]}`));
    expect(pageStates).toEqual([]);
  });

  it('exam cards, metric boxes and action groups come from the shared primitives, never from page stylesheets', () => {
    // The exam focus shell keeps its own until UI-SYSTEM-002.
    const pageCards = sources
      .filter(s => s.path.endsWith('.css') && s.path !== 'styles/workstation.css')
      .flatMap(s => [...s.text.matchAll(/\.([a-z0-9-]*(?:-card|-stat|-metric|-progress|-actions)[a-z0-9-]*)\s*[{,.:>\s]/g)].map(m => `${s.path}: .${m[1]}`));
    expect(pageCards).toEqual([]);
  });

  it('text and action colors of the tokens keep WCAG AA contrast', () => {
    const pairs: Array<[string, string, string]> = [
      ['primary action', '--color-primary-fg', '--color-primary'],
      ['destructive action (white text)', '--color-neutral-0', '--color-danger-base'],
      ['body text', '--color-text-primary', '--color-background'],
      ['secondary text', '--color-text-secondary', '--color-background'],
      ['secondary text on a muted surface', '--color-text-secondary', '--color-surface-muted'],
      ['success', '--color-success-text', '--color-success-bg'],
      ['warning', '--color-warning-text', '--color-warning-bg'],
      ['danger', '--color-danger-text', '--color-danger-bg'],
      ['information', '--color-info-text', '--color-info-bg'],
      ['neutral badge', '--color-neutral-badge-text', '--color-neutral-badge-bg'],
      ['active badge', '--color-active-text', '--color-active-bg'],
    ];
    const failing = pairs
      .map(([label, fg, bg]) => ({ label, ratio: contrast(tokenValue(fg), tokenValue(bg)) }))
      .filter(p => p.ratio < 4.5)
      .map(p => `${p.label}: ${p.ratio.toFixed(2)}:1`);
    expect(failing).toEqual([]);
  });
});
