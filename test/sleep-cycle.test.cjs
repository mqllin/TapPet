'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createSleepCycle} = require('../app/overlay/sleep-cycle.js');

test('mouse movement resets the sixty-second idle clock and sleep settles gradually', () => {
  const cycle = createSleepCycle(0, 60_000, () => .5);
  assert.equal(cycle.sample(59_999), null);
  cycle.activity(59_999);
  assert.equal(cycle.sample(119_998), null);
  const start = 119_999;
  assert.equal(cycle.sample(start).phase, 'settling');
  const halfway = cycle.sample(start + 350);
  assert.equal(halfway.curl, .5);
  assert.equal(halfway.showZ, false);
  assert.deepEqual(cycle.sample(start + 700), {posture:'loaf', phase: 'sleeping', curl: 1, lid: 1, showZ: true});
});

test('waking opens the eyes, holds the pose for a second, rises, then yawns once', () => {
  const cycle = createSleepCycle(0, 60_000, () => .5);
  cycle.sample(60_000);
  const wake = 61_200;
  cycle.activity(wake);
  const opening = cycle.sample(wake + 90);
  assert.equal(opening.phase, 'opening');
  assert.equal(opening.curl, 1);
  assert.equal(opening.lid, .5);
  assert.equal(opening.frozen, true);
  assert.equal(opening.showZ, undefined);

  cycle.activity(wake + 150);
  for (const offset of [180, 800, 1179]) {
    assert.deepEqual(cycle.sample(wake + offset), {posture:'loaf', phase: 'holding', curl: 1, lid: 0, frozen: true});
  }
  assert.equal(cycle.sample(wake + 1180).phase, 'rising');
  assert.equal(cycle.sample(wake + 1605).curl, .5);
  assert.equal(cycle.sample(wake + 2029).phase, 'rising');
  assert.equal(cycle.sample(wake + 2030).phase, 'yawning');
  const yawning = cycle.sample(wake + 2655);
  assert.equal(yawning.phase, 'yawning');
  assert.equal(yawning.curl, 0);
  assert.equal(yawning.yawn, 1);
  assert.equal(yawning.lid, .72);
  assert.equal(cycle.sample(wake + 3280), null);
  assert.equal(cycle.sample(wake + 60_149), null);
  assert.equal(cycle.sample(wake + 60_150).phase, 'settling');
});

test('movement while curling keeps the current posture when beginning a wake', () => {
  const cycle = createSleepCycle(0, 60_000, () => .5);
  cycle.sample(60_000);
  const settling = cycle.sample(60_350);
  cycle.activity(60_350);
  const opening = cycle.sample(60_350);
  assert.equal(opening.curl, settling.curl);
  assert.equal(opening.lid, settling.lid);
});

test('each set of three naps uses all postures and a wake keeps its original posture', () => {
  const cycle = createSleepCycle(0, 20, () => .5);
  const naps = [];
  for (let i = 0; i < 9; i++) {
    const t = i*5000;
    cycle.startSleep(t);
    const {posture} = cycle.sample(t+900);
    assert.equal(cycle.sample(t+1400).posture, posture);
    cycle.activity(t+1500);
    for (const offset of [90, 800, 1350, 2600]) assert.equal(cycle.sample(t+1500+offset).posture, posture);
    assert.notEqual(naps.at(-1), posture);
    naps.push(posture);
    if (naps.length%3 === 0) assert.equal(new Set(naps.slice(-3)).size,3);
  }
});
