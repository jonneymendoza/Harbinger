import mongoose from 'mongoose';
import SourceModel, { ISource } from '@domains/news/models/Source';
import { Source, SourceInput, ISourceRepository } from '@domains/news/interfaces/ISourceRepository';

export class SourceRepository implements ISourceRepository {
  async findAllActive(): Promise<Source[]> {
    const sources = await SourceModel.find({ isActive: true }).lean();
    return sources as unknown as Source[];
  }

  async findById(id: string): Promise<Source | null> {
    const source = await SourceModel.findById(id).lean();
    return (source as unknown as Source) || null;
  }

  async findAll(): Promise<Source[]> {
    const sources = await SourceModel.find().sort({ createdAt: -1 }).lean();
    return sources as unknown as Source[];
  }

  async create(input: SourceInput): Promise<Source> {
    const source = new SourceModel({
      ...input,
      isActive: input.isActive ?? true,
    });
    const saved = await source.save();
    return saved.toObject() as unknown as Source;
  }

  async update(id: string, input: Partial<SourceInput>): Promise<Source | null> {
    const source = await SourceModel.findByIdAndUpdate(
      id,
      { $set: input },
      { new: true, runValidators: true }
    ).lean();
    return (source as unknown as Source) || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await SourceModel.findByIdAndDelete(id);
    return result !== null;
  }

  async toggleActive(id: string): Promise<Source | null> {
    const source = await SourceModel.findById(id);
    if (!source) return null;
    source.isActive = !source.isActive;
    await source.save();
    return source.toObject() as unknown as Source;
  }
}
