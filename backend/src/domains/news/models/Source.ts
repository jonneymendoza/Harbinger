import mongoose, { Schema, Document } from 'mongoose';

export interface ISource extends Document {
  name: string;
  /** Short label shown in the UI (e.g. filter pills). Falls back to `name`. */
  displayName?: string;
  baseUrl: string;
  /** Key of the scraping adapter that handles this source. */
  adapter: string;
  /**
   * Newest articles to consider per run for this source, overriding
   * SCRAPER_ARTICLE_LIMIT. Sources whose listings mix articles with
   * non-article pages need a higher ceiling to yield the same article count.
   */
  articleLimit?: number;
  articleLinkSelector: string;
  contentSelector: string;
  titleSelector: string;
  imageSelector: string;
  isActive: boolean;
  createdAt: Date;
}

const SourceSchema = new Schema<ISource>(
  {
    name: { type: String, required: true, trim: true },
    displayName: { type: String, trim: true },
    baseUrl: { type: String, required: true, unique: true },
    adapter: { type: String, required: true, default: 'generic', trim: true },
    articleLimit: { type: Number, min: 1, max: 200 },
    // Selectors are only meaningful to the selector-driven `generic` adapter;
    // site-specific adapters know their own structure, so these stay optional.
    articleLinkSelector: { type: String, default: '' },
    contentSelector: { type: String, default: '' },
    titleSelector: { type: String, default: '' },
    imageSelector: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SourceSchema.index({ isActive: 1 });

export default mongoose.model<ISource>('Source', SourceSchema);
