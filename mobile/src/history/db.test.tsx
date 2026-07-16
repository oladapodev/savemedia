import { render, screen } from '@testing-library/react-native';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { Text } from 'react-native';
import {
  AppDataProvider,
  HISTORY_DATABASE_NAME,
  useHistoryRepository,
  useJobRepository,
  useRepositories,
  useSettingsRepository,
} from './db';
import { FakeSqliteDatabase } from './test-db';

jest.mock('expo-sqlite', () => {
  const React = require('react');
  return {
    SQLiteProvider: jest.fn(({ children }) => React.createElement(React.Fragment, null, children)),
    useSQLiteContext: jest.fn(),
  };
});

function RepositoryProbe() {
  const repositories = useRepositories();
  const history = useHistoryRepository();
  const jobs = useJobRepository();
  const settings = useSettingsRepository();
  return (
    <Text>
      {repositories.history === history
        && repositories.jobs === jobs
        && repositories.settings === settings
        ? 'repositories-ready'
        : 'repositories-mismatched'}
    </Text>
  );
}

describe('AppDataProvider', () => {
  test('creates typed repository singletons inside the Expo SQLite provider', async () => {
    (useSQLiteContext as jest.Mock).mockReturnValue(new FakeSqliteDatabase());

    await render(
      <AppDataProvider>
        <RepositoryProbe />
      </AppDataProvider>,
    );

    expect(screen.getByText('repositories-ready')).toBeTruthy();
    expect(SQLiteProvider).toHaveBeenCalledWith(
      expect.objectContaining({ databaseName: HISTORY_DATABASE_NAME, onInit: expect.any(Function) }),
      undefined,
    );
  });
});
