import { COURSE_SUGGESTIONS, CHURCH_SUGGESTIONS, catalogKey, churchName } from '../shared/catalog-options.mjs';

// The same permanent catalogue is available in Node and the production Worker.
// Preserve existing IDs and custom entries; never rename records linked to a class.
export async function ensureOfferingCatalog(db) {
  for (const [table, names] of [['courses', COURSE_SUGGESTIONS], ['locations', CHURCH_SUGGESTIONS]]) {
    const rows = await db.prepare(`SELECT id,name,active FROM ${table}`).all();
    const normalize = name => catalogKey(table === 'locations' ? churchName(name) : name);
    const existing = new Map(rows.map(row => [normalize(row.name), row]));
    for (const name of names) {
      const row = existing.get(normalize(name));
      if (!row) await db.prepare(`INSERT INTO ${table} (name,active) VALUES (?,1) ON CONFLICT DO NOTHING`).run(name);
      else if (Number(row.active) !== 1) await db.prepare(`UPDATE ${table} SET active=1 WHERE id=?`).run(row.id);
    }
  }
}
