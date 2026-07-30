import * as matchers from '@testing-library/jest-dom/matchers';
import { expect } from 'vitest';

expect.extend(matchers);

// Polyfills that jsdom/Globals are missing but Sonner expects:
if (!('startViewTransition' in document)) {
  Object.defineProperty(document, 'startViewTransition', {
    value: (_cb: () => void) => ({ finished: Promise.resolve() }),
    writable: true,
  });
}

// ScrollbarGutter polyfill for jsdom
if (!('scrollbarGutter' in (document.documentElement.style as any))) {
  Object.defineProperty(document.documentElement.style, 'scrollbarGutter', {
    value: 'stable',
    writable: true,
  });
}
