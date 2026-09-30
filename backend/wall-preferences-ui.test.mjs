import test from 'node:test';
import assert from 'node:assert/strict';
import { wallPreferenceValue, updateWallPreferences } from '../src/utils/wallPreferences.mjs';

test('mural selector preserves mixed legacy settings until an explicit choice', () => {
    const previous = { wallPosts: true, wallComments: false, wallLikes: true, systemAlerts: false };
    assert.equal(wallPreferenceValue(previous), 'mixed');
    assert.equal(updateWallPreferences(previous, 'mixed'), previous);
    for (const value of ['all', 'none']) {
        const next = updateWallPreferences(previous, value);
        assert.equal(wallPreferenceValue(next), value);
        for (const key of ['wallPosts', 'wallComments', 'wallLikes']) assert.equal(next[key], value === 'all');
        assert.equal(next.systemAlerts, false);
    }
    assert.equal(previous.wallComments, false);
    assert.equal(wallPreferenceValue({}), 'all');
});
