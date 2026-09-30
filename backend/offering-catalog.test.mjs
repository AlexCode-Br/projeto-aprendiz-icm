import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ensureOfferingCatalog } from './offering-catalog.mjs';
import { COURSE_SUGGESTIONS, CHURCH_SUGGESTIONS, catalogKey, churchName } from '../shared/catalog-options.mjs';

test('catálogo de ofertas completa banco parcial, mantém IDs e inclui EAD sem duplicar nomes', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE courses(id INTEGER PRIMARY KEY,name TEXT UNIQUE,active INTEGER); CREATE TABLE locations(id INTEGER PRIMARY KEY,name TEXT UNIQUE,active INTEGER)');
    db.prepare('INSERT INTO courses VALUES (7,?,1),(8,?,1)').run(' VIOLAO I ', 'Clarinete');
    db.prepare('INSERT INTO locations VALUES (9,?,0),(10,?,1)').run('ICM Pituba', 'Local personalizado');
    await ensureOfferingCatalog(db);
    await ensureOfferingCatalog(db);
    const courses = db.prepare('SELECT * FROM courses').all();
    const locations = db.prepare('SELECT * FROM locations').all();
    for (const name of COURSE_SUGGESTIONS) assert.equal(courses.filter(row => catalogKey(row.name) === catalogKey(name) && row.active === 1).length, 1);
    for (const name of CHURCH_SUGGESTIONS) assert.equal(locations.filter(row => catalogKey(churchName(row.name)) === catalogKey(name) && row.active === 1).length, 1);
    assert.equal(courses.find(row => row.id === 7).name, ' VIOLAO I ');
    assert.equal(locations.find(row => row.id === 9).name, 'ICM Pituba');
    assert.ok(courses.some(row => row.name === 'Clarinete'));
    assert.ok(locations.some(row => row.name === 'Local personalizado'));
  } finally { db.close(); }
});
