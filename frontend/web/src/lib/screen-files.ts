/** The file of screens downloaded on demand could not be downloaded (offline, or a release replaced it). */
export class ScreenLoadError extends Error {
  constructor(cause: unknown) {
    super('Screens could not be downloaded', { cause });
    this.name = 'ScreenLoadError';
  }
}

/** Screens in a file of their own, downloaded the first time one of them is shown (WEB-001). */
export interface ScreenFiles<T> {
  /** The screens: one download shared by every caller; a failure stays until `retry`. */
  get(): Promise<T>;
  /** After a failed download: the next `get` asks again. Does nothing while loading or once loaded. */
  retry(): void;
  /** Whether the file is gone from the server (a release replaced it): only a page reload helps then. */
  replaced(): Promise<boolean>;
}

interface Attempt<T> {
  promise: Promise<T>;
  failed: boolean;
}

export function screenFiles<T>({
  load,
  address,
  loadAddress = url => import(/* @vite-ignore */ url) as Promise<T>,
  check = url => fetch(url, { method: 'HEAD', cache: 'no-store' }),
}: {
  /** The bundler's own import of the screens. */
  load: () => Promise<T>;
  /** The built file's address when the build names it (null in development and tests). */
  address: () => string | null;
  loadAddress?: (url: string) => Promise<T>;
  check?: (url: string) => Promise<Response>;
}): ScreenFiles<T> {
  let attempts = 0;
  let current: Attempt<T> | null = null;

  function begin(): Attempt<T> {
    attempts += 1;
    const url = address();
    // A retry asks under a new address: an engine may keep a failed download for the page and
    // answer the same address with the same failure without asking the server, WebKit even
    // after a reload (CI run 45).
    const download = attempts === 1 || url === null ? load() : loadAddress(`${url}?attempt=${attempts}`);
    const attempt: Attempt<T> = { promise: download, failed: false };
    attempt.promise = download.catch((cause: unknown) => {
      attempt.failed = true;
      throw new ScreenLoadError(cause);
    });
    return attempt;
  }

  return {
    get() {
      current ??= begin();
      return current.promise;
    },
    retry() {
      if (current?.failed) current = null;
    },
    async replaced() {
      const url = address();
      if (url === null) return false;
      try {
        return (await check(url)).status === 404;
      } catch {
        // Unreachable: not known to be replaced; the next attempt says whether it can download.
        return false;
      }
    },
  };
}
