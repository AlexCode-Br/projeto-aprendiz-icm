import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const migration = await readFile(join(import.meta.dirname, 'migrations', '017_merge_remote_location_into_ead.sql'), 'utf8');

test('migração consolida Remoto em EAD sem apagar turmas ou seus vínculos', () => {
  assert.match(migration, /UPDATE classes\s+SET location_id=ead_location_id/i);
  assert.match(migration, /UPDATE professor_profiles SET home_location_id=ead_location_id/i);
  assert.match(migration, /UPDATE locations SET name='EAD',active=1/i);
  assert.doesNotMatch(migration, /DELETE FROM (classes|enrollments|attendance_sessions|attendance_records)/i);
});
