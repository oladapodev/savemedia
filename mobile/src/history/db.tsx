import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { SettingsRepository } from '../settings/repo';
import { JobRepository } from './jobs';
import { HistoryRepository } from './repo';
import { migrateDatabase, type SqliteDatabase, type SqliteRunResult, type SqliteValue } from './schema';

export const HISTORY_DATABASE_NAME = 'imediasave.db';

/** Expo-specific provider kept at the app edge; repositories receive only SqliteDatabase. */
export type AppRepositories = {
  history: HistoryRepository;
  jobs: JobRepository;
  settings: SettingsRepository;
};

const RepositoriesContext = createContext<AppRepositories | null>(null);

export function AppDataProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider databaseName={HISTORY_DATABASE_NAME} onInit={initializeHistoryDatabase}>
      <RepositoryProvider>{children}</RepositoryProvider>
    </SQLiteProvider>
  );
}

function RepositoryProvider({ children }: PropsWithChildren) {
  const expoDatabase = useSQLiteContext();
  const repositories = useMemo<AppRepositories>(() => {
    const database = adaptExpoDatabase(expoDatabase);
    return {
      history: new HistoryRepository(database),
      jobs: new JobRepository(database),
      settings: new SettingsRepository(database),
    };
  }, [expoDatabase]);
  return <RepositoriesContext.Provider value={repositories}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories(): AppRepositories {
  const repositories = useContext(RepositoriesContext);
  if (!repositories) throw new Error('Repository hooks must be used within AppDataProvider.');
  return repositories;
}

export function useHistoryRepository(): HistoryRepository {
  return useRepositories().history;
}

export function useJobRepository(): JobRepository {
  return useRepositories().jobs;
}

export function useSettingsRepository(): SettingsRepository {
  return useRepositories().settings;
}

export async function initializeHistoryDatabase(database: SQLiteDatabase): Promise<void> {
  await migrateDatabase(adaptExpoDatabase(database));
}

export function adaptExpoDatabase(database: SQLiteDatabase): SqliteDatabase {
  return {
    execAsync: (source) => database.execAsync(source),
    runAsync: async (source, ...params) => {
      const result = await database.runAsync(source, ...params);
      return { changes: result.changes, lastInsertRowId: Number(result.lastInsertRowId) } satisfies SqliteRunResult;
    },
    getFirstAsync: <T,>(source: string, ...params: SqliteValue[]) => database.getFirstAsync<T>(source, ...params),
    getAllAsync: <T,>(source: string, ...params: SqliteValue[]) => database.getAllAsync<T>(source, ...params),
    withExclusiveTransactionAsync: async (task) => {
      await database.withExclusiveTransactionAsync(async (transaction) => task(adaptExpoDatabase(transaction)));
    },
  };
}
