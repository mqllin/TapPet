window.createCat = function (host, options = {}) {
const stageEl = host;
let dead = false, raf = 0, followKeys = false, lastStrikeAt = -1e9, halfRate = false;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), mix = (a, b, t) => a + (b - a) * t, rnd = (a, b) => a + Math.random() * (b - a);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
catch (e) { return null; }
const coatCanvas = document.createElement('canvas');
const coatContext = coatCanvas.getContext('2d');
const outline = color => [[1, 0], [-1, 0], [0, 1], [0, -1]]
  .map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${color})`).join(' ');
coatCanvas.style.pointerEvents = 'none';
stageEl.appendChild(coatCanvas);
renderer.domElement.style.position = 'absolute';
renderer.domElement.style.inset = '0';
renderer.domElement.style.filter = outline('#b5b6b1');
stageEl.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 100);
const CAM = V(0, 5.0, 10.2), LOOK = V(0, 1.35, 0.45);
const flat = color => new THREE.MeshBasicMaterial({ color });
const back = color => new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });

/* ---------- fixed black coat ---------- */
const onFace = (color, k) => new THREE.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: -4 * k, polygonOffsetUnits: -4 * k });
const M = { lid: onFace('#151515', 3), shut: onFace('#e2b93b', 1), fur: flat('#151515'), patch: flat('#f8f6ef'), line: back('#8b8f86'), eye: onFace('#e2b93b', 1), pupil: onFace('#0b0b0b', 2), whisker: flat('#f4f4ee'), whiskerOut: flat('#8b8f86'), inner: flat('#151515') };

/* ---------- desk, keyboard, mouse ---------- */
const ROWS = window.petKeyboardRows;
const KB = { unit: 0.18, z0: 0.92, x0: 0 }, KEY_TOP = 0.2;
const DESK_DX = 0.2825;                                  // keyboard + mouse together are centred on the cat
const board = new THREE.Group(); scene.add(board);
const roundedSlab = (w, d, r, hgt) => { const sh = new THREE.Shape(), x = w / 2, y = d / 2; sh.moveTo(-x + r, -y); sh.lineTo(x - r, -y); sh.quadraticCurveTo(x, -y, x, -y + r); sh.lineTo(x, y - r); sh.quadraticCurveTo(x, y, x - r, y); sh.lineTo(-x + r, y); sh.quadraticCurveTo(-x, y, -x, y - r); sh.lineTo(-x, -y + r); sh.quadraticCurveTo(-x, -y, -x + r, -y);
  const g = new THREE.ExtrudeGeometry(sh, { depth: hgt, bevelEnabled: false, curveSegments: 6 }); g.rotateX(-Math.PI / 2); return g; };
const boardBase = new THREE.Mesh(roundedSlab(15 * KB.unit + 0.2, 5 * KB.unit + 0.2, 0.11, 0.1), flat('#22231f')); boardBase.position.set(DESK_DX, 0, KB.z0 + 2.5 * KB.unit); board.add(boardBase);
const KEYCAP = { plain: new THREE.Color('#e9e7df'), mod: new THREE.Color('#d6d2c2'), accent: new THREE.Color('#f2b25c') };
function shadeSurface(geometry, shadeAt) {
  const shades = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < shades.length / 3; i++) shades.fill(shadeAt(i), i * 3, i * 3 + 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(shades, 3));
  return geometry;
}
const keys = new Map(), hitColor = new THREE.Color('#e2b93b');
ROWS.forEach((row, r) => { let x = 0; row.forEach(([code, w, label]) => {
  // The keyboard faces the cat: the cat's left hand is on screen right, the number row is nearest the viewer.
  const wx = DESK_DX + (7.5 - (x + w / 2)) * KB.unit, wz = KB.z0 + (4 - r + 0.5) * KB.unit;
  const base = code === 'Enter' || code === 'Backquote' ? KEYCAP.accent : (w > 1 && code !== 'Space') || /^(Alt|Meta|Control)/.test(code) ? KEYCAP.mod : KEYCAP.plain;
  const geometry = roundedSlab(w * KB.unit - 0.03, KB.unit - 0.03, 0.035, 0.09);
  geometry.translate(0, -0.045, 0);
  // The original GLB carries the same baked side shading. Multiply it by the animated press colour.
  const normals = geometry.attributes.normal;
  shadeSurface(geometry, i => .58 + .42 * Math.max(0, normals.getY(i)));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({color: base, vertexColors: true}));
  mesh.position.set(wx, 0.145, wz); board.add(mesh);
  keys.set(code, { code, label, mesh, base, ox: wx - DESK_DX, x: wx, z: wz, down: false, glow: 0 }); x += w;
}); });
const MOUSE_OFFSET = 1.94 - DESK_DX;
const MOUSE_AT = V(-MOUSE_OFFSET, 0, 1.08);
const mouseGroup = new THREE.Group(); mouseGroup.name = 'Desktop mouse'; mouseGroup.position.copy(MOUSE_AT); scene.add(mouseGroup);
// Which paw works the mouse, and which way the desk set is laid out. The picture mirrors its owner: a mouse in the owner's right
// hand sits on the left of the picture. For a left-handed mouse the keyboard and mouse swap sides, still centred on the cat together.
let MOUSE_PAW = 'L', DESK_DIR = 1;
function setHanded(leftMouse) {
  DESK_DIR = leftMouse ? -1 : 1; MOUSE_PAW = leftMouse ? 'R' : 'L';
  boardBase.position.x = DESK_DX * DESK_DIR; keys.forEach(k => { k.x = DESK_DX * DESK_DIR + k.ox; k.mesh.position.x = k.x; });
  MOUSE_AT.x = -MOUSE_OFFSET * DESK_DIR;
}
// Touch-typing hands: these keys belong to the left hand, everything else to the right. The keyboard faces the cat, so the
// owner's left hand is the paw on the right of the picture.
const pawFor = code => window.handForCode(code) === 'Left' ? 'R' : 'L';
const shell = new THREE.SphereGeometry(.3, 24, 16);
shadeSurface(shell, i => .59 + .41 * THREE.MathUtils.smoothstep(shell.attributes.position.getY(i) / .3, .15, .85));
const mouseBody = new THREE.Mesh(shell, new THREE.MeshBasicMaterial({color: KEYCAP.plain, vertexColors:true})); mouseBody.scale.set(0.7, 0.42, 1.2); mouseBody.position.y = 0.1; mouseGroup.add(mouseBody);
const mouseRim = new THREE.Mesh(mouseBody.geometry, back('#393a34')); mouseRim.scale.set(0.77, 0.47, 1.27); mouseRim.position.y = 0.1; mouseGroup.add(mouseRim);
const mouseBtn = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, 0.16), flat('#656257')); mouseBtn.position.set(0, 0.215, 0.24); mouseGroup.add(mouseBtn);
const wheel = new THREE.BoxGeometry(.055, .03, .105);
shadeSurface(wheel, i => .65 + .35 * Math.max(0, wheel.attributes.normal.getY(i)));
const mouseWheel = new THREE.Mesh(wheel, new THREE.MeshBasicMaterial({color: KEYCAP.accent, vertexColors:true})); mouseWheel.position.set(0, 0.222, 0.16); mouseGroup.add(mouseWheel);

/* ---------- the cat: one flowing body, an oval head, oval-ended legs, and a tail that grows out of the hip ---------- */
const lights = new THREE.HemisphereLight(0xfffff0, 0x8bafa6, 1.7);
const deskLayer = 1;
for (const group of [board, mouseGroup]) group.traverse(object => object.layers.set(deskLayer));
lights.layers.enable(deskLayer);
scene.add(lights);
const keyLight = new THREE.DirectionalLight(0xfff3d8, 1.05);
keyLight.layers.enable(deskLayer);
keyLight.position.set(3, 5, 4);
scene.add(keyLight);
const cat = new THREE.Group(); cat.position.set(0, 0, 0.08); scene.add(cat);
const ball = (r, mat, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), mat); m.scale.set(sx, sy, sz); return m; };
const add = (parent, mesh, x, y, z) => { mesh.position.set(x, y, z); parent.add(mesh); return mesh; };
const spline = pts => { const c = new THREE.SplineCurve(pts.map(([a, b]) => new THREE.Vector2(a, b))); const table = c.getPoints(120); return y => { let k = 0; while (k < table.length - 2 && table[k + 1].x < y) k++; const a = table[k], b = table[k + 1], f = clamp((y - a.x) / Math.max(1e-6, b.x - a.x), 0, 1); return a.y + (b.y - a.y) * f; }; };
// The body is a single lofted surface: at each height an ellipse with its own width, depth and forward offset.
const BODY_H = 2.5;                                   // the neck continues up inside the head, so no gap can open behind it
const halfW = spline([[0, 0.86], [0.07, 0.9], [0.3, 1.0], [0.62, 1.03], [0.95, 0.93], [1.3, 0.75], [1.6, 0.58], [1.85, 0.47], [2.02, 0.41], [BODY_H, 0.37]]);
// Front and back outlines seen from the side: an upright chest and a full, rounded back down to the rump.
const frontZ = spline([[0, 0.4], [0.07, 0.43], [0.3, 0.5], [0.6, 0.54], [0.95, 0.52], [1.3, 0.48], [1.6, 0.46], [1.9, 0.42], [2.02, 0.4], [BODY_H, 0.36]]);
const backZ = spline([[0, -1.14], [0.07, -1.19], [0.3, -1.32], [0.6, -1.38], [0.95, -1.24], [1.3, -1.0], [1.6, -0.76], [1.9, -0.56], [2.02, -0.5], [BODY_H, -0.44]]);
const halfD = y => (frontZ(y) - backZ(y)) / 2, midZ = y => (frontZ(y) + backZ(y)) / 2;
const upper = new THREE.Group(); cat.add(upper);            // chest and head lean; the feet and tail stay put
const torso = new THREE.Group(); upper.add(torso);
let NECK_W = 1, SHOULDER_W = 1, builtNeck = -1;
const bodyMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x151515, side: THREE.DoubleSide })); torso.add(bodyMesh); M.body = bodyMesh.material;
function buildBody() {
  if (builtNeck === NECK_W + SHOULDER_W * 100) return; builtNeck = NECK_W + SHOULDER_W * 100; bodyMesh.geometry.dispose();
  bodyMesh.geometry = new THREE.ParametricGeometry((u, v, out) => { const y = v * BODY_H, a = u * Math.PI * 2, close = Math.sqrt(1 - (1 - Math.min(1, y / 0.12)) ** 2), f = (1 + (NECK_W - 1) * smooth(1.15, 1.95, y)) * (1 + (SHOULDER_W - 1) * smooth(0.55, 1.4, y) * (1 - smooth(1.6, 2.25, y))) * (1 + 0.34 * smooth(1.72, 2.2, y)), g = 1 + (f / (1 + 0.34 * smooth(1.72, 2.2, y)) - 1) * 0.3; const top = 1 - 0.8 * smooth(2.17, 2.46, y);   /* the hidden top of the neck narrows to a point so it can never poke out of the head */ out.set(Math.cos(a) * halfW(y) * f * close * top, y, midZ(y) + 0.1 * (1 - top) + Math.sin(a) * halfD(y) * g * close * top); }, 56, 44);
}
const chest = add(torso, ball(1, M.patch, 0.3, 0.5, 0.16), 0, 1.22, 0.4);
const hindFeet = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.6, 0.1, 0.25); cat.add(g); const rim = add(g, ball(1, M.line, 0.216, 0.118, 0.325), 0, -0.012, 0.022); const foot = add(g, ball(1, M.patch, 0.2, 0.11, 0.31), 0, 0, 0); foot.renderOrder = 1; rim.renderOrder = 0; return g; });

const HEAD_R = [0.86, 0.66, 0.7];
upper.matrixAutoUpdate = false;                              // the chest leans by shearing, so its base never leaves the desk
const headFix = new THREE.Group(); headFix.matrixAutoUpdate = false; upper.add(headFix);   // undoes the shear so the head keeps its shape
const head = new THREE.Group(); head.position.set(0, 2.3, 0.1); headFix.add(head);
M.head = flat('#151515');
M.tail = M.fur;
coatCanvas.style.filter = outline('#f1eee2');
const face = add(head, ball(1, M.head, HEAD_R[0], HEAD_R[1], HEAD_R[2]), 0, 0, 0);
face.name = 'Cat face';
const tongue = add(head, ball(1, new THREE.MeshBasicMaterial({ color: '#f08a98' }), 0.06, 0.085, 0.04), 0.02, -0.36, 0.6); tongue.visible = false;
const muzzle = add(head, ball(1, M.patch, 0.13, 0.08, 0.1), 0, -0.4, 0.5);
muzzle.visible = chest.visible = false;
for (const k of ['eye', 'pupil', 'inner']) M[k].side = THREE.DoubleSide;

// Ears: a solid rounded form whose base sits inside the head, so the outline runs from head to ear without a step.
const earR = spline([[0, 0.3], [0.12, 0.285], [0.32, 0.22], [0.48, 0.13], [0.56, 0.062], [0.588, 0]]), EAR_H = 0.588, EAR_T = 0.5;
const earGeo = new THREE.LatheGeometry(Array.from({ length: 29 }, (_, i) => new THREE.Vector2(Math.max(0, earR(i / 28 * EAR_H)), i / 28 * EAR_H)), 32);
// The inner marking is a strip of the ear's own front surface, lifted a hair so it never floats.
const earInnerGeo = new THREE.ParametricGeometry((u, v, out) => { const y = mix(0.1, 0.47, v), r = earR(y), a = (u - 0.5) * 2 * 0.72 * Math.sqrt(Math.max(0, 1 - v ** 5)) * (0.72 + 0.28 * Math.min(1, v * 6)); out.set(r * Math.sin(a), y, r * Math.cos(a) * EAR_T + 0.007); }, 20, 28);
const ears = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.46, 0.3, -0.04); g.rotation.z = -s * 0.24; head.add(g);
  const ear = new THREE.Mesh(earGeo, new THREE.MeshBasicMaterial({color: '#151515', side: THREE.DoubleSide})); ear.scale.z = EAR_T; g.add(ear);
  const inner = new THREE.Mesh(earInnerGeo, M.inner); inner.renderOrder = 3; g.add(inner); return g; });

// A patch is a small ellipse wrapped onto the head's surface, so eyes and markings sit on the face from every angle.
const PR = 6, PS = 32;
function makePatch(mat, order) {
  const geo = new THREE.BufferGeometry(), index = [];
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((1 + PR * PS) * 3), 3));
  if (mat.map) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((1 + PR * PS) * 2), 2));
  for (let k = 0; k < PS; k++) index.push(0, 1 + k, 1 + (k + 1) % PS);
  for (let r = 0; r < PR - 1; r++) for (let k = 0; k < PS; k++) { const a = 1 + r * PS + k, b = 1 + r * PS + (k + 1) % PS, c = a + PS, d = b + PS; index.push(a, c, b, b, c, d); }
  geo.setIndex(index); const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = order; mesh.frustumCulled = false; head.add(mesh); return mesh;
}
const onHead = (x, y, z, lift, out, n, uv) => { const k = 1 / Math.sqrt((x / HEAD_R[0]) ** 2 + (y / HEAD_R[1]) ** 2 + (z / HEAD_R[2]) ** 2); x *= k; y *= k; z *= k;
  // Use the face sphere's UVs so patterned eyelids match the fur below while blinking or asleep.
  if (uv) uv.setXY(n, Math.atan2(z / HEAD_R[2], -x / HEAD_R[0]) / (2 * Math.PI), .5 + Math.asin(clamp(y / HEAD_R[1], -1, 1)) / Math.PI);
  const nx = x / HEAD_R[0] ** 2, ny = y / HEAD_R[1] ** 2, nz = z / HEAD_R[2] ** 2, nl = Math.hypot(nx, ny, nz);
  out.setXYZ(n, x + nx / nl * lift, y + ny / nl * lift, z + nz / nl * lift); };
function fillPatch(mesh, cx, cy, rx, ry, turn, lift) {
  cx = clamp(cx, -0.78, 0.78); cy = clamp(cy, -0.58, 0.58);
  const pos = mesh.geometry.attributes.position, inside = Math.max(0.03, 1 - (cx / HEAD_R[0]) ** 2 - (cy / HEAD_R[1]) ** 2), cz = HEAD_R[2] * Math.sqrt(inside);
  // tangent directions at the centre: along x and along y on the ellipsoid
  let ax = 1, az = -(cx / HEAD_R[0] ** 2) / (cz / HEAD_R[2] ** 2), al = Math.hypot(ax, az); ax /= al; az /= al;
  let by = 1, bz = -(cy / HEAD_R[1] ** 2) / (cz / HEAD_R[2] ** 2), bl = Math.hypot(by, bz); by /= bl; bz /= bl;
  const co = Math.cos(turn), si = Math.sin(turn);
  const uv = mesh.geometry.attributes.uv;
  onHead(cx, cy, cz, lift, pos, 0, uv);
  for (let r = 1; r <= PR; r++) for (let k = 0; k < PS; k++) { const a = k / PS * Math.PI * 2, u = Math.cos(a) * rx * r / PR, v = Math.sin(a) * ry * r / PR, lx = u * co - v * si, ly = u * si + v * co;
    onHead(cx + ax * lx, cy + by * ly, cz + az * lx + bz * ly, lift, pos, 1 + (r - 1) * PS + k, uv); }
  pos.needsUpdate = true;
  if (uv) uv.needsUpdate = true;
}
M.mouth = onFace('#48262e', 2); const mouth = makePatch(M.mouth, 4); mouth.visible = false;
M.yawnTongue = onFace('#d87d8f', 3); const yawnTongue = makePatch(M.yawnTongue, 5); yawnTongue.visible = false;
const eyes = [-1, 1].map(s => ({
  s, iris: makePatch(M.eye, 3), pupil: makePatch(M.pupil, 4), lid: makePatch(M.lid, 5),
}));
// Whiskers: three separate hairs per side, each rooted at its own spot on the cheek; light over the face, coat-dark beyond it.
const whiskers = [];
for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
  const pivot = new THREE.Group(); pivot.scale.setScalar(.78); head.add(pivot);
  const pts = new THREE.QuadraticBezierCurve3(V(0, 0, 0), V(s * 0.24, 0.005, 0), V(s * 0.44, -0.075, 0)).getPoints(14);
  pivot.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(0, 7)), 8, 0.008, 5), M.whisker));
  pivot.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(6)), 10, 0.008, 5), M.whiskerOut));
  whiskers.push({ s, i, pivot });
}

/* A limb or tail is a "sausage": a tube whose thickness varies along its length and whose end is rounded. */
const SEG = 48, SIDES = 14, CAP = 5, RINGS = SEG + 1 + CAP;
function makeSausage(mat, order) {
  const geo = new THREE.BufferGeometry(), index = [];
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RINGS * SIDES * 3), 3));
  for (let r = 0; r < RINGS - 1; r++) for (let k = 0; k < SIDES; k++) { const a = r * SIDES + k, b = r * SIDES + (k + 1) % SIDES, c = a + SIDES, d = b + SIDES; index.push(a, b, c, b, d, c); }
  geo.setIndex(index); const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = order; return mesh;
}
const sP = V(0, 0, 0), sT = V(0, 0, 0), sN = V(0, 0, 0), sB = V(0, 0, 0);
function shapeSausage(mesh, path, radius, ref) {
  const pos = mesh.geometry.attributes.position; let n = 0, endR = 0;
  for (let r = 0; r < RINGS; r++) {
    let rad;
    if (r <= SEG) { const t = r / SEG; path.getPoint(t, sP); path.getTangent(t, sT); rad = radius(t); if (r === SEG) endR = rad; }
    else { const a = (r - SEG) / CAP * Math.PI / 2; path.getPoint(1, sP); path.getTangent(1, sT); sP.addScaledVector(sT, endR * Math.sin(a)); rad = endR * Math.cos(a); }
    sN.copy(ref).addScaledVector(sT, -ref.dot(sT)).normalize(); sB.crossVectors(sT, sN);
    for (let k = 0; k < SIDES; k++) { const a = k / SIDES * Math.PI * 2, c = Math.cos(a) * rad, d = Math.sin(a) * rad; pos.setXYZ(n++, sP.x + sN.x * c + sB.x * d, sP.y + sN.y * c + sB.y * d, sP.z + sN.z * c + sB.z * d); }
  }
  pos.needsUpdate = true;
}
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const AX = V(1, 0, 0), AZ = V(0, 0, 1);

// Tail: starts inside the hip so it grows out of the body, thick at the root and tapering to a round tip.
const tailCurve = new THREE.CatmullRomCurve3([V(0.3, 0.36, -0.75), V(0.82, 0.2, -0.64), V(1.16, 0.3, -0.5), V(1.3, 0.58, -0.42), V(1.46, 0.8, -0.37), V(1.66, 0.87, -0.35)], false, 'catmullrom', 0.5);
const tail = makeSausage(M.tail, 1); cat.add(tail);
let TAIL_K = 1;
function buildTail(k) {
  TAIL_K = k;
  shapeSausage(tail, tailCurve, t => .16 * k * (1 + .7 * (1 - smooth(0, .16, t)) ** 2), AZ);
}
buildTail(1);
// The sleeping tail wraps from the hip around the front paws.
const TAIL_UP = tailCurve.points.map(q => q.clone());
const TAIL_DOWN = [V(0.3, 0.25, -0.75), V(.84, .22, -.66), V(1.08, .17, -.32), V(1.14, .16, .08), V(1.03, .16, .40), V(.73, .155, .57)];
// Trace the outside of the haunch, then turn in just in front of the standing paws.
const TAIL_AROUND_PAWS = [TAIL_UP[0], V(.76,.29,-.62), V(1.01,.21,-.20),
  V(.96,.18,.36), V(.67,.16,.83), V(.18,.155,1.04)];
let tailDown = 0, lastPawWrap = 0;
let tailSweep = 0, tailLift = 0, tailFlick = 0, lastFloorWeight = 0;
const tailLengths = TAIL_UP.map((point, i) => i ? point.distanceTo(TAIL_UP[i - 1]) : 0);
const floorPoint = V(0, 0, 0);
function poseTail(curl, sweep, lift, flick, floorWeight, floorPhase, pawWrap) {
  if (Math.abs(curl - tailDown) < .002 && Math.abs(sweep - tailSweep) < .003
    && Math.abs(lift - tailLift) < .003 && Math.abs(flick - tailFlick) < .003
    && !floorWeight && !lastFloorWeight && Math.abs(pawWrap - lastPawWrap) < .002) return;
  lastFloorWeight = floorWeight;
  lastPawWrap = pawWrap;
  tailDown = curl;
  tailSweep = sweep;
  tailLift = lift;
  tailFlick = flick;
  const tuck = smooth(0, 1, curl);
  tailCurve.points.forEach((point, i) => {
    const bend = smooth(.2, 1, i / (TAIL_UP.length - 1));
    const tip = bend * bend;
    point.copy(TAIL_UP[i]);
    point.x += .20 * sweep * bend + .16 * flick * tip;
    point.y += .28 * lift * bend + .16 * flick * tip;
    point.z += .34 * sweep * bend - .20 * flick * tip;
    if (floorWeight) {
      if (i === 0) floorPoint.copy(point);
      else {
        // Bend successive links in the desk plane. The tip trails the hip through each reversal.
        const u = i / (TAIL_UP.length - 1);
        const swing = Math.sin(floorPhase - 1.3 * u);
        const angle = .05 + .83 * u + (.27 + 1.02 * u) * swing;
        const height = .16 * TAIL_K + .014 + .035 * (1 - u) ** 2 + .035 * tip * swing ** 2;
        const dy = height - floorPoint.y;
        const reach = Math.sqrt(Math.max(0, tailLengths[i] ** 2 - dy ** 2));
        floorPoint.set(floorPoint.x + reach * Math.cos(angle), height, floorPoint.z + reach * Math.sin(angle));
      }
      point.lerp(floorPoint, floorWeight);
    }
    // Let the hip lead and the tip settle last, like a tail curling around the feet.
    const lag = .20 * i / (TAIL_UP.length - 1);
    point.lerp(TAIL_AROUND_PAWS[i], smooth(lag, 1, pawWrap));
    point.lerp(TAIL_DOWN[i], tuck);
  });
  buildTail(TAIL_K);
}

/* ---------- forelimbs: oval-ended legs from the shoulder to wherever the paw is ---------- */
const SHOULDER = { L: V(-0.25, 1.5, 0.19), R: V(0.25, 1.5, 0.19) };       // world; L is screen left = the cat's right paw
let LEG_R = 0.16, FOOT = 1;
const REST = { L: V(-0.23, 0.11, 0.76), R: V(0.23, 0.11, 0.76) }, UP = { L: V(-0.46, 1.1, 0.9), R: V(0.46, 1.1, 0.9) };
const sleepPoses = {
  upright: {bodyDrop:0, headDrop:.025, headX:0, headZ:.015, nod:.08, turn:0, tilt:.025, tail:0, paws:REST},
  loaf: {bodyDrop:.40, headDrop:.375, headX:-.075, headZ:.20, nod:.12, turn:.07, tilt:.07, tail:.94,
    paws:{L:V(-.21,.11,.58), R:V(.21,.11,.58)}},
  pillow: {bodyDrop:.47, headDrop:.465, headX:-.27, headZ:.37, nod:.21, turn:-.16, tilt:.17, tail:1,
    paws:{L:V(-.41,.145,.86), R:V(-.04,.12,.81)}},
};
const paws = {};
for (const side of ['L', 'R']) {
  const rim = makeSausage(M.line, 1), core = makeSausage(M.fur, 2); scene.add(rim, core);
  const root = ball(1, M.fur); scene.add(root);                       // closes the top of the leg inside the chest
  const foot = new THREE.Group(); scene.add(foot); const fr = add(foot, ball(1, M.line, 0.216, 0.118, 0.325), 0, -0.012, 0.022), ff = add(foot, ball(1, M.patch, 0.2, 0.11, 0.31), 0, 0, 0); fr.renderOrder = 2; ff.renderOrder = 3;
  paws[side] = { side, rim, core, foot, root, pos: REST[side].clone(), to: REST[side].clone(), from: V(0, 0, 0), tapAt: -1e9, landed: true, landedAt: -1e9, pending: null, held: 0, mode: 'rest' };
}
const tmpC = V(0, 0, 0), curve = new THREE.QuadraticBezierCurve3(V(0, 0, 0), V(0, 0, 0), V(0, 0, 0));
const legRadius = t => LEG_R * mix(1.6, 0.8, smooth(0, 0.8, t)), rimRadius = t => legRadius(t) + RIM_W * smooth(0.3, 0.6, t); let RIM_W = 0.03;
function drawLimb(p, shoulder) {
  // A leg hangs straight when the paw is on the desk below it, and bends at the elbow as the paw lifts or reaches.
  const s = p.side === 'L' ? -1 : 1, tip = tmpC.copy(p.pos); p.foot.position.copy(p.pos); tip.y += 0.05 * FOOT; tip.z -= 0.1 * FOOT;
  const dx = tip.x - shoulder.x, dz = tip.z - shoulder.z, drop = shoulder.y - tip.y, slack = clamp(1 - drop / 1.25, 0, 1), far = Math.hypot(dx, dz);
  curve.v0.copy(shoulder); curve.v2.copy(tip);
  curve.v1.set(shoulder.x + dx * 0.5 + s * (0.1 * slack + 0.04 * far), tip.y + drop * (0.5 - 0.35 * slack) + 0.16 * far, shoulder.z + dz * 0.5 + 0.08 + 0.45 * slack + 0.1 * far);
  // Standing on the desk, the leg bows forward just enough to sit in front of the chest so its outline shows; reaching out, the outline thins.
  const out = smooth(0.6, 1.0, far), lifted = smooth(0.25, 0.7, p.pos.y);   // a lifted paw keeps a full outline
  { const fr = p.foot.children[0]; fr.position.set(0, -0.012 - 0.024 * lifted, 0.022 * (1 - lifted)); fr.scale.set(0.216 - 0.01 * lifted, 0.118, 0.325 - 0.01 * lifted); } curve.v1.z = mix(Math.max(curve.v1.z, tip.z + 0.32), curve.v1.z, Math.max(out, lifted)); RIM_W = mix(0.03, 0.013, Math.max(out, lifted));
  shapeSausage(p.core, curve, legRadius, AX); shapeSausage(p.rim, curve, rimRadius, AX);
  p.root.position.copy(shoulder); p.root.scale.setScalar(legRadius(0) * 1.02);
}

const P = {
  headSize: 0.86, headW: 0.94, headH: 1.01, neck: 0.02,
  neckW: 1.31, earSize: 1.05, earSpread: 0.95, eyeSize: 1.2,
  eyeSpread: 0.9, eyeY: 0.31, eyeTilt: -0.08, bodyW: 0.86,
  bodyH: 0.98, legThick: 0.97, legGap: 1, footSize: 0.89,
  tailThick: 0.73, shoulderW: 1.15, whiskY: 0.08,
};
function applyShape() {
  head.scale.set(P.headSize * P.headW, P.headSize * P.headH, P.headSize);
  ears.forEach((g, i) => { const s = i ? 1 : -1; g.position.x = s * 0.46 * P.earSpread; g.scale.setScalar(P.earSize); });
  NECK_W = P.neckW; SHOULDER_W = P.shoulderW; buildBody();
  whiskers.forEach(w => { const x = w.s * 0.4, y = P.eyeY * 0.35 - 0.2 + P.whiskY - w.i * 0.085, z = HEAD_R[2] * Math.sqrt(Math.max(0.03, 1 - (x / HEAD_R[0]) ** 2 - (y / HEAD_R[1]) ** 2));
    w.pivot.position.set(x, y, z + 0.008); w.pivot.rotation.set(0, -w.s * 0.52, w.s * (0.2 - w.i * 0.2)); });
  hindFeet.forEach((g, i) => { g.position.x = (i ? 1 : -1) * 0.6 * P.bodyW; g.scale.setScalar(P.footSize); });
  LEG_R = 0.16 * P.legThick; FOOT = P.footSize; for (const side of ['L', 'R']) paws[side].foot.scale.setScalar(P.footSize);
  for (const side of ['L', 'R']) { const s = side === 'L' ? -1 : 1; SHOULDER[side].x = s * Math.min(0.25 * P.legGap, 0.42 * P.bodyW); SHOULDER[side].y = 1.5 * P.bodyH; REST[side].x = s * 0.23 * P.legGap; UP[side].x = s * 0.46 * P.legGap; UP[side].y = 1.1 * P.bodyH;
  }
  buildTail(P.tailThick);
}

/* ---------- state ---------- */
const RISE = 30, FALL = 46, STRIKE = RISE + FALL;
const KEY_READY_MS = 1000, POINTER_GAZE_MS = 15000;
const S = { last: performance.now(), lastKey: -1e9, lastMouse: -1e9, rest: null, breath: 0, down: new Map(), thump: 0, thumpSide: 0, jolt: -1e9, rate: 0,
  turn: 0, nod: 0, tilt: 0, lid: 0, blinkAt: performance.now() + 2500, blinkUntil: 0, happyUntil: 0, bounceAt: -1e9, act: null, actUntil: 0, nextAct: performance.now() + 6000,
  gazeX: 0, gazeY: 0, pointer: null, mouseAim: null, phase: 0, alt: 'L', mouseDown: false, mouseX: 0, mouseZ: 0, mouseGoalX: 0, mouseGoalZ: 0, lastMouseMotion: -Infinity, sx: 0, fwd: 0, fwdGoal: 0, chips: [] };
const sleep = window.createSleepCycle(S.last, (options.sleepSeconds ?? 60) * 1000);
const zzz = document.createElement('div');
zzz.className = 'zzz';
zzz.hidden = true;
zzz.setAttribute('aria-hidden', 'true');
zzz.innerHTML = '<span>Z</span><span>Z</span><span>Z</span>';
stageEl.appendChild(zzz);

const keyboardPose = t => S.down.size > 0 || (t - S.lastKey < KEY_READY_MS && S.lastMouse <= S.lastKey);
let pointerOverPet = false;
const mousePose = t => !pointerOverPet && mouseGroup.visible && S.lastMouse > S.lastKey && t - S.lastMouse < 1600;

const glance = { next: 0, start: 0, end: 0 };
function typingGlance(t, typing) {
  if (!typing || reduceMotion) {
    glance.next = glance.end = 0;
    return 0;
  }
  if (!glance.next) glance.next = t + rnd(3400, 6800);
  // Keep the schedule through short pauses, but only start a glance while keys are in use.
  if (t >= glance.next && (S.down.size || t - lastStrikeAt < 180)) {
    glance.start = t;
    glance.end = t + rnd(660, 960);
    glance.next = glance.end + rnd(3900, 8100);
  }
  if (t >= glance.end) return 0;
  return smooth(glance.start, glance.start + 180, t) * (1 - smooth(glance.end - 240, glance.end, t));
}

const tailMotion = { last: S.last, phase: 0, speed: 1.5, amplitude: 0,
  flickAt: -Infinity, nextFlick: S.last + rnd(4800, 9000), direction: 1 };
const floorSweep = {kind: 'sweep', wrap: 0, next: S.last + rnd(4500, 7000), until: 0, period: 0, phase: 0, blend: 0};
function updateFloorSweep(t, dt, idle, rest) {
  if (floorSweep.until && (!idle || t >= floorSweep.until)) {
    floorSweep.until = 0;
    floorSweep.next = t + rnd(7400, 14500);
  }
  // Curl into sleep from the current sweep, keeping the tail on the desk until it is tucked.
  if (rest?.phase === 'settling') return smooth(0, 1, floorSweep.blend);
  if (rest?.phase === 'sleeping') floorSweep.blend = 0;
  if (idle && !floorSweep.until && t >= floorSweep.next) {
    floorSweep.kind = Math.random() < .45 ? 'wrap' : 'sweep';
    if (floorSweep.kind === 'wrap') {
      floorSweep.until = t + rnd(4500, 7800);
    } else {
      floorSweep.period = rnd(2.1, 3.1);
      floorSweep.phase = 0;
      floorSweep.until = t + 1000 * floorSweep.period * (Math.random() < .5 ? 2 : 3);
    }
  }
  const sweeping = floorSweep.until && floorSweep.kind === 'sweep';
  const wrapping = floorSweep.until && floorSweep.kind === 'wrap';
  floorSweep.blend = clamp(floorSweep.blend + dt * (sweeping ? 1.6 : idle ? -1.6 : -3.2), 0, 1);
  floorSweep.wrap = clamp(floorSweep.wrap + dt * (wrapping ? .64 : idle ? -.66 : -2.5), 0, 1);
  if (floorSweep.blend) floorSweep.phase += dt * 2 * Math.PI / floorSweep.period;
  return smooth(0, 1, floorSweep.blend);
}
function animateTail(t, rest, typing, mousing, happy) {
  const elapsed = t - tailMotion.last;
  if (elapsed < 32) return; // Update the curved mesh and its accessory mount together at roughly 30 Hz.
  tailMotion.last = t;
  const dt = Math.min(.09, elapsed / 1000);
  const follow = 1 - Math.exp(-5 * dt);
  const speed = happy ? 4.1 : typing ? 2.7 + Math.min(S.rate, 8) * .25 : mousing ? 3.1 : 1.45;
  const amplitude = rest || reduceMotion ? 0 : happy ? .92 : typing ? .60 : mousing ? .69 : .38;
  tailMotion.speed += (speed - tailMotion.speed) * follow;
  tailMotion.amplitude += (amplitude - tailMotion.amplitude) * follow;
  tailMotion.phase += tailMotion.speed * dt;

  const idle = !rest && !reduceMotion && !typing && !mousing && !happy && !S.pet && !S.mouseDown
    && S.act !== 'stretch' && S.act !== 'pounce' && S.act !== 'lick';
  const floorWeight = updateFloorSweep(t, dt, idle, rest);
  if (rest || reduceMotion || floorWeight || floorSweep.wrap) tailMotion.flickAt = -Infinity;
  else if (idle && t >= tailMotion.nextFlick) {
    tailMotion.flickAt = t;
    tailMotion.nextFlick = t + rnd(4800, 11000);
    tailMotion.direction = Math.random() < .5 ? -1 : 1;
  }
  const flickAge = (t - tailMotion.flickAt) / 790;
  const flick = flickAge < 1 ? Math.sin(flickAge * Math.PI * 4) * Math.sin(flickAge * Math.PI) : 0;
  const curl = rest ? rest.curl * sleepPoses[rest.posture].tail : 0;
  const amount = tailMotion.amplitude * (1 - curl);
  const phase = tailMotion.phase;
  const sweep = Math.sin(phase) + (mousing ? .55 * S.mouseX : 0);
  const lift = .20 + .68 * Math.sin(phase - .9) + .15 * Math.sin(phase * 2);
  poseTail(curl, amount * sweep, amount * lift, flick * tailMotion.direction * (1 - curl), floorWeight, floorSweep.phase, floorSweep.wrap);
}

function settleKeyboard() {
  for (const code of S.down.keys()) keyUp(code);
  downAt.clear();
  clearChips();
  S.lastKey = -Infinity;
  S.thump = 0;
  glance.next = glance.end = 0;
  for (const paw of Object.values(paws)) {
    paw.pending = null;
    paw.tapAt = -Infinity;
    paw.held = 0;
    paw.landed = true;
  }
}

function updateRest(t) {
  const previous = S.rest;
  const rest = sleep.sample(t, !S.pet);
  if (rest && !previous) {
    settleKeyboard();
    S.act = null;
  } else if (!rest && previous) {
    S.blinkUntil = 0;
    S.blinkAt = t + 2000;
    S.nextAct = t + 4500;
  }
  S.rest = rest;
  return rest;
}

function land(p, t) {
  p.landed = true; p.landedAt = t; S.thump = 1; S.thumpSide = p.side === 'L' ? -1 : 1; S.jolt = t;
  const k = p.pending; p.pending = null; if (!k) return;
  k.glow = 1;
  k.down = S.down.has(k.code);
  const chip = addChip(k, t);
  if (!k.down) fadeChip(chip, t);
}
function strike(side, x, z, t, key) {
  const p = paws[side]; if (!p.landed) land(p, t);
  const raised = p.mode === 'up' && p.pos.y >= KEY_TOP + 0.79;
  p.from.copy(p.pos); p.to.set(x, KEY_TOP + 0.09, z); p.tapAt = raised ? t - RISE : t; p.landed = false; p.pending = key || null; p.mode = 'key';
  S.lastKey = t; lastStrikeAt = t; S.rate = Math.min(12, S.rate + 1);
  S.nextAct = Math.max(S.nextAct, t + 4000);
}
function keyDown(code, t = performance.now()) {
  if (S.rest || S.down.has(code)) return;
  const k = keys.get(code); let side, x, z;
  side = code === 'Space' && t - S.lastMouse < 1600 ? (MOUSE_PAW === 'L' ? 'R' : 'L') : pawFor(code);
  if (k) { x = k.x; z = k.z; if (code === 'Space') x += (side === 'L' ? -1 : 1) * 0.3; } else { x = (side === 'L' ? -1 : 1) * 0.8; z = KB.z0 + 0.55; }
  S.down.set(code, side); strike(side, x, z, t, k); paws[side].held = 1;
}
function keyUp(code) {
  const side = S.down.get(code); if (!side) return; S.down.delete(code);
  const t = performance.now();
  if (!S.down.size) {
    S.lastKey = t;
    S.nextAct = Math.max(S.nextAct, t + 4000);
  }
  const k = keys.get(code); if (k) k.down = false;
  if (![...S.down.values()].includes(side)) paws[side].held = 0;
  const chip = S.chips.find(chip => chip.code === code);
  if (chip) fadeChip(chip, t);
}

function addChip(key, time) {
  const existing = S.chips.find(chip => chip.code === key.code);
  if (existing) {
    existing.born = time;
    existing.gone = null;
    return existing;
  }
  const element = document.createElement('div');
  element.className = 'chip';
  element.textContent = key.label;
  element.setAttribute('aria-hidden', 'true');
  stageEl.appendChild(element);
  const chip = {el: element, k: key, code: key.code, born: time, gone: null};
  S.chips.push(chip);
  return chip;
}

function fadeChip(chip, time) {
  chip.gone = Math.max(time, chip.born + 260);
}

function clearChips() {
  for (const chip of S.chips) chip.el.remove();
  S.chips = [];
}

function moveMouse(dx = 0, dy = 0) {
  const time = performance.now();
  sleep.activity(time);
  S.lastMouse = time;
  if (!dx && !dy) return;
  S.lastMouseMotion = time;
  S.mouseAim = S.pointer;
  S.nextAct = Math.max(S.nextAct, time + POINTER_GAZE_MS + 1500);
  if (pointerOverPet) return;
  // Keep the inward edge next to the keyboard and allow a wider outward sweep.
  const outward = -DESK_DIR;
  const x = S.mouseGoalX * outward + dx * MouseTravel.horizontalScale * outward;
  S.mouseGoalX = clamp(x, -MouseTravel.inward, MouseTravel.outward) * outward;
  S.mouseGoalZ = clamp(S.mouseGoalZ + dy * MouseTravel.depthScale, -MouseTravel.depth, MouseTravel.depth);
}

const MouseTravel = {inward: .205, outward: .43, depth: .28, horizontalScale: .0028, depthScale: .0024, mouseRate: 64, pawRate: 36};
function setPointer(pointer) {
  if (Number.isFinite(pointer?.x) && Number.isFinite(pointer?.y)) S.pointer = pointer;
}

function setPetting(active, side = 1) {
  const time = performance.now();
  if (active) {
    sleep.activity(time);
    S.pet = true;
    S.petSide = side;
    S.happyUntil = Infinity;
  } else if (S.pet) {
    sleep.activity(time);
    S.pet = false;
    S.happyUntil = time + 900;
  }
}

/* ---------- frame ---------- */
const shoulderW = V(0, 0, 0), proj = V(0, 0, 0), tmpGoal = V(0, 0, 0), keyboardTarget = V(0, 0, 0);
let viewWidth = 0, viewHeight = 0, viewPixelRatio = 0;
function renderFrame() {
  try { frame(); }
  catch (error) {
    if (!options.onFrameError) throw error;
    options.onFrameError(error);
  }
}
function frame() {
  const t = performance.now(), realDt = Math.min(1, (t - S.last) / 1000), dt = Math.min(0.05, realDt); S.last = t;
  const ease = k => 1 - Math.exp(-dt * k);
  const rest = updateRest(t);
  const frozen = rest?.frozen;
  const sleepPose = sleepPoses[rest?.posture ?? 'upright'];
  const settling = rest?.curl ?? 0;
  const loaf = sleepPose.bodyDrop * settling;
  const happy = !rest && t < S.happyUntil;
  const typing = !rest && !happy && keyboardPose(t);
  const hover = typing;
  const mousing = !rest && !typing && !happy && mousePose(t);
  const pointer = !rest && !typing && S.lastMouseMotion > S.lastKey && t - S.lastMouseMotion < POINTER_GAZE_MS
    ? S.mouseAim : null;
  const forwardGlance = typingGlance(t, typing);
  const pressingMouse = S.mouseDown && !S.pet;
  const recentlyMoved = t - S.lastMouseMotion < 150;
  if (!recentlyMoved) {
    S.mouseGoalX *= Math.exp(-dt * 4.5);
    S.mouseGoalZ *= Math.exp(-dt * 4.5);
  }
  S.mouseX += (S.mouseGoalX - S.mouseX) * ease(MouseTravel.mouseRate);
  S.mouseZ += (S.mouseGoalZ - S.mouseZ) * ease(MouseTravel.mouseRate);
  mouseGroup.position.set(MOUSE_AT.x + S.mouseX, 0, MOUSE_AT.z + S.mouseZ);
  mouseBody.material.color.copy(KEYCAP.plain).lerp(hitColor, pressingMouse && mousing ? 1 : 0);
  S.rate *= Math.exp(-dt * 1.2); const fast = 0;   // 0 = unhurried typing, 1 = hammering away
  S.thump *= Math.exp(-dt * 13);

  if (dead) return;
  const waking = rest && !rest.showZ && rest.phase !== 'settling';
  if (!waking && !typing && t - Math.max(S.lastKey, S.lastMouse) > 2500 && !S.pet && t >= S.happyUntil && (halfRate = !halfRate)) {
    raf = requestAnimationFrame(renderFrame);
    return;
  }
  const w = stageEl.clientWidth, h = stageEl.clientHeight; if (!w || !h) { raf = requestAnimationFrame(renderFrame); return; }
  zzz.style.fontSize = (w * 0.063) + 'px';
  const pixelRatio = Math.min(1.5, devicePixelRatio || 1);
  if (w !== viewWidth || h !== viewHeight || pixelRatio !== viewPixelRatio) {
    if (pixelRatio !== viewPixelRatio) renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, h, false);
    coatCanvas.width = renderer.domElement.width;
    coatCanvas.height = renderer.domElement.height;
    coatContext.globalCompositeOperation = 'copy';
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 38 : 27;
    camera.updateProjectionMatrix();
    viewWidth = w;
    viewHeight = h;
    viewPixelRatio = pixelRatio;
  }
  camera.position.copy(CAM); camera.lookAt(LOOK);
  camera.updateMatrixWorld();

  // keys
  const jolt = 0.03 * Math.exp(-(t - S.jolt) / 55); board.position.y = -jolt;
  keys.forEach(k => { if (!k.down && k.glow > 0) k.glow = Math.max(0, k.glow - dt * 5); k.mesh.position.y = 0.145 - (k.down ? 0.045 : 0); k.mesh.material.color.copy(k.base).lerp(hitColor, k.glow); });

  // body
  if (!frozen) {
    S.phase += dt * (rest ? 0.9 : 1.7 + Math.min(1.4, S.rate * 0.14));
    S.breath = reduceMotion ? 0 : Math.sin(S.phase);
  }
  const breath = S.breath;
  const bounceE = (t - S.bounceAt) / 420;
  const bounce = !rest && bounceE < 1 ? Math.sin(Math.PI * bounceE) : 0;
  const reach = (paws.L.pos.z > 0.86 ? paws.L.pos.x - REST.L.x : 0) + (paws.R.pos.z > 0.86 ? paws.R.pos.x - REST.R.x : 0);
  const act0 = S.act, stretching = act0 === 'stretch', licking = act0 === 'lick', yawning = act0 === 'yawn', pouncing = act0 === 'pounce', actLeft = S.actUntil - t;
  const yawn = rest ? (rest.yawn ?? 0) : yawning ? Math.sin(clamp(1 - actLeft / 1900, 0, 1) * Math.PI) ** 0.7 : 0;
  const crouch = pouncing && actLeft > 520, swat = pouncing && actLeft <= 520 && actLeft > 120;
  if (pouncing && actLeft <= 520 && !S.pounced) { S.pounced = true; S.bounceAt = t; } if (!pouncing) S.pounced = false;
  if (!frozen) S.low = (S.low || 0) + ((stretching ? 1 : crouch ? 0.55 : 0) - (S.low || 0)) * ease(crouch ? 9 : 5);
  const squat = 1 - loaf - 0.16 * (S.low || 0);
  torso.scale.set(
    P.bodyW * (1 + .24 * loaf + breath * (0.012 + 0.008 * loaf) - bounce * 0.03),
    P.bodyH * squat * (1 + breath * 0.012 + bounce * 0.05 - S.thump * (0.012 + 0.02 * fast)),
    1 + .31 * loaf + breath * 0.02
  );
  for (const [i, foot] of hindFeet.entries()) {
    foot.position.set((i ? 1 : -1) * 0.6 * P.bodyW * (1 - .12 * loaf), .1, mix(.25, -.16, loaf));
  }
  // The body follows the cursor sideways and leans forward when the paws reach for the desk.
  let farZ = 0; for (const sd of ['L', 'R']) { const q = paws[sd]; if (q.held || t - q.tapAt < 260) farZ = Math.max(farZ, q.to.z); }
  if (farZ) S.fwdGoal = clamp(0.14 + (farZ - KB.z0) * 0.32, 0.14, 0.42);
  if (!frozen) {
    S.fwd += ((mousing ? 0.2 : hover ? S.fwdGoal : 0) - S.fwd) * ease(7);
    let lean = typing ? clamp(reach * .13, -.2, .2) : 0;
    if (pointer) {
      // Use the neutral body as the reference so leaning cannot move the target under the cursor.
      cat.localToWorld(proj.set(0, 1.4, .43)).project(camera);
      const centerX = proj.x;
      cat.localToWorld(proj.set(.83, 1.4, .43)).project(camera);
      const halfWidth = Math.abs(proj.x - centerX);
      const dx = pointer.x - centerX;
      const outside = (Math.abs(dx) - halfWidth) * w / h;
      lean = .25 * Math.sign(dx) * smooth(0, .65, outside);
    }
    S.sx += (lean - S.sx) * ease(9);
  }
  const sx = S.sx + S.thump * S.thumpSide * 0.012 + (crouch ? Math.sin(t / 55) * 0.02 : 0), fwd = S.fwd;
  upper.matrix.set(1, sx, 0, 0,  0, 1 - fwd * fwd * 0.35, 0, 0,  0, fwd, 1, 0,  0, 0, 0, 1);
  if (!frozen) animateTail(t, rest, typing, mousing, happy);

  // head
  const calm = !typing && !rest && !happy && !mousing && !pointer;
  if (S.wantStretch) { S.wantStretch = false; if (calm && !reduceMotion) { S.act = 'stretch'; S.actUntil = t + 1700; S.nextAct = t + rnd(6000, 12000); } }
  if (calm && !reduceMotion && t > S.nextAct) { const pool = ['lookL', 'lookR', 'tilt', 'ear', 'ear', 'lick', 'lick']; S.act = pool[Math.floor(Math.random() * pool.length)]; S.actUntil = t + ({ ear: 420, lick: 3200 }[S.act] || 1700); S.nextAct = t + rnd(6000, 14000); }
  if (S.act && (t > S.actUntil || !calm)) S.act = null;
  head.position.set(
    sleepPose.headX * settling,
    (2.3 * P.bodyH + P.neck) * (1 - sleepPose.headDrop * settling - .16 * (S.low || 0)) + breath * .018 + bounce * .09 - S.thump * .02,
    .1 - fwd * .5 + sleepPose.headZ * settling
  );
  { const py = head.position.y; headFix.matrix.set(1, -sx, 0, sx * py,  0, 1, 0, 0,  0, -fwd, 1, fwd * py,  0, 0, 0, 1); }
  const ex = .37 * P.eyeSpread, ey = P.eyeY;
  let aimX = 0, aimY = 0;
  if (typing || pointer) {
    const target = typing
      ? board.localToWorld(keyboardTarget.copy(boardBase.position).setY(KEY_TOP)).project(camera)
      : pointer;
    const targetY = typing ? -target.y : target.y;
    // Project the midpoint between the eyes. Both screen axes use the same pixel scale.
    head.updateWorldMatrix(true, false);
    proj.set(0, ey, HEAD_R[2] * Math.sqrt(1 - (ex / HEAD_R[0]) ** 2 - (ey / HEAD_R[1]) ** 2));
    head.localToWorld(proj).project(camera);
    const dx = (target.x - proj.x) * w / h, dy = targetY + proj.y;
    const distance = Math.hypot(dx, dy, .48);
    aimX = (1 - forwardGlance) * dx / distance;
    aimY = (1 - forwardGlance) * dy / distance;
  }
  let turnT = aimX * .62, nodT = aimY * .38;
  if (rest) {
    turnT = mix(turnT, sleepPose.turn, settling);
    nodT = mix(nodT, sleepPose.nod, settling) - .26 * yawn;
  } else if (happy) {
    turnT *= .42;
    nodT = -.12;
  } else if (!typing && !pointer) {
    turnT = S.act === 'lookL' ? -.45 : S.act === 'lookR' ? .45 : 0;
    nodT = yawning ? -.3 * yawn : crouch ? .16 : licking ? .34 + Math.sin(t / 140) * .09
      : stretching ? -.18 : 0;
  }
  const tiltT = rest ? sleepPose.tilt * settling : happy ? (S.petSide || -1) * .1 + Math.sin(t / 330) * .06
    : licking ? -.12 : S.act === 'tilt' ? .2 : 0;
  if (!frozen) {
    S.turn += (turnT - S.turn) * ease(12);
    S.nod += (nodT - S.nod) * ease(11);
    S.tilt += (tiltT - S.tilt) * ease(5);
  }
  head.rotation.set(S.nod + (1 - forwardGlance) * S.thump * (0.05 + 0.05 * fast), S.turn, S.tilt);
  const flick = S.act === 'ear' ? Math.sin((S.actUntil - t) / 420 * Math.PI * 2) * 0.28 : 0;
  ears[0].rotation.z = .24 + flick;
  ears[1].rotation.z = -.24 - flick * .5;
  ears[0].rotation.x = ears[1].rotation.x = -.32 * fast;

  // eyes
  if (rest) {
    S.lid = rest.lid;
  } else {
    if (t > S.blinkAt) { S.blinkUntil = t + 130; S.blinkAt = t + rnd(2600, 5600); }
    const lid = t < S.blinkUntil || happy || licking || stretching || yawn > .25 ? 1 : 0;
    S.lid += (lid - S.lid) * (1 - Math.exp(-realDt * (lid > S.lid ? 34 : 16)));
  }
  S.gazeX += (aimX - S.gazeX) * ease(36);
  S.gazeY += (aimY - S.gazeY) * ease(36);
  const widen = (typing ? 1.25 : pouncing ? 1.9 : 1) * (1 - 0.3 * fast);
  const er = .205 * P.eyeSize, iry = er * .74, c = S.lid;
  for (const e of eyes) {
    // The upper lid leaves the same thin crescent for a blink, a stroke or sleep.
    const shut = c > .7, h = iry * mix(1, .3, smooth(0, .8, c));
    const eyc = ey + (h * .7 - iry) * smooth(.35, .7, c);
    e.iris.material = shut ? M.shut : M.eye;
    fillPatch(e.iris, e.s * ex, eyc, er * (shut ? .92 : 1), h, e.s * P.eyeTilt, .008);
    const prx = er * .3 * widen;
    const dx = clamp(S.gazeX * er * .42, -(er * .9 - prx), er * .9 - prx);
    const room = h * Math.sqrt(Math.max(0, 1 - ((Math.abs(dx) + prx * 0.7) / er) ** 2));   // how tall the eye is where the pupil sits
    const pry = Math.min(er * .62, room * .68), dy = clamp(-S.gazeY * iry * .34, -(room - pry), room - pry);
    fillPatch(e.pupil, e.s * ex + dx, eyc + dy, prx, pry, e.s * P.eyeTilt * 0.5, 0.013);
    e.pupil.visible = c < 0.45; e.lid.visible = shut;
    if (shut) fillPatch(e.lid, e.s * ex, eyc + h * .6, er * 1.08, h, e.s * P.eyeTilt, .018);
  }

  // paws
  for (const side of ['L', 'R']) {
    const p = paws[side], since = t - p.tapAt;
    if (rest) {
      if (!frozen) {
        p.mode = 'rest';
        p.pos.lerp(tmpGoal.copy(REST[side]).lerp(sleepPose.paws[side], settling), ease(11));
      }
    } else if (since < STRIKE) {
      const k = 1 - Math.pow(1 - Math.min(1, since / 60), 3); p.pos.lerpVectors(p.from, p.to, k);
      p.pos.y = since < RISE ? mix(p.from.y, Math.max(p.from.y, p.to.y + 0.7), since / RISE) : mix(Math.max(p.from.y, p.to.y + 0.7), p.to.y - 0.03, Math.pow((since - RISE) / FALL, 2));
    } else {
      if (!p.landed) land(p, t);
      if (p.held) { p.pos.x += (p.to.x - p.pos.x) * ease(30); p.pos.z += (p.to.z - p.pos.z) * ease(30); p.pos.y += (p.to.y - 0.04 - p.pos.y) * ease(30); }
      else if (hover) {
        p.mode = 'up';
        tmpGoal.copy(UP[side]);
        tmpGoal.z += fwd * 0.6;
        tmpGoal.y += Math.sin(t / 240 + (side === 'L' ? 0 : 1.8)) * 0.012;
        p.pos.lerp(tmpGoal, ease(20));
      }
      else if (side === MOUSE_PAW && mousing && (S.lastMouse > p.tapAt || since > STRIKE + 110)) {
        p.mode = 'mouse';
        tmpGoal.copy(mouseGroup.position);
        tmpGoal.y = pressingMouse ? .25 : .3;
        tmpGoal.z += .02;
        p.pos.lerp(tmpGoal, ease(MouseTravel.pawRate));
      }
      else if (licking && side === 'R' && since > STRIKE + 110) { p.mode = 'lick'; head.getWorldPosition(tmpGoal); tmpGoal.x += 0.06; tmpGoal.y += -0.5 * P.headSize - Math.sin(t / 140) * 0.06; tmpGoal.z += 0.66 * P.headSize; p.pos.lerp(tmpGoal, ease(12)); }
      else if (swat && side === (S.pointer && S.pointer.x > 0 ? 'R' : 'L') && since > STRIKE + 110) { p.mode = 'swat'; tmpGoal.set((side === 'L' ? -1 : 1) * 0.62, 1.25, 1.05); p.pos.lerp(tmpGoal, ease(26)); }
      else if (stretching && since > STRIKE + 110) { p.mode = 'rest'; tmpGoal.copy(REST[side]); tmpGoal.z += .85; p.pos.lerp(tmpGoal, ease(8)); }
      else if (since > STRIKE + 110) { p.mode = 'rest'; p.pos.lerp(REST[side], ease(9)); }
    }
    shoulderW.copy(SHOULDER[side]); shoulderW.x += sx * shoulderW.y; shoulderW.z += fwd * shoulderW.y; shoulderW.y = shoulderW.y * (1 - fwd * fwd * 0.35) * squat + breath * 0.02 + bounce * 0.06; drawLimb(p, shoulderW);
  }

  tongue.visible = licking && paws.R.mode === 'lick';
  if (tongue.visible) {
    const k = Math.sin(t / 140);
    tongue.position.y = -.38 - .05 * k;
    tongue.scale.set(.06, .085 + .03 * k, .04);
  }
  mouth.visible = yawn > .04;
  yawnTongue.visible = yawn > .24;
  if (mouth.visible) {
    const mouthY = -.235 - .055 * yawn;
    const halfHeight = .012 + .22 * yawn;
    fillPatch(mouth, 0, mouthY, .028 + .185 * yawn, halfHeight, 0, .012);
    if (yawnTongue.visible) {
      fillPatch(yawnTongue, 0, mouthY - halfHeight * .48, .096 * yawn, .070 * yawn, 0, .018);
    }
  }

  options.onFrame?.(dt, t, rest);
  renderer.render(scene, camera);
  // Keep the pet's colour on the rear canvas and its depth in WebGL. The desk pass
  // can then outline the visible keys and mouse even where a paw overlaps them.
  coatContext.drawImage(renderer.domElement, 0, 0);
  camera.layers.set(deskLayer);
  renderer.autoClearDepth = false;
  renderer.render(scene, camera);
  renderer.autoClearDepth = true;
  camera.layers.set(0);
  options.onAfterFrame?.(camera, t);
  zzz.hidden = !rest?.showZ;
  if (!zzz.hidden) {
    head.getWorldPosition(proj);
    proj.x += .58;
    proj.y += .53;
    proj.project(camera);
    zzz.style.left = (proj.x + 1) / 2 * w + 'px';
    zzz.style.top = (1 - proj.y) / 2 * h + 'px';
  }
  // Labels above the keys that were hit.
  S.chips = S.chips.filter(c => { const out = Math.max(0, (t - (c.gone ?? c.born + HOLD_MAX)) / 240); if (out >= 1) { c.el.remove(); return false; }
    proj.set(c.k.x, 0.75, c.k.z).project(camera); c.el.style.left = ((proj.x + 1) / 2 * w) + 'px'; c.el.style.top = ((1 - proj.y) / 2 * h - out * 8) + 'px'; c.el.style.opacity = String(clamp((t - c.born) / 60, 0, 1) * (1 - out)); return true; });
  raf = requestAnimationFrame(renderFrame);
}
applyShape();
raf = requestAnimationFrame(renderFrame);

/* ---------- what the app can ask of the cat ---------- */
// A press whose key is not being shown (privacy mode, or a key off the little keyboard) still gets a paw tap, with no key attached.
// The signal names the owner's hand; the keyboard faces the cat, so the owner's left hand is the paw on the right of the picture.
const plainTap = side => { if (S.rest) return; const t = performance.now(), s = side === 'Left' ? 'R' : 'L'; strike(s, (s === 'L' ? -1 : 1) * rnd(0.45, 1.0), KB.z0 + rnd(0.35, 0.7), t, null); };
let shownKeys = new Set(), buttonsDown = 0, buttonsAt = 0;
// The system sometimes never reports a key coming back up (on macOS, any key let go while Command is held). A paw therefore
// lets go by itself after a moment instead of staying planted on a key nobody is pressing.
const HOLD_MAX = 1400, downAt = new Map();
const letGo = setInterval(() => { const t = performance.now();
  for (const [code, at] of downAt) if (t - at > HOLD_MAX) { keyUp(code); downAt.delete(code); }
  if (S.mouseDown && buttonsAt && t - buttonsAt > HOLD_MAX) S.mouseDown = false; }, 200);
return {
  parts: {
    boardBase, mouseGroup, keys, face, bodyMesh,
  },
  setInput(keySet, buttonSet) {
    sleep.activity(performance.now());
    for (const code of shownKeys) if (!keySet.has(code)) { keyUp(code); downAt.delete(code); }
    if (!S.rest) {
      for (const code of keySet) if (!shownKeys.has(code)) { keyDown(code); downAt.set(code, performance.now()); }
    }
    shownKeys = new Set(keySet);
    const t = performance.now(), n = buttonSet.size;
    if (n !== buttonsDown) { S.lastMouse = t; S.mouseDown = n > 0; buttonsDown = n; buttonsAt = n > 0 ? t : 0; }
  },
  tap(side) {
    sleep.activity(performance.now());
    if (!followKeys) { plainTap(side); return; }
    const at = performance.now(); setTimeout(() => { if (!dead && lastStrikeAt < at && !S.down.size && !shownKeys.size) plainTap(side); }, 45);
  },
  repeat(code) {
    const t = performance.now();
    sleep.activity(t);
    if (!followKeys || S.rest || !shownKeys.has(code)) return;
    keyDown(code, t);
    downAt.set(code, t);
  },
  setOptions(o) {
    if ('showKeyboard' in o) board.visible = !!o.showKeyboard;
    if ('showMouse' in o) mouseGroup.visible = !!o.showMouse;
    if ('followKeys' in o && followKeys !== !!o.followKeys) {
      followKeys = !!o.followKeys;
      if (!followKeys) {
        for (const code of S.down.keys()) keyUp(code);
        shownKeys.clear();
        downAt.clear();
      }
    }
    if ('leftMouse' in o && !!o.leftMouse !== (DESK_DIR < 0)) {
      setHanded(!!o.leftMouse);
      S.mouseX = S.mouseZ = S.mouseGoalX = S.mouseGoalZ = 0;
    }
    if (Number.isFinite(o.sleepSeconds)) sleep.setIdleMs(clamp(o.sleepSeconds, 10, 7200) * 1000);
  },
  mouseMoved: moveMouse,
  bodyLean: () => S.sx,
  noteActivity() { sleep.activity(performance.now()); },
  setPointer,
  setPointerOverPet(overPet) { pointerOverPet = overPet; },
  setPetting,
  clear() {
    settleKeyboard();
    shownKeys = new Set();
    buttonsDown = buttonsAt = 0;
    S.mouseDown = false;
    S.mouseGoalX = S.mouseGoalZ = 0;
    S.lastMouse = S.lastMouseMotion = -Infinity;
    S.mouseAim = null;
  },
  state() {
    const t = performance.now();
    if (S.rest) {
      if (S.rest.phase === 'rising') return 'waking';
      if (S.rest.phase === 'yawning') return 'yawning';
      return 'sleeping';
    }
    return S.pet || t < S.happyUntil ? 'petting' : keyboardPose(t) ? 'typing' : mousePose(t) ? 'mouse' : 'idle';
  },
  fastForwardToSleep() { sleep.startSleep(performance.now()); },
  destroy() { dead = true; clearInterval(letGo); cancelAnimationFrame(raf); S.chips.forEach(c => c.el.remove()); zzz.remove(); coatCanvas.remove(); renderer.domElement.remove(); renderer.dispose(); },
};
};
