'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const {OverlayInteraction} = require('../app/platform/overlay-interaction.cjs');

function desktop(t) {
  const state = {
    bounds: {x: -820, y: 70, width: 400, height: 330},
    cursor: {x: -620, y: 235},
    saved: [], samples: [], placements: [], messages: [],
  };
  const win = {
    isDestroyed: () => false,
    getBounds: () => ({...state.bounds}),
    setBounds: bounds => { state.bounds = {...bounds}; state.placements.push({...bounds}); },
    setIgnoreMouseEvents: ignore => { state.ignoresMouse = ignore; },
    setAlwaysOnTop() {},
  };
  const screen = {
    getCursorScreenPoint: () => ({...state.cursor}),
    getDisplayMatching: () => ({workArea: {x: -1280, y: 0, width: 1280, height: 1024}}),
  };
  const interaction = new OverlayInteraction(win, screen, {
    send(channel, value) { state.messages.push([channel, value]); },
    save(patch, options) { state.saved.push(patch); state.saveOptions = options; },
    input: sample => state.samples.push(sample),
  });
  interaction.setRegions([{x: .5, y: .5, rx: .18, ry: .20}]);
  interaction.start();
  t.after(() => interaction.stop());
  return {state, interaction};
}

test('stroking across transparent space cannot move the window, even with a stale drag request', t => {
  const {state, interaction} = desktop(t);
  const origin = {...state.bounds};
  for (const kind of ['move', 'hold', 'se']) {
    interaction.begin(kind);
    assert.equal(interaction.gesture, undefined);
  }
  interaction.begin('pet');
  state.cursor.x -= 460;
  state.cursor.y += 140;
  interaction.tick();
  assert.equal(state.ignoresMouse, false);
  interaction.end(true);
  interaction.tick();
  assert.equal(state.ignoresMouse, true);
  assert.deepEqual(state.bounds, origin);
  assert.deepEqual(state.saved, []);
});

test('the pet hand cursor tracks the clickable region and gives way to the edit cursors', t => {
  const {state, interaction} = desktop(t);
  const hover = () => state.messages.filter(([channel]) => channel === 'overlay:pet-hover').map(([, value]) => value);
  interaction.tick();
  assert.deepEqual(hover(), [true]);
  state.cursor.x += 170;
  interaction.tick();
  assert.equal(state.ignoresMouse, true);
  state.cursor.x -= 170;
  interaction.tick();
  interaction.setEditing(true);
  interaction.tick();
  assert.equal(state.ignoresMouse, false);
  assert.deepEqual(hover(), [true, false, true, false]);
  interaction.setEditing(false);
  interaction.stop();
  assert.deepEqual(hover(), [true, false, true, false, true, false]);
});

test('only the editor moves or resizes the window and a cancelled drag restores its origin', t => {
  const {state, interaction} = desktop(t);
  interaction.setEditing(true);
  interaction.begin('move');
  state.cursor.x += 90;
  state.cursor.y += 30;
  interaction.tick();
  assert.deepEqual(state.bounds, {x: -730, y: 100, width: 400, height: 330});
  state.cursor.x += 3; // The release can arrive between native poll ticks.
  interaction.end(true);
  assert.deepEqual(state.saved, [{position: {x: -727, y: 100}}]);
  const moved = {...state.bounds};
  interaction.begin('nw');
  state.cursor.x -= 42;
  state.cursor.y -= 35;
  interaction.tick();
  assert.ok(state.bounds.width > moved.width && state.bounds.height > moved.height);
  assert.equal(state.bounds.x + state.bounds.width, moved.x + moved.width);
  assert.equal(state.bounds.y + state.bounds.height, moved.y + moved.height);
  interaction.end(true);
  assert.deepEqual(state.saved[1], {size: state.bounds.height, position: {x: state.bounds.x, y: state.bounds.y}});
  const resized = {...state.bounds};
  interaction.begin('move');
  state.cursor.y += 65;
  interaction.tick();
  interaction.setEditing(false);
  assert.deepEqual(state.bounds, resized);
  interaction.begin('move');
  state.cursor.x += 50;
  interaction.end(true);
  assert.deepEqual(state.bounds, resized);
  assert.equal(state.saved.length, 2);
});

test('gaze uses window-relative coordinates outside the pet and refreshes without waking on a layout change', t => {
  const {state, interaction} = desktop(t);
  assert.deepEqual(state.samples, [{pointer: {x: 0, y: 0}}]);
  state.cursor.x -= 600;
  state.cursor.y += 330;
  interaction.tick();
  assert.deepEqual(state.samples.at(-1), {pointer: {x: -3, y: 2}, move: true, dx: -150, dy: 150});
  Object.assign(state.bounds, {x: -1220, y: 235, width: 800, height: 660});
  interaction.tick();
  assert.deepEqual(state.samples.at(-1), {pointer: {x: -1, y: 0}});
  interaction.tick();
  assert.equal(state.samples.length, 3);
  interaction.refreshPointer();
  assert.deepEqual(state.samples[3], {pointer: {x: -1, y: 0}});
});

test('moving keeps the original size despite native rounding and preserves it when the move is saved', t => {
  const {state, interaction} = desktop(t);
  const {width, height} = state.bounds;
  interaction.setEditing(true);
  interaction.begin('move');
  for (let i = 0; i < 30; i++) {
    state.cursor.x += 31;
    state.cursor.y += 7;
    interaction.tick();
    // Windows can report an extra DIP after moving to a fractional pixel origin.
    state.bounds.width++;
    state.bounds.height++;
  }
  interaction.end(true);
  assert.ok(state.placements.every(bounds => bounds.width === width && bounds.height === height));
  assert.deepEqual(state.bounds, {x: -400, y: 280, width, height});
  assert.deepEqual(state.saved, [{position: {x: -400, y: 280}}]);
  assert.deepEqual(state.saveOptions, {alreadyPlaced: true});
  state.bounds.width++;
  state.bounds.height++;
  interaction.begin('move');
  state.cursor.x -= 31;
  interaction.tick();
  assert.equal(state.bounds.width, width);
  assert.equal(state.bounds.height, height);
  interaction.end(true);
});

test('hover refresh cannot re-pin a pet after the menu option is cleared', async t => {
  const {interaction} = desktop(t);
  const changes = [];
  interaction.window.setAlwaysOnTop = (value,level) => changes.push([value,level]);
  interaction.setPinned(true);
  interaction.allowMouse(true);
  interaction.setPinned(false);
  interaction.allowMouse(false);
  interaction.allowMouse(true);
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(changes, [[true,'pop-up-menu'],[false,'normal']]);
});

test('moving off the cat into its menu keeps hit testing active until edit mode takes over', t => {
  const {state, interaction} = desktop(t);
  interaction.setMenuOpen(true);
  state.cursor.x += 200;
  interaction.tick();
  assert.equal(state.ignoresMouse, false);
  interaction.setEditing(true);
  interaction.setMenuOpen(false);
  interaction.tick();
  assert.equal(state.ignoresMouse, false);
  interaction.setEditing(false);
  assert.equal(state.ignoresMouse, true);
});
