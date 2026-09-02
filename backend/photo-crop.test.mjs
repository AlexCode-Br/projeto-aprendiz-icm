import test from 'node:test';
import assert from 'node:assert/strict';
import { getPhotoCrop, movePhotoCrop } from '../shared/photo-crop.mjs';

test('recorte central quadrado em fotos horizontais e verticais', () => {
    assert.deepEqual(getPhotoCrop(1200, 800), { x: 200, y: 0, size: 800 });
    assert.deepEqual(getPhotoCrop(800, 1200), { x: 0, y: 200, size: 800 });
});
test('zoom e posição nunca permitem áreas fora da imagem', () => {
    for (const [width, height] of [[1200, 800], [800, 1200], [512, 512]]) {
        for (const zoom of [0, 1, 1.5, 3, 10]) {
            for (const position of [{ x: -1, y: -1 }, { x: 0.5, y: 0.5 }, { x: 2, y: 2 }]) {
                const crop = getPhotoCrop(width, height, zoom, position);
                assert.ok(crop.x >= 0 && crop.y >= 0);
                assert.ok(crop.x + crop.size <= width && crop.y + crop.size <= height);
            }
        }
    }
});
test('arraste é independente do tamanho de prévia e respeita limites', () => {
    assert.deepEqual(movePhotoCrop(1200, 800, 2, { x: 0.5, y: 0.5 }, 20, 10, 200), movePhotoCrop(1200, 800, 2, { x: 0.5, y: 0.5 }, 40, 20, 400));
    assert.deepEqual(movePhotoCrop(512, 512, 1, { x: 0.5, y: 0.5 }, 100, 100, 288), { x: 0.5, y: 0.5 });
    assert.throws(() => getPhotoCrop(0, 800));
});
