import assert from 'node:assert/strict';
import test from 'node:test';
import { describeDevice } from '../src/utils/deviceInfo.js';

test('identifica navegadores e sistemas usados pelos dispositivos conectados', () => {
  assert.deepEqual(describeDevice('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36'), {
    browser: 'Chrome', system: 'Android', mobile: true, label: 'Android · Chrome',
  });
  assert.equal(describeDevice('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Edg/140.0').label, 'Windows · Edge');
  assert.equal(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1').label, 'iOS · Safari');
});
