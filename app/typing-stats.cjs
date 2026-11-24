'use strict';

const punctuation = new Set([
  'Space', 'Semicolon', 'Equal', 'Comma', 'Minus', 'Period', 'Slash', 'Backquote',
  'BracketLeft', 'Backslash', 'BracketRight', 'Quote',
  'NumpadMultiply', 'NumpadAdd', 'NumpadSubtract', 'NumpadDecimal', 'NumpadDivide',
]);

function isCharacterPress(code, {ctrlKey, altKey, metaKey}) {
  return !!code && !ctrlKey && !altKey && !metaKey
    && (punctuation.has(code) || /^(?:Key[A-Z]|Digit[0-9]|Numpad[0-9])$/.test(code));
}

function localDay(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, i) => String(part).padStart(i ? 2 : 4, '0')).join('-');
}

class TypingStats {
  constructor(daily) {
    this.day = daily?.day;
    this.today = daily?.count ?? 0;
    this.tracking = false;
    this.dirty = false;
    this.recent = new Map();
  }

  setTracking(enabled) {
    if (enabled === this.tracking) return;
    this.tracking = enabled;
    this.recent.clear();
  }

  checkDay(date) {
    const today = localDay(date);
    if (this.day === today) return;
    this.day = today;
    this.today = 0;
  }

  record(time = performance.now(), date = new Date()) {
    if (!this.tracking) return;
    this.checkDay(date);
    const second = Math.floor(time / 1000);
    this.recent.set(second, (this.recent.get(second) ?? 0) + 1);
    this.today++;
    this.dirty = true;
  }

  snapshot(time = performance.now(), date = new Date()) {
    this.checkDay(date);
    const first = Math.floor(time / 1000) - 59;
    let speed = 0;
    for (const [second, count] of this.recent) {
      if (second < first) this.recent.delete(second);
      else speed += count;
    }
    return {speed: this.tracking ? speed : null, today: this.today};
  }

  flush(save) {
    if (!this.dirty) return;
    save({day: this.day, count: this.today});
    this.dirty = false;
  }
}

module.exports = {TypingStats, isCharacterPress};
