import mongoose from 'mongoose';

/**
 * Clear all collections in the database
 * Use between tests to ensure isolation
 */
export async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Drop the entire database
 * Use sparingly - mainly for cleanup after all tests
 */
export async function dropDatabase() {
  await mongoose.connection.dropDatabase();
}

/**
 * Check if connected to database
 */
export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Wait for database connection
 */
export async function waitForConnection(timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!isConnected()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Database connection timeout');
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
