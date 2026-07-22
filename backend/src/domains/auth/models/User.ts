import mongoose, { Schema, Document } from 'mongoose';

export type RoleType = 'USER' | 'ADMIN';

export interface IUser extends Document {
  email: string;
  displayName: string;
  provider: 'google' | 'apple' | 'facebook' | 'local';
  providerId: string;
  role: RoleType;
  passwordHash?: string;
  bookmarks: mongoose.Types.ObjectId[];
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    provider: {
      type: String,
      required: true,
      enum: ['google', 'apple', 'facebook', 'local'],
    },
    providerId: { type: String, required: true },
    role: {
      type: String,
      required: true,
      enum: ['USER', 'ADMIN'],
      default: 'USER',
    },
    passwordHash: { type: String, select: false },
    bookmarks: [{ type: Schema.Types.ObjectId, ref: 'Article' }],
  },
  { timestamps: true },
);

UserSchema.index({ providerId: 1, provider: 1 }, { unique: true });

export const User = mongoose.model<IUser>('User', UserSchema);
