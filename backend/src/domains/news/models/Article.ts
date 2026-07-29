import mongoose, { Schema, Document } from 'mongoose';

export interface IArticle extends Document {
  sourceId: mongoose.Types.ObjectId;
  sourceName: string;
  sourceUrl: string;
  title: string;
  heroImage: string | null;
  thumbnailImage: string | null;
  contentImages: string[];
  fullContent: string;
  summary: string;
  category: string | null;
  publishedAt: Date;
  scrapedAt: Date;
}

const ArticleSchema = new Schema<IArticle>(
  {
    sourceId: { type: Schema.Types.ObjectId, ref: 'Source', required: true, index: true },
    sourceName: { type: String, required: true },
    sourceUrl: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    heroImage: { type: String, default: null },
    thumbnailImage: { type: String, default: null },
    contentImages: [{ type: String }],
    fullContent: { type: String, default: '' },
    summary: { type: String, default: '' },
    category: { type: String, default: null },
    publishedAt: { type: Date, required: true },
    scrapedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// sourceUrl's unique index is declared on the field above; redeclaring it here
// makes Mongoose log a duplicate-index warning at boot.
ArticleSchema.index({ publishedAt: -1 });

export default mongoose.model<IArticle>('Article', ArticleSchema);
