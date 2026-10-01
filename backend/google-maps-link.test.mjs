import test from 'node:test';
import assert from 'node:assert/strict';
import { googleMapsLink } from '../shared/google-maps-link.mjs';

test('local da turma aceita links oficiais do Maps e rejeita outros destinos',()=>{
  for(const url of ['https://maps.app.goo.gl/example','https://goo.gl/maps/example','https://www.google.com/maps/place/Pituba','https://www.google.com.br/maps?q=Salvador','https://maps.google.com/?q=Salvador']) assert.equal(googleMapsLink(url),url);
  for(const url of ['javascript:alert(1)','http://maps.google.com/','https://google.com.evil.test/maps','https://www.google.com/url?q=https://evil.test','https://user:pass@maps.google.com/','https://maps.app.goo.gl:9999/test','https://example.com/maps',null,'']) assert.equal(googleMapsLink(url),'');
});
