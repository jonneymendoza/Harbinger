import { ScrapeStatus, ScrapeTrigger } from '@domains/news/models/ScrapeRun';

export interface ScrapeRunSourceResult {
  sourceId?: string | null;
  sourceName: string;
  linksDiscovered: number;
  articlesScraped: number;
  articlesSkipped: number;
  articlesRejected: number;
  errors: string[];
}

export interface ScrapeRunRecord {
  id: string;
  trigger: ScrapeTrigger;
  status: ScrapeStatus;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  totalArticlesAdded: number;
  results: ScrapeRunSourceResult[];
  error?: string | null;
}

export type ScrapeRunInput = Omit<ScrapeRunRecord, 'id'>;

export interface ScrapeRunPage {
  runs: ScrapeRunRecord[];
  totalRuns: number;
}

export interface IScrapeRunRepository {
  record(input: ScrapeRunInput): Promise<void>;
  findRecent(page: number, limit: number): Promise<ScrapeRunPage>;
}
