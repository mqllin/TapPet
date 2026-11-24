'use strict';

const aspectRatio = 1.21;
const minimumSize = 220;
const maximumSize = 570;
const resizeCorners = new Set(['nw', 'ne', 'sw', 'se']);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function dimensions(size, area) {
  const limit = Math.min(area.height, Math.floor(area.width / aspectRatio), maximumSize);
  const height = Math.round(clamp(size, Math.min(limit, minimumSize), limit));
  return {width: Math.round(height * aspectRatio), height};
}

function constrainPosition({x, y, width, height}, area) {
  return {
    x: clamp(x, area.x, Math.max(area.x, area.x + area.width - width)),
    y: clamp(y, area.y, Math.max(area.y, area.y + area.height - height)),
  };
}

function overlayBounds(screen, {size, corner, position}) {
  const preferred = position
    ? {...position, width: Math.round(size * aspectRatio), height: size}
    : null;
  const {workArea: area} = preferred ? screen.getDisplayMatching(preferred) : screen.getPrimaryDisplay();
  const {width, height} = dimensions(size, area);
  const gap = 8;
  const right = area.x + area.width - width;
  const bottom = area.y + area.height - height;
  return {...constrainPosition({
    x: preferred?.x ?? (corner.endsWith('right') ? right - gap : area.x + gap),
    y: preferred?.y ?? (corner.startsWith('bottom') ? bottom - gap : area.y + gap),
    width,
    height,
  }, area), width, height};
}

function isRegion(region) {
  return region && [region.x, region.y, region.rx, region.ry].every(value => Number.isFinite(value) && value >= 0 && value <= 1)
    && region.rx > 0 && region.ry > 0;
}

