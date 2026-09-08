import assert from 'node:assert/strict';
import test from 'node:test';
import { createLazyClient } from './lazy-client.mjs';

test('cliente sob demanda só inicializa o SDK no primeiro uso', () => {
  let constructions = 0;
  const client = createLazyClient(value => {
    constructions += 1;
    return {
      value,
      readValue() { return this.value; },
    };
  }, 'seguro');

  assert.equal(constructions, 0);
  assert.equal(Boolean(client), true);
  assert.equal(constructions, 0);
  assert.equal(client.value, 'seguro');
  assert.equal(constructions, 1);
  assert.equal(client.readValue(), 'seguro');
  assert.equal(constructions, 1);
});
