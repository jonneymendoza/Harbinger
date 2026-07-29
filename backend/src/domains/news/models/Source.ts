import mongoose, { Schema, Document } from 'mongoose';

export interface ISource extends Document {
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

const SourceSchema = new Schema<ISource>(
  {
    name: { type: String, required: true, trim: true },
    baseUrl: { type: String, required: true, unique: true },
    adapter: { type: String, required: true, default: 'generic', trim: true },
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
