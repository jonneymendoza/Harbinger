/**
 * Guards the spec that /api/docs serves.
 *
 * SWAGGER.md is hand-edited, and a YAML slip there would previously surface
 * only as a broken docs page in a running container. These assertions also
 * enforce the rule in AGENTS.md — that the spec matches the routes — for the
 * cases that have actually gone stale before: bookmark paths that documented a
 * path parameter the route never had.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadOpenApiSpec, resetSpecCache } from '../../src/shared/docs/openapi';

type Spec = {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
};

let spec: Spec;

beforeEach(() => {
  resetSpecCache();
  spec = loadOpenApiSpec() as Spec;
});

describe('OpenAPI spec', () => {
  it('parses out of SWAGGER.md', () => {
    expect(spec).toBeTruthy();
    expect(spec.openapi).toMatch(/^3\./);
    expect(spec.info.title).toBe('Harbinger News Aggregator API');
  });

  // Each of these is a route that exists in the app. Missing entries are how
  // the spec drifted last time.
  it.each([
    ['/health', 'get'],
    ['/auth/{provider}', 'post'],
    ['/auth/login', 'post'],
    ['/auth/guest', 'post'],
    ['/auth/logout', 'post'],
    ['/news', 'get'],
    ['/news/sources', 'get'],
    ['/news/{id}', 'get'],
    ['/bookmarks', 'get'],
    ['/bookmarks', 'post'],
    ['/bookmarks', 'delete'],
    ['/bookmarks/ids', 'get'],
    ['/bookmarks/{id}', 'delete'],
    ['/admin/sources', 'get'],
    ['/admin/sources', 'post'],
    ['/admin/sources/{id}', 'put'],
    ['/admin/sources/{id}', 'delete'],
    ['/admin/sources/{id}/toggle', 'patch'],
    ['/admin/sources/adapters', 'get'],
    ['/admin/sources/discover-feeds', 'get'],
    ['/admin/sources/test', 'post'],
    ['/admin/sources/scrape-runs', 'get'],
    ['/admin/sources/run-scraper', 'post'],
    ['/admin/sources/{id}/scrape', 'post'],
  ])('documents %s %s', (path, method) => {
    expect(spec.paths[path]).toBeDefined();
    expect(spec.paths[path][method]).toBeDefined();
  });

  // The old spec said POST /bookmarks/{articleId}; the route takes a body.
  it('bookmarks an article by body, not by path parameter', () => {
    expect(spec.paths['/bookmarks/{articleId}']).toBeUndefined();

    const post = spec.paths['/bookmarks'].post as {
      requestBody: { content: Record<string, { schema: { required: string[] } }> };
    };
    expect(post.requestBody.content['application/json'].schema.required).toContain('articleId');
  });

  it('gives every operation a unique operationId', () => {
    const ids: string[] = [];
    for (const operations of Object.values(spec.paths)) {
      for (const [method, operation] of Object.entries(operations)) {
        if (method === 'parameters') continue;
        ids.push((operation as { operationId: string }).operationId);
      }
    }

    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves every $ref to a schema that exists', () => {
    const refs: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        if (key === '$ref' && typeof value === 'string') refs.push(value);
        else walk(value);
      }
    };
    walk(spec.paths);
    walk(spec.components.schemas);

    expect(refs.length).toBeGreaterThan(0);
    const missing = refs.filter((ref) => {
      const name = ref.replace('#/components/schemas/', '');
      return !(name in spec.components.schemas);
    });
    expect(missing).toEqual([]);
  });

  it('declares bearer auth and applies it to admin routes', () => {
    expect(spec.components.securitySchemes.bearerAuth).toBeDefined();

    const adminOps = Object.entries(spec.paths)
      .filter(([path]) => path.startsWith('/admin/'))
      .flatMap(([, operations]) => Object.values(operations));

    expect(adminOps.length).toBeGreaterThan(0);
    for (const operation of adminOps) {
      expect((operation as { security: unknown[] }).security).toBeTruthy();
    }
  });

  // 409 was added with the per-source scrape; the map has to list it or the
  // error contract in specs/api-endpoints.md §6 is incomplete.
  it('documents the conflict response on both scrape routes', () => {
    for (const path of ['/admin/sources/run-scraper', '/admin/sources/{id}/scrape']) {
      const responses = (spec.paths[path].post as { responses: Record<string, unknown> }).responses;
      expect(responses['409']).toBeDefined();
    }
  });
});
