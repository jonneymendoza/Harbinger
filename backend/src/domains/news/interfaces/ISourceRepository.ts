import { Types } from 'mongoose';

export interface Source {
  _id: Types.ObjectId;
  name: string;
  baseUrl: string;
  /** Key of the scraping adapter that handles this source. */
  adapter: string;
  articleLinkSelector: string;
  contentSelector: string;
  titleSelector: string;
  imageSelector: string;
  isActive: boolean;
  createdAt: Date;
}

export interface SourceInput {
  name: string;
  baseUrl: string;
  adapter?: string;
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
