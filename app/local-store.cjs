'use strict';

const path = require('node:path');
const fs = require('node:fs');

const corners = ['bottom-right', 'bottom-left', 'top-right', 'top-left'];
const defaults = {
  visible: true, alwaysOnTop: true, inputEnabled: true, size: 340, corner: 'bottom-right',
  sleepSeconds: 60, leftHanded: false, privacyMode: false,
  showTypingStats: true, showTypingSpeed: true, showTypingTotal: true,
};
const booleanSettings = ['visible', 'alwaysOnTop', 'inputEnabled', 'leftHanded', 'privacyMode',
  'showTypingStats', 'showTypingSpeed', 'showTypingTotal'];
const normalizeDuration = value => Math.round(Math.max(10, Math.min(7200, value)));

function validPosition(position) {
  return position && [position.x, position.y].every(value => Number.isFinite(value) && Math.abs(value) < 100000);
}
function settingsPatch(current, patch) {
  const next = {...current};
  for (const field of booleanSettings) {
    if (typeof patch?.[field] === 'boolean') next[field] = patch[field];
  }
  if (Number.isFinite(patch?.size)) next.size = Math.round(Math.max(220, Math.min(570, patch.size)));
  if (Number.isFinite(patch?.sleepSeconds)) next.sleepSeconds = normalizeDuration(patch.sleepSeconds);
  if (corners.includes(patch?.corner)) {
    next.corner = patch.corner;
    delete next.position;
  }
  if (validPosition(patch?.position)) next.position = {x:Math.round(patch.position.x),y:Math.round(patch.position.y)};
  return next;
}

class LocalStore {
  constructor(dir) {
    fs.mkdirSync(dir, {recursive: true});
    this.file = path.join(dir, 'desk-pet.json');
    let saved;
    try {
      saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') this.warning = '本地设置读取失败，已使用默认设置。';
    }
    this.state = {settings: settingsPatch(defaults, saved?.settings)};
    const daily = saved?.typingDaily;
    if (/^\d{4}-\d{2}-\d{2}$/.test(daily?.day) && Number.isSafeInteger(daily.count) && daily.count >= 0) {
      this.state.typingDaily = {day: daily.day, count: daily.count};
    }
  }

  commit(next) {
    const temp = this.file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(next), {mode: 0o600});
    fs.renameSync(temp, this.file);
    this.state = next;
  }

  patchSettings(patch) {
    this.commit({...this.state, settings: settingsPatch(this.state.settings, patch)});
  }

  saveTypingDaily(daily) {
    this.commit({...this.state, typingDaily: daily});
  }
}

module.exports = {LocalStore};
