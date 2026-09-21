// All SQLite access for the KetoKind app lives here.
// Uses expo-sqlite's synchronous API. Call initDb() once at startup.
//
// Split into focused modules under src/db/; this file re-exports everything
// so existing imports keep working unchanged.

export * from './db/client';
export * from './db/schema';
export * from './db/profile';
export * from './db/catalog';
export * from './db/logs';
export * from './db/backup';
export * from './db/exportData';
export * from './db/trends';
