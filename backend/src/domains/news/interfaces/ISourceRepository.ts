import { Types } from 'mongoose';

export interface Source {
  _id: Types.ObjectId;
  name: string;
  /** Short label shown in the UI. Falls back to `name`. */
  displayName?: string;
  baseUrl: string;
  /** Key of the scraping adapter that handles this source. */
  adapter: string;
  /** Per-source override for SCRAPER_ARTICLE_LIMIT. */
  articleLimit?: number;
  articleLinkSelector: string;
  contentSelector: string;
  titleSelector: string;
  imageSelector: string;
  isActive: boolean;
  createdAt: Date;
}

export interface SourceInput {
  name: string;
  displayName?: string;
  baseUrl: string;
  adapter?: string;
  articleLimit?: number;
  /** Required only by the selector-driven `generic` adapter. */
  articleLinkSelector?: string;
  contentSelector?: string;
  titleSelector?: string;
  imageSelector?: string;
  isActive?: boolean;
}

export interface ISourceRepository {
  findAllActive(): Promise<Source[]>;
  findById(id: string): Promise<Source | null>;
  findAll(): Promise<Source[]>;
  create(input: SourceInput): Promise<Source>;
  update(id: string, input: Partial<SourceInput>): Promise<Source | null>;
  delete(id: string): Promise<boolean>;
  toggleActive(id: string): Promise<Source | null>;
}