class OverlayInteraction {
  constructor(window, screen, {send, save, input}) {
    this.window = window;
    this.screen = screen;
    this.send = send;
    this.save = save;
    this.input = input;
    this.regions = [];
    this.interactive = false;
    this.editing = false;
    this.hovering = false;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 16);
    this.tick();
  }

  stop() {
    clearInterval(this.timer);
    clearTimeout(this.cursorRefresh);
    this.timer = undefined;
    this.menuOpen = false;
    this.lastCursor = undefined;
    this.lastPointer = undefined;
    if (this.gesture || this.petting) {
      this.end(false);
      this.send('overlay:cancel-gesture');
    }
    if (this.editing) {
      this.editing = false;
      this.send('overlay:resize-mode', false);
    }
    this.setHover(false);
    this.allowMouse(false);
  }

  setRegions(regions) {
    this.regions = Array.isArray(regions) ? regions.slice(0, 2).filter(isRegion) : [];
  }

  place(bounds) {
    this.moveSize = undefined;
    this.window.setBounds(bounds, false);
  }

  setPinned(pinned) {
    this.pinned = pinned;
    clearTimeout(this.cursorRefresh);
    this.window.setAlwaysOnTop(pinned, pinned ? 'pop-up-menu' : 'normal');
  }

  allowMouse(interactive) {
    if (this.interactive === interactive || this.window.isDestroyed()) return;
    this.interactive = interactive;
    this.window.setIgnoreMouseEvents(!interactive, {forward: true});
    if (process.platform === 'win32' && this.timer && this.pinned) {
      // Once Chromium has the new hover state, refresh Win32 hit testing without moving
      // the window or taking focus. This also covers a pointer that stops on the boundary.
      clearTimeout(this.cursorRefresh);
      this.cursorRefresh = setTimeout(() => {
        if (this.pinned && !this.window.isDestroyed()) this.window.setAlwaysOnTop(true, 'pop-up-menu');
      }, 25);
    }
  }

  setHover(hovering) {
    if (this.hovering === hovering) return;
    this.hovering = hovering;
    this.send('overlay:pet-hover', hovering);
  }

  refreshPointer() {
    this.lastPointer = undefined;
    this.tick();
  }

  tick() {
    if (!this.timer || this.window.isDestroyed()) return;
    const cursor = this.screen.getCursorScreenPoint();
    const previous = this.lastCursor;
    this.lastCursor = cursor;
    if (this.gesture) this.advance(cursor);
    const bounds = this.window.getBounds();
    const x = (cursor.x - bounds.x) / bounds.width;
    const y = (cursor.y - bounds.y) / bounds.height;
    const pointer = {x: 2 * x - 1, y: 2 * y - 1};
    const moved = previous && (cursor.x !== previous.x || cursor.y !== previous.y);
    if (moved || pointer.x !== this.lastPointer?.x || pointer.y !== this.lastPointer?.y) {
      const sample = {pointer};
      if (moved) {
        sample.move = true;
        sample.dx = clamp(cursor.x - previous.x, -150, 150);
        sample.dy = clamp(cursor.y - previous.y, -150, 150);
      }
      this.input(sample);
      this.lastPointer = pointer;
    }
    if (this.editing || this.menuOpen) return;
    const hovering = this.regions.some(region => ((x - region.x) / region.rx) ** 2 + ((y - region.y) / region.ry) ** 2 <= 1);
    if (!this.petting) this.allowMouse(hovering);
    this.setHover(hovering);
  }

  begin(kind) {
    if (!this.timer || !this.interactive || this.gesture || this.petting) return;
    if (!this.editing) {
      // Keep delivering the release when a stroke crosses a transparent part of the window.
      this.petting = kind === 'pet';
      return;
    }
    if (kind !== 'move' && !resizeCorners.has(kind)) return;
    const origin = this.window.getBounds();
    if (kind === 'move') {
      // Keep the same size on subsequent drags, even if the native bounds now report a rounded edge.
      this.moveSize ??= {width: origin.width, height: origin.height};
      Object.assign(origin, this.moveSize);
    }
    this.gesture = {
      kind,
      cursor: this.screen.getCursorScreenPoint(),
      origin,
    };
  }

  advance(cursor) {
    const gesture = this.gesture;
    const dx = cursor.x - gesture.cursor.x;
    const dy = cursor.y - gesture.cursor.y;
    const {origin} = gesture;
    if (gesture.kind === 'move') {
      const x = Math.round(origin.x + dx);
      const y = Math.round(origin.y + dy);
      const current = gesture.latest ?? origin;
      if (current.x === x && current.y === y) return;
      gesture.latest = {...origin, x, y};
      // At fractional display scaling, setPosition can round the current size up on every move.
      this.window.setBounds(gesture.latest, false);
      return;
    }
    const left = gesture.kind.endsWith('w');
    const top = gesture.kind.startsWith('n');
    const newSize = origin.height + ((left ? -dx : dx) * aspectRatio + (top ? -dy : dy)) / (1 + aspectRatio ** 2);
    const {workArea} = this.screen.getDisplayMatching(origin);
    const {width, height} = dimensions(newSize, workArea);
    if ((gesture.latest?.height ?? origin.height) === height) return;
    const x = left ? origin.x + origin.width - width : origin.x;
    const y = top ? origin.y + origin.height - height : origin.y;
    gesture.latest = {x, y, width, height};
    this.window.setBounds(gesture.latest, false);
  }

  end(commit) {
    const gesture = this.gesture;
    this.petting = false;
    if (commit && gesture && !this.window.isDestroyed()) this.advance(this.screen.getCursorScreenPoint());
    this.gesture = undefined;
    if (!gesture?.latest || this.window.isDestroyed()) return;
    if (!commit) {
      this.window.setBounds(gesture.origin, false);
      return;
    }
    if (gesture.kind === 'move') {
      const {latest} = gesture;
      const position = constrainPosition(latest, this.screen.getDisplayMatching(latest).workArea);
      if (position.x !== latest.x || position.y !== latest.y) this.window.setBounds({...latest, ...position}, false);
      this.save({position}, {alreadyPlaced: true});
    } else {
      const {x, y, height} = gesture.latest;
      this.moveSize = undefined;
      this.save({position: {x, y}, size: height});
    }
  }

  setMenuOpen(open) {
    this.menuOpen = open;
    if (open) clearTimeout(this.cursorRefresh);
    else this.tick();
  }

  setEditing(editing) {
    if (!this.timer || this.editing === editing) return;
    this.end(false);
    this.editing = editing;
    this.send('overlay:resize-mode', editing);
    if (editing) {
      this.setHover(false);
      this.allowMouse(true);
    } else this.tick();
  }

  stepSize(delta) {
    if (!this.timer || !this.editing || this.gesture || ![-20, 20].includes(delta)) return;
    const bounds = this.window.getBounds();
    const {workArea} = this.screen.getDisplayMatching(bounds);
    const {width, height} = dimensions(bounds.height + delta, workArea);
    if (height === bounds.height) return;
    const x = bounds.x + Math.round((bounds.width - width) / 2);
    const y = bounds.y + Math.round((bounds.height - height) / 2);
    this.save({size: height, position: {x, y}});
  }
}

module.exports = {OverlayInteraction, overlayBounds};
