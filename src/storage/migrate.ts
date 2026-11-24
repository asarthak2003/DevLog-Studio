import { DayLog } from '../core/types';
import { CURRENT_SCHEMA_VERSION } from './schema';

type MigrationStep = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migration registry: maps (version) -> function transforming to (version + 1).
 */
const migrations: Record<number, MigrationStep> = {
  // Example: 1: (v1Data) => { return { ...v1Data, schemaVersion: 2 }; }
};

/**
 * Sequentially applies migrations to ensure loaded JSON matches the current schema.
 */
export function migrateDayLog(raw: unknown): DayLog {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid day log payload: must be an object');
  }

  let data = { ...(raw as Record<string, unknown>) };
  let version = typeof data.schemaVersion === 'number' ? data.schemaVersion : 1;

  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = migrations[version];
    if (!migration) {
      break;
    }
    data = migration(data);
    version = (data.schemaVersion as number) || version + 1;
  }

  // Ensure default structures exist
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    workspaceId: typeof data.workspaceId === 'string' ? data.workspaceId : 'default',
    date: typeof data.date === 'string' ? data.date : new Date().toISOString().slice(0, 10),
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    files: typeof data.files === 'object' && data.files !== null ? (data.files as DayLog['files']) : {},
    events: Array.isArray(data.events) ? data.events : [],
    notes: Array.isArray(data.notes) ? data.notes : undefined,
  };
}
