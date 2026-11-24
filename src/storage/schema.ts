// Schema versions and definitions for DevLog Studio persistent records.

export const CURRENT_SCHEMA_VERSION = 1;

export function isValidDayLog(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.schemaVersion === 'number' &&
    typeof obj.workspaceId === 'string' &&
    typeof obj.date === 'string' &&
    Array.isArray(obj.sessions) &&
    typeof obj.files === 'object' &&
    obj.files !== null
  );
}
