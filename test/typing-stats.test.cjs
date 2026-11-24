'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {TypingStats, isCharacterPress} = require('../app/typing-stats.cjs');
const {LocalStore} = require('../app/local-store.cjs');

test('the typing count includes character keys and skips editing, navigation and shortcuts', () => {
  for (const code of ['KeyA', 'Space', 'Digit2', 'Comma', 'Numpad7']) assert.ok(isCharacterPress(code, {}));
  for (const code of ['ArrowLeft', 'Backspace', 'F2', 'Enter', 'ControlLeft', 'NumpadHome']) {
    assert.ok(!isCharacterPress(code, {}));
  }
  assert.ok(isCharacterPress('KeyA', {shiftKey: true}));
  for (const flag of ['ctrlKey', 'altKey', 'metaKey']) assert.ok(!isCharacterPress('KeyA', {[flag]: true}));
});

test('speed is a rolling minute and pausing leaves the daily total intact', () => {
  const day = new Date(2026, 10, 24, 14, 20);
  const stats = new TypingStats();
  stats.setTracking(true);
  stats.record(0, day);
  stats.record(1000, day);
  stats.record(1000, day);
  assert.deepEqual(stats.snapshot(59999, day), {speed: 3, today: 3});
  assert.deepEqual(stats.snapshot(60000, day), {speed: 2, today: 3});
  stats.setTracking(false);
  stats.record(60100, day);
  assert.deepEqual(stats.snapshot(61000, day), {speed: null, today: 3});
  stats.setTracking(true);
  assert.deepEqual(stats.snapshot(62000, day), {speed: 0, today: 3});
});

test('today and the independent label options reopen from configuration and reset on a local date change', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-typing-stats-'));
  t.after(() => fs.rmSync(directory, {recursive: true, force: true}));
  const open = () => new LocalStore(directory);
  const store = open();
  store.patchSettings({showTypingStats: true, showTypingSpeed: false, showTypingTotal: true});
  const stats = new TypingStats(store.state.typingDaily);
  const date = new Date(2026, 10, 24, 23, 59);
  stats.setTracking(true);
  stats.record(500, date);
  stats.record(750, date);
  stats.flush(daily => store.saveTypingDaily(daily));
  const reopened = open();
  assert.equal(reopened.state.settings.showTypingSpeed, false);
  assert.equal(reopened.state.settings.showTypingTotal, true);
  const loaded = new TypingStats(reopened.state.typingDaily);
  assert.deepEqual(loaded.snapshot(0, date), {speed: null, today: 2});
  const next = new Date(2026, 10, 25, 0, 0);
  assert.deepEqual(loaded.snapshot(90, next), {speed: null, today: 0});
  loaded.setTracking(true);
  loaded.record(120, next);
  loaded.flush(daily => reopened.saveTypingDaily(daily));
  assert.deepEqual(open().state.typingDaily, {day: '2026-11-25', count: 1});
});
