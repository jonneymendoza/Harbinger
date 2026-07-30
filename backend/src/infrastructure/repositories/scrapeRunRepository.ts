import mongoose from 'mongoose';
import ScrapeRunModel from '@domains/news/models/ScrapeRun';
import {
  IScrapeRunRepository,
  ScrapeRunInput,
  ScrapeRunPage,
  ScrapeRunRecord,
} from '@domains/news/interfaces/IScrapeRunRepository';

const toRecord = (doc: any): ScrapeRunRecord => ({
  id: String(doc._id),
  trigger: doc.trigger,
  status: doc.status,
  startedAt: doc.startedAt,
  finishedAt: doc.finishedAt,
  durationMs: doc.durationMs,
  totalArticlesAdded: doc.totalArticlesAdded ?? 0,
  error: doc.error ?? null,
  results: (doc.results ?? []).map((r: any) => ({
    sourceId: r.sourceId ? String(r.sourceId) : null,
    sourceName: r.sourceName,
    linksDiscovered: r.linksDiscovered ?? 0,
    articlesScraped: r.articlesScraped ?? 0,
    articlesSkipped: r.articlesSkipped ?? 0,
    articlesRejected: r.articlesRejected ?? 0,
    errors: r.errors ?? [],
  })),
});

export class ScrapeRunRepository implements IScrapeRunRepository {
  async record(input: ScrapeRunInput): Promise<void> {
    await ScrapeRunModel.create({
      ...input,
      results: input.results.map((r) => ({
        ...r,
        sourceId: r.sourceId ? new mongoose.Types.ObjectId(r.sourceId) : null,
      })),
    });
  }

  async findRecent(page: number, limit: number): Promise<ScrapeRunPage> {
    const [docs, totalRuns] = await Promise.all([
      ScrapeRunModel.find()
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ScrapeRunModel.countDocuments(),
    ]);

    return { runs: docs.map(toRecord), totalRuns };
  }
}
