import type { SqliteDatabase } from '../history/schema';

export type SettingsQuality = 'balanced' | 'original' | 'audio';
export type SettingsThemeMode = 'system' | 'light' | 'dark';
export type SettingsMetadata = Record<string, unknown>;
export type Settings = {
  quality: SettingsQuality; smartAutoSave: boolean; alerts: boolean; allowCellular: boolean;
  themeMode: SettingsThemeMode; metadataVersion: number; metadata: SettingsMetadata;
};
export type SettingsInput = Omit<Settings, 'metadataVersion'>;
type DeepReadonly<T> = T extends Record<string, unknown>
  ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
  : T;
type SettingsRow = {
  quality: SettingsQuality; smart_auto_save: number; alerts: number; allow_cellular: number;
  theme_mode: SettingsThemeMode; metadata_version: number; metadata_json: string;
};

export const defaultSettings: DeepReadonly<Settings> = deepFreeze({
  quality: 'balanced', smartAutoSave: true, alerts: true, allowCellular: true, themeMode: 'system', metadataVersion: 1, metadata: {},
});

export class SettingsRepository {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly now: () => number = Date.now,
  ) {}

  async get(): Promise<Settings> {
    const row = await this.database.getFirstAsync<SettingsRow>('SELECT * FROM settings WHERE singleton_id = 1');
    if (row) return rowToSettings(row);
    const defaults = copyDefaults();
    await this.save(defaults);
    return defaults;
  }

  async save(input: SettingsInput, updatedAt = this.now()): Promise<void> {
    await this.database.runAsync(
      `INSERT INTO settings (
        singleton_id, quality, smart_auto_save, alerts, allow_cellular, theme_mode,
        metadata_version, metadata_json, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(singleton_id) DO UPDATE SET quality = excluded.quality,
        smart_auto_save = excluded.smart_auto_save, alerts = excluded.alerts,
        allow_cellular = excluded.allow_cellular, theme_mode = excluded.theme_mode,
        metadata_version = excluded.metadata_version, metadata_json = excluded.metadata_json,
        updated_at = excluded.updated_at`,
      input.quality, input.smartAutoSave ? 1 : 0, input.alerts ? 1 : 0, input.allowCellular ? 1 : 0,
      input.themeMode, 1, JSON.stringify(input.metadata), updatedAt,
    );
  }
}

function copyDefaults(): Settings {
  return {
    quality: defaultSettings.quality,
    smartAutoSave: defaultSettings.smartAutoSave,
    alerts: defaultSettings.alerts,
    allowCellular: defaultSettings.allowCellular,
    themeMode: defaultSettings.themeMode,
    metadataVersion: defaultSettings.metadataVersion,
    metadata: { ...defaultSettings.metadata },
  };
}

function deepFreeze<T extends Record<string, unknown>>(value: T): DeepReadonly<T> {
  for (const child of Object.values(value)) {
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      deepFreeze(child as Record<string, unknown>);
    }
  }
  return Object.freeze(value) as DeepReadonly<T>;
}

function rowToSettings(row: SettingsRow): Settings {
  return {
    quality: row.quality, smartAutoSave: row.smart_auto_save === 1, alerts: row.alerts === 1,
    allowCellular: row.allow_cellular === 1, themeMode: row.theme_mode,
    metadataVersion: row.metadata_version, metadata: parseMetadata(row.metadata_json),
  };
}

function parseMetadata(value: string): SettingsMetadata {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as SettingsMetadata : {};
  } catch { return {}; }
}
