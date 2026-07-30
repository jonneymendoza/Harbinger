/// <reference types="vitest/globals" />

declare global {
  namespace Vi {
    interface Assertion<T = any> {
      toBeInTheDocument(): void;
      not: { toBeInTheDocument(): void };
      toBeVisible(): void;
      toBeDisabled(): void;
      toBeEnabled(): void;
      toBeNullish(): void;
      toHaveTextContent(content: string): void;
      toContainHTML(html: string): void;
      toHaveClass(...classNames: string[]): void;
      toHaveAttribute(attr: string, value?: unknown): void;
    }
  }
}

export {};
