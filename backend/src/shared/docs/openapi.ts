import fs from 'fs';
import path from 'path';
import { parse } from 'yaml';
import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

/**
 * Serves the API documentation from `SWAGGER.md`.
 *
 * The spec lives inside a fenced ```yaml block in that markdown file rather
 * than a standalone .yaml, so there is one document to maintain: the prose and
 * the machine-readable spec cannot drift apart into two half-accurate copies.
 * AGENTS.md requires SWAGGER.md to be updated with any route change, and this
 * makes that file the thing actually being served.
 */

/** First fenced yaml block in the document. */
const YAML_FENCE = /^```yaml\s*$([\s\S]*?)^```\s*$/m;

/**
 * SWAGGER.md sits at the backend root. Compiled output runs from `dist/`, so
 * the path differs between `ts-node src/` and `node dist/` — try the candidates
 * rather than assuming one layout.
 */
function locateSpecFile(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../../SWAGGER.md'), // dist/shared/docs → backend root
    path.resolve(__dirname, '../../../../SWAGGER.md'),
    path.resolve(process.cwd(), 'SWAGGER.md'),
    path.resolve(process.cwd(), 'backend/SWAGGER.md'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

let cached: object | null | undefined;

/**
 * Reads and parses the spec, or returns null if it cannot be loaded.
 *
 * Never throws: documentation failing to parse must not stop the API from
 * serving traffic.
 */
export function loadOpenApiSpec(): object | null {
  if (cached !== undefined) return cached;

  try {
    const file = locateSpecFile();
    if (!file) {
      console.warn('[Docs] SWAGGER.md not found; /api/docs disabled.');
      cached = null;
      return cached;
    }

    const match = YAML_FENCE.exec(fs.readFileSync(file, 'utf-8'));
    if (!match) {
      console.warn(`[Docs] No \`\`\`yaml block in ${file}; /api/docs disabled.`);
      cached = null;
      return cached;
    }

    const spec = parse(match[1]) as object | null;
    if (!spec || typeof spec !== 'object') {
      console.warn('[Docs] Spec parsed to something that is not an object; /api/docs disabled.');
      cached = null;
      return cached;
    }

    cached = spec;
    return cached;
  } catch (error) {
    console.error('[Docs] Failed to load OpenAPI spec:', error);
    cached = null;
    return cached;
  }
}

/** Test seam — the spec is cached after the first read. */
export function resetSpecCache(): void {
  cached = undefined;
}

/**
 * Router exposing Swagger UI and the raw spec.
 *
 * Returns null when the spec cannot be loaded, so the caller can skip mounting
 * rather than serve a broken page.
 */
export function createDocsRouter(): Router | null {
  const spec = loadOpenApiSpec();
  if (!spec) return null;

  const router = Router();

  // The raw document, for codegen and external tooling.
  router.get('/openapi.json', (_req, res) => {
    res.json(spec);
  });

  router.use(
    '/',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'Harbinger API',
      swaggerOptions: {
        // Endpoints are grouped by tag; collapsed is unreadable at this size.
        docExpansion: 'list',
        persistAuthorization: true,
        tryItOutEnabled: true,
      },
    }),
  );

  return router;
}
