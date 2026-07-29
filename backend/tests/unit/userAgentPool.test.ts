import { describe, it, expect } from 'vitest';
import { getRandomUserAgent, USER_AGENTS } from '../../src/infrastructure/scraper/userAgentPool';

describe('userAgentPool', () => {
  it('should return a user agent string', () => {
    const ua = getRandomUserAgent();
    expect(typeof ua).toBe('string');
    expect(ua.length).toBeGreaterThan(0);
  });

  it('should return a user agent from the pool', () => {
    for (let i = 0; i < 100; i++) {
      const ua = getRandomUserAgent();
      expect(USER_AGENTS).toContain(ua);
    }
  });

  it('should have multiple user agents in the pool', () => {
    expect(USER_AGENTS.length).toBeGreaterThan(1);
  });

  it('should return valid browser user agent strings', () => {
    const ua = getRandomUserAgent();
    expect(ua).toContain('Mozilla');
    // All UAs should contain either AppleWebKit (Chrome/Safari/Edge) or Gecko (Firefox)
    const hasEngine = /AppleWebKit|Gecko/.test(ua);
    expect(hasEngine).toBe(true);
  });
});
