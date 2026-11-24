'use strict';

(() => {
  function parseModel(bytes) {
    return new Promise((resolve, reject) => {
      new THREE.GLTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '', resolve, reject);
    });
  }

  function dispose(root) {
    const materials = new Set();
    const geometries = new Set();
    const textures = new Set();
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      geometries.add(mesh.geometry);
      for (const material of [].concat(mesh.material)) {
        materials.add(material);
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      }
    });
    for (const resource of [...geometries, ...materials, ...textures]) resource.dispose();
  }

  function installBuiltinDesktopModels(rig, keyboard, mouse) {
    const {boardBase, keys, mouseGroup} = rig;
    const keyboardMeshes = new Map();
    keyboard.traverse(mesh => { if (mesh.isMesh) keyboardMeshes.set(mesh.name, mesh); });
    const mouseMeshes = [];
    mouse.traverse(mesh => { if (mesh.isMesh) mouseMeshes.push(mesh); });
    const base = keyboardMeshes.get('Keyboard_case');
    if (!base || [...keys.keys()].some(code => !keyboardMeshes.has(code)) ||
        mouseMeshes.length !== mouseGroup.children.length) {
      throw new Error('内置模型和动画无法匹配。');
    }

    const anchor = boardBase.position;
    const replaced = new Set();
    function replace(mesh, geometry) {
      replaced.add(mesh.geometry);
      mesh.geometry = geometry;
    }
    replace(boardBase, base.geometry.clone());
    for (const [code, {mesh, x, z}] of keys) {
      const geometry = keyboardMeshes.get(code).geometry.clone().translate(anchor.x - x, -.145, anchor.z - z);
      replace(mesh, geometry);
    }
    mouseGroup.children.forEach((mesh, index) => {
      mesh.updateMatrix();
      const geometry = mouseMeshes[index].geometry.clone().applyMatrix4(mesh.matrix.clone().invert());
      replace(mesh, geometry);
      if (mesh.material.side === THREE.BackSide) mesh.material.side = THREE.FrontSide;
    });
    for (const geometry of replaced) geometry.dispose();
  }

  window.createPetScene = function createPetScene(host, {onHitRegions, onFrameError}) {
    const keys = new Set();
    const buttons = new Set();
    let privacyMode = false;
    let lastHitReport = -Infinity;
    const hitBox = new THREE.Box3();
    const projectedPoint = new THREE.Vector3();
    const driver = window.createCat(host, {onFrameError, onAfterFrame: publishHitRegions});
    if (!driver) throw new Error('无法启动 WebGL，3D 桌宠需要图形加速。');
    const rig = driver.parts;

    async function loadDesk() {
      const bytes = await window.desktopPet.getDeskModels();
      const [keyboard, mouse] = await Promise.all(bytes.map(parseModel));
      try {
        installBuiltinDesktopModels(rig, keyboard.scene, mouse.scene);
      } finally {
        dispose(keyboard.scene);
        dispose(mouse.scene);
      }
    }

    function projectHitRegion(object, camera, low = 0, high = 1) {
      hitBox.setFromObject(object);
      if (hitBox.isEmpty()) return null;
      const lowY = THREE.MathUtils.lerp(hitBox.min.y, hitBox.max.y, low);
      const highY = THREE.MathUtils.lerp(hitBox.min.y, hitBox.max.y, high);
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      for (const x of [hitBox.min.x, hitBox.max.x]) {
        for (const y of [lowY, highY]) {
          for (const z of [hitBox.min.z, hitBox.max.z]) {
            projectedPoint.set(x, y, z).project(camera);
            const nx = (projectedPoint.x + 1) / 2;
            const ny = (1 - projectedPoint.y) / 2;
            left = Math.min(left, nx);
            right = Math.max(right, nx);
            top = Math.min(top, ny);
            bottom = Math.max(bottom, ny);
          }
        }
      }
      return {x: (left + right) / 2, y: (top + bottom) / 2, rx: (right - left) * .46, ry: (bottom - top) * .47};
    }

    function publishHitRegions(camera, time) {
      if (time - lastHitReport < 65) return;
      lastHitReport = time;
      onHitRegions([projectHitRegion(rig.face, camera), projectHitRegion(rig.bodyMesh, camera, .12, .85)]);
    }

    function setOptions(options) {
      if (privacyMode !== options.privacyMode) {
        privacyMode = options.privacyMode;
        keys.clear();
        buttons.clear();
        driver.clear();
      }
      driver.setOptions({
        followKeys: !privacyMode,
        leftMouse: options.leftHanded,
        sleepSeconds: options.sleepSeconds,
      });
    }

    return {
      loadDesk,
      setOptions,
      setPetting: driver.setPetting,
      setPointerOverPet: driver.setPointerOverPet,
      input(value) {
        if (value.reset) {
          keys.clear();
          buttons.clear();
          driver.clear();
          return;
        }
        if (value.pointer) driver.setPointer(value.pointer);
        if (value.move) {
          driver.mouseMoved(value.dx, value.dy);
          return;
        }
        if (value.pointer) return;
        if (value.keyRepeat && !privacyMode) {
          driver.repeat(value.keyRepeat);
          return;
        }
        if (value.activity) {
          driver.noteActivity();
          return;
        }
        if (value.tap) {
          if (privacyMode && (value.tap === 'Left' || value.tap === 'Right')) {
            driver.tap(value.tap);
          }
          return;
        }
        const nextKeys = privacyMode ? [] : value.keys ?? [];
        keys.clear();
        buttons.clear();
        for (const code of nextKeys) keys.add(code);
        for (const button of value.buttons ?? []) buttons.add(button);
        driver.setInput(keys, buttons);
      },
    };
  };
})();
