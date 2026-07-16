import { FakeSqliteDatabase } from '../history/test-db';
import { migrateDatabase } from '../history/schema';
import { defaultSettings, SettingsRepository } from './repo';

describe('SettingsRepository', () => {
  test('returns product defaults before any settings have been persisted', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);

    await expect(new SettingsRepository(db).get()).resolves.toEqual({
      quality: 'balanced',
      smartAutoSave: true,
      alerts: true,
      allowCellular: true,
      themeMode: 'system',
      metadata: {},
      metadataVersion: 1,
    });
  });

  test('deep-freezes defaults, persists them on first read, and returns copy-safe values', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const settings = new SettingsRepository(db, () => 123);

    const first = await settings.get();
    first.quality = 'original';
    first.metadata.changed = true;
    const second = await settings.get();

    expect(Object.isFrozen(defaultSettings)).toBe(true);
    expect(Object.isFrozen(defaultSettings.metadata)).toBe(true);
    expect(db.settings).toMatchObject({ quality: 'balanced', updated_at: 123 });
    expect(second).toEqual({
      quality: 'balanced',
      smartAutoSave: true,
      alerts: true,
      allowCellular: true,
      themeMode: 'system',
      metadata: {},
      metadataVersion: 1,
    });
    expect(second).not.toBe(first);
    expect(second.metadata).not.toBe(first.metadata);
  });

  test('persists changes for a repository recreated over the same database', async () => {
    const db = new FakeSqliteDatabase();
    await migrateDatabase(db);
    const settings = new SettingsRepository(db);
    await settings.save({
      quality: 'original',
      smartAutoSave: false,
      alerts: false,
      allowCellular: false,
      themeMode: 'dark',
      metadata: { changedBy: 'test' },
    });

    await expect(new SettingsRepository(db).get()).resolves.toEqual({
      quality: 'original',
      smartAutoSave: false,
      alerts: false,
      allowCellular: false,
      themeMode: 'dark',
      metadata: { changedBy: 'test' },
      metadataVersion: 1,
    });
  });
});
