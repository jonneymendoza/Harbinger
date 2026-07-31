import mongoose, { Schema, Document } from 'mongoose';

/** `source` = an admin scraped one source on its own, rather than the whole set. */
export type ScrapeTrigger = 'boot' | 'cron' | 'manual' | 'source';
/** partial = the run completed but at least one source reported a problem. */
export type ScrapeStatus = 'success' | 'partial' | 'failed';

export interface IScrapeSourceResult {
  sourceId?: mongoose.Types.ObjectId | null;
  sourceName: string;
  linksDiscovered: number;
  articlesScraped: number;
  articlesSkipped: number;
  articlesRejected: number;
  errors: string[];
}

export interface IScrapeRun extends Document {
  trigger: ScrapeTrigger;
  status: ScrapeStatus;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  totalArticlesAdded: number;
  results: IScrapeSourceResult[];
  /** Set when the pipeline itself threw, as opposed to a single source failing. */
  error?: string | null;
}

const ScrapeSourceResultSchema = new Schema<IScrapeSourceResult>(
  {
    sourceId: { type: Schema.Types.ObjectId, ref: 'Source', default: null },
    sourceName: { type: String, required: true },
    linksDiscovered: { type: Number, default: 0 },
    articlesScraped: { type: Number, default: 0 },
    articlesSkipped: { type: Number, default: 0 },
    articlesRejected: { type: Number, default: 0 },
    errors: [{ type: String }],
  },
  { _id: false },
);

/**
 * One execution of the scrape pipeline.
 *
 * Without this the only record of a run was container stdout, so a source that
 * silently started returning zero links could go unnoticed indefinitely — which
 * is exactly what happened with Arsenal.
 */
const ScrapeRunSchema = new Schema<IScrapeRun>({
  trigger: { type: String, required: true, enum: ['boot', 'cron', 'manual', 'source'] },
  status: { type: String, required: true, enum: ['success', 'partial', 'failed'] },
  startedAt: { type: Date, required: true },
  finishedAt: { type: Date, required: true },
  durationMs: { type: Number, required: true },
  totalArticlesAdded: { type: Number, default: 0 },
  results: { type: [ScrapeSourceResultSchema], default: [] },
  error: { type: String, default: null },
});

// Newest first is the only order this is ever read in.
ScrapeRunSchema.index({ startedAt: -1 });

/**
 * Runs expire automatically. An hourly cron writes ~720 documents a month, so
 * without this the collection grows without bound for data nobody reads.
 */
const RETENTION_DAYS = Math.max(1, parseInt(process.env.SCRAPE_LOG_RETENTION_DAYS || '30', 10) || 30);
ScrapeRunSchema.index({ startedAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

export default mongoose.model<IScrapeRun>('ScrapeRun', ScrapeRunSchema);
