'use strict';

(() => {
  const api = window.desktopPet;
  const report = message => api.reportProblem(message);
  const pet = document.querySelector('#pet');
  const editor = document.querySelector('#scale-editor');
  const size = document.querySelector('#pet-size');
  const statsBar = document.querySelector('#typing-stats');
  const speed = document.querySelector('#typing-speed');
  const total = document.querySelector('#typing-total');
  const speedValue = document.querySelector('#typing-speed-value');
  const totalValue = document.querySelector('#typing-total-value');
  const number = new Intl.NumberFormat(document.documentElement.lang);
  let scene;
  let regions = [];
  let pointerId;
  let gesture;
  const cards = document.querySelector('#pet-cards');
  const showSize = () => { size.value = window.innerHeight + ' px'; };

  function regionAt(event) {
    const x = event.clientX / window.innerWidth;
    const y = event.clientY / window.innerHeight;
    return regions.find(region => region && ((x - region.x) / region.rx) ** 2 + ((y - region.y) / region.ry) ** 2 <= 1);
  }

  function finish(commit) {
    if (pointerId === undefined) return;
    const pointer = pointerId;
    pointerId = undefined;
    if (document.body.hasPointerCapture(pointer)) document.body.releasePointerCapture(pointer);
    document.body.classList.remove('dragging');
    if (gesture === 'pet') scene?.setPetting(false);
    gesture = undefined;
    api.endOverlayGesture(commit);
  }

  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || pointerId !== undefined) return;
    if (editor.hidden) {
      if (!regionAt(event)) return;
      gesture = 'pet';
    } else {
      if (!editor.contains(event.target) || event.target.closest('.scale-toolbar')) return;
      gesture = event.target.closest('[data-corner]')?.dataset.corner ?? 'move';
    }
    event.preventDefault();
    pointerId = event.pointerId;
    document.body.setPointerCapture(pointerId);
    if (gesture === 'pet') {
      const center = regions[0]?.x ?? .5;
      scene?.setPetting(true, event.clientX / window.innerWidth >= center ? -1 : 1);
    }
    document.body.classList.toggle('dragging', gesture === 'move');
    api.beginOverlayGesture(gesture);
  });
  document.addEventListener('pointerup', event => {
    if (event.pointerId === pointerId) finish(true);
  });
  for (const eventName of ['pointercancel', 'lostpointercapture']) {
    document.addEventListener(eventName, event => {
      if (event.pointerId === pointerId) finish(false);
    });
  }
  document.addEventListener('contextmenu', event => {
    event.preventDefault();
    if (!editor.hidden || regionAt(event)) {
      finish(false);
      api.openOverlayMenu();
    }
  });
  editor.addEventListener('click', event => {
    const step = event.target.closest('[data-step]')?.dataset.step;
    if (step) api.stepOverlaySize(Number(step));
    if (event.target.id === 'finish-scale') api.finishOverlayResize();
  });
  window.addEventListener('resize', showSize);
  api.onOverlayCancel(() => finish(false));
  api.onPetHover(hovering => {
    document.body.classList.toggle('pet-hover', hovering);
    scene?.setPointerOverPet(hovering);
  });
  api.onOverlayResize(editing => {
    finish(false);
    editor.hidden = !editing;
    showSize();
  });
  api.onTypingStats(stats => {
    statsBar.hidden = !stats.showSpeed && !stats.showTotal;
    speed.hidden = !stats.showSpeed;
    total.hidden = !stats.showTotal;
    speedValue.textContent = stats.speed === null ? '—' : number.format(stats.speed);
    totalValue.textContent = number.format(stats.today);
  });

  function setOptions(options) {
    scene.setOptions(options);
    cards.style.left = options.leftHanded ? '47%' : '53%';
  }

  const fallback = document.querySelector('#fallback');
  let graphicsTimer;
  pet.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    fallback.hidden = false;
    clearTimeout(graphicsTimer);
    graphicsTimer = setTimeout(api.recoverOverlay, 1800);
  }, true);
  pet.addEventListener('webglcontextrestored', () => {
    clearTimeout(graphicsTimer);
    requestAnimationFrame(() => requestAnimationFrame(() => { fallback.hidden = true; }));
  }, true);
  try {
    scene = window.createPetScene(pet, {
      onFrameError(error) {
        fallback.hidden = false;
        report(error.message);
        api.recoverOverlay();
      },
      onHitRegions(hitRegions) {
        regions = hitRegions;
        api.publishOverlayRegions(hitRegions);
      },
    });
    api.onOverlayOptions(setOptions);
    api.onDesktopInput(input => scene.input(input));
    scene.loadDesk().then(() => api.getOverlayOptions()).then(setOptions)
      .catch(error => report(error.message)).finally(() => api.overlayReady());
  } catch (error) {
    document.querySelector('#fallback').hidden = false;
    report(error.message);
    api.overlayReady();
  }
})();
