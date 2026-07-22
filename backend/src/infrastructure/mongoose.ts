import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/news-aggregator';

  mongoose.set('strictQuery', false);

  try {
    await mongoose.connect(mongoUri);
    console.log('[DB] Connected to MongoDB');
  } catch (error) {
    console.error('[DB] Failed to connect to MongoDB:', error);
    process.nextTick(() => {
      if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        console.log('[DB] Retrying in 5 seconds...');
        setTimeout(() => connectDB(), 5000);
      } else {
        process.exit(1);
      }
    });
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[DB] MongoDB reconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[DB] MongoDB error:', err);
  });
}

export function disconnectDB(): Promise<void> {
  return mongoose.disconnect();
}
