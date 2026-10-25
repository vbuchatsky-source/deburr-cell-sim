import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ================= i18n =================
const QS = new URLSearchParams(location.search);
const LANG = (() => { const q = QS.get('lang'); if (q === 'en' || q === 'he') { localStorage.setItem('dbc_lang', q); return q; } return localStorage.getItem('dbc_lang') || 'he'; })();
const EN = LANG === 'en';
const L = (he, en) => EN ? en : he;
if (EN) { document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr'; }
document.title = L('תא אוטומטי להסרת גרדים במברשות אברסיביות – סימולציה', 'Automatic Abrasive-Brush Deburring Cell – Simulator');
for (const id of ['bLang2']) { const b = document.getElementById(id); b.textContent = EN ? 'עב' : 'EN'; }
function switchLang(e) { e && e.stopPropagation(); const nl = EN ? 'he' : 'en'; localStorage.setItem('dbc_lang', nl); const u = new URL(location.href); u.searchParams.set('lang', nl); location.href = u.toString(); }
document.getElementById('bLang2').onclick = switchLang;
const $ = id => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => { t = clamp(t); return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
const TAU = Math.PI * 2;
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
const MQ = matchMedia('(max-width: 820px), (max-height: 520px)');
function layout() { const m = MQ.matches; document.body.classList.toggle('mobile', m); document.body.classList.toggle('landscape', m && innerWidth > innerHeight); return m; }
let IS_MOBILE = layout();

// ================= renderer =================
const canvas = $('c');
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }); }
catch (e) { document.body.insertAdjacentHTML('beforeend', '<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#1b1e23;z-index:99">WebGL not available</div>'); throw e; }
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9; renderer.localClippingEnabled = true;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x15181d); scene.fog = new THREE.Fog(0x1b1e23, 5000, 11000);
const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
const camera = new THREE.PerspectiveCamera(34, 1, 20, 20000);
const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }; controls.maxPolarAngle = Math.PI * .53; controls.minDistance = 120; controls.maxDistance = 7000;
scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x2a2622, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(900, 2900, 1500); sun.target.position.set(-300, 700, 0); scene.add(sun.target);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4; sun.shadow.normalBias = 1.5; sun.shadow.bias = -.0005;
Object.assign(sun.shadow.camera, { left: -1300, right: 1300, top: 1300, bottom: -1100, near: 300, far: 6000 }); scene.add(sun);
const fill = new THREE.DirectionalLight(0xbfd4ff, .6); fill.position.set(-1800, 1500, -1200); scene.add(fill);
const inLight = new THREE.PointLight(0xfff2e0, 0.0, 900, 2); inLight.position.set(0, 1400, 0); scene.add(inLight); // LED strip inside cell

// ================= textures =================
function canvasTex(w, h, draw, rep = [1, 1], srgb = false) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.userData.canvas = c; return t; }
function normalFrom(tex, k = 2) { const s = tex.userData.canvas, w = s.width, h = s.height; const d = s.getContext('2d').getImageData(0, 0, w, h).data; const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); const o = x.createImageData(w, h);
  const Lm = (i, j) => d[(((j + h) % h) * w + ((i + w) % w)) * 4] / 255;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const dx = (Lm(i + 1, j) - Lm(i - 1, j)) * k, dy = (Lm(i, j + 1) - Lm(i, j - 1)) * k; const n = 1 / Math.hypot(dx, dy, 1); const p = (j * w + i) * 4; o.data[p] = (-dx * n * .5 + .5) * 255; o.data[p + 1] = (dy * n * .5 + .5) * 255; o.data[p + 2] = n * 255; o.data[p + 3] = 255; }
  x.putImageData(o, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.copy(tex.repeat); t.anisotropy = 8; return t; }
const brushed = canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); for (let i = 0; i < 5000; i++) { const y = Math.random() * h, v = 90 + Math.random() * 90 | 0; x.strokeStyle = `rgba(${v},${v},${v},.3)`; x.lineWidth = .4 + Math.random(); x.beginPath(); const sx = Math.random() * w; x.moveTo(sx - 200, y); x.lineTo(sx + 200, y); x.stroke(); } }, [3, 3]);
const brushedN = normalFrom(brushed, 1.2);
const paint = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#7a7a7a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = 100 + Math.random() * 60 | 0; x.fillStyle = `rgba(${v},${v},${v},.5)`; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }, [4, 4]);
const paintN = normalFrom(paint, .6);
const floorCol = canvasTex(1024, 1024, (x, w, h) => { x.fillStyle = '#3a3f47'; x.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { const v = 50 + Math.random() * 30 | 0; x.fillStyle = `rgba(${v},${v + 4},${v + 10},.35)`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } x.strokeStyle = 'rgba(15,17,20,.95)'; x.lineWidth = 4; x.strokeRect(0, 0, w, h); }, [14, 14], true);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(16000, 16000), new THREE.MeshStandardMaterial({ map: floorCol, roughness: .5, metalness: 0, envMapIntensity: .5 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
// yellow safety lines around robot zone
for (const [w, d, x, z] of [[1100, 30, -800, 820], [30, 1400, -1370, 120], [1100, 30, -800, -580]]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: 0xf2c11d, roughness: .7 })); s.rotation.x = -Math.PI / 2; s.position.set(x, 1.5, z); scene.add(s); }
// bristle texture (SiC filament) for the brushes
const bristleTex = canvasTex(512, 64, (x, w, h) => { x.fillStyle = '#2a2b2e'; x.fillRect(0, 0, w, h); for (let i = 0; i < 2600; i++) { const v = 30 + Math.random() * 80 | 0; x.strokeStyle = `rgba(${v},${v},${v + 4},.8)`; x.lineWidth = .6 + Math.random() * .8; const X = Math.random() * w; x.beginPath(); x.moveTo(X, 0); x.lineTo(X + (Math.random() - .5) * 6, h); x.stroke(); } }, [6, 1], true);

// ================= materials =================
const Q0 = QS.get('q'); let HIGH = Q0 ? Q0 === 'high' : localStorage.getItem('dbc_q') === 'high';
const sm = o => { const { env, ...r } = o; return Object.assign(new THREE.MeshStandardMaterial(r), { envMapIntensity: env ?? 1 }); };
const M = {
  profile: sm({ color: 0xb7bec7, metalness: .85, roughness: .4, roughnessMap: brushed, normalMap: brushedN, normalScale: new THREE.Vector2(.15, .15), env: .9 }),
  alu: sm({ color: 0xc3c9d0, metalness: .9, roughness: .34, roughnessMap: brushed, normalMap: brushedN, normalScale: new THREE.Vector2(.18, .18), env: .9 }),
  panel: sm({ color: 0xd2d6db, metalness: .55, roughness: .45, roughnessMap: paint, normalMap: paintN, normalScale: new THREE.Vector2(.2, .2) }),
  ss: sm({ color: 0xd0d4d9, metalness: 1, roughness: .24, roughnessMap: brushed, normalMap: brushedN, normalScale: new THREE.Vector2(.12, .12), env: .9 }),
  steel: sm({ color: 0xa8aeb6, metalness: 1, roughness: .3, roughnessMap: brushed, env: .9 }),
  dark: sm({ color: 0x23272d, metalness: .5, roughness: .45, roughnessMap: brushed }),
  black: sm({ color: 0x16181c, metalness: .35, roughness: .5, roughnessMap: paint }),
  motor: sm({ color: 0x1d2024, metalness: .6, roughness: .38, roughnessMap: brushed }),
  rubber: sm({ color: 0x111214, metalness: 0, roughness: .92 }),
  yellow: sm({ color: 0xf2c418, metalness: .15, roughness: .42, roughnessMap: paint, normalMap: paintN, normalScale: new THREE.Vector2(.15, .15) }),
  robot: sm({ color: 0xdfe3e6, metalness: .15, roughness: .4, roughnessMap: paint }),
  robotJ: sm({ color: 0x2b6fb3, metalness: .3, roughness: .35 }),
  ptfe: sm({ color: 0xf1f0ea, metalness: 0, roughness: .55 }),
  blue: sm({ color: 0x2556a8, metalness: .5, roughness: .35 }),
  green: sm({ color: 0x2f9f5a, metalness: .2, roughness: .4 }),
  red: sm({ color: 0xd0201a, metalness: .1, roughness: .35 }),
  orangeP: sm({ color: 0xe2601a, metalness: .1, roughness: .45 }),
  grey: sm({ color: 0x7c848e, metalness: .3, roughness: .5 }),
  carbide: sm({ color: 0x5a5e66, metalness: 1, roughness: .3 }),
  brass: sm({ color: 0xd2a84e, metalness: 1, roughness: .28 }),
  hose: sm({ color: 0x1f6fe0, metalness: 0, roughness: .35 }),
  cable: sm({ color: 0x15171a, metalness: 0, roughness: .6 }),
  cableO: sm({ color: 0xe0601a, metalness: 0, roughness: .55 }),
  plc: sm({ color: 0x3a3e44, metalness: .1, roughness: .55 }),
  plcLight: sm({ color: 0xe6e7e2, metalness: .05, roughness: .6 }),
  bristle: sm({ color: 0x9a9da3, map: bristleTex, metalness: .1, roughness: .85 }),
  hub: sm({ color: 0x8a1c1c, metalness: .4, roughness: .4 }),
  pc: new THREE.MeshPhysicalMaterial({ color: 0xff7a1a, metalness: 0, roughness: .06, transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: .05 }),
  glassC: new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, metalness: 0, roughness: .05, transparent: true, opacity: .2, depthWrite: false, side: THREE.DoubleSide }),
  lens: sm({ color: 0x0a1630, metalness: .9, roughness: .05 }),
  led: sm({ color: 0xffffff, emissive: new THREE.Color(0xfff4d8), emissiveIntensity: 1.2, roughness: .3 }),
};
M.pc.userData.glass = M.glassC.userData.glass = 1;

// ================= geometry helpers =================
function add(mesh, p) { mesh.castShadow = mesh.receiveShadow = true; p.add(mesh); return mesh; }
const GC = new Map();
function rgeo(w, h, d) { const k = w + '|' + h + '|' + d; if (!GC.has(k)) { const r = Math.min(2.5, Math.min(w, h, d) * .12); GC.set(k, r < .6 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 1, r)); } return GC.get(k); }
function box(w, h, d, mat, x, y, z, p) { const m = add(new THREE.Mesh(rgeo(w, h, d), mat), p); m.position.set(x, y, z); return m; }
function cyl(r, len, mat, axis, x, y, z, p, seg = 24, r2) { const rt = r2 ?? r, c = Math.min(1.2, r * .12, len * .12);
  const pts = [[0, -len / 2], [r - c, -len / 2], [r, -len / 2 + c], [rt, len / 2 - c], [rt - c, len / 2], [0, len / 2]].map(a => new THREE.Vector2(Math.max(.001, a[0]), a[1]));
  const g = c > .3 ? new THREE.LatheGeometry(pts, seg) : new THREE.CylinderGeometry(rt, r, len, seg);
  if (axis === 'x') g.rotateZ(-Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
  const m = add(new THREE.Mesh(g, mat), p); m.position.set(x, y, z); return m; }
function ring(r0, r1, len, mat, axis, x, y, z, p, seg = 32) { const s = new THREE.Shape(); s.absarc(0, 0, r1, 0, TAU); const h = new THREE.Path(); h.absarc(0, 0, r0, 0, TAU, true); s.holes.push(h);
  const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: seg }); g.translate(0, 0, -len / 2); if (axis === 'x') g.rotateY(Math.PI / 2); else if (axis === 'y') g.rotateX(Math.PI / 2);
  const m = add(new THREE.Mesh(g, mat), p); m.position.set(x, y, z); return m; }
function grp(p, x = 0, y = 0, z = 0, tag) { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); g.userData.body = 1; if (tag) g.userData.tag = tag; return g; }
function tube(pts, r, mat, p, seg = 40) { const c = new THREE.CatmullRomCurve3(pts.map(a => new THREE.Vector3(...a))); const m = add(new THREE.Mesh(new THREE.TubeGeometry(c, seg, r, 8, false), mat), p); m.userData.tube = 1; return m; }
function plate(w, h, draw, x, y, z, p, ry = 0, ppm = 6, emissive = false) { const t = canvasTex(Math.round(w * ppm), Math.round(h * ppm), draw, [1, 1], true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, metalness: .3, roughness: .4, emissive: emissive ? 0xffffff : 0, emissiveMap: emissive ? t : null, emissiveIntensity: emissive ? .9 : 0 })); m.position.set(x, y, z); m.rotation.y = ry; p.add(m); m.userData.plate = 1; return m; }
// item 50x50 T-slot profile (cross-section extruded)
const TSG = new Map();
function tslotGeo(len, s = 50) { const k = len + '|' + s; if (TSG.has(k)) return TSG.get(k); const h = s / 2, q = s / 50;
  const side = [[-h + 2 * q, h], [-5.5 * q, h], [-5.5 * q, h - 4.5 * q], [-10 * q, h - 4.5 * q], [-8 * q, h - 13 * q], [8 * q, h - 13 * q], [10 * q, h - 4.5 * q], [5.5 * q, h - 4.5 * q], [5.5 * q, h], [h - 2 * q, h]];
  const sh = new THREE.Shape(); let first = true; for (let r = 0; r < 4; r++) for (const [x, y] of side) { let X = x, Y = y; for (let i = 0; i < r; i++) [X, Y] = [Y, -X]; if (first) { sh.moveTo(X, Y); first = false; } else sh.lineTo(X, Y); }
  sh.closePath(); const ho = new THREE.Path(); ho.absarc(0, 0, 5 * q, 0, TAU, true); sh.holes.push(ho);
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: true, bevelThickness: .6, bevelSize: .5, bevelSegments: 1, curveSegments: 8 }); g.translate(0, 0, -len / 2); TSG.set(k, g); return g; }
function prof(len, axis, x, y, z, p, s = 50) { let g = tslotGeo(len - 1.2, s); if (axis === 'x') g = g.clone().rotateY(Math.PI / 2); else if (axis === 'y') g = g.clone().rotateX(Math.PI / 2); const m = add(new THREE.Mesh(g, M.profile), p); m.position.set(x, y, z);
  // black end caps
  return m; }
const boltHead = new THREE.CylinderGeometry(3.2, 3.2, 3.5, 10), boltHex = new THREE.CylinderGeometry(1.6, 1.6, 1, 6);
const BOLTMAT = sm({ color: 0x1b1d21, metalness: .7, roughness: .35 }), BOLTRED = sm({ color: 0xb8231c, metalness: .3, roughness: .35 });
function bolts(p, list, size = 1, mat = BOLTMAT) { if (!list.length) return; const a = new THREE.InstancedMesh(boltHead, mat, list.length), b = new THREE.InstancedMesh(boltHex, new THREE.MeshBasicMaterial({ color: 0x050505 }), list.length);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(size, size, size);
  list.forEach(([x, y, z, ax = 'y', dir = 1], i) => { const up = new THREE.Vector3(ax === 'x' ? dir : 0, ax === 'y' ? dir : 0, ax === 'z' ? dir : 0); q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    a.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z).addScaledVector(up, 1.75 * size), q, s)); b.setMatrixAt(i, m4.compose(new THREE.Vector3(x, y, z).addScaledVector(up, 3.3 * size), q, s)); });
  a.castShadow = true; a.userData.inst = b.userData.inst = 1; p.add(a); p.add(b); }
// NEMA stepper motor (size 42 or 57) along axis, shaft pointing +axis; returns group
function nema(p, x, y, z, axis = 'y', s = 42, len = 48, label = 'NEMA17', dir = 1) { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g);
  if (axis === 'x') g.rotation.z = -Math.PI / 2 * dir; else if (axis === 'z') g.rotation.x = Math.PI / 2 * dir; else if (dir < 0) g.rotation.z = Math.PI;
  // local: shaft along +y
  box(s, 8, s, M.alu, 0, len / 2 - 4, 0, g); box(s, 8, s, M.alu, 0, -len / 2 + 4, 0, g); box(s * .96, len - 16, s * .96, M.motor, 0, 0, 0, g);
  for (let i = -2; i <= 2; i++) box(s * .98, 1.2, s * .98, M.dark, 0, i * (len - 18) / 5, 0, g);
  cyl(s * .26, 2, M.alu, 'y', 0, len / 2 + 1, 0, g); cyl(s * .06 + 1.5, 20, M.ss, 'y', 0, len / 2 + 10, 0, g, 12);
  box(14, 12, 10, M.black, 0, -len / 2 + 14, s / 2 + 4, g); // connector
  bolts(g, [[s * .38, len / 2, s * .38], [-s * .38, len / 2, s * .38], [s * .38, len / 2, -s * .38], [-s * .38, len / 2, -s * .38]], .7);
  plate(s * .8, s * .32, (c, w, h) => { c.fillStyle = '#d9dde2'; c.fillRect(0, 0, w, h); c.fillStyle = '#123'; c.font = `bold ${h * .42}px Arial`; c.fillText(label, w * .06, h * .5); c.font = `${h * .26}px Arial`; c.fillText(s > 50 ? '23HS22-1504S' : 'M-1713-1.5', w * .06, h * .86); }, 0, -2, s * .48 + .6, g);
  return g; }
// jaw (spider) coupling along y, centered
function jawCoupling(p, x, y, z, r = 10, len = 26) { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); cyl(r, len * .4, M.alu, 'y', 0, -len * .3, 0, g); cyl(r, len * .4, M.alu, 'y', 0, len * .3, 0, g); cyl(r * .92, len * .2, M.red, 'y', 0, 0, 0, g, 12); bolts(g, [[r, -len * .3, 0, 'x'], [r, len * .3, 0, 'x']], .45); return g; }
function linRailX(len, x, y, z, p, face = 'z') { const m = box(len, 15, 15, M.steel, x, y, z, p); const B = []; for (let i = 30; i < len; i += 60) B.push([x - len / 2 + i, y, z + 7.5, 'z']); bolts(p, B, .55); return m; }

// ================= parts registry =================
const parts = {}, partOrder = [];
function part(id, name, desc, dir, anchor, opt = {}) { const g = new THREE.Group(); g.userData.part = id; scene.add(g);
  parts[id] = { id, name, desc, g, dir: new THREE.Vector3(...dir), anchor: new THREE.Vector3(...anchor), no: partOrder.length + 1, shell: !!opt.shell }; partOrder.push(id); return g; }

// =====================================================================
//  SCENE  (mm, Y up). Cell centre x=0,z=0. Front door at +z. Robot at -x.
// =====================================================================
const C = { LOADX: -470, INSPX: -250, WORKX: 0, SH_Y: 780, CH_Y: 870, JAW_T: 949, PARK_X: 150, PARK_YB: 1290, DISC_R: 60, VB_BOT: 205 };
const A = (o, ...ids) => { o.userData.allow = (o.userData.allow || []).concat(ids); return o; };

// ---------- 1. frame ----------
const gFrame = part('frame', L('מסגרת פרופילי אלומיניום item 50×50', 'item 50×50 aluminium profile frame'), L('מסגרת מפרופילי אלומיניום מאולגן 10-50×50 (item 0.0.624.52) – 4 עמודים של 1500 מ"מ, קורות רוחב ואורך, זוויתנים יצוקים ופלטת עבודה SS304 בעובי 10 מ"מ. רגלי פילוס ואוזני מלגזה. הורחבה ל-760 מ"מ כדי שמנוע ציר X יישאר בתוך המעטפת.', 'Anodised aluminium 10-50×50 profiles (item 0.0.624.52) – four 1500 mm posts, cross beams, die-cast angle brackets and a 10 mm SS304 machine plate. Levelling feet and forklift lugs. Widened to 760 mm so the X motor stays inside the envelope.'), [0, 0, 0], [355, 1500, 275]);
for (const x of [-355, 355]) for (const z of [-275, 275]) { prof(1430, 'y', x, 785, z, gFrame); cyl(22, 6, M.black, 'y', x, 57, z, gFrame); cyl(14, 22, M.steel, 'y', x, 43, z, gFrame); cyl(30, 10, M.rubber, 'y', x, 27, z, gFrame); box(50, 8, 50, M.dark, x, 64, z, gFrame); }
for (const y of [95, 715, 1475]) { for (const z of [-275, 275]) prof(660, 'x', 0, y, z, gFrame); for (const x of [-355, 355]) prof(500, 'z', x, y, 0, gFrame); }
// angle brackets (item 62523) under the x-rails at the posts
{ for (const x of [-355, 355]) for (const z of [-275, 275]) for (const y of [715, 1475]) { if (y === 1475 && z < 0) continue; const sx = Math.sign(x); box(22, 4, 22, M.alu, x - sx * 36, y - 27, z, gFrame); box(4, 22, 22, M.alu, x - sx * 27, y - 36, z, gFrame); box(4, 4, 22, M.alu, x - sx * 30, y - 30, z, gFrame).rotation.z = Math.PI / 4; } }
box(660, 10, 550, M.ss, 0, 745, 0, gFrame); // SS304 machine plate (item 10001)
{ const B = []; for (const x of [-310, -110, 110, 310]) for (const z of [-260, 260]) B.push([x, 750, z]); bolts(gFrame, B, .9); }
// loading bridge outside the cell (shuttle overhang) + support leg
box(204, 10, 160, M.ss, -488, 745, 0, gFrame); prof(690, 'y', -560, 395, 0, gFrame); box(80, 8, 80, M.dark, -560, 46, 0, gFrame); cyl(30, 10, M.rubber, 'y', -560, 27, 0, gFrame); cyl(12, 16, M.steel, 'y', -560, 40, 0, gFrame);
box(4, 40, 40, M.alu, -538, 720, 0, gFrame); box(40, 4, 40, M.alu, -560, 738, 0, gFrame); prof(150, 'x', -463, 715, 0, gFrame);
// forklift lugs
for (const z of [-275, 275]) for (const x of [-200, 200]) box(80, 30, 12, M.alu, x, 95, z + Math.sign(z) * 31, gFrame);
// bottom shelf for the cabinet
box(660, 6, 500, M.grey, 0, 123, 0, gFrame);

// ---------- 2. guards / enclosure (panels outside the frame) ----------
const gGuard = part('guard', L('מיגון: חלונות PMMA, דלת ושלב פירוק', 'Guarding: PMMA windows, door, roof'), L('דלת חזית מפוליקרבונט כתום שקוף (מסנן ניצוצות) עם מתג Interlock מקודד, דפנות אלומיניום, גג. פתיחת הדלת מנתקת מיד מומנט מכל המנועים (STO) – נסה את התקלה "דלת נפתחה".', 'Front door of orange transparent polycarbonate (spark filter) with a coded interlock switch, aluminium side panels and roof. Opening the door instantly removes torque from all motors (STO) – try the "door opened" fault.'), [0, 0, 1], [0, 1400, 300], { shell: true });
const PAN = M.panel;
// left panel with shuttle window opening z ±110, y 745..1100
box(4, 745 - 130, 600, PAN, -383, 130 + (745 - 130) / 2, 0, gGuard); box(4, 400, 600, PAN, -383, 1300, 0, gGuard);
box(4, 355, 190, PAN, -383, 922.5, -205, gGuard); box(4, 355, 190, PAN, -383, 922.5, 205, gGuard);
box(4, 1370, 600, M.pc, 383, 815, 0, gGuard).userData.glass = 1; // right PC window
box(760, 1370, 4, PAN, 0, 815, -303, gGuard); box(764, 4, 604, M.pc, 0, 1503, 0, gGuard).userData.glass = 1; // back + roof (PC)
// window frame strips on the right
for (const y of [132, 1498]) box(6, 6, 600, M.alu, 386, y, 0, gGuard);
// lower front panel with window (cabinet)
const lowFront = box(710, 600, 4, M.pc, 0, 430, 303, gGuard); lowFront.userData.glass = 1;
for (const y of [132, 728]) box(710, 6, 6, M.alu, 0, y, 306, gGuard);
// door: hinged at x=-380 (outward)
const door = grp(gGuard, -380, 0, 303, 'door'); A(door, 'frame');
box(756, 690, 4, M.pc, 378, 1100, 0, door).userData.glass = 1;
for (const [w, h, x, y] of [[760, 20, 378, 760], [760, 20, 378, 1440], [20, 700, 10, 1100], [20, 700, 746, 1100]]) box(w, h, 10, M.alu, x, y, 4, door);
box(16, 160, 26, M.black, 710, 1100, 18, door); box(12, 12, 20, M.black, 710, 1170, 8, door); box(12, 12, 20, M.black, 710, 1030, 8, door); // handle
for (const y of [800, 1400]) cyl(8, 50, M.steel, 'y', -4, y, 16, door, 12); // hinges
box(14, 40, 14, M.red, 752, 1260, 18, door); // coded interlock actuator
box(12, 50, 30, M.yellow, 392, 1260, 290, gFrame); // interlock switch (outside right)
plate(260, 60, (c, w, h) => { c.fillStyle = '#f2c418'; c.fillRect(0, 0, w, h); c.fillStyle = '#111'; c.font = `bold ${h * .32}px Arial`; c.fillText(L('⚠ סכנה – מברשות מסתובבות', '⚠ DANGER – ROTATING BRUSHES'), w * .04, h * .42); c.font = `${h * .22}px Arial`; c.fillText(L('אין לפתוח בזמן פעולה · משקפי מגן', 'Do not open while running · eye protection'), w * .04, h * .8); }, 378, 1350, 3, door, 0, 3);
// ---------- 3. automatic shutter on the shuttle window ----------
const gShut = part('shutter', L('תריס פנאומטי לחלון השאטל', 'Pneumatic shutter for the shuttle window'), L('חלון פולי-קרבונט קטן שנסגר על ידי בוכנה פנאומטית Ø20 כשהמברשות פועלות, ונפתח רק כשהשאטל יוצא לעמדת הטעינה. כך הרובוט לעולם לא נכנס לתא – שיפור משמעותי לעומת התכנון המקורי.', 'A small polycarbonate gate closed by a Ø20 pneumatic cylinder while the brushes run; it opens only when the shuttle travels out to the loading station. The robot never enters the cell – a key improvement over the original design.'), [-1, 0, 0], [-370, 1150, 120]);
for (const s of [-1, 1]) { box(12, 720, 12, M.alu, -392, 1120, s * 134, gShut); box(4, 720, 6, M.dark, -396, 1120, s * 129, gShut); }
const shutter = grp(gShut, 0, 0, 0, 'shutter'); A(shutter, 'shutter');
box(4, 300, 254, M.pc, -392, 948, 0, shutter).userData.glass = 1; box(6, 16, 240, M.alu, -392, 1106, 0, shutter); box(6, 12, 240, M.rubber, -392, 796, 0, shutter);
box(12, 30, 46, M.alu, -406, 1080, -136, shutter); box(12, 30, 20, M.alu, -400, 1080, -117, shutter).position.x = -397; box(16, 50, 24, M.dark, -425, 1080, -165, shutter); // arm + rodless carriage
// rodless (band) cylinder, static
box(30, 740, 30, M.alu, -402, 1110, -165, gShut).position.x = -402; box(34, 20, 34, M.dark, -402, 730, -165, gShut); box(34, 20, 34, M.dark, -402, 1490, -165, gShut);
tube([[-402, 1500, -150], [-402, 1530, -120], [-402, 1520, -60]], 3, M.hose, gShut); tube([[-410, 728, -150], [-430, 700, -120], [-440, 650, -60]], 3, M.hose, gShut);
// ---------- 4. Z axis (shuttle linear axis) ----------
const gZ = part('zaxis', L('ציר Z – מסילות PTFE ובורג הנעה M12', 'Z axis – PTFE rails and M12 lead screw'), L('שתי מסילות PTFE (item 10002), בורג הנעה M12, מסבי BK/BF12 ומנוע צעד NEMA17 עם מצמד. השאטל נע בין עמדת הטעינה (מחוץ לתא), עמדת הבדיקה ועמדת העבודה – זהו "מיקום Z" של הכלי מתחת למברשות.', 'Two PTFE rails (item 10002), M12 lead screw, BK/BF12 bearings and a NEMA17 stepper with coupling. The shuttle moves between the loading station (outside the cell), the inspection station and the working station – the "Z positioning" of the tool under the brushes.'), [0, -.4, 1], [-150, 800, 60]);
for (const z of [-45, 45]) box(735, 30, 16, M.ptfe, -207.5, 765, z, gZ);
cyl(6, 715, M.ss, 'x', -212.5, 772, 0, gZ, 12);
box(24, 40, 46, M.alu, -562, 770, 0, gZ); box(24, 40, 46, M.alu, 132, 770, 0, gZ); // BK/BF supports
cyl(9, 26, M.steel, 'x', -562, 772, 0, gZ, 16); cyl(9, 26, M.steel, 'x', 132, 772, 0, gZ, 16);
jawCoupling(gZ, 160, 772, 0, 10, 26).rotation.z = Math.PI / 2;
const zMot = nema(gZ, 205, 772, 0, 'x', 42, 48, 'NEMA17', -1); // shaft toward -x
box(8, 48, 50, M.alu, 177, 776, 0, gZ);
// limit switches (E47) at rail ends
for (const x of [-575, 145]) { box(20, 20, 14, M.blue, x, 760, 70, gZ); }

// ---------- 5. shuttle (moving) + chuck ----------
const gSh = part('shuttle', L('שאטל: פלטת נשא ומנוע ראשי PCE 220M4', 'Shuttle: carrier plate and PCE 220M4 main motor'), L('פלטת SS304 המחליקה על מסילות ה-PTFE, נושאת את מנוע הסיבוב הראשי (גיר-מנוע AC 220M4) ואת הצ\'אק. אום פליז על הבורג. בשאטל נמצא גם חיישן הנוכחות IFM IGT205 לזיהוי כלי.', 'SS304 plate sliding on the PTFE rails, carrying the main rotation motor (220M4 AC gear-motor) and the chuck. Brass nut on the screw. It also carries the IFM IGT205 presence sensor.'), [0, 0, 1], [0, 840, 70]);
gSh.userData.body = 1; A(gSh, 'zaxis'); // slides on the rails / screw through nut
box(140, 15, 140, M.ss, 0, 787.5, 0, gSh);
box(40, 18, 26, M.brass, 0, 771, 0, gSh); // nut under plate (between rails)
box(90, 75, 90, M.motor, 0, 832.5, 0, gSh); cyl(30, 88, M.motor, 'x', 89, 832, 0, gSh, 24); cyl(31, 6, M.alu, 'x', 136, 832, 0, gSh, 24); box(30, 20, 26, M.black, 80, 872, 0, gSh);
for (let i = 0; i < 6; i++) cyl(31.5, 2, M.dark, 'x', 55 + i * 12, 832, 0, gSh, 24);
plate(70, 28, (c, w, h) => { c.fillStyle = '#d9dde2'; c.fillRect(0, 0, w, h); c.fillStyle = '#123'; c.font = `bold ${h * .38}px Arial`; c.fillText('PCE 220M4', w * .06, h * .45); c.font = `${h * .24}px Arial`; c.fillText('i=1:20 · 140 rpm', w * .06, h * .82); }, 0, 836, 45.6, gSh);
box(18, 14, 12, M.blue, -55, 801, 56, gSh); cyl(4, 30, M.steel, 'x', -49, 815, 56, gSh, 10); // IFM sensor
// chuck rotor (rotates with tool)
const gChuck = new THREE.Group(); gChuck.userData.part = 'chuck'; gChuck.position.set(0, C.CH_Y, 0); gSh.add(gChuck);
parts.chuck = { id: 'chuck', name: L('צ\'אק 3 לסתות Lingman JAB-40', 'Lingman JAB-40 3-jaw chuck'), desc: L('צ\'אק פנאומטי 3 לסתות Ø84. כוח הידוק מחושב ~95N; עם μ=0.15 מתקבל גבול גלישה ≈0.77N בקצה – ומכאן מגבלת כוח המברשת שמוטמעת בסימולציה (הגנת Over-force). ירידת לחץ אוויר מזוהה ע"י מתג לחץ.', 'Pneumatic 3-jaw chuck Ø84. Computed clamping force ~95 N; with μ=0.15 the slip limit at the tool tip is ≈0.77 N – this limit is built into the simulator as the over-force protection. Loss of air pressure is detected by a pressure switch.'), g: gChuck, dir: new THREE.Vector3(0, 1.2, .6), anchor: new THREE.Vector3(0, 75, 0), no: partOrder.length + 1 }; partOrder.push('chuck');
gChuck.userData.body = 1; A(gChuck, 'shuttle', 'tool');
cyl(42, 64, M.steel, 'y', 0, 32, 0, gChuck, 40); cyl(44, 10, M.dark, 'y', 0, 5, 0, gChuck, 40); cyl(14, 4, M.dark, 'y', 0, 64, 0, gChuck, 24);
{ const B = []; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + .5; B.push([Math.cos(a) * 34, 64, Math.sin(a) * 34]); } bolts(gChuck, B, .55); }
const jaws = []; for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; const piv = new THREE.Group(); piv.rotation.y = -a; gChuck.add(piv); const j = grp(piv, 20, 0, 0, 'jaw'); A(j, 'tool', 'chuck');
  box(20, 15, 12, M.steel, 10, 71.5, 0, j); box(26, 4, 10, M.dark, 13, 65.5, 0, j); jaws.push(j); }
// jaws ride in T-slots: chuck top face at y=64 relative -> slots
for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; const s = box(26, 0.8, 11, M.black, 0, 64.2, 0, gChuck); s.position.set(Math.cos(a) * 28, 64.2, -Math.sin(a) * 28); s.rotation.y = a; }

// ---------- 6. Y axes ----------
const gY = part('yaxis', L('ציר Y – 2 עמודים, מנועי NEMA23 ו-57PX 1:6', 'Y axis – 2 columns, NEMA23 + 57PX 1:6'), L('שני עמודי פרופיל עם מסילות ליניאריות ובורגי M12 שמונעים על ידי NEMA23 (23HS22) דרך תמסורת פלנטרית 57PX יחס 1:6 – מומנט מספיק להחזקת הקורה גם ללא זרם (עם בלם). חיישני קצה E47 בכל קצה.', 'Two profile columns with linear rails and M12 screws driven by NEMA23 (23HS22) through 57PX 1:6 planetary gearboxes – enough torque to hold the beam (with brake). E47 limit switches at each end.'), [0, 0, -1], [327, 1400, -195]);
for (const s of [-1, 1]) { const x = s * 290; prof(700, 'y', x, 1100, -250, gY); box(15, 680, 15, M.steel, x, 1100, -217.5, gY); { const B = []; for (let y = 790; y < 1440; y += 60) B.push([x, y, -210, 'z']); bolts(gY, B, .5); }
  const sx = s * 327; cyl(6, 550, M.ss, 'y', sx, 1035, -195, gY, 12); box(40, 26, 36, M.alu, sx, 763, -195, gY);
  box(80, 8, 70, M.alu, s * 310, 1444, -195, gY); // motor bracket
  const gb = cyl(28, 50, M.alu, 'y', sx, 1355, -195, gY, 24); cyl(20, 8, M.dark, 'y', sx, 1326, -195, gY); jawCoupling(gY, sx, 1316, -195, 9, 14);
  nema(gY, sx, 1408, -195, 'y', 56, 56, 'NEMA23', -1).rotation.y = Math.PI / 2 + (s > 0 ? Math.PI : 0);
  box(20, 20, 14, M.blue, x - s * 30, 790, -210, gY); box(20, 20, 14, M.blue, x - s * 30, 1360, -210, gY); // limit switches
}

// ---------- 7. gantry: X beam (moves in Y) and X carriage ----------
const gG = part('gantry', L('קורת X ועגלה – NEMA23', 'X beam & carriage – NEMA23'), L('קורת פרופיל אופקית עם מסילה ליניארית item 44334 ועגלה 44316, בורג M12 ומנוע NEMA23. העגלה הצהובה נושאת את שני ראשי המברשת; הקורה עולה ויורדת על צירי Y.', 'Horizontal profile beam with item 44334 linear rail and 44316 carriage, M12 screw and NEMA23 motor. The yellow carriage carries both brush heads; the beam travels up and down on the Y axes.'), [0, 0, 1], [0, 1330, -100]);
const beam = grp(gG, 0, C.PARK_YB, 0, 'beam'); A(beam, 'yaxis');
prof(620, 'x', 0, 0, -155, beam); box(620, 15, 15, M.steel, 0, 0, -122.5, beam); { const B = []; for (let x = -280; x < 300; x += 60) B.push([x, 0, -115, 'z']); bolts(beam, B, .5); }
for (const s of [-1, 1]) { box(34, 50, 30, M.steel, s * 290, 0, -195, beam); box(30, 30, 24, M.brass, s * 325, 0, -195, beam); box(12, 20, 20, M.steel, s * 309, 0, -195, beam); }
cyl(6, 384, M.ss, 'x', 6, 60, -155, beam, 12); box(24, 50, 40, M.alu, -192, 50, -155, beam); box(24, 50, 40, M.alu, 192, 50, -155, beam);
jawCoupling(beam, 214, 60, -155, 9, 20).rotation.z = Math.PI / 2; const xm = nema(beam, 260, 60, -155, 'x', 56, 56, 'NEMA23', -1); box(8, 60, 60, M.alu, 228, 60, -155, beam);
const car = grp(beam, C.PARK_X, 0, 0, 'xcar'); A(car, 'gantry');
box(60, 34, 25, M.steel, 0, 0, -102.5, car); box(150, 265, 10, M.yellow, 0, -47.5, -85, car).scale.x = 2; // yellow plate 300x265
box(50, 16, 50, M.brass, 0, 60, -155, car); box(50, 15, 75, M.yellow, 0, 75.5, -127.5, car); // nut + adapter
{ const B = []; for (const x of [-130, 130]) for (const y of [-160, 20]) B.push([x, y, -80, 'z']); B.push([-20, 0, -80, 'z'], [20, 0, -80, 'z']); bolts(car, B, .9, BOLTRED); }
plate(120, 30, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2c418'; c.font = `bold ${h * .5}px Arial`; c.fillText('BRAUDE DR3 · DEBURR', w * .04, h * .68); }, 0, 25, -79.4, car);
// disc brush head
const gDisc = new THREE.Group(); gDisc.userData.part = 'disc'; gDisc.position.set(-110, -150, 0); car.add(gDisc);
parts.disc = { id: 'disc', name: L('ראש מברשת דיסק (קצוות חיתוך)', 'Disc brush head (cutting edges)'), desc: L('מברשת דיסק Ø120 מסיבי ניילון-SiC (Ferrois), מונעת ע"י NEMA17/BLDC 20W. עוברת לאורך קצוות החיתוך במהירות היקפית 6-15 מ/ש. בלאי מקטין את הקוטר – הבקר מגדיל סל"ד כדי לשמור על מהירות היקפית קבועה.', 'Ø120 nylon-SiC filament disc brush (Ferrois), driven by a NEMA17/20 W BLDC. Sweeps along the cutting edges at 6–15 m/s tip speed. Wear shrinks the diameter – the controller raises rpm to keep a constant surface speed.'), g: gDisc, dir: new THREE.Vector3(-1, 0, .6), anchor: new THREE.Vector3(0, 0, 40), no: partOrder.length + 1 }; partOrder.push('disc');
nema(gDisc, 0, 0, -59, 'z', 42, 42, 'BLDC 20W', 1); jawCoupling(gDisc, 0, 0, -27, 10, 20).rotation.x = Math.PI / 2;
box(60, 60, 4, M.yellow, 0, 0, -82, gDisc); // motor flange plate on carriage
const discRot = grp(gDisc, 0, 0, 0, 'discRot'); A(discRot, 'gantry', 'disc', 'tool');
cyl(4, 30, M.ss, 'z', 0, 0, -18, discRot, 12); cyl(25, 25, M.hub, 'z', 0, 0, 0, discRot, 32); cyl(10, 27, M.steel, 'z', 0, 0, 0, discRot, 16);
const discBrG = new THREE.Group(); discRot.add(discBrG); const discBr = ring(25.5, 60, 22, M.bristle, 'z', 0, 0, 0, discBrG, 48); A(discBr, 'tool');
// vertical (cup) brush head
const gVert = new THREE.Group(); gVert.userData.part = 'vert'; gVert.position.set(110, 0, 0); car.add(gVert);
parts.vert = { id: 'vert', name: L('ראש מברשת אנכית (חריצים)', 'Vertical brush head (flutes)'), desc: L('מברשת כוס אנכית Ø120 שיורדת מלמעלה לתוך החריצים והקצה. רק מברשת אחת עובדת בכל רגע – המעבר ביניהן נעשה ע"י תנועת X בלבד, ללא כלי נוסף.', 'Ø120 vertical cup brush that comes down into the flutes and the tip. Only one brush works at a time – switching between them is done by an X move only.'), g: gVert, dir: new THREE.Vector3(1, .3, .6), anchor: new THREE.Vector3(0, 100, 0), no: partOrder.length + 1 }; partOrder.push('vert');
box(60, 10, 100, M.yellow, 0, 45, -30, gVert); box(60, 60, 10, M.yellow, 0, 15, -75, gVert); // L-arm
cyl(18, 25, M.alu, 'y', 0, 27.5, 0, gVert, 24); // bearing housing
nema(gVert, 0, 71, 0, 'y', 42, 42, 'BLDC 20W', -1);
const vertRot = grp(gVert, 0, 0, 0, 'vertRot'); A(vertRot, 'gantry', 'vert', 'tool');
cyl(6, 230, M.ss, 'y', 0, -75, 0, vertRot, 12); cyl(60, 10, M.hub, 'y', 0, -185, 0, vertRot, 40);
const vertBr = ring(14, 59, 15, M.bristle, 'y', 0, -197.5, 0, vertRot, 48); A(vertBr, 'tool');
// bristle bundles (instanced) for realism
function bristleBundles(parent, n, place) { const g = new THREE.CylinderGeometry(1.1, .9, 1, 5); g.translate(0, .5, 0); const im = new THREE.InstancedMesh(g, M.bristle, n); const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < n; i++) { const r = place(i, v, q, s); m4.compose(v, q, s); im.setMatrixAt(i, m4); } im.userData.inst = 1; im.castShadow = true; parent.add(im); return im; }
const discBundles = bristleBundles(discBrG, 420, (i, v, q, s) => { const a = i / 420 * TAU * 7 % TAU, z = ((i * 7919) % 100 / 100 - .5) * 20; v.set(Math.cos(a) * 26, Math.sin(a) * 26, z); q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(a + (Math.random() - .5) * .08), Math.sin(a), 0).normalize()); s.set(1, 34 + Math.random() * 1.5, 1); });
const vertBundles = bristleBundles(vertRot, 360, (i, v, q, s) => { const a = i * 2.39996, r = 16 + Math.sqrt((i + .5) / 360) * 42; v.set(Math.cos(a) * r, -190, Math.sin(a) * r); q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3((Math.random() - .5) * .06, -1, (Math.random() - .5) * .06).normalize()); s.set(1, 14 + Math.random() * 1.2, 1); });

// ---------- 8. inspection camera ----------
const gCam = part('camera', L('עמדת בדיקה: מצלמה וטבעת תאורה', 'Inspection: camera and ring light'), L('מצלמת מכונה (Machine Vision) עם טבעת LED מעל עמדת הבדיקה. מודדת את גובה הגרד לפני ואחרי – כלי עם גרד 10-20 מיקרון חוזר אוטומטית לעיבוד נוסף, מעל 20 נדחה לסל האדום. השיפור הזה מחליף בדיקה ידנית במיקרוסקופ.', 'Machine-vision camera with an LED ring light above the inspection station. Measures the burr height before and after – a tool with a 10–20 µm burr is automatically re-brushed, above 20 µm it is rejected to the red bin. Replaces manual microscope inspection.'), [0, 1, 0], [-250, 1400, 0]);
box(30, 30, 499, M.alu, -250, 1465, 0, gCam); cyl(6, 70, M.ss, 'y', -250, 1415, 0, gCam, 12); box(50, 70, 50, M.black, -250, 1345, 0, gCam); cyl(18, 25, M.dark, 'y', -250, 1297.5, 0, gCam, 24); cyl(14, 1, M.lens, 'y', -250, 1284.6, 0, gCam, 24);
ring(42, 60, 12, M.dark, 'y', -250, 1276, 0, gCam, 40); const ringLed = ring(44, 58, 1, M.led, 'y', -250, 1269.6, 0, gCam, 40); ringLed.userData.keep = 1;
for (const a of [0, 2.09, 4.19]) box(6, 40, 6, M.alu, -250 + Math.cos(a) * 51, 1300, Math.sin(a) * 51, gCam);
box(60, 6, 60, M.alu, -250, 1323, 0, gCam).scale.set(1.8, 1, 1.8);

// ---------- 9. dust extraction ----------
const gDust = part('dust', L('יניקת אבק ומסנן HEPA', 'Dust extraction and HEPA filter'), L('מנדף יניקה ליד אזור המגע שמושך את אבק ה-SiC והשבבים אל יחידת סינון עם מסנן HEPA ומד הפרש לחצים. מסנן סתום → התראה ו"אזהרה" במסך. שיפור: הפרויקט המקורי לא כלל טיפול באבק.', 'Suction hood next to the contact zone pulls SiC dust and chips to a filter unit with a HEPA filter and differential-pressure gauge. A clogged filter raises a warning. Improvement: the original project had no dust handling.'), [1, 0, .3], [520, 900, 165]);
{ const hg = new THREE.CylinderGeometry(22, 48, 70, 4, 1, true); hg.rotateY(Math.PI / 4); const h = add(new THREE.Mesh(hg, M.grey), gDust); h.position.set(115, 1000, 165); h.material = M.grey; }
const duct = tube([[115, 1030, 165], [115, 1250, 160], [140, 1395, 150], [300, 1400, 145], [470, 1400, 140], [540, 1340, 140], [540, 1100, 140], [540, 830, 140]], 28, M.grey, gDust, 60); A(duct, 'guard');
box(160, 800, 200, M.panel, 520, 400, 165, gDust); box(164, 30, 204, M.dark, 520, 790, 165, gDust); cyl(50, 60, M.motor, 'x', 630, 600, 165, gDust, 24); box(4, 300, 150, M.dark, 602, 350, 165, gDust);
box(40, 40, 6, M.plcLight, 520, 660, 268, gDust); cyl(14, 2, M.led, 'z', 520, 660, 271.5, gDust, 24);
plate(120, 40, (c, w, h) => { c.fillStyle = '#e9ecef'; c.fillRect(0, 0, w, h); c.fillStyle = '#123'; c.font = `bold ${h * .36}px Arial`; c.fillText('HEPA H13 · 300 m³/h', w * .05, h * .45); c.font = `${h * .24}px Arial`; c.fillText('ΔP 0-500 Pa', w * .05, h * .82); }, 520, 520, 265.6, gDust);

// ---------- 10. electrical cabinet (lower bay) ----------
const gCab = part('cabinet', L('לוח חשמל: PLC Omron CP2E, דרייברים וספק', 'Electrical bay: Omron CP2E PLC, drivers, PSU'), L('בקר Omron CP2E, 6 דרייברים למנועי הצעד (DM542), ספק 24V/48V, ממסר בטיחות (PL d), מגען, מפסק ראשי ומהדקים. תעלות חיווט. מסך HMI NB7W מחובר לבקר.', 'Omron CP2E PLC, 6 stepper drivers (DM542), 24 V/48 V PSU, safety relay (PL d), contactor, main switch and terminals in wiring ducts. The NB7W HMI is connected to the PLC.'), [0, -.3, 1], [0, 420, 200]);
box(600, 560, 4, M.panel, 0, 410, -268, gCab);
for (const y of [190, 400, 600]) box(560, 8, 10, M.ss, 0, y, -261, gCab); // DIN rails
for (const y of [150, 290, 500, 650]) box(580, 40, 40, M.grey, 0, y, -246, gCab); // wire ducts
const plc = box(130, 90, 70, M.plcLight, -200, 400, -231, gCab); box(130, 14, 72, M.dark, -200, 360, -231, gCab);
plate(120, 70, (c, w, h) => { c.fillStyle = '#e8e8e4'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a3d7a'; c.font = `bold ${h * .2}px Arial`; c.fillText('OMRON', w * .05, h * .22); c.fillStyle = '#222'; c.font = `${h * .14}px Arial`; c.fillText('SYSMAC CP2E-N30', w * .05, h * .4); for (let i = 0; i < 12; i++) { c.fillStyle = i % 3 ? '#2a2' : '#dd0'; c.fillRect(w * .06 + i * w * .07, h * .6, w * .04, h * .06); } }, -200, 400, -195.6, gCab);
for (let i = 0; i < 6; i++) { box(40, 110, 80, M.black, -60 + i * 50, 600, -226, gCab); box(30, 20, 4, M.green, -60 + i * 50, 640, -184, gCab); }
plate(290, 16, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `${h * .7}px Arial`; c.fillText('DM542  Z · X · Y1 · Y2 · DISC · VERT', 4, h * .78); }, 65, 560, -185.5, gCab);
box(120, 90, 90, M.alu, 180, 400, -221, gCab); for (let i = 0; i < 8; i++) box(2, 80, 92, M.dark, 130 + i * 14, 400, -221, gCab);
for (let i = 0; i < 8; i++) box(18, 70, 60, i < 2 ? M.yellow : M.plcLight, 20 + i * 20, 400, -236, gCab);
box(50, 80, 70, M.red, 280, 190, -231, gCab); box(46, 76, 60, M.grey, 230, 190, -236, gCab);
for (let i = 0; i < 26; i++) box(6, 40, 46, i % 5 === 4 ? M.blue : M.grey, -260 + i * 8, 190, -243, gCab);
// FRL unit on left outside
box(40, 60, 50, M.blue, -405, 520, 160, gCab); cyl(14, 50, M.glassC, 'y', -405, 460, 160, gCab, 20).userData.glass = 1; cyl(18, 16, M.black, 'y', -405, 560, 160, gCab); cyl(14, 10, M.plcLight, 'z', -405, 520, 190, gCab);
box(6, 120, 60, M.alu, -390, 520, 160, gCab);
tube([[-405, 580, 160], [-405, 640, 100], [-403, 662, -20], [-402, 676, -120], [-402, 712, -150]], 4, M.hose, gCab);
// main switch on the right side outside
box(70, 70, 40, M.plcLight, 422, 400, -150, gCab); box(4, 64, 64, M.yellow, 459, 400, -150, gCab); box(10, 50, 20, M.red, 466, 400, -150, gCab);
// cables from cabinet up to the axis motors (through grommets in the table)
for (const [x, z, c] of [[-150, -230, M.cable], [-130, -230, M.cableO], [200, -230, M.cable], [220, -230, M.cableO]]) { const t = tube([[x, 300, z], [x, 600, z], [x + 10, 700, z + 5]], 4, c, gCab); }

// ---------- 11. HMI + stack light ----------
const gHmi = part('hmi', L('מסך HMI ועמוד איתות', 'HMI and signal tower'), L('מסך מגע Omron NB7W לבחירת מתכון, מונים, SPC ותקלות. עמוד איתות: ירוק – רץ, כתום – אזהרה/עבודה חוזרת, אדום – עצירה/תקלה. לחצן עצירת חירום אדום-צהוב עם STO.', 'Omron NB7W touch screen for recipes, counters, SPC and faults. Signal tower: green – running, amber – warning/re-work, red – stop/fault. Red/yellow emergency-stop button with STO.'), [1, 0, 1], [470, 1180, 330]);
box(30, 24, 24, M.alu, 401, 1000, 320, gHmi); cyl(10, 100, M.alu, 'x', 466, 1000, 320, gHmi, 16); box(40, 40, 40, M.dark, 536, 1000, 320, gHmi); cyl(10, 120, M.alu, 'y', 536, 1080, 320, gHmi, 16);
const hmi = new THREE.Group(); hmi.position.set(536, 1200, 330); hmi.rotation.y = .7; gHmi.add(hmi);
box(220, 160, 40, M.plc, 0, 0, 0, hmi); const hmiScr = plate(196, 136, () => { }, 0, 0, 20.6, hmi, 0, 2, true);
box(48, 30, 34, M.yellow, 0, -110, 4, hmi); const estopBtn = cyl(16, 14, M.red, 'z', 0, -110, 28, hmi, 24); cyl(10, 4, M.dark, 'y', 0, -86, 0, hmi);
const tower = new THREE.Group(); tower.position.set(300, 1505, -240); gHmi.add(tower);
cyl(26, 12, M.black, 'y', 0, 6, 0, tower); cyl(8, 50, M.alu, 'y', 0, 37, 0, tower, 12);
const TL = []; for (const [i, col] of [[0, 0x18c040], [1, 0xffa000], [2, 0xff2020]]) { const m = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .1, roughness: .2, transparent: true, opacity: .9 }); const s = cyl(25, 30, m, 'y', 0, 77 + i * 31, 0, tower, 24); s.userData.keep = 1; s.userData.glass = 1; TL.push(s); }
cyl(25, 8, M.black, 'y', 0, 172, 0, tower);

// ---------- 12. robot (UR12e-like 6-axis cobot) ----------
const RB = { base: new THREE.Vector3(-760, 760, 330), L1: 600, L2: 560, SH: 180 };
const gRob = part('robot', L('רובוט שיתופי UR12e + גריפר', 'UR12e collaborative robot + gripper'), L('זרוע שיתופית 6 צירים (טווח 1300 מ"מ, 12 ק"ג). לוקחת כלי ממגש הקלט, טוענת לצ\'אק בעמדת הטעינה שמחוץ לתא, ופורקת כלי גמור למגש הפלט או לסל הפסולים. גריפר מקבילי עם לסתות מצופות פוליאוריתן ושני חיישני נוכחות.', '6-axis cobot (1300 mm reach, 12 kg). Picks a tool from the input tray, loads the chuck at the loading station outside the cell and unloads finished tools to the output tray or the reject bin. Parallel gripper with polyurethane-padded fingers and two presence sensors.'), [-1, 0, .5], [-760, 1700, 330]);
cyl(90, 740, M.dark, 'y', RB.base.x, 380, RB.base.z, gRob, 32); cyl(130, 14, M.dark, 'y', RB.base.x, 7, RB.base.z, gRob, 32); cyl(120, 20, M.alu, 'y', RB.base.x, 750, RB.base.z, gRob, 32);
{ const B = []; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; B.push([RB.base.x + Math.cos(a) * 105, 760, RB.base.z + Math.sin(a) * 105]); B.push([RB.base.x + Math.cos(a) * 115, 14, RB.base.z + Math.sin(a) * 115]); } bolts(gRob, B, .9); }
plate(120, 50, (c, w, h) => { c.fillStyle = '#2a2e34'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `bold ${h * .38}px Arial`; c.fillText('UR12e', w * .08, h * .5); c.font = `${h * .22}px Arial`; c.fillText('cobot · 12 kg · 1300 mm', w * .08, h * .82); }, RB.base.x, 500, RB.base.z + 90.6, gRob);
const R = {}; R.yaw = grp(gRob, RB.base.x, RB.base.y, RB.base.z, 'rbase'); A(R.yaw, 'robot');
cyl(78, 90, M.robot, 'y', 0, 45, 0, R.yaw, 40); cyl(80, 12, M.robotJ, 'y', 0, 96, 0, R.yaw, 40); cyl(62, 70, M.robot, 'y', 0, 137, 0, R.yaw, 32);
cyl(72, 170, M.robot, 'z', 0, RB.SH, 0, R.yaw, 40); cyl(74, 10, M.robotJ, 'z', 0, RB.SH, 82, R.yaw, 40);
R.up = grp(R.yaw, 0, RB.SH, 0, 'rup'); A(R.up, 'robot');
cyl(50, RB.L1 - 120, M.robot, 'x', RB.L1 / 2, 0, -110, R.up, 32); cyl(62, 80, M.robot, 'z', 0, 0, -120, R.up, 32); cyl(56, 60, M.robot, 'z', RB.L1, 0, -112, R.up, 32);
R.el = grp(R.up, RB.L1, 0, 0, 'rel'); A(R.el, 'robot');
cyl(58, 120, M.robot, 'z', 0, 0, -20, R.el, 32); cyl(60, 8, M.robotJ, 'z', 0, 0, 43, R.el, 32); cyl(40, RB.L2 - 110, M.robot, 'x', RB.L2 / 2 - 10, 0, -20, R.el, 28);
R.wr = grp(R.el, RB.L2, 0, 0, 'rwr'); A(R.wr, 'robot');
cyl(44, 100, M.robot, 'z', 0, 0, -20, R.wr, 28); cyl(46, 8, M.robotJ, 'z', 0, 0, 34, R.wr, 28); cyl(40, 64, M.robot, 'y', 0, -66, 0, R.wr, 28); cyl(41, 8, M.robotJ, 'y', 0, -96, 0, R.wr, 28);
// wrist-3 rotates about vertical → gripper
R.g = grp(R.wr, 0, -100, 0, 'rgrip'); A(R.g, 'robot', 'tool');
cyl(32, 10, M.alu, 'y', 0, -5, 0, R.g, 28); box(70, 65, 90, M.dark, 0, -42.5, 0, R.g); box(72, 10, 92, M.alu, 0, -15, 0, R.g);
plate(60, 20, (c, w, h) => { c.fillStyle = '#222'; c.fillRect(0, 0, w, h); c.fillStyle = '#4af'; c.font = `bold ${h * .6}px Arial`; c.fillText('2F-85 grip', 4, h * .75); }, 0, -45, 45.6, R.g);
box(16, 10, 10, M.blue, 30, -60, 46, R.g);
R.f = []; for (const s of [-1, 1]) { const f = grp(R.g, 0, -75, s * 20, 'finger'); A(f, 'robot', 'tool'); box(20, 110, 10, M.alu, 0, -55, s * 0, f); box(20, 30, 3, M.rubber, 0, -95, -s * 6.5, f); f.userData.s = s; R.f.push(f); }
tube([[-30, 0, -60], [-120, -30, -90], [-260, 10, -70]], 5, M.cable, R.wr).userData.allow = ['robot'];

// ---------- 13. trays + reject bin ----------
const TR = { IN: new THREE.Vector3(-1250, 800, 100), OUT: new THREE.Vector3(-1250, 800, 440), BIN: new THREE.Vector3(-560, 0, 600) };
const gTr = part('trays', L('מגשי קלט/פלט וסל פסולים', 'Input/output trays and reject bin'), L('מגשי POM עם 6 קדחים לכלים, על עגלות. מגש הקלט (כחול) – כלים לפני עיבוד, מגש הפלט (ירוק) – כלים תקינים, סל אדום – כלים שנדחו בבדיקה. ספירה מלאה בלוח הנתונים.', 'POM trays with 6 tool holes on trolleys. Input tray (blue) – tools before processing, output tray (green) – good tools, red bin – rejected tools. Full counts in the data tab.'), [-1, 0, 0], [-1250, 840, 270]);
function trayStand(c, col) { for (const dx of [-120, 120]) for (const dz of [-70, 70]) prof(740, 'y', c.x + dx, 380, c.z + dz, gTr, 30); box(270, 20, 170, M.alu, c.x, 750, c.z, gTr); for (const dx of [-120, 120]) for (const dz of [-70, 70]) { cyl(14, 10, M.rubber, 'y', c.x + dx, 5, c.z + dz, gTr); }
  box(250, 6, 150, M.alu, c.x, 160, c.z, gTr); box(260, 40, 160, col, c.x, 780, c.z, gTr); for (let i = 0; i < 6; i++) { const p = slotPos(c, i); cyl(17, 1, M.black, 'y', p.x, 800.6, p.z, gTr, 20); } }
function slotPos(c, i) { return new THREE.Vector3(c.x + ((i % 3) - 1) * 80, c.y, c.z + (i < 3 ? -40 : 40)); }
trayStand(TR.IN, sm({ color: 0x2a5fb0, roughness: .5 })); trayStand(TR.OUT, sm({ color: 0x2f9f5a, roughness: .5 }));
// reject bin
{ const b = TR.BIN; for (const [w, d, x, z] of [[220, 6, 0, -97], [220, 6, 0, 97], [6, 188, -107, 0], [6, 188, 107, 0]]) box(w, 600, d, M.red, b.x + x, 300, b.z + z, gTr); box(208, 6, 188, M.dark, b.x, 3, b.z, gTr);
  plate(140, 40, (c, w, h) => { c.fillStyle = '#c01818'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `bold ${h * .45}px Arial`; c.fillText(L('פסולים / NG', 'REJECT / NG'), w * .08, h * .65); }, b.x, 500, b.z + 100.6, gTr); }
plate(120, 30, (c, w, h) => { c.fillStyle = '#123'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `bold ${h * .5}px Arial`; c.fillText(L('קלט · IN', 'INPUT'), 8, h * .7); }, TR.IN.x, 780, TR.IN.z + 80.6, gTr);
plate(120, 30, (c, w, h) => { c.fillStyle = '#163'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `bold ${h * .5}px Arial`; c.fillText(L('פלט · OK', 'OUTPUT OK'), 8, h * .7); }, TR.OUT.x, 780, TR.OUT.z + 80.6, gTr);

// ---------- 14. drag chains (instanced, follow the axes) ----------
const gCh = part('chains', L('שרשראות כבלים וצנרת אוויר', 'Cable drag chains and air hoses'), L('שרשראות כבלים (igus E2) לכל ציר נע: שאטל, קורת Y ועגלת X. הכבלים לא נמתחים ולא נשחקים, ורדיוס הכיפוף קבוע. צנרת אוויר כחולה Ø6 לצ\'אק ולתריס.', 'igus E2 cable chains for every moving axis: shuttle, Y beam and X carriage. Cables are never stretched or rubbed and keep a fixed bend radius. Blue Ø6 air hoses to the chuck and the shutter.'), [0, .5, -1], [-150, 830, 95]);
const linkGeo = new RoundedBoxGeometry(14, 16, 1, 1, 2); // scaled per chain
function makeChain(parent, n, w, mat = M.black) { const im = new THREE.InstancedMesh(linkGeo, mat, n); im.userData.inst = 1; im.castShadow = true; im.frustumCulled = false; parent.add(im); return { im, n, w }; }
// lay chain: fixed end p0 (lower run) ... bend radius R ... moving end; 2D in plane (u along travel, v perpendicular) mapped by fn(u,v)->Vector3
function layChain(ch, u0, uM, Lc, R, map) { const ub = (Lc - Math.PI * R + u0 + uM) / 2; const seg = Lc / ch.n; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, ch.w), e = new THREE.Euler();
  for (let i = 0; i < ch.n; i++) { const d = (i + .5) * seg; let u, v, a; const l1 = ub - u0;
    if (d < l1) { u = u0 + d; v = 0; a = 0; } else if (d < l1 + Math.PI * R) { const t = (d - l1) / R; u = ub + Math.sin(t) * R; v = R - Math.cos(t) * R; a = t; } else { u = ub - (d - l1 - Math.PI * R); v = 2 * R; a = Math.PI; }
    const r = map(u, v, a, e); q.setFromEuler(e); m4.compose(r, q, s); ch.im.setMatrixAt(i, m4); } ch.im.instanceMatrix.needsUpdate = true; }
const chZ = makeChain(gCh, 40, 25), chX = makeChain(gCh, 24, 30), chY = makeChain(gCh, 44, 30);

// =====================================================================
//  TOOL (workpiece) – procedural drill / router / countersink with burr
// =====================================================================
const P = { type: 'drill', D: 12, rpm: 1600, feed: 20, passes: 2, inf: 0.8, crpm: 60, sim: 1, css: true, rework: true };
const TYPES = { drill: { he: 'מקדח', en: 'Drill', k: 1 }, router: { he: 'כרסום (פלטות קרביד)', en: 'Router (carbide inserts)', k: .85 }, csink: { he: 'מקדח שקיעה', en: 'Countersink', k: 1.15 } };
const Lf = () => Math.round(13 + (P.D - 6) * 1.5);
const tipL = () => P.type === 'router' ? 2 : P.type === 'csink' ? 3 : Math.max(3, Math.round(P.D / 2 * .6));
const toolLen = () => 100 + Lf() + tipL();
const toolMat = sm({ color: 0x9aa0a8, metalness: 1, roughness: .22, roughnessMap: brushed, env: 1.1 });
const carbMat = sm({ color: 0x4a4e57, metalness: .9, roughness: .3 });
const burrMat = sm({ color: 0xd8dde4, metalness: 1, roughness: .15, emissive: new THREE.Color(0x553311), emissiveIntensity: .25 });
function flutedGeo(r, len, pitch, depth = .32, nfl = 2, seg = 48, hs = 24) { const g = new THREE.CylinderGeometry(r, r, len, seg, hs, false); const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const rr = Math.hypot(v.x, v.z); if (rr < 1e-3) continue; const th = Math.atan2(v.z, v.x); const ph = th - (v.y + len / 2) / pitch * TAU; const c = Math.max(0, Math.cos(nfl * ph / 1)); const k = 1 - depth * Math.pow(Math.max(0, Math.cos(nfl * ph)), 2); p.setXYZ(i, v.x * k, v.y, v.z * k); }
  g.computeVertexNormals(); g.translate(0, len / 2, 0); return g; }
function buildTool(target, type = P.type, D = P.D, withBurr = true) { // returns {g, burr}
  const g = new THREE.Group(); const r = D / 2, lf = Lf(), tl = tipL();
  // shank 0..100 with chamfer at bottom
  const sh = new THREE.LatheGeometry([[0, 0], [r - .8, 0], [r, .8], [r, 100], [0, 100]].map(a => new THREE.Vector2(Math.max(.001, a[0]), a[1])), 40); add(new THREE.Mesh(sh, toolMat), g);
  if (type === 'drill') { const f = add(new THREE.Mesh(flutedGeo(r, lf, Math.max(30, D * 3.2)), toolMat), g); f.position.y = 100; const c = new THREE.ConeGeometry(r * .98, tl, 40, 1); c.translate(0, 100 + lf + tl / 2, 0); add(new THREE.Mesh(c, toolMat), g); }
  else if (type === 'router') { const core = add(new THREE.Mesh(flutedGeo(r * .78, lf, Math.max(60, D * 6), .2), toolMat), g); core.position.y = 100; for (const s of [0, Math.PI]) { const pl = box(r * .5, lf - 2, 2, carbMat, 0, 0, 0, g); pl.position.set(Math.cos(s) * r * .74, 100 + lf / 2, -Math.sin(s) * r * .74); pl.rotation.y = s; pl.position.add(new THREE.Vector3(Math.sin(s) * 1, 0, Math.cos(s) * 1)); }
    cyl(r * .78, tl, toolMat, 'y', 0, 100 + lf + tl / 2, 0, g, 32); }
  else { const neck = cyl(r * .55, lf - r * .9, toolMat, 'y', 0, 100 + (lf - r * .9) / 2, 0, g, 32); const cn = new THREE.CylinderGeometry(r * .25, r, r * .9, 40, 6); const p = cn.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const th = Math.atan2(v.z, v.x); const k = 1 - .18 * Math.pow(Math.max(0, Math.cos(3 * th)), 6); p.setXYZ(i, v.x * k, v.y, v.z * k); } cn.computeVertexNormals(); cn.translate(0, 100 + lf - r * .45, 0); add(new THREE.Mesh(cn, toolMat), g); cyl(r * .25, tl, toolMat, 'y', 0, 100 + lf + tl / 2, 0, g, 24); }
  // laser-marked size ring on shank
  cyl(r + .05, 6, sm({ color: 0x2a3a6a, metalness: .6, roughness: .3 }), 'y', 0, 75, 0, g, 40).userData.ring = 1;
  let burr = null; if (withBurr) { const n = 90; const bg = new THREE.TetrahedronGeometry(1, 0); burr = new THREE.InstancedMesh(bg, burrMat, n); burr.userData.inst = 1; burr.userData.pts = [];
    for (let i = 0; i < n; i++) { let x, y, z; const t = i / n; if (i < n * .6) { const k = t / .6; y = 100 + k * lf; const th = (y - 100) / Math.max(30, D * 3.2) * TAU + (i % 2) * Math.PI + .3; x = Math.cos(th) * r; z = Math.sin(th) * r; }
      else { const k = (t - .6) / .4; const th = (i % 2) * Math.PI + .3; const rr = r * (1 - k); x = Math.cos(th) * rr; z = Math.sin(th) * rr; y = 100 + lf + tl * k; if (type !== 'drill') y = 100 + lf + tl; }
      burr.userData.pts.push(new THREE.Vector3(x, y, z)); } g.add(burr); }
  if (target) target.add(g); return { g, burr }; }
function setBurr(b, frac) { if (!b) return; const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(); const n = b.userData.pts.length;
  for (let i = 0; i < n; i++) { const p = b.userData.pts[i]; const s = Math.max(.001, (.45 + .55 * ((i * 37) % 10) / 10) * 1.6 * Math.min(1.4, frac)); q.setFromEuler(new THREE.Euler(i, i * 2, i * 3)); m4.compose(p, q, new THREE.Vector3(s, s, s)); b.setMatrixAt(i, m4); }
  b.instanceMatrix.needsUpdate = true; b.visible = frac > .01; }
// the active tool (moves between tray, gripper, chuck)
const gTool = new THREE.Group(); gTool.userData.part = 'tool'; gTool.userData.body = 1; A(gTool, 'chuck', 'trays', 'stock'); scene.add(gTool);
parts.tool = { id: 'tool', name: L('הכלי (מקדח / כרסום / שקיעה)', 'The tool (drill / router / countersink)'), desc: L('כלי חיתוך מקרביד/HSS בקוטר 6-32 מ"מ. אחרי השחזה נשארים גרדים (burr) של 30-150 מיקרון על הקצוות; היעד ≤10 מיקרון ללא פגיעה ברדיוס הקצה. הנקודות הבהירות על הכלי הן הגרד – הן נעלמות בזמן ההברשה.', 'Carbide/HSS cutting tool Ø6–32 mm. After grinding, 30–150 µm burrs remain on the edges; the target is ≤10 µm without damaging the edge radius. The bright specks on the tool are the burr – they disappear while brushing.'), g: gTool, dir: new THREE.Vector3(0, 0, 0), anchor: new THREE.Vector3(0, 130, 0), no: partOrder.length + 1 }; partOrder.push('tool');
let TOOL = null; function rebuildActiveTool() { if (TOOL) { gTool.remove(TOOL.g); TOOL.g.traverse(o => o.geometry && o.geometry.dispose()); } TOOL = buildTool(gTool); setBurr(TOOL.burr, S ? S.burrFrac : 1); }
// tray stock (decorative copies sitting in tray holes)
const gStock = new THREE.Group(); gStock.userData.part = 'stock'; A(gStock, 'trays'); scene.add(gStock);
parts.stock = { id: 'stock', name: L('כלים במגשים', 'Tools in trays'), desc: L('כלים ממתינים במגש הקלט וכלים גמורים במגש הפלט.', 'Tools waiting in the input tray and finished tools in the output tray.'), g: gStock, dir: new THREE.Vector3(-1, 0, 0), anchor: new THREE.Vector3(-1050, 950, 270), no: partOrder.length + 1 }; partOrder.push('stock');
const stockIn = [], stockOut = [];
function rebuildStock() { while (gStock.children.length) { const c = gStock.children.pop(); c.traverse(o => o.geometry && o.geometry.dispose()); } stockIn.length = stockOut.length = 0;
  for (let i = 0; i < 6; i++) { const a = buildTool(gStock); a.g.position.copy(slotPos(TR.IN, i)).setY(760); a.g.userData.body = 1; setBurr(a.burr, 1); stockIn.push(a); const b = buildTool(gStock, P.type, P.D, false); b.g.position.copy(slotPos(TR.OUT, i)).setY(760); b.g.userData.body = 1; b.g.visible = false; stockOut.push(b); } }

// =====================================================================
//  MERGE (performance) + outlines
// =====================================================================
const S = { burrFrac: 1 };
rebuildActiveTool(); rebuildStock();
const edgeMat = new THREE.LineBasicMaterial({ color: 0x06080b, transparent: true, opacity: .45, depthWrite: false });
const NOMERGE = QS.has('nomerge');
const PERF = { merged: 0, meshesBefore: 0, drawAfter: 0 };
function partOf(o) { for (let q = o; q; q = q.parent) if (q.userData.part) return q.userData.part; return null; }
function walk(root, fn) { const rec = o => { fn(o); for (const c of o.children.slice()) if (!c.userData.part) rec(c); }; rec(root); }
const SKIPMERGE = new Set(['tool', 'stock', 'chains']);
{ const ecache = new Map(); const edgeOf = g => { let e = ecache.get(g.uuid); if (!e) { e = new THREE.EdgesGeometry(g, 32); ecache.set(g.uuid, e); } return e; };
  const mkey = m => [m.uuid].join('|');
  const canEdge = o => !(o.isInstancedMesh || o.userData.glass || o.geometry.type === 'TubeGeometry' || o.geometry.type === 'PlaneGeometry' || o.geometry.attributes.position.count > 20000 || o.material === M.bristle);
  const norm = (g, M4) => { let c = g.index ? g.toNonIndexed() : g.clone(); for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv'].includes(k)) c.deleteAttribute(k);
    if (!c.attributes.uv) c.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2)); if (!c.attributes.normal) c.computeVertexNormals(); c.morphAttributes = {}; c.clearGroups(); return c.applyMatrix4(M4); };
  const anchorOf = (o, root) => { for (let q = o.parent; q; q = q.parent) { if (q === root || q.userData.body) return q; } return root; };
  scene.updateMatrixWorld(true);
  for (const id of partOrder) { if (SKIPMERGE.has(id)) continue; const root = parts[id].g; const groups = new Map(), edges = new Map(), kill = [];
    walk(root, o => { if (!o.isMesh) return; PERF.meshesBefore++;
      const stat = !NOMERGE && !o.isInstancedMesh && !o.userData.keep && !Array.isArray(o.material) && o.material.isMeshStandardMaterial && !o.material.transparent && !o.userData.glass && !o.material.map?.isCanvasTexture && !o.material.emissiveMap;
      if (stat) { const A_ = anchorOf(o, root); const M4 = A_.matrixWorld.clone().invert().multiply(o.matrixWorld); const k = A_.uuid + mkey(o.material);
        if (!groups.has(k)) groups.set(k, { A: A_, m: o.material, g: [] }); groups.get(k).g.push(norm(o.geometry, M4));
        if (canEdge(o)) { if (!edges.has(A_)) edges.set(A_, []); edges.get(A_).push(edgeOf(o.geometry).clone().applyMatrix4(M4)); } kill.push(o); }
      else if (canEdge(o)) { const l = new THREE.LineSegments(edgeOf(o.geometry), edgeMat); l.raycast = () => { }; l.userData.edge = 1; o.add(l); } });
    for (const o of kill) o.parent.remove(o);
    for (const { A: A_, m, g } of groups.values()) { const mg = mergeGeometries(g, false); if (!mg) { console.warn('merge fail', id); continue; } const mm = add(new THREE.Mesh(mg, m), A_); mm.userData.merged = 1; PERF.merged++; }
    for (const [A_, es] of edges) { const l = new THREE.LineSegments(mergeGeometries(es, false), edgeMat); l.raycast = () => { }; l.userData.edge = 1; A_.add(l); } }
}
// per-part material clones (so X-ray/highlight/section work per part)
const ALLMATS = new Set();
for (const id of partOrder) walk(parts[id].g, o => { if ((o.isMesh) && !Array.isArray(o.material)) { o.material = o.material.clone(); ALLMATS.add(o.material); const u = o.userData; u.op = o.material.opacity; u.tr = o.material.transparent; u.dw = o.material.depthWrite; u.em = o.material.emissive ? o.material.emissive.clone() : null; u.ei = o.material.emissiveIntensity; } });
for (const id of partOrder) { parts[id].base = parts[id].g.position.clone(); }

// =====================================================================
//  SIMULATION STATE + process model
// =====================================================================
Object.assign(S, { run: false, estop: false, hold: false, t: 0, ph: '', shX: C.LOADX, shut: 1, jaw: 1, chA: 0, chRpm: 0, yb: C.PARK_YB, cx: C.PARK_X, dA: 0, vA: 0, dRpm: 0, vRpm: 0, Rb: 60, door: 0, fo: 12,
  q: { yaw: 0, t1: 1.6, t2: -2.2 }, G: new THREE.Vector3(-640, 1150, 160), toolAt: 'in', slot: 0, inLeft: 6, outN: 0, n: 0, good: 0, rej: 0, rew: 0, drop: 0, res: [], burr: 0, he: 0, hf: 0, h0: 0, re: 4, force: 0, forceMax: 0,
  contact: null, cyc0: 0, lastCyc: 0, cycs: [], dp: 120, alarm: '', warn: '', insp: 0, dropV: null, loadReady: false, toolIn: false, unloadReady: false, reworked: false, meas: null });
const F = { drop: false, wear: false, force: false, door: false, air: false, limit: false, missing: false, filter: false };
const FLIM = 0.765; // N – chuck slip limit from the student's clamping calculation
const tipV = (rb = S.Rb, rpm = rpmDisc()) => Math.PI * 2 * rb / 1000 * rpm / 60;
const rpmDisc = () => P.css ? Math.min(3600, P.rpm * 60 / S.Rb) : P.rpm;
const forceOf = inf => 0.42 * inf + 0.05;
const toolTopW = () => C.SH_Y + 90 + 39 + toolLen(); // world, tool in chuck (shuttle y offset 0)
const TOOL_BOT = C.CH_Y + 39;
function newBurr() { S.h0 = clamp(80 + gauss() * 20, 30, 150); S.he = S.h0; S.hf = S.h0 * (.7 + Math.random() * .3); S.re = 4 + Math.random() * 1.5; S.burr = Math.max(S.he, S.hf); S.burrFrac = 1; S.reworked = false; S.forceMax = 0; S.kT = Math.exp(gauss() * .22); }
function passEff(inf, phaseV) { const v = phaseV ?? tipV(); const wearK = 1 - Math.max(0, 60 - S.Rb) / 60; return clamp(Math.pow(v / 10, .8) * Math.pow(Math.max(.05, inf) / .8, .6) * Math.pow(20 / P.feed, .45) * TYPES[P.type].k * (.85 + .3 * wearK), 0, 4); }
function updBurrVis() { S.burr = Math.max(S.he, S.hf); S.burrFrac = clamp(S.burr / 80, 0, 1.4); setBurr(TOOL.burr, S.burrFrac); }

// ---------- robot kinematics ----------
function ik(G) { const W = G.clone(); W.y += 270; const dx = W.x - RB.base.x, dz = W.z - RB.base.z; const yaw = Math.atan2(-dz, dx); const r = Math.hypot(dx, dz), y = W.y - (RB.base.y + RB.SH);
  const d = Math.min(RB.L1 + RB.L2 - 1, Math.hypot(r, y)); const phi = Math.atan2(y, r); const al = Math.acos(clamp((RB.L1 ** 2 + d * d - RB.L2 ** 2) / (2 * RB.L1 * d), -1, 1)); const t1 = phi + al;
  const ex = Math.cos(t1) * RB.L1, ey = Math.sin(t1) * RB.L1; const tf = Math.atan2(y - ey, r - ex); return { yaw, t1, t2: tf - t1 }; }
function applyRobot() { const q = S.q; R.yaw.rotation.y = q.yaw; R.up.rotation.z = q.t1; R.el.rotation.z = q.t2; R.wr.rotation.z = -(q.t1 + q.t2); for (const f of R.f) f.position.z = f.userData.s * (P.D / 2 + 8 + S.fo); }
const angLerp = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return a + d * k; };

// ---------- generator helpers ----------
const ST_ = { m: null, r: null };
function* tween(d, fn) { let t = 0; fn(0); while (t < d) { const dt = yield; t += dt || 0; fn(clamp(t / d)); } }
function* until(c) { while (!c()) yield; }
function* wait(d) { let t = 0; while (t < d) { t += (yield) || 0; } }
function* rJ(G, d = 1.4) { const q0 = { ...S.q }, q1 = ik(G), G0 = S.G.clone(); yield* tween(d, k => { const e = ease(k); S.q.yaw = angLerp(q0.yaw, q1.yaw, e); S.q.t1 = lerp(q0.t1, q1.t1, e); S.q.t2 = lerp(q0.t2, q1.t2, e); S.G.lerpVectors(G0, G, e); }); }
function* rL(G, d = .7) { const G0 = S.G.clone(); yield* tween(d, k => { S.G.lerpVectors(G0, G, ease(k)); Object.assign(S.q, ik(S.G)); }); }
function* fingers(open, d = .3) { const a = S.fo, b = open ? 12 : 0; yield* tween(d, k => S.fo = lerp(a, b, ease(k))); }
function* jawsTo(open, d = .4) { const a = S.jaw, b = open ? 1 : 0; yield* tween(d, k => S.jaw = lerp(a, b, ease(k))); }
function* shuttleTo(x) { const a = S.shX, d = Math.abs(x - a) / 160 + .3; yield* tween(d, k => S.shX = lerp(a, x, ease(k))); }
function* shutterTo(open) { const a = S.shut, b = open ? 1 : 0; yield* tween(.6, k => S.shut = lerp(a, b, ease(k))); }
function* gantry(cx, yb, vmax = 140) { const a = S.cx, b = S.yb; const d = Math.max(Math.abs(cx - a), Math.abs(yb - b)) / vmax + .15; yield* tween(d, k => { const e = ease(k); S.cx = lerp(a, cx, e); S.yb = lerp(b, yb, e); }); }
function* spin(on, d = .6) { const a = S.dRpm; yield* tween(d, k => { S.chRpm = on ? P.crpm * k : P.crpm * (1 - k); }); }
function attachTool(where) { const wp = new THREE.Vector3(); TOOL.g.updateWorldMatrix(true, false);
  if (where === 'grip') { R.g.add(gTool); gTool.position.set(0, -240, 0); gTool.rotation.set(0, 0, 0); gTool.visible = true; }
  else if (where === 'chuck') { gChuck.add(gTool); gTool.position.set(0, 39, 0); gTool.rotation.set(0, 0, 0); }
  else { scene.add(gTool); gTool.rotation.set(0, 0, 0); }
  S.toolAt = where; }
// gripper: G is 30 mm above the jaw/tray top; tool bottom = G - 70 → in gripper frame (R.g at W-100 = G+170) bottom at -240
function gripPose() { gTool.position.set(0, -240, 0); }
const slotG = (c, i, up = 0) => slotPos(c, i).setY(830 + up);
const LOADG = (up = 0) => new THREE.Vector3(C.LOADX, C.JAW_T + 30 + up, 0);
const HOME = new THREE.Vector3(-640, 1150, 160);
function alarm(msg, level = 'err') { if (level === 'err') S.alarm = msg; else S.warn = msg; showAlarm(); }
function clearAlarm() { S.alarm = ''; showAlarm(); }

// ---------- robot program ----------
function* robotProg() {
  for (;;) {
    // 1. pick
    if (S.inLeft <= 0) { yield* wait(.8); refillIn(); }
    const i = S.slot; S.cyc0 = S.t;
    yield* rJ(slotG(TR.IN, i, 250), 1.5); yield* fingers(true, .2); yield* rL(slotG(TR.IN, i), .7);
    if (F.missing) { yield* fingers(false, .3); alarm(L('⚠ חיישן גריפר: אין כלי בקדח ' + (i + 1) + ' – מדלג לקדח הבא', '⚠ Gripper sensor: no tool in slot ' + (i + 1) + ' – skipping to next slot'), 'warn'); yield* fingers(true, .2); yield* rL(slotG(TR.IN, i, 250), .7); S.slot = (S.slot + 1) % 6; S.inLeft--; stockIn[i].g.visible = false; continue; }
    stockIn[i].g.visible = false; rebuildActiveTool(); newBurr(); updBurrVis(); attachTool('grip'); gripPose();
    yield* fingers(false, .3); S.slot = (S.slot + 1) % 6; S.inLeft--;
    yield* rL(slotG(TR.IN, i, 250), .7);
    // 2. transfer → load station
    yield* until(() => S.loadReady);
    let dropped = false; const q0 = { ...S.q }, q1 = ik(LOADG(160)), G0 = S.G.clone();
    yield* tween(1.6, k => { const e = ease(k); S.q.yaw = angLerp(q0.yaw, q1.yaw, e); S.q.t1 = lerp(q0.t1, q1.t1, e); S.q.t2 = lerp(q0.t2, q1.t2, e); S.G.lerpVectors(G0, LOADG(160), e);
      if (F.drop && k > .3 && !dropped) { dropped = true; } });
    if (dropped) { const wp = new THREE.Vector3(); gTool.getWorldPosition(wp); attachTool('floor'); gTool.position.copy(wp); S.dropV = new THREE.Vector3(0, 0, 0); S.drop++; alarm(L('⛔ כלי נפל מהגריפר! חיישן הנוכחות זיהה – הרובוט נעצר. אסוף את הכלי ונקה את התקלה', '⛔ Tool dropped from the gripper! The presence sensor detected it – robot stopped. Collect the tool and clear the fault'));
      yield* until(() => !F.drop); clearAlarm(); gTool.visible = false; S.dropV = null; addResult('drop'); yield* rJ(HOME, 1.2); continue; }
    yield* rL(LOADG(0), .7); attachTool('chuck'); yield* jawsTo(false, .4); yield* fingers(true, .3); S.toolIn = true; S.loadReady = false;
    yield* rL(LOADG(160), .6); S.robotClear = true; yield* rJ(HOME, 1.3);
    // 3. wait for the finished tool
    yield* until(() => S.unloadReady);
    yield* rJ(LOADG(160), 1.4); S.robotClear = false; yield* rL(LOADG(0), .7); yield* fingers(false, .3); yield* jawsTo(true, .4); attachTool('grip'); gripPose(); S.toolIn = false; S.unloadReady = false;
    yield* rL(LOADG(160), .6); S.robotClear = true;
    // 4. sort: OK → output tray, NG → reject bin
    const res = S.res[S.res.length - 1]; const ok = res && res.st === 'ok';
    if (ok) { const j = S.outN % 6; if (S.outN && j === 0) stockOut.forEach(b => b.g.visible = false); yield* rJ(slotG(TR.OUT, j, 250), 1.6); yield* rL(slotG(TR.OUT, j), .7); yield* fingers(true, .3); stockOut[j].g.visible = true; attachTool('none'); gTool.visible = false; S.outN++; yield* rL(slotG(TR.OUT, j, 250), .6); }
    else { yield* rJ(new THREE.Vector3(-1150, 1100, 330), 1.2); yield* rJ(new THREE.Vector3(TR.BIN.x, 1000, TR.BIN.z), 1.2); yield* fingers(true, .3); const wp = new THREE.Vector3(); gTool.getWorldPosition(wp); attachTool('bin'); gTool.position.copy(wp); S.dropV = new THREE.Vector3(0, 0, 0); S.binFall = true; yield* wait(.5); gTool.visible = false; S.binFall = false; }
    S.lastCyc = S.t - S.cyc0; S.cycs.push(S.lastCyc);
  }
}
function refillIn() { S.inLeft = 6; S.slot = 0; stockIn.forEach(a => a.g.visible = true); toast(L('המפעיל מילא מגש קלט חדש (6 כלים)', 'Operator refilled the input tray (6 tools)')); }

// ---------- machine program ----------
function discCx() { return -(P.D / 2 + S.Rb) + effInf() + 110; }
function effInf() { return P.inf + (F.force ? 1.6 : 0) - S.infCorr; }
S.infCorr = 0;
function* safeRetract() { const yb = toolTopW() + C.VB_BOT + 25; yield* gantry(Math.min(S.cx, discCx() - 30), S.yb, 200); yield* gantry(S.cx, Math.max(S.yb, yb), 200); }
function* machineProg() {
  for (;;) {
    // at the loading station
    yield* shutterTo(true); yield* shuttleTo(C.LOADX); if (S.jaw < 1) yield* jawsTo(true);
    S.loadReady = true; yield* until(() => S.toolIn && S.robotClear);
    // presence check + inspection (before)
    yield* shuttleTo(C.INSPX); S.insp = 1; yield* wait(.6); S.meas = { pre: S.burr + gauss() * 1.5 }; S.insp = 0;
    let pass = 0;
    for (;;) {
      yield* shuttleTo(C.WORKX); yield* shutterTo(false);
      yield* brushCycle(pass > 0);
      yield* shutterTo(true); yield* shuttleTo(C.INSPX); S.insp = 1; yield* wait(.9); S.insp = 0;
      const m = Math.max(0, S.burr + gauss() * .8); S.meas.post = m; const edgeBad = S.re > 25;
      if (m > 10 && m <= 20 && P.rework && !S.reworked && !edgeBad) { S.reworked = true; S.rew++; pass++; toast(L('גרד ' + m.toFixed(1) + ' µm – חזרה אוטומטית להברשה נוספת', 'Burr ' + m.toFixed(1) + ' µm – automatic re-brush')); continue; }
      addResult(m <= 10 && !edgeBad ? 'ok' : 'ng', m, edgeBad); break;
    }
    yield* shuttleTo(C.LOADX); S.unloadReady = true; S.robotClear = false; yield* until(() => !S.toolIn && S.robotClear);
  }
}
function* brushCycle(re) {
  const np = re ? 1 : P.passes; const tt = toolTopW(); const y0 = TOOL_BOT + 100 + 4, y1 = TOOL_BOT + 100 + Lf() + tipL() - 3;
  S.ph = 'spin'; yield* tween(.6, k => { S.chRpm = P.crpm * k; S.dRpm = rpmDisc() * k; });
  // approach: x at park height, then down to the first flute position
  S.ph = 'disc'; yield* gantry(discCx(), S.yb); yield* gantry(discCx(), y0 + 150);
  for (let p = 0; p < np; p++) { const a = p % 2 ? y1 : y0, b = p % 2 ? y0 : y1; const d = (y1 - y0) / P.feed;
    const he0 = S.he; yield* tween(d, k => { S.yb = lerp(a, b, k) + 150; S.cx = discCx(); S.contact = 'disc'; contactForce(); S.he = he0 * Math.exp(-1.25 * passEff(effInf()) * S.kT * k); updBurrVis(); }); wearStep();
    S.re += .6 * S.force / .5; if (F.air) { yield* airLoss(); } }
  S.contact = null; S.force = 0;
  // transition to the vertical brush (only one brush in contact at a time)
  S.ph = 'switch'; yield* gantry(S.cx - 30, S.yb, 200); yield* tween(.4, k => S.dRpm = rpmDisc() * (1 - k)); yield* gantry(S.cx, tt + C.VB_BOT + 25, 200);
  yield* tween(.3, k => S.vRpm = P.rpm * k); yield* gantry(-80, S.yb, 200);
  S.ph = 'vert'; const yv = tt - effInf() + C.VB_BOT; yield* gantry(-80, yv, 60);
  for (let p = 0; p < np; p++) { const d = Math.max(.8, 60 / P.feed); const hf0 = S.hf; yield* tween(d, k => { S.cx = -80 + Math.sin(k * TAU) * 15; S.yb = tt - effInf() + C.VB_BOT; S.contact = 'vert'; contactForce(); S.hf = hf0 * Math.exp(-1.3 * passEff(effInf(), Math.PI * .118 * P.rpm / 60) * S.kT * k); S.he *= 1 - .002; updBurrVis(); });
    S.re += .4 * S.force / .5; if (F.air) { yield* airLoss(); } }
  S.contact = null; S.force = 0; S.ph = 'park';
  yield* gantry(S.cx, tt + C.VB_BOT + 25, 120); yield* tween(.4, k => { S.vRpm = P.rpm * (1 - k); S.chRpm = P.crpm * (1 - k); });
  if (F.limit) { yield* gantry(C.PARK_X + 24, C.PARK_YB, 140); alarm(L('⛔ חריגת גבול ציר X – מפסק קצה E47 הופעל, הצירים נעצרו. נקה את התקלה לחזרה לבית', '⛔ X-axis overtravel – E47 limit switch tripped, axes stopped. Clear the fault to re-home')); yield* until(() => !F.limit); clearAlarm(); }
  yield* gantry(C.PARK_X, C.PARK_YB, 160); S.ph = '';
}
function contactForce() { const inf = effInf(); let f = forceOf(inf); if (f > FLIM) { S.infCorr = Math.min(P.inf + 1.6 - .4, S.infCorr + .08); if (!S.ofT || S.t - S.ofT > 3) { S.ofT = S.t; alarm(L('⚠ כוח מגע ' + f.toFixed(2) + 'N > גבול ' + FLIM + 'N (גלישה בצ\'אק). זרם המנוע זוהה – החדירה הוקטנה אוטומטית', '⚠ Contact force ' + f.toFixed(2) + ' N > ' + FLIM + ' N limit (chuck slip). Detected from motor current – infeed reduced automatically'), 'warn'); } }
  else if (!F.force) S.infCorr = Math.max(0, S.infCorr - .02); S.force = forceOf(effInf()); S.forceMax = Math.max(S.forceMax, f); }
function wearStep() { S.Rb = Math.max(42, S.Rb - (F.wear ? 1.5 : .02)); if (S.Rb < 50 && !S.wearWarned) { S.wearWarned = true; alarm(L('⚠ בלאי מברשת: Ø' + (S.Rb * 2).toFixed(0) + ' – מהירות היקפית נשמרת ע"י הגדלת סל"ד, יש להחליף מברשת בהקדם', '⚠ Brush wear: Ø' + (S.Rb * 2).toFixed(0) + ' – surface speed held by raising rpm, replace the brush soon'), 'warn'); } }
function* airLoss() { alarm(L('⛔ איבוד לחץ אוויר בצ\'אק! מתג הלחץ זיהה – המברשות הורחקו והסיבוב נעצר', '⛔ Chuck air-pressure loss! Pressure switch tripped – brushes retracted and rotation stopped')); S.contact = null; const cx = S.cx, yb = S.yb; yield* safeRetract(); S.chRpm = 0; S.dRpm = 0; S.vRpm = 0; yield* until(() => !F.air); clearAlarm(); yield* tween(.6, k => { S.chRpm = P.crpm * k; }); }
function addResult(st, m, edgeBad) { S.n++; if (st === 'ok') S.good++; else S.rej++; const r = { i: S.n, t: new Date().toISOString().slice(11, 19), type: P.type, D: P.D, rpm: Math.round(rpmDisc()), v: +tipV().toFixed(2), feed: P.feed, passes: P.passes, inf: P.inf, h0: +(S.h0 || 0).toFixed(1), pre: +(S.meas?.pre ?? 0).toFixed(1), post: m == null ? null : +m.toFixed(1), re: +S.re.toFixed(1), F: +S.forceMax.toFixed(2), rework: S.reworked ? 1 : 0, st, why: st === 'drop' ? 'drop' : edgeBad ? 'edge' : (m > 10 ? 'burr' : '') , cyc: +(S.t - S.cyc0).toFixed(1) }; S.res.push(r); if (S.res.length > 2000) S.res.shift(); updData(); }
Object.assign(S.q, ik(HOME)); S.G.copy(HOME);
ST_.m = machineProg(); ST_.r = robotProg(); ST_.m.next(); ST_.r.next();
function step(dt) {
  if (S.estop || S.alarmHold()) return; S.t += dt;
  ST_.m.next(dt); ST_.r.next(dt);
  S.chA += S.chRpm / 60 * TAU * dt; S.dA += S.dRpm / 60 * TAU * dt; S.vA += S.vRpm / 60 * TAU * dt;
  S.dp = clamp(S.dp + (F.filter ? 60 : -40) * dt, 120, 480);
}
S.alarmHold = () => F.door;

// =====================================================================
// 7. visuals, views, UI, data, loop, debug
// =====================================================================
gTool.visible = false; rebuildActiveTool(); rebuildStock(); Object.assign(S.q, ik(HOME)); S.G.copy(HOME);
const BOM = [[1, "10001", "Machine Plate", "CM", 1, "SS304", "CNC Supplier Yurini", "N/A", ""], [2, "10002", "Machine MASTER- Chuck Rail", "CM", 2, "PTFE", "CNC Supplier Yurini", "N/A", "JAB-40 + SMC ISE20 pressure switch (air-loss detection)"], [3, "10003", "Rail Holder 1", "CM", 1, "SS304", "CNC Supplier Yurini", "N/A", ""], [4, "10004", "Rail slider Holder", "CM", 1, "SS304", "CNC Supplier Yurini", "N/A", ""], [5, "10005", "BF12 End Support Bearing", "OTS", 2, "Datasheet", "Zytech", "HW-BK-END12", ""], [6, "10006", "Chuck", "OTS", 1, "Datasheet", "lingman", "JAB-40", "JAB-40 + SMC ISE20 pressure switch (air-loss detection)"], [7, "10007", "Machine MASTER- Chuck Holder Plate", "CM", 1, "SS304", "CNC Supplier Yurini", "N/A", "JAB-40 + SMC ISE20 pressure switch (air-loss detection)"], [8, "10008", "Machine MASTER- Motor Holder", "CM", 2, "SS304", "CNC Supplier Yurini", "N/A", ""], [9, "10009", "Main MotorPCE PCE 220M4 142.5", "OTS", 1, "Datasheet", "Minimotor.com", "220M4", "PCE 220M4 + VFD, or NEMA23 closed-loop for 20–140 rpm"], [10, "10010", "Motor Nema17 40x42x5mm", "OTS", 3, "Datasheet", "Shneider", "M-1713-1.5", "M-1713-1.5 + DM542 driver"], [11, "10011", "Rod Screw M12 x 300mm", "CM", 2, "SS304", "CNC Supplier Yurini", "N/A", "ISO 4762 A2-70"], [12, "10012", "Rod Screw M12 x 900mm", "CM", 1, "SS304", "CNC Supplier Yurini", "N/A", "ISO 4762 A2-70"], [13, "10013", "Stepper Motor Nema 23", "OTS", 2, "Datasheet", "Stepperonline", "23HS22- 1504S", "23HS22-1504S + DM542; Y: + 57PX 1:6 + brake"], [14, "10014", "profile 10-50x50x1500", "CM", 4, "Aluminum, anodized", "ITEM", "0.0.624.52", ""], [15, "10015", "profile 10-50x50x500", "CM", 12, "Aluminum, anodized", "ITEM", "0.0.624.52", ""], [16, "10016", "profile 10-50x50x507", "CM", 4, "Aluminum, anodized", "ITEM", "0.0.624.52", ""], [17, "10017", "Planetary gear 57PX-6 1to6", "OTS", 2, "Datasheet", "ANODAS", "MX-IW-57PX-6", ""], [18, "10018", "Coupler 14-10", "OTS", 2, "Datasheet", "Orientalmotor", "MCL401014", "Jaw coupling MJC-25 (14–10)"], [19, "10019", "Rod Screw M12 x 320mm", "CM", 1, "SS304", "CNC Supplier Yurini", "N/A", "ISO 4762 A2-70"], [20, "10020", "Stabilizer Holder1", "CM", 2, "SS304", "CNC Supplier Yurini", "N/A", ""], [21, "10021", "linear Guide Rail 44334 ITEM", "CM", 1, "St, Cf 53", "ITEM", "N/A", ""], [22, "10022", "Screw rod holder2", "CM", 2, "SS304", "CNC Supplier Yurini", "N/A", ""], [23, "10023", "Rod M12 x 770mm", "OTS", 1, "SS304", "CNC Supplier Yurini", "N/A", "TR12×3 lead screw + POM anti-backlash nut"], [24, "10024", "Bearing D14-10", "OTS", 3, "SS", "Barmil", "TBD", "SKF 6000-2RS / BK12+BF12 pair"], [25, "10025", "Brush Chuck", "OTS", 2, "TBD", "TBD", "TBD", "ER16 collet chuck (Rego-Fix) – tool-less brush change"], [26, "10026", "Slider Motors Adapter 2", "CM", 1, "SS304", "CNC Supplier Yurini", "N/A", ""], [27, "10027", "Rail - Rod Screw Adapter", "CM", 1, "SS304", "CNC Supplier Yurini", "N/A", "Trapezoidal TR12×3 (self-locking) instead of M12 thread"], [28, "10028", "Screw M10x16", "OTS", 36, "SS", "Barmil", "TBD", "ISO 4762 A2-70"], [29, "10029", "Screw M7x10", "OTS", 8, "SS", "Barmil", "TBD", "ISO 4762 A2-70"], [30, "10030", "M3 Pin", "CM", 2, "SS304", "CNC Supplier Yurini", "N/A", ""], [31, "10031", "Screw M2.5x1", "OTS", 4, "SS", "Barmil", "TBD", "ISO 4762 A2-70"], [32, "10032", "Screw M2.5x14", "OTS", 20, "SS", "Barmil", "TBD", "ISO 4762 A2-70"], [33, "10033", "Screw M5x0.5x13", "OTS", 16, "SS", "Barmil", "TBD", "ISO 4762 A2-70"], [34, "10034", "T-Slot Nut St M10", "OTS", 26, "Datasheet", "ITEM", "0.0.625.02", ""], [35, "10035", "Angle Bracket 62523 ITEM", "OTS", 32, "Datasheet", "ITEM", "0.0.625.23", ""], [36, "10036", "carriage 44316 ITEM", "OTS", 1, "Datasheet", "ITEM", "0.0.443.16", ""], [37, "10037", "Botoom Window", "CM", 1, "PMMA + Aluminum", "Yeruham Outomation", "N/A", ""], [38, "10038", "Rear Window", "CM", 2, "Aluminum", "Yeruham Outomation", "N/A", ""], [39, "10039", "TopWindow", "CM", 1, "PMMA + Aluminum", "Yeruham Outomation", "N/A", ""], [40, "10040", "Window Handle", "OTS", 1, "Aluminum", "TBD", "TBD", "Elesa M.443 or item 0.0.437.25 handle"], [41, "10041", "Angle 63045 ITEM", "OTS", 2, "Aluminum", "TBD", "0.0.630.45", ""], [42, "10042", "Side Door", "CM", 2, "Aluminum", "Yeruham Outomation", "N/A", ""], [43, "10043", "Screw M6x0.5x16", "OTS", 8, "SS", "Barmil", "TBD", "ISO 4762 A2-70"], [44, "10044", "Nut M5", "OTS", 2, "SS", "Barmil", "TBD", ""], [45, "10045", "T-Slot Nut St M5", "OTS", 2, "SS", "ITEM", "0.0.437.19", ""], [46, "10046", "Roof", "CM", 1, "Aluminum", "Yeruham Outomation", "N/A", ""], [47, "10047", "Controller", "OTS", 1, "TBD", "TBD", "TBD", "Omron CP2E-N30DT-D + NB7W-TW01B HMI + G9SE safety relay"], [48, "10048", "Forklift Part", "OTS", 4, "Aluminum", "ITEM", "0.0.683.95", ""], [49, "10049", "Levelling Foot 0043929 ITEM", "OTS", 4, "Datasheet", "ITEM", "0.0.439.29", ""], [50, "10050", "Limit switch E47", "OTS", 8, "TBD", "ca.rs-online", "E47BMS42", "Omron D4N-4120 + PLC soft limits"], [51, "10051", "Brush Motor Series DB42", "OTS", 2, "Datasheet", "BeUDMKE", "DB42-12-20-30S", "24 V BLDC 42BLS02 26 W + driver with rpm feedback (CSS)"]];
// ---------- small UI helpers ----------
let toastT = 0; function toast(msg) { const t = $('toast'); t.textContent = msg; t.style.display = 'block'; t.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => { t.style.display = 'none'; }, 3200); }
function showAlarm() { const a = $('alarm'); const m = S.alarm || S.warn; a.textContent = m || ''; a.className = S.alarm ? 'on err' : S.warn ? 'on warn' : ''; a.style.display = m ? 'block' : 'none'; if (S.warn && !S.alarm) { clearTimeout(showAlarm.t); showAlarm.t = setTimeout(() => { S.warn = ''; showAlarm(); }, 6000); } wake(); }
$('alarm').onclick = () => { S.warn = ''; showAlarm(); };
const fmt = (v, d = 1) => (v == null || isNaN(v)) ? '–' : (+v).toFixed(d);

// ---------- particles: sparks + dust ----------
function mkPts(n, col, size, blend) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3).fill(-1e5), 3)); const m = new THREE.PointsMaterial({ color: col, size, sizeAttenuation: true, transparent: true, opacity: .9, depthWrite: false, blending: blend }); const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); return { p, n, pos: g.attributes.position, v: new Float32Array(n * 3), life: new Float32Array(n), i: 0 }; }
const SPK = mkPts(IS_MOBILE ? 160 : 360, 0xffb050, 2.6, THREE.AdditiveBlending), DST = mkPts(IS_MOBILE ? 140 : 300, 0x8f8a80, 3.2, THREE.NormalBlending); DST.p.material.opacity = .45;
function emit(P_, x, y, z, vx, vy, vz, life) { const i = P_.i = (P_.i + 1) % P_.n; P_.pos.setXYZ(i, x, y, z); P_.v[i * 3] = vx; P_.v[i * 3 + 1] = vy; P_.v[i * 3 + 2] = vz; P_.life[i] = life; }
const HOOD = new THREE.Vector3(115, 1000, 165);
function particles(dt, sdt) {
  if (S.contact && sdt > 0 && S.run) { const rt = P.D / 2, n = Math.min(6, Math.ceil(sdt * 260)), tt = toolTopW();
    for (let k = 0; k < n; k++) { if (S.contact === 'disc') { const y = S.yb - 150 + (Math.random() - .5) * 18, x = S.shX - rt + 1; const sp = 600 + Math.random() * 900; emit(SPK, x, y, (Math.random() - .5) * 18, 300 + Math.random() * 400, (Math.random() < .5 ? -1 : 1) * sp * .3 - sp * .7, (Math.random() - .5) * 700, .25 + Math.random() * .3); }
      else { const a = Math.random() * TAU; emit(SPK, S.shX + Math.cos(a) * rt, tt, Math.sin(a) * rt, -Math.sin(a) * 900, 200 + Math.random() * 300, Math.cos(a) * 900, .2 + Math.random() * .25); }
      if (Math.random() < .6) emit(DST, S.shX + (Math.random() - .5) * 30, (S.contact === 'disc' ? S.yb - 150 : tt) + (Math.random() - .5) * 20, (Math.random() - .5) * 30, (Math.random() - .5) * 120, 40 + Math.random() * 60, (Math.random() - .5) * 120, 2 + Math.random() * 1.5); } }
  const ok = !F.filter; const hv = new THREE.Vector3();
  for (const [P_, g, drag] of [[SPK, -2600, 1.5], [DST, -15, .6]]) { let any = false; for (let i = 0; i < P_.n; i++) { if (P_.life[i] <= 0) continue; any = true; P_.life[i] -= dt; const j = i * 3; let x = P_.pos.getX(i), y = P_.pos.getY(i), z = P_.pos.getZ(i);
      if (P_ === DST) { hv.set(HOOD.x - x, HOOD.y - y, HOOD.z - z); const d = hv.length(); if (ok && d < 500) { hv.multiplyScalar(260 / Math.max(d, 30)); P_.v[j] += (hv.x - P_.v[j]) * dt * 2; P_.v[j + 1] += (hv.y - P_.v[j + 1]) * dt * 2; P_.v[j + 2] += (hv.z - P_.v[j + 2]) * dt * 2; if (d < 30) P_.life[i] = 0; } }
      P_.v[j + 1] += g * dt; const k = Math.exp(-drag * dt); P_.v[j] *= k; P_.v[j + 1] *= k; P_.v[j + 2] *= k; x += P_.v[j] * dt; y += P_.v[j + 1] * dt; z += P_.v[j + 2] * dt; if (y < 752 && Math.abs(x) < 330 && Math.abs(z) < 275) { y = 752; P_.v[j + 1] *= -.3; } if (P_.life[i] <= 0) y = -1e5; P_.pos.setXYZ(i, x, y, z); }
    P_.pos.needsUpdate = true; P_.p.visible = any; }
}

// ---------- HMI screen ----------
const hmiCtx = (() => { const t = hmiScr.material.map || hmiScr.material.emissiveMap; return t ? { t, c: t.image } : null; })();
function drawHMI() { if (!hmiCtx) return; const c = hmiCtx.c, x = c.getContext('2d'), w = c.width, h = c.height;
  x.fillStyle = '#0b1622'; x.fillRect(0, 0, w, h); x.fillStyle = S.alarm ? '#c0282a' : S.warn ? '#b07a00' : '#1d6b3a'; x.fillRect(0, 0, w, h * .16);
  x.fillStyle = '#fff'; x.font = `bold ${h * .1}px Arial`; x.fillText(S.alarm ? 'ALARM' : S.estop ? 'E-STOP' : S.run ? 'AUTO RUN' : 'READY', w * .04, h * .12);
  x.font = `${h * .085}px Arial`; const L_ = [['TOOL', TYPES[P.type].en + ' Ø' + P.D], ['PCS', S.n + '  OK ' + S.good + '  NG ' + S.rej], ['BURR', fmt(S.burr) + ' µm'], ['RPM', Math.round(rpmDisc()) + '  v=' + fmt(tipV(), 1) + ' m/s'], ['FORCE', fmt(S.force, 2) + ' / ' + FLIM + ' N'], ['ΔP', Math.round(S.dp) + ' Pa']];
  L_.forEach(([a, b], i) => { x.fillStyle = '#7fb2d6'; x.fillText(a, w * .04, h * (.3 + i * .12)); x.fillStyle = '#e8f1f8'; x.fillText(b, w * .3, h * (.3 + i * .12)); });
  x.fillStyle = '#28425a'; x.fillRect(w * .04, h * .93, w * .92, h * .04); x.fillStyle = '#3fd07a'; x.fillRect(w * .04, h * .93, w * .92 * clamp(1 - S.burrFrac), h * .04); hmiCtx.t.needsUpdate = true; }

// ---------- apply state to the 3D scene ----------
const tmpV = new THREE.Vector3(); let hmiT = 0, blink = 0;
function visuals(dt, sdt) {
  S.door = lerp(S.door, F.door ? 1 : 0, 1 - Math.exp(-dt * 4));
  gSh.position.x = S.shX; shutter.position.y = S.shut * 330;
  jaws.forEach(j => j.position.x = P.D / 2 + 8 * S.jaw); gChuck.rotation.y = S.chA;
  beam.position.y = S.yb; car.position.x = S.cx; discRot.rotation.z = -S.dA; vertRot.rotation.y = S.vA; discBrG.scale.set(S.Rb / 60, S.Rb / 60, 1);
  door.rotation.y = -S.door * 1.4; applyRobot();
  if (S.dropV && gTool.parent === scene) { S.dropV.y -= 9810 * dt * Math.min(P.sim, 4); const fl = S.toolAt === 'bin' ? 15 : P.D / 2; gTool.position.addScaledVector(S.dropV, dt * Math.min(P.sim, 4)); if (S.toolAt !== 'bin') gTool.rotation.x = Math.max(-Math.PI / 2, gTool.rotation.x - dt * 5); if (gTool.position.y < fl) { gTool.position.y = fl; S.dropV.set(0, 0, 0); } }
  // drag chains
  layChain(chZ, -250, S.shX, 544, 30, (u, v, a, e) => { e.set(0, 0, a); return tmpV.set(u, 758 + v, 92).clone(); });
  layChain(chX, 30, S.cx, 314, 30, (u, v, a, e) => { e.set(0, 0, a); return tmpV.set(u, S.yb + 100 + v, -170).clone(); });
  layChain(chY, 900, S.yb - 40, 600, 30, (u, v, a, e) => { e.set(0, 0, a + Math.PI / 2); return tmpV.set(245 - v, u, -235).clone(); });
  particles(dt, sdt);
  // stack light + ring light + interior light
  blink += dt; const bl = (blink * 2.5 | 0) % 2 === 0; const red = S.alarm || S.estop || F.door, amb = !red && (S.warn || !S.run), grn = !red && !amb;
  TL[0].material.emissiveIntensity = grn ? 2.2 : .05; TL[1].material.emissiveIntensity = amb ? (S.warn ? (bl ? 2.2 : .1) : 1.6) : .05; TL[2].material.emissiveIntensity = red ? (bl ? 2.6 : .2) : .05;
  ringLed.material.emissiveIntensity = S.insp ? 3 : .15; inLight.intensity = S.run ? 0 : 0;
  hmiT += dt; if (hmiT > .4) { hmiT = 0; drawHMI(); }
}

// ---------- look: X-ray / highlight ----------
let XRAY = false, HL = null, LABELS = !IS_MOBILE, EXP = 0, expTarget = null, SEC = false, SECAX = 'z', SECV = 0;
const ensureU = o => { const u = o.userData; if (u.op === undefined) { o.material = o.material.clone(); ALLMATS.add(o.material); u.op = o.material.opacity; u.tr = o.material.transparent; u.dw = o.material.depthWrite; u.em = o.material.emissive ? o.material.emissive.clone() : null; u.ei = o.material.emissiveIntensity; if (SEC) o.material.clippingPlanes = [secPlane]; } };
const FOCUS_SHELL = new Set(['guard', 'shutter', 'frame']);
function applyLook() { for (const id of partOrder) { const p = parts[id]; const hl = HL && HL.includes(id); const dim = HL && !hl;
    p.g.traverse(o => { if (!o.isMesh || Array.isArray(o.material) || o.userData.edge || o.isPoints) return; ensureU(o); const m = o.material, u = o.userData; let op = u.op, tr = u.tr, dw = u.dw;
      if (XRAY) { const shellish = p.shell || FOCUS_SHELL.has(id) || u.glass; op = shellish ? .07 : (hl ? 1 : .55); tr = true; dw = !shellish && !!hl; }
      if (dim && !XRAY) { op = Math.min(op, .25); tr = true; dw = false; }
      if (!XRAY && EXP > .3 && (id === 'guard' || id === 'shutter')) { op = Math.min(op, .12); tr = true; dw = false; }
      m.opacity = op; m.transparent = tr; m.depthWrite = dw; if (m.emissive && u.em) { if (hl) { m.emissive.setHex(0x1a6cff); m.emissiveIntensity = .35; } else { m.emissive.copy(u.em); m.emissiveIntensity = u.ei; } } m.needsUpdate = true; }); }
  edgeMat.opacity = XRAY ? .12 : .45; wake(); }

// ---------- section clipping ----------
const secPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
const SECR = { x: [-1300, 700], y: [0, 1600], z: [-330, 360] };
function applySec() { const n = { x: [-1, 0, 0], y: [0, -1, 0], z: [0, 0, -1] }[SECAX]; secPlane.normal.set(...n); secPlane.constant = SECV;
  const cp = SEC ? [secPlane] : null; for (const m of ALLMATS) { m.clippingPlanes = cp; m.clipShadows = true; m.needsUpdate = true; } edgeMat.clippingPlanes = cp; edgeMat.needsUpdate = true;
  scene.traverse(o => { if (o.isMesh && o.userData.op !== undefined && o.material.clippingPlanes !== cp) { o.material.clippingPlanes = cp; o.material.needsUpdate = true; } });
  document.body.classList.toggle('sec', SEC); wake(); }

// ---------- explode + labels ----------
const EXPL = partOrder.filter(id => !['tool', 'stock', 'chains'].includes(id));
let expFaded = false; function applyExplode() { if ((EXP > .3) !== expFaded) { expFaded = EXP > .3; applyLook(); } for (const id of EXPL) { const p = parts[id]; p.g.position.copy(p.base).addScaledVector(p.dir, EXP * 650); } }
scene.updateMatrixWorld(true); for (const id of partOrder) parts[id].aL = parts[id].g.worldToLocal(parts[id].anchor.clone());
const lblEls = {}; for (const id of partOrder) { const d = document.createElement('div'); d.className = 'lbl'; d.innerHTML = `<span class="n">${parts[id].no}</span>${parts[id].name.split(/[–:(]/)[0].trim()}`; d.onclick = e => { e.stopPropagation(); focusPart(id); }; $('labels').appendChild(d); lblEls[id] = d; }
const lv = new THREE.Vector3();
function updLabels() { const show = LABELS || EXP > .05; $('labels').style.display = show ? '' : 'none'; if (!show) return; const W = innerWidth, H = innerHeight;
  for (const id of partOrder) { const p = parts[id], el = lblEls[id]; if (!p.g.visible || (id === 'tool' && !gTool.visible)) { el.style.display = 'none'; continue; }
    if (id === 'tool') gTool.localToWorld(lv.set(0, 130, 0)); else p.g.localToWorld(lv.copy(p.aL));
    lv.project(camera); if (lv.z > 1 || Math.abs(lv.x) > 1.05 || Math.abs(lv.y) > 1.05) { el.style.display = 'none'; continue; }
    el.style.display = ''; el.style.transform = `translate(${(lv.x * .5 + .5) * W}px,${(-lv.y * .5 + .5) * H}px) translate(-50%,-100%)`; el.classList.toggle('hot', !!(HL && HL.includes(id))); } }

// ---------- camera ----------
let camTw = null, FOLLOW = false;
function flyTo(p, t, dur = 1.1) { camTw = { p0: camera.position.clone(), p1: new THREE.Vector3(...p), t0: controls.target.clone(), t1: new THREE.Vector3(...t), k: 0, dur }; wake(); }
const portrait = () => innerWidth / innerHeight < .8;
const CAMS = {
  overview: () => portrait() ? [[650, 2300, 3500], [-380, 800, 120]] : [[1300, 1950, 2900], [-300, 820, 80]],
  work: () => [[-200, 1150, 250], [10, 1010, 0]],
  brush: () => [[-170, 1120, 245], [0, 1060, 0]],
  chuck: () => [[-120, 1020, 220], [0, 950, 0]],
  robot: () => [[-200, 1800, 1900], [-950, 980, 260]],
  cabinet: () => [[-80, 520, 1250], [-60, 420, -200]],
  top: () => [[-300, 3900, 260], [-300, 800, 80]],
  front: () => [[-200, 1100, 2600], [-200, 900, 0]],
};
function cam(n) { FOLLOW = n === 'follow'; if (FOLLOW) { const t = [S.shX, 1000, 0]; flyTo([S.shX + 380, 1250, 620], t); } else { const [p, t] = CAMS[n](); flyTo(p, t); } document.querySelectorAll('[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === n)); }
function focusPart(id) { HL = [id]; applyLook(); const p = parts[id]; const b = new THREE.Box3().setFromObject(id === 'tool' ? gTool : p.g); if (b.isEmpty()) return; const c = b.getCenter(new THREE.Vector3()), r = Math.max(120, b.getSize(new THREE.Vector3()).length() * .5);
  const dir = camera.position.clone().sub(controls.target).normalize(); const d = r / Math.sin(camera.fov * Math.PI / 360) * .9; flyTo(c.clone().addScaledVector(dir, d).toArray(), c.toArray());
  showInfo(p.name, `<p>${p.desc}</p><p class="why">${L('מספר בתרשים הפיצוץ', 'Explode-view number')}: <b>${p.no}</b></p>`, null); }
// click to focus
const ray = new THREE.Raycaster(), pt0 = new THREE.Vector2(); let downAt = null;
canvas.addEventListener('pointerdown', e => downAt = [e.clientX, e.clientY]);
canvas.addEventListener('pointerup', e => { if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return; pt0.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1); ray.setFromCamera(pt0, camera);
  const objs = partOrder.map(id => parts[id].g).filter(g => g.visible); const hits = ray.intersectObjects(objs, true).filter(h => !h.object.userData.edge && !h.object.isPoints && !h.object.isLineSegments && (!SEC || secPlane.distanceToPoint(h.point) > 0) && (!XRAY || !(parts[partOf(h.object)]?.shell || FOCUS_SHELL.has(partOf(h.object)))) && !(h.object.material?.opacity < .1));
  const h = hits.find(h => !['guard'].includes(partOf(h.object)) || !XRAY); if (h) { let id = partOf(h.object); if (id === 'chuck' || id === 'disc' || id === 'vert') { } if (parts[id]) focusPart(id); } else { HL = null; applyLook(); hideInfo(); } });

// ---------- info box, stations, tour ----------
let infoNav = null;
function showInfo(t, html, nav) { $('iTitle').textContent = t; $('iBody').innerHTML = html; $('info').classList.add('on'); infoNav = nav; $('info').querySelector('.nav').style.display = nav ? '' : 'none'; wake(); }
function hideInfo() { $('info').classList.remove('on'); TOUR = false; }
$('iClose').onclick = () => { hideInfo(); HL = null; applyLook(); };
const ST = [
  { p: ['trays', 'robot', 'stock'], c: [[-200, 1800, 1900], [-1000, 900, 270]], t: L('1 · הזנה: מגשים ורובוט', '1 · Feeding: trays and robot'), b: L('הרובוט השיתופי (UR12e) עומד מחוץ לתא ולוקח כלי ממגש הקלט (6 קדחים). חיישן בגריפר מוודא שיש כלי. בסוף המחזור הכלי חוזר למגש הפלט (OK) או לסל הפסולים (NG).', 'The UR12e cobot stands outside the cell and picks a tool from the 6-hole input tray. A gripper sensor confirms the tool is there. At the end it puts the tool in the output tray (OK) or the reject bin (NG).') },
  { p: ['shutter', 'shuttle'], c: [[-150, 1250, 950], [-470, 950, 0]], t: L('2 · עמדת טעינה מחוץ לתא + תריס', '2 · Loading outside the cell + shutter'), b: L('השאטל יוצא דרך חלון בדופן השמאלית. הרובוט מכניס את הכלי לצ\'אק מבלי להיכנס לתא. כשהשאטל נכנס, תריס פנאומטי סוגר את החלון כדי שלא ייצאו ניצוצות ואבק.', 'The shuttle exits through a window in the left wall. The robot loads the chuck without entering the cell. When the shuttle goes in, a pneumatic shutter closes the window so sparks and dust stay inside.') },
  { p: ['camera'], c: [[-50, 1300, 650], [-250, 1050, 0]], t: L('3 · בדיקה אופטית לפני ואחרי', '3 · Vision inspection before and after'), b: L('מצלמה עם טבעת תאורה מודדת את הגרד בקצוות ואת רדיוס הקצה. בין 10 ל-20 מיקרון: הכלי חוזר להברשה נוספת אחת. מעל זה, או אם רדיוס הקצה מעל 25 מיקרון: פסול.', 'A camera with a ring light measures the edge burr and the edge radius. Between 10 and 20 µm the tool gets one automatic re-brush. Above that, or with an edge radius over 25 µm, it is rejected.') },
  { p: ['chuck'], c: CAMS.chuck(), t: L('4 · צ\'אק פנאומטי JAB-40', '4 · JAB-40 pneumatic chuck'), b: L('3 לסתות סוגרות על השוק. כוח ההידוק קובע את כוח המגע המקסימלי: 0.765N לפני גלישה (מחישוב הפרויקט). מתג לחץ מזהה איבוד אוויר.', '3 jaws clamp the shank. The clamping force sets the maximum brush force: 0.765 N before slip (from the project calculation). A pressure switch detects air loss.') },
  { p: ['zaxis', 'shuttle'], c: [[250, 1050, 650], [-150, 790, 0]], t: L('5 · ציר Z – שאטל', '5 · Z axis – shuttle'), b: L('פלטת נשא על מסילות PTFE, מונעת בבורג M12 ע"י NEMA17. היא עוברת בין 3 עמדות: טעינה (−470), בדיקה (−250) ועבודה (0). המנוע הראשי PCE 220M4 מסובב את הכלי ב-20 עד 140 סל"ד.', 'Carrier plate on PTFE rails, driven by an M12 screw and a NEMA17. It moves between 3 stations: load (−470), inspect (−250) and work (0). The PCE 220M4 main motor turns the tool at 20–140 rpm.') },
  { p: ['yaxis'], c: [[700, 1500, 900], [0, 1150, -220]], t: L('6 · ציר Y – שני עמודים', '6 · Y axis – twin columns'), b: L('שני ברגים מסונכרנים עם NEMA23 ותמסורת 57PX 1:6 מרימים את קורת X. המהירות נמוכה, המומנט גבוה, והתמסורת נועלת את הקורה בכוח.', 'Two synchronised screws, each with a NEMA23 and a 57PX 1:6 planetary, lift the X beam. Low speed, high torque, and the gearing holds the beam.') },
  { p: ['gantry'], c: [[450, 1550, 800], [60, 1300, -120]], t: L('7 · קורת X ועגלה', '7 · X beam and carriage'), b: L('עגלה על מסילה ליניארית item, מונעת בבורג. נושאת את שתי המברשות. רק מברשת אחת במגע בכל רגע.', 'Carriage on an item linear rail, screw-driven. It carries both brushes; only one brush touches the tool at any time.') },
  { p: ['disc'], c: CAMS.brush(), t: L('8 · מברשת דיסק – קצוות חיתוך', '8 · Disc brush – cutting edges'), b: L('מברשת SiC Ø120 מסתובבת ב-1600 סל"ד (≈10 מ\'/ש\'), ונעה לאורך החלק החותך בזמן שהכלי מסתובב. CSS: כשהמברשת נשחקת, הסל"ד עולה כדי לשמור על מהירות היקפית קבועה.', 'Ø120 SiC brush at 1600 rpm (≈10 m/s) travels along the flutes while the tool rotates. CSS: as the brush wears, the rpm rises to keep the surface speed constant.') },
  { p: ['vert'], c: [[300, 1350, 520], [0, 1150, 0]], t: L('9 · מברשת אנכית – פני הקצה', '9 · Vertical cup brush – end face'), b: L('מברשת כוס יורדת על קצה הכלי ומתנדנדת ±15 מ"מ כדי להסיר גרדים מהחודים ומהמרווחים.', 'A cup brush comes down on the tool tip and oscillates ±15 mm to clear burrs from the tip and flute ends.') },
  { p: ['dust'], c: [[800, 1600, 1100], [300, 1200, 100]], t: L('10 · יניקת אבק + HEPA', '10 · Dust extraction + HEPA'), b: L('מנדף ליד אזור המגע יונק אבק SiC ומתכת אל מסנן HEPA. חיישן ΔP מתריע על מסנן סתום.', 'A hood next to the contact zone pulls SiC and metal dust into a HEPA filter. A ΔP sensor warns when the filter clogs.') },
  { p: ['cabinet'], c: CAMS.cabinet(), t: L('11 · לוח חשמל', '11 · Electrical bay'), b: L('PLC Omron CP2E, 6 דרייברי DM542, ספק 24V/48V, יחידת FRL ומפסק ראשי. ממסר בטיחות מנתק מומנט (STO) כשהדלת נפתחת.', 'Omron CP2E PLC, 6 DM542 drivers, 24 V/48 V PSU, FRL unit and main switch. A safety relay cuts torque (STO) when the door opens.') },
  { p: ['hmi', 'guard'], c: [[1100, 1450, 1500], [400, 1200, 250]], t: L('12 · HMI, בטיחות ועמוד איתות', '12 · HMI, safety and signal tower'), b: L('מסך מגע למתכונים ולנתונים, לחצן חירום, עמוד איתות (ירוק: ריצה, כתום: אזהרה, אדום: תקלה), דלת עם נעילה מקודדת ומיגון PC כתום שמסנן את אור הניצוצות.', 'Touch screen for recipes and data, E-stop, signal tower (green run, amber warning, red fault), coded door interlock and orange PC guarding that filters spark glare.') },
];
let TOUR = false, stI = 0;
function showStation(i) { stI = (i + ST.length) % ST.length; const s = ST[stI]; HL = s.p; applyLook(); flyTo(...s.c); showInfo(s.t, `<p>${s.b}</p>`, true); $('iPrev').textContent = L('→ הקודם', '← Prev'); $('iNext').textContent = L('הבא ←', 'Next →'); }
$('iPrev').onclick = () => showStation(stI - 1); $('iNext').onclick = () => showStation(stI + 1);
let tourT = 0; function tour() { TOUR = true; tourT = 0; showStation(0); }

// ---------- risks ----------
const RISKS = [
  ['drop', L('נפילת כלי מהגריפר', 'Tool dropped by the gripper'), L('חיישן נוכחות בגריפר, הרובוט נעצר, גובה העברה נמוך, רפידות PU', 'Gripper presence sensor, robot stops, low transfer height, PU pads'), 'mid'],
  ['wear', L('בלאי מברשת', 'Brush wear'), L('CSS: הסל"ד עולה ושומר על מהירות היקפית; אזהרה מתחת ל-Ø100', 'CSS raises rpm to hold surface speed; warning below Ø100'), 'ok'],
  ['force', L('כוח מגע גבוה / גלישה בצ\'אק', 'Excess force / chuck slip'), L('ניטור זרם, גבול 0.765N מחישוב הצ\'אק, הקטנה אוטומטית של החדירה', 'Current monitoring, 0.765 N limit from the chuck calculation, automatic infeed reduction'), 'mid'],
  ['door', L('פתיחת דלת בזמן עבודה', 'Door opened while running'), L('נעילה מקודדת וממסר בטיחות STO (PL d). הכל נעצר מיד', 'Coded interlock + STO safety relay (PL d); everything stops at once'), 'ok'],
  ['air', L('איבוד לחץ אוויר', 'Air-pressure loss'), L('מתג לחץ: המברשות מורחקות, הסיבוב נעצר, ממתין ללחץ', 'Pressure switch: brushes retract, rotation stops, waits for pressure'), 'mid'],
  ['limit', L('חריגת גבול ציר', 'Axis overtravel'), L('מפסקי קצה E47 בכל ציר וגבולות תוכנה', 'E47 limit switches on every axis plus software limits'), 'ok'],
  ['missing', L('קדח ריק במגש', 'Empty tray slot'), L('חיישן גריפר: מדלגים לקדח הבא', 'Gripper sensor skips to the next slot'), 'ok'],
  ['filter', L('מסנן סתום / אבק SiC', 'Clogged filter / SiC dust'), L('HEPA עם חיישן ΔP והתראה; התא סגור', 'HEPA filter with ΔP alarm; cell enclosed'), 'mid'],
  [null, L('ניצוצות / שריפה', 'Sparks / fire'), L('מיגון PC כתום, תא מתכת, תריס על חלון השאטל, אין חומרים דליקים', 'Orange PC guarding, metal enclosure, shutter on the shuttle window, no flammables'), 'ok'],
  [null, L('פגיעת רובוט באדם', 'Robot hitting a person'), L('רובוט שיתופי עם הגבלת כוח, עובד מחוץ לתא', 'Force-limited cobot working outside the cell'), 'ok'],
  [null, L('רעש', 'Noise'), L('תא סגור, פחות מ-80dB(A)', 'Enclosed cell, under 80 dB(A)'), 'ok'],
  [null, L('עיגול יתר של הקצה', 'Over-rounding the edge'), L('המצלמה מודדת את רדיוס הקצה; מעל 25µm: פסול', 'The camera measures the edge radius; over 25 µm is rejected'), 'mid'],
];
const IMPROV = [
  [L('טעינה מחוץ לתא + תריס אוטומטי', 'Loading outside the cell + automatic shutter'), L('הרובוט לא נכנס לתא, והחלון נסגר בזמן ההברשה', 'The robot never enters the cell; the window is closed while brushing')],
  [L('בדיקה אופטית לפני ואחרי', 'Vision inspection before and after'), L('מדידת גרד ורדיוס קצה, עם הברשה חוזרת אוטומטית ומיון OK/NG', 'Measures burr and edge radius, re-brushes automatically and sorts OK/NG')],
  [L('פיצוי בלאי CSS', 'CSS wear compensation'), L('הסל"ד עולה כשהמברשת נשחקת, ויש התראת החלפה', 'rpm rises as the brush wears, with a replace-brush warning')],
  [L('גבול כוח מחישוב הצ\'אק', 'Force limit from the chuck calculation'), L('0.765N, ניטור זרם והקטנת חדירה', '0.765 N, current monitoring and infeed reduction')],
  [L('יניקת אבק + HEPA + ΔP', 'Dust extraction + HEPA + ΔP'), L('אבק SiC הוא סכנה נשימתית', 'SiC dust is a breathing hazard')],
  [L('שרשראות כבלים לכל ציר', 'Drag chains on every axis'), L('igus E2, רדיוס כיפוף קבוע', 'igus E2 with a fixed bend radius')],
  [L('מברשת אחת במגע בכל רגע', 'Only one brush in contact at a time'), L('מסלול נסיגה בטוח בין הדיסק לכוס', 'Safe retract path between the disc and the cup')],
  [L('מתכונים, SPC ו-Cpk', 'Recipes, SPC and Cpk'), L('שמירת פרמטרים לכל כלי, היסטוגרמה, גרף ריצה ויצוא CSV', 'Saved parameters per tool, histogram, run chart and CSV export')],
  [L('סימולציית תקלות', 'Fault simulation'), L('8 תקלות עם תגובת מכונה אמיתית', '8 faults, each with the machine\'s real response')],
  [L('הרחבת המסגרת ל-760', 'Frame widened to 760'), L('מנוע X נכנס בתוך התא בלי להתנגש בתמסורת Y', 'The X motor fits inside the cell without hitting the Y gearbox')],
  [L('עמוד איתות, HMI ולחצן חירום', 'Signal tower, HMI and E-stop'), L('מצב המכונה ברור למפעיל', 'The machine state is clear to the operator')],
  [L('בורג TR12×3 במקום M12', 'TR12×3 lead screw instead of M12'), L('נעילה עצמית ודיוק טוב יותר (הצעה ב-BOM)', 'Self-locking and more accurate (suggested in the BOM)')],
];

// ---------- presets & recipes ----------
const PRESETS = { [L('מקדח Ø6', 'Drill Ø6')]: { type: 'drill', D: 6, rpm: 1800, feed: 24, passes: 2, inf: .6, crpm: 80 }, [L('מקדח Ø12', 'Drill Ø12')]: { type: 'drill', D: 12, rpm: 1600, feed: 20, passes: 2, inf: .8, crpm: 60 }, [L('מקדח Ø20', 'Drill Ø20')]: { type: 'drill', D: 20, rpm: 1500, feed: 16, passes: 2, inf: 1, crpm: 45 },
  [L('כרסום Ø32 קרביד', 'Router Ø32 carbide')]: { type: 'router', D: 32, rpm: 1400, feed: 12, passes: 3, inf: 1.1, crpm: 30 }, [L('שקיעה Ø16', 'Countersink Ø16')]: { type: 'csink', D: 16, rpm: 1500, feed: 18, passes: 2, inf: .7, crpm: 50 } };
const getRecipes = () => { try { return JSON.parse(localStorage.getItem('dbc_recipes') || '{}'); } catch { return {}; } };
function applyParams(o) { const re = o.type !== P.type || o.D !== P.D; Object.assign(P, o); if (re && !S.toolIn && S.toolAt !== 'grip') { rebuildStock(); stockIn.forEach((a, i) => a.g.visible = i >= S.slot || S.inLeft === 6); } else if (re) { rebuildStock(); stockIn.forEach((a, i) => a.g.visible = i >= S.slot); toast(L('המתכון החדש יחול מהכלי הבא', 'New recipe applies from the next tool')); } syncUI(); }

// ---------- build panel ----------
const TABS = [['ctl', L('בקרה', 'Control')], ['view', L('תצוגה', 'Views')], ['data', L('נתונים', 'Data')], ['risk', L('סיכונים', 'Risks')], ['info', L('מידע', 'Info')]];
$('phead').innerHTML = `<button id="bLang" class="langb">${EN ? 'עב' : 'EN'}</button><h1>${L('תא הסרת גרדים אוטומטי במברשות', 'Automatic brush-deburring cell')}</h1><div class="sub">${L('בראודה · הנדסת מכונות · פרויקט DR3 · סימולציה תלת-ממדית', 'Braude ME · DR3 project · 3D simulation')}</div><div id="tabs">${TABS.map(([k, t], i) => `<button data-tab="${k}" class="${i ? '' : 'on'}">${t}</button>`).join('')}</div>`;
const rng = (id, lab, min, max, st, unit) => `<div class="row"><label>${lab}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${st}"><span class="val" id="${id}V"></span>${unit ? '' : ''}</div>`;
$('pbody').innerHTML = `
<div class="tab on" id="t-ctl">
 <div class="btns"><button id="bRun" class="primary"></button><button id="bE" class="stop">⛔ ${L('חירום', 'E-STOP')}</button><button id="bRst">↺ ${L('איפוס', 'Reset')}</button></div>
 ${rng('sSim', L('מהירות סימולציה', 'Sim speed'), 0, 6, 1)}
 <h2>${L('מתכון', 'Recipe')}</h2>
 <div class="row"><label>${L('תבנית', 'Preset')}</label><select id="selP"></select></div>
 <div class="btns"><button id="bSaveR">💾 ${L('שמור מתכון', 'Save recipe')}</button><button id="bDelR">🗑 ${L('מחק', 'Delete')}</button></div>
 <h2>${L('כלי', 'Tool')}</h2>
 <div class="seg" id="segT">${Object.entries(TYPES).map(([k, v]) => `<button data-t="${k}">${EN ? v.en : v.he}</button>`).join('')}</div>
 ${rng('sD', L('קוטר כלי Ø (מ"מ)', 'Tool Ø (mm)'), 6, 32, 1)}
 <h2>${L('פרמטרי הברשה', 'Brushing')}</h2>
 ${rng('sRpm', L('סל"ד מברשת', 'Brush rpm'), 600, 3000, 50)}
 ${rng('sFeed', L('הזנה (מ"מ/ש\')', 'Feed (mm/s)'), 5, 60, 1)}
 ${rng('sPass', L('מעברים', 'Passes'), 1, 5, 1)}
 ${rng('sInf', L('חדירה (מ"מ)', 'Infeed (mm)'), .2, 2, .1)}
 ${rng('sCrpm', L('סל"ד צ\'אק', 'Chuck rpm'), 20, 140, 5)}
 <label class="chk"><input type="checkbox" id="cCss"> ${L('CSS – פיצוי בלאי (מהירות היקפית קבועה)', 'CSS – wear compensation (constant surface speed)')}</label>
 <label class="chk"><input type="checkbox" id="cRew"> ${L('הברשה חוזרת אוטומטית (10–20µm)', 'Automatic re-brush (10–20 µm)')}</label>
 <h2>${L('חישובים', 'Calculations')}</h2><div class="kv" id="calc"></div>
 <div class="btns"><button id="bBrush">🔄 ${L('החלף מברשת', 'Replace brush')}</button><button id="bQ"></button></div>
</div>
<div class="tab" id="t-view">
 <h2>${L('מצלמה', 'Camera')}</h2>
 <div class="btns">${[['overview', L('מבט כללי', 'Overview')], ['follow', L('מעקב כלי', 'Follow tool')], ['work', L('אזור עבודה', 'Work zone')], ['brush', L('מברשות', 'Brushes')], ['chuck', L('צ\'אק', 'Chuck')], ['robot', L('רובוט', 'Robot')], ['cabinet', L('לוח חשמל', 'Cabinet')], ['top', L('מלמעלה', 'Top')], ['front', L('חזית', 'Front')]].map(([k, t]) => `<button data-cam="${k}">${t}</button>`).join('')}</div>
 <h2>${L('תצוגה', 'Display')}</h2>
 <div class="btns"><button id="bX">◐ X-RAY</button><button id="bLbl">🏷 ${L('תוויות', 'Labels')}</button><button id="bSec">✂ ${L('חתך', 'Section')}</button><button id="bExp">💥 ${L('פיצוץ', 'Explode')}</button></div>
 <div id="secRow"><div class="seg" id="segAx"><button data-ax="x">X</button><button data-ax="y">Y</button><button data-ax="z">Z</button></div>${rng('sSec', L('מיקום חתך', 'Section position'), 0, 1, .005)}</div>
 ${rng('sExp', L('פיצוץ', 'Explode'), 0, 1, .01)}
 <h2>${L('הסבר לפי עמדות', 'Stations')}</h2>
 <div class="btns"><button id="bTour" class="primary">▶ ${L('סיור מודרך', 'Guided tour')}</button></div>
 <div id="stList"></div>
 <p class="note">${L('לחיצה על חלק במודל: מיקוד והסבר.', 'Click any part in the model to focus on it and read about it.')}</p>
</div>
<div class="tab" id="t-data">
 <div class="kv" id="kvD"></div>
 <h2>${L('היסטוגרמת גרד אחרי (µm)', 'Final burr histogram (µm)')}</h2><canvas id="hist" width="600" height="190"></canvas>
 <h2>${L('גרף ריצה – גרד ורדיוס קצה', 'Run chart – burr and edge radius')}</h2><canvas id="chart" width="600" height="190"></canvas>
 <div class="btns"><button id="bCsv">⬇ CSV</button><button id="bClr">🧹 ${L('נקה נתונים', 'Clear data')}</button></div>
 <h2>${L('תוצאות אחרונות', 'Latest results')}</h2><div id="lastT"></div>
</div>
<div class="tab" id="t-risk">
 <p class="note">${L('כל סיכון והטיפול בו. הפעל תקלה כדי לראות את תגובת המכונה.', 'Each risk and how it is handled. Toggle a fault to see how the machine responds.')}</p>
 <div id="riskL"></div>
</div>
<div class="tab" id="t-info">
 <div class="card"><b>${L('על הפרויקט', 'About')}</b><div class="t">${L('תא אוטומטי להסרת גרדים מכלי חיתוך אחרי השחזה, עם מברשות שוחקות (SiC). הכלי מוחזק בצ\'אק מסתובב; מברשת דיסק עוברת על הקצוות, ומברשת כוס אנכית מנקה את הקצה. מבוסס על פרויקט DR3 במכללת בראודה (הנדסת מכונות).', 'An automatic cell that removes post-grinding burrs from cutting tools with abrasive SiC brushes. The tool turns in a chuck, a disc brush works the cutting edges and a vertical cup brush cleans the tip. Based on a Braude College ME DR3 project.')}</div></div>
 <h2>${L('שיפורים שלי', 'My improvements')}</h2><ol class="imp">${IMPROV.map(([a, b]) => `<li><b>${a}</b> – ${b}</li>`).join('')}</ol>
 <h2>BOM (${BOM.length} ${L('שורות', 'rows')}, ${L('סה"כ', 'total qty')} ${BOM.reduce((s, r) => s + (+r[4] || 0), 0)})</h2>
 <table class="bom"><tr><td>#</td><td>${L('תיאור', 'Description')}</td><td>${L('כמ\'', 'Qty')}</td><td>${L('ספק / דגם', 'Supplier / model')}</td></tr>${BOM.map(r => `<tr><td>${r[0]}</td><td>${r[2]}<br><small>${r[1]} · ${r[3]} · ${r[5]}</small></td><td>${r[4] ?? ''}</td><td>${r[6]}${r[7] && r[7] !== 'N/A' ? '<br><small>' + r[7] + '</small>' : ''}${r[8] ? `<br><small style="color:#7fd3ff">💡 ${r[8]}</small>` : ''}</td></tr>`).join('')}</table>
 <p class="note">${L('💡 = דגם מוצע להשלמת פריט TBD או לשיפור.', '💡 = suggested model to fill a TBD item or improve it.')}</p>
</div>`;
const SIMV = [.25, .5, 1, 2, 4, 8, 16];
document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => { document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.id === 't-' + b.dataset.tab)); if (b.dataset.tab === 'data') updData(); });
$('bLang').onclick = switchLang; $('bLang2').onclick = switchLang; $('bLang2').textContent = EN ? 'עב' : 'EN';
$('mbtn').textContent = '☰ ' + L('תפריט ובקרה', 'Menu & controls'); $('mbtn').onclick = () => { document.body.classList.toggle('menuopen'); wake(); }; $('pclose').onclick = () => { document.body.classList.remove('menuopen'); wake(); };
const bindR = (id, key, f = v => v, show) => { const el = $(id); el.oninput = () => { P[key] = f(+el.value); if (key === 'D') applyParams({ D: P.D }); syncUI(); }; };
bindR('sD', 'D'); bindR('sRpm', 'rpm'); bindR('sFeed', 'feed'); bindR('sPass', 'passes'); bindR('sInf', 'inf'); bindR('sCrpm', 'crpm');
$('sSim').oninput = () => { P.sim = SIMV[+$('sSim').value]; syncUI(); };
document.querySelectorAll('#segT button').forEach(b => b.onclick = () => applyParams({ type: b.dataset.t }));
$('cCss').onchange = () => { P.css = $('cCss').checked; syncUI(); }; $('cRew').onchange = () => { P.rework = $('cRew').checked; };
function fillPresets() { const r = getRecipes(); $('selP').innerHTML = `<option value="">—</option>` + Object.keys(PRESETS).map(k => `<option value="p:${k}">${k}</option>`).join('') + Object.keys(r).map(k => `<option value="r:${k}">💾 ${k}</option>`).join(''); }
fillPresets(); $('selP').onchange = () => { const v = $('selP').value; if (!v) return; const o = v[0] === 'p' ? PRESETS[v.slice(2)] : getRecipes()[v.slice(2)]; if (o) applyParams({ ...o }); };
$('bSaveR').onclick = () => { const n = prompt(L('שם המתכון:', 'Recipe name:'), TYPES[P.type][LANG] + ' Ø' + P.D); if (!n) return; const r = getRecipes(); r[n] = { type: P.type, D: P.D, rpm: P.rpm, feed: P.feed, passes: P.passes, inf: P.inf, crpm: P.crpm, css: P.css }; localStorage.setItem('dbc_recipes', JSON.stringify(r)); fillPresets(); $('selP').value = 'r:' + n; toast(L('המתכון נשמר', 'Recipe saved')); };
$('bDelR').onclick = () => { const v = $('selP').value; if (v[0] !== 'r') return; const r = getRecipes(); delete r[v.slice(2)]; localStorage.setItem('dbc_recipes', JSON.stringify(r)); fillPresets(); };
$('bRun').onclick = () => { if (S.estop) return; S.run = !S.run; syncUI(); wake(); };
$('bE').onclick = () => { S.estop = !S.estop; if (S.estop) S.run = false; document.body.classList.toggle('estop', S.estop); $('estopOv').textContent = S.estop ? L('⛔ עצירת חירום – לחץ שוב לשחרור', '⛔ EMERGENCY STOP – press again to release') : ''; syncUI(); wake(); };
$('estopOv').onclick = () => $('bE').click();
$('bRst').onclick = () => { S.res.length = 0; Object.assign(S, { n: 0, good: 0, rej: 0, rew: 0, drop: 0, cycs: [], outN: 0 }); stockOut.forEach(b => b.g.visible = false); updData(); toast(L('המונים אופסו', 'Counters reset')); };
$('bBrush').onclick = () => { S.Rb = 60; S.wearWarned = false; F.wear = false; syncUI(); toast(L('הותקנה מברשת חדשה Ø120', 'New Ø120 brush fitted')); };
document.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => { cam(b.dataset.cam); if (IS_MOBILE) document.body.classList.remove('menuopen'); });
$('bX').onclick = () => { XRAY = !XRAY; $('bX').classList.toggle('on', XRAY); applyLook(); };
$('bLbl').onclick = () => { LABELS = !LABELS; $('bLbl').classList.toggle('on', LABELS); updLabels(); wake(); };
$('bSec').onclick = () => { SEC = !SEC; $('bSec').classList.toggle('on', SEC); if (SEC && !$('sSec').dataset.set) { $('sSec').value = SECAX === 'z' ? .5 : .5; } setSecFromSlider(); };
function setSecFromSlider() { const r = SECR[SECAX], t = +$('sSec').value; SECV = lerp(r[0], r[1], t); $('sSecV').textContent = Math.round(SECV) + ' mm'; applySec(); }
$('sSec').oninput = () => { $('sSec').dataset.set = 1; setSecFromSlider(); };
document.querySelectorAll('#segAx button').forEach(b => b.onclick = () => { SECAX = b.dataset.ax; document.querySelectorAll('#segAx button').forEach(x => x.classList.toggle('on', x === b)); setSecFromSlider(); });
$('bExp').onclick = () => { expTarget = EXP > .5 ? 0 : 1; $('bExp').classList.toggle('on', expTarget > 0); wake(); };
$('sExp').oninput = () => { EXP = +$('sExp').value; expTarget = null; applyExplode(); $('sExpV').textContent = Math.round(EXP * 100) + '%'; wake(); };
$('bTour').onclick = () => { tour(); if (IS_MOBILE) document.body.classList.remove('menuopen'); };
$('stList').innerHTML = ST.map((s, i) => `<div class="card" data-st="${i}"><b>${s.t}</b></div>`).join(''); document.querySelectorAll('[data-st]').forEach(c => c.onclick = () => { showStation(+c.dataset.st); if (IS_MOBILE) document.body.classList.remove('menuopen'); });
$('riskL').innerHTML = RISKS.map(([f, t, m, lv]) => `<div class="card"><b>${t}</b><span class="tag ${lv}">${lv === 'ok' ? L('נמוך', 'Low') : L('בינוני', 'Medium')}</span><div class="m">🛡 ${m}</div>${f ? `<label class="chk"><input type="checkbox" data-f="${f}"> ${L('הדמה תקלה', 'Simulate fault')}</label>` : ''}</div>`).join('');
document.querySelectorAll('[data-f]').forEach(c => c.onchange = () => { F[c.dataset.f] = c.checked; if (c.dataset.f === 'door') { if (c.checked) alarm(L('⛔ הדלת נפתחה – STO: כל הצירים והמנועים נעצרו מיד', '⛔ Door opened – STO: all axes and motors stopped at once')); else clearAlarm(); } if (c.dataset.f === 'filter' && c.checked) alarm(L('⚠ ΔP במסנן עולה – יש להחליף את מסנן ה-HEPA', '⚠ Filter ΔP rising – replace the HEPA filter'), 'warn'); if (c.dataset.f === 'wear' && c.checked) toast(L('בלאי מואץ – צפה בסל"ד עולה (CSS)', 'Accelerated wear – watch the rpm rise (CSS)')); if (!S.run && !S.estop) { S.run = true; syncUI(); } wake(); });
$('bCsv').onclick = () => { const k = ['i', 't', 'type', 'D', 'rpm', 'v', 'feed', 'passes', 'inf', 'h0', 'pre', 'post', 're', 'F', 'rework', 'st', 'why', 'cyc']; const csv = [k.join(','), ...S.res.map(r => k.map(x => r[x] ?? '').join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'deburr_results.csv'; a.click(); };
$('bClr').onclick = () => $('bRst').click();

function syncUI() { $('sD').value = P.D; $('sDV').textContent = 'Ø' + P.D; $('sRpm').value = P.rpm; $('sRpmV').textContent = P.rpm; $('sFeed').value = P.feed; $('sFeedV').textContent = P.feed; $('sPass').value = P.passes; $('sPassV').textContent = P.passes; $('sInf').value = P.inf; $('sInfV').textContent = P.inf.toFixed(1); $('sCrpm').value = P.crpm; $('sCrpmV').textContent = P.crpm;
  $('sSim').value = Math.max(0, SIMV.indexOf(P.sim)); $('sSimV').textContent = '×' + P.sim; $('cCss').checked = P.css; $('cRew').checked = P.rework;
  document.querySelectorAll('#segT button').forEach(b => b.classList.toggle('on', b.dataset.t === P.type));
  $('bRun').textContent = S.run ? '⏸ ' + L('השהה', 'Pause') : '▶ ' + L('הפעל', 'Start'); $('bE').classList.toggle('on', S.estop);
  $('bQ').textContent = '⚙ ' + L('איכות', 'Quality') + ': ' + (HIGH ? 'HQ' : L('מהיר', 'Fast')); $('bQ').classList.toggle('on', HIGH); calc(); }
function estCycle() { const lf = Lf() + tipL(); return 3.4 + 3.6 + 2 + .6 + 1.9 + .6 + .6 + 2 + P.passes * (lf / P.feed) + 3 + P.passes * Math.max(.8, 60 / P.feed) + 3 + .6 + 1.9 + .9 + 1.7 + 3.4; }
function calc() { const f = forceOf(effInf()), v = tipV(), pw = f * .6 * v + 4; const ok = f <= FLIM;
  $('calc').innerHTML = [[L('סל"ד בפועל (CSS)', 'Actual rpm (CSS)'), Math.round(rpmDisc())], [L('מהירות היקפית', 'Surface speed'), fmt(v, 2) + ' m/s'], [L('Ø מברשת', 'Brush Ø'), Math.round(S.Rb * 2) + ' mm'], [L('כוח מגע', 'Contact force'), `<span style="color:${forceOf(P.inf) > FLIM ? '#ff8a80' : '#7dff9e'}">${fmt(forceOf(P.inf), 2)} N</span> / ${FLIM}`], [L('הספק מברשת', 'Brush power'), fmt(pw, 1) + ' W'], [L('אורך חלק חותך', 'Flute length'), Lf() + ' mm'], [L('זמן מחזור משוער', 'Est. cycle'), fmt(estCycle(), 0) + ' s'], [L('תפוקה', 'Throughput'), Math.round(3600 / estCycle()) + ' /h']].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join(''); }
syncUI();

// ---------- data ----------
function stats(a) { const n = a.length; if (!n) return { n, m: 0, s: 0 }; const m = a.reduce((x, y) => x + y, 0) / n; const s = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / Math.max(1, n - 1)); return { n, m, s }; }
function updData() { if (!$('kvD')) return; const post = S.res.filter(r => r.post != null).map(r => r.post); const st = stats(post); const cpk = st.s > 0 ? (10 - st.m) / (3 * st.s) : null;
  const byT = {}; S.res.forEach(r => { if (r.post == null) return; const k = (EN ? TYPES[r.type].en : TYPES[r.type].he) + ' Ø' + r.D; (byT[k] = byT[k] || []).push(r.post); });
  const ac = stats(S.cycs.slice(-20));
  $('kvD').innerHTML = [[L('נבדקו', 'Processed'), S.n], [L('תקינים', 'OK'), S.good], [L('פסולים', 'Rejects'), S.rej], [L('הברשה חוזרת', 'Re-brushed'), S.rew], [L('נפילות', 'Drops'), S.drop], [L('תפוקה', 'Yield'), S.n ? fmt(S.good / S.n * 100, 1) + '%' : '–'], [L('גרד ממוצע', 'Mean burr'), fmt(st.m, 2) + ' µm'], [L('סטיית תקן', 'Std dev'), fmt(st.s, 2) + ' µm'], ['Cpk (USL 10µm)', cpk == null ? '–' : `<span style="color:${cpk >= 1.33 ? '#7dff9e' : cpk >= 1 ? '#ffd27a' : '#ff8a80'}">${fmt(cpk, 2)}</span>`], [L('זמן מחזור ממוצע', 'Mean cycle'), ac.n ? fmt(ac.m, 1) + ' s' : '–'],
    ...Object.entries(byT).map(([k, a]) => [L('גרד ', 'Burr ') + k, fmt(stats(a).m, 1) + ' µm (n=' + a.length + ')'])].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
  // histogram
  { const c = $('hist'), x = c.getContext('2d'), w = c.width, h = c.height; x.clearRect(0, 0, w, h); const bins = new Array(25).fill(0); post.forEach(v => bins[Math.min(24, Math.floor(v))]++); const mx = Math.max(1, ...bins); const bw = (w - 40) / 25;
    x.fillStyle = '#9aa4b1'; x.font = '12px Arial'; for (let i = 0; i < 25; i++) { const bh = bins[i] / mx * (h - 40); x.fillStyle = i >= 10 ? '#e2575a' : '#3fb6ff'; x.fillRect(30 + i * bw + 1, h - 22 - bh, bw - 2, bh); if (i % 5 === 0) { x.fillStyle = '#9aa4b1'; x.fillText(i, 30 + i * bw, h - 6); } }
    x.strokeStyle = '#ffd27a'; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(30 + 10 * bw, 8); x.lineTo(30 + 10 * bw, h - 22); x.stroke(); x.setLineDash([]); x.fillStyle = '#ffd27a'; x.fillText('USL 10', 34 + 10 * bw, 18); x.fillStyle = '#9aa4b1'; x.fillText('n=' + post.length, w - 60, 18); }
  // run chart
  { const c = $('chart'), x = c.getContext('2d'), w = c.width, h = c.height; x.clearRect(0, 0, w, h); const R_ = S.res.filter(r => r.post != null).slice(-60); const Y = v => h - 20 - clamp(v / 30) * (h - 30);
    x.strokeStyle = '#33404e'; for (const g of [0, 10, 20, 30]) { x.beginPath(); x.moveTo(30, Y(g)); x.lineTo(w - 6, Y(g)); x.stroke(); x.fillStyle = '#9aa4b1'; x.font = '11px Arial'; x.fillText(g, 6, Y(g) + 4); }
    x.strokeStyle = '#ffd27a'; x.setLineDash([5, 4]); x.beginPath(); x.moveTo(30, Y(10)); x.lineTo(w - 6, Y(10)); x.stroke(); x.setLineDash([]);
    const X = i => 30 + i / Math.max(1, R_.length - 1) * (w - 40);
    for (const [k, col] of [['post', '#3fb6ff'], ['re', '#c08bff']]) { x.strokeStyle = col; x.lineWidth = 2; x.beginPath(); R_.forEach((r, i) => i ? x.lineTo(X(i), Y(r[k])) : x.moveTo(X(i), Y(r[k]))); x.stroke(); x.lineWidth = 1; R_.forEach((r, i) => { x.fillStyle = k === 'post' ? (r.st === 'ok' ? '#3fb6ff' : '#e2575a') : col; x.fillRect(X(i) - 2, Y(r[k]) - 2, 4, 4); }); }
    x.fillStyle = '#3fb6ff'; x.fillText(L('גרד µm', 'burr µm'), w - 150, 14); x.fillStyle = '#c08bff'; x.fillText(L('רדיוס קצה µm', 'edge r µm'), w - 80, 14); }
  $('lastT').innerHTML = `<table><tr><td>#</td><td>${L('כלי', 'Tool')}</td><td>${L('לפני', 'Pre')}</td><td>${L('אחרי', 'Post')}</td><td>r</td><td>F</td><td></td></tr>${S.res.slice(-8).reverse().map(r => `<tr><td>${r.i}</td><td>${EN ? TYPES[r.type].en : TYPES[r.type].he} Ø${r.D}</td><td>${fmt(r.pre)}</td><td>${fmt(r.post)}</td><td>${fmt(r.re)}</td><td>${fmt(r.F, 2)}</td><td>${r.st === 'ok' ? '✅' : r.st === 'drop' ? '⬇' : '❌'}${r.rework ? '↻' : ''}</td></tr>`).join('')}</table>`;
}

// ---------- HUD ----------
$('hud').innerHTML = `<div class="st" id="hSt"><i></i><span id="hStT"></span></div><div>${L('נבדקו', 'Done')}<b id="hN"></b></div><div>${L('פסולים', 'NG')}<b id="hR"></b></div><div>${L('מחזור', 'Cycle')}<b id="hC"></b></div><div>${L('גרד', 'Burr')}<b id="hB"></b></div><div class="hm">${L('קוטר', 'Tool')}<b id="hD"></b></div><div class="hm">${L('סל"ד', 'rpm')}<b id="hRpm"></b></div><div>v<b id="hV"></b></div><div class="hm">F<b id="hF"></b></div><div class="bar"><span id="hBar"></span></div>`;
const PHN = { spin: L('הרצת מנועים', 'Spin-up'), disc: L('מברשת דיסק – קצוות', 'Disc brush – edges'), switch: L('מעבר בין מברשות', 'Switching brushes'), vert: L('מברשת אנכית – קצה', 'Cup brush – tip'), park: L('חזרה לחניה', 'Parking') };
function phase() { if (S.estop) return L('עצירת חירום', 'E-STOP'); if (F.door) return L('דלת פתוחה – STO', 'Door open – STO'); if (S.alarm) return L('תקלה', 'Fault'); if (!S.run) return S.n ? L('מושהה', 'Paused') : L('מוכן – לחץ ▶', 'Ready – press ▶'); if (S.insp) return L('בדיקה אופטית', 'Vision inspection'); if (S.ph) return PHN[S.ph]; if (S.toolAt === 'grip') return L('רובוט מעביר כלי', 'Robot transferring'); if (Math.abs(S.shX - C.LOADX) < 2) return L('עמדת טעינה', 'Load station'); return L('שאטל בתנועה', 'Shuttle moving'); }
function hud() { const st = $('hSt'); st.className = 'st' + (S.estop || S.alarm || F.door ? ' err' : !S.run || S.warn ? ' warn' : ''); $('hStT').textContent = phase();
  $('hN').textContent = S.n; $('hR').textContent = S.rej; $('hC').textContent = fmt(S.lastCyc || estCycle(), 1) + L(' ש׳', ' s'); $('hB').textContent = S.toolAt === 'none' || !gTool.visible ? '–' : fmt(S.burr, 1) + ' µm'; $('hB').style.color = S.burr > 10 ? '#ffb27a' : '#7dff9e';
  $('hD').textContent = TYPES[P.type][EN ? 'en' : 'he'].split(' ')[0] + ' Ø' + P.D; $('hRpm').textContent = Math.round(rpmDisc()); $('hV').textContent = fmt(tipV(), 1) + ' m/s'; $('hF').textContent = fmt(S.force, 2) + ' N'; $('hF').style.color = S.force > FLIM ? '#ff8a80' : '';
  $('hBar').style.width = clamp(1 - S.burrFrac) * 100 + '%'; if (TOUR) {} }

// ---------- quality / post ----------
let composer = null, postTok = 0;
const PR_CAP = () => Math.min(devicePixelRatio, IS_MOBILE ? 1.5 : 2) * (HIGH ? 1 : (IS_MOBILE ? .8 : .9)); let prScale = 1;
const applyPR = () => { const pr = Math.max(.6, PR_CAP() * prScale); if (Math.abs(renderer.getPixelRatio() - pr) > .01) { renderer.setPixelRatio(pr); renderer.setSize(innerWidth, innerHeight, false); if (composer) { composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); } } };
function setupPost() { const tok = ++postTok; if (composer) { composer.dispose?.(); composer = null; }
  renderer.shadowMap.type = HIGH ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; sun.shadow.mapSize.set(HIGH ? 2048 : 1024, HIGH ? 2048 : 1024); sun.shadow.radius = HIGH ? 4 : 1; if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } renderer.shadowMap.needsUpdate = true;
  for (const m of ALLMATS) m.needsUpdate = true; applyPR(); if (!HIGH) return;
  Promise.all(['EffectComposer', 'RenderPass', 'GTAOPass', 'UnrealBloomPass', 'OutputPass'].map(n => import('three/addons/postprocessing/' + n + '.js'))).then(([a, b, c, d, e]) => { if (tok !== postTok || !HIGH) return;
    const pr = renderer.getPixelRatio(); const rt = new THREE.WebGLRenderTarget(innerWidth * pr, innerHeight * pr, { type: THREE.HalfFloatType, samples: 4 });
    composer = new a.EffectComposer(renderer, rt); composer.addPass(new b.RenderPass(scene, camera)); const g = new c.GTAOPass(scene, camera, innerWidth, innerHeight); g.updateGtaoMaterial({ radius: 60, distanceExponent: 1.5, thickness: 8, scale: 1.1, samples: 12 }); g.blendIntensity = .85; composer.addPass(g);
    composer.addPass(new d.UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), .35, .3, 1.5)); composer.addPass(new e.OutputPass()); composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight); wake(); }).catch(err => console.warn('post', err)); }
function setQuality(h, user) { HIGH = h; if (user) localStorage.setItem('dbc_q', h ? 'high' : 'low'); setupPost(); syncUI(); wake(); }
$('bQ').onclick = () => setQuality(!HIGH, true);
function resize() { IS_MOBILE = layout(); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < .8 ? 50 : 34; camera.updateProjectionMatrix(); applyPR(); if (composer) composer.setSize(innerWidth, innerHeight); wake(); }
const NODRS = QS.has('nodrs');
let wakeN = 90; function wake(n = 90) { wakeN = Math.max(wakeN, n); }
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'input', 'change', 'click', 'touchmove']) addEventListener(ev, () => wake(), { passive: true });
controls.addEventListener('change', () => wake(30)); controls.addEventListener('start', () => { camTw = null; FOLLOW = false; });
addEventListener('resize', resize); resize(); setupPost();

// ---------- loop ----------
let last = performance.now(), hudT = 0, lblT = 0, frameN = 0, drsT = 0, drsN = 0, dataT = 0;
window.__perf = { fps: 0 };
function frame(nowMs) {
  requestAnimationFrame(frame);
  const dtReal = Math.min(.25, Math.max(0, (nowMs - last) / 1000)); last = nowMs;
  const moving = S.run && !S.estop;
  const active = moving || camTw || expTarget !== null || FOLLOW || wakeN > 0 || S.dropV;
  if (!active) { hudT += dtReal; if (hudT > .5) { hudT = 0; hud(); } return; } if (wakeN > 0) wakeN--;
  let rem = dtReal; while (rem > 1e-4) { const d = Math.min(.05, rem); rem -= d; const sd = moving ? d * P.sim : 0; if (moving) step(sd); visuals(d, sd); }
  if (expTarget !== null) { EXP = lerp(EXP, expTarget, 1 - Math.exp(-dtReal * 5)); if (Math.abs(EXP - expTarget) < .002) { EXP = expTarget; expTarget = null; } $('sExp').value = EXP; $('sExpV').textContent = Math.round(EXP * 100) + '%'; applyExplode(); }
  if (camTw) { camTw.k = Math.min(1, camTw.k + dtReal / camTw.dur); const k = ease(camTw.k); camera.position.lerpVectors(camTw.p0, camTw.p1, k); controls.target.lerpVectors(camTw.t0, camTw.t1, k); if (camTw.k >= 1) camTw = null; }
  if (FOLLOW && !camTw) { const wp = new THREE.Vector3(); gTool.visible ? gTool.getWorldPosition(wp) : wp.set(S.shX, 950, 0); wp.y += 60; const d = wp.clone().sub(controls.target).multiplyScalar(.06); controls.target.add(d); camera.position.add(d); }
  if (TOUR && !camTw) { tourT += dtReal; if (tourT > 9) { tourT = 0; if (stI < ST.length - 1) showStation(stI + 1); else TOUR = false; } }
  controls.update();
  frameN++; if (moving || EXP > 0 || frameN % 20 === 0) { if (frameN % (HIGH ? 2 : 3) === 0) renderer.shadowMap.needsUpdate = true; }
  if (composer) composer.render(); else renderer.render(scene, camera);
  lblT += dtReal; if (lblT > .05) { lblT = 0; updLabels(); }
  hudT += dtReal; if (hudT > .15) { hudT = 0; hud(); if (frameN % 6 === 0) calc(); }
  drsT += dtReal; drsN++; if (drsT > 1 && !NODRS) { const f = drsN / drsT; __perf.fps = f; drsT = 0; drsN = 0;
    if (f < 45 && prScale > .55) { prScale = Math.max(.55, prScale - .15); applyPR(); } else if (f > 58 && prScale < 1) { prScale = Math.min(1, prScale + .1); applyPR(); } }
}
renderer.shadowMap.autoUpdate = false;
// initial state / URL params
const qp = QS; visuals(0, 0); applyLook();
S.run = !qp.has('paused'); syncUI();
if (qp.has('x')) { XRAY = true; $('bX').classList.add('on'); applyLook(); }
if (qp.has('e')) { EXP = +qp.get('e'); applyExplode(); $('sExp').value = EXP; LABELS = true; }
if (qp.has('sec')) { SEC = true; SECAX = qp.get('sec') || 'z'; $('bSec').classList.add('on'); if (qp.has('sv')) $('sSec').value = qp.get('sv'); else $('sSec').value = .5; document.querySelectorAll('#segAx button').forEach(x => x.classList.toggle('on', x.dataset.ax === SECAX)); setSecFromSlider(); }
if (qp.has('nolabels')) LABELS = false; if (qp.has('labels')) LABELS = true; $('bLbl').classList.toggle('on', LABELS);
{ const [p, t] = CAMS.overview(); camera.position.set(...p); controls.target.set(...t); }
if (qp.has('cam')) { const c = qp.get('cam'); if (CAMS[c]) { const [p, t] = CAMS[c](); camera.position.set(...p); controls.target.set(...t); } else { const v = c.split(',').map(Number); camera.position.set(v[0], v[1], v[2]); controls.target.set(v[3], v[4], v[5]); } }
if (qp.has('st')) setTimeout(() => showStation(+qp.get('st')), 50);
if (qp.has('tab')) document.querySelector(`#tabs [data-tab="${qp.get('tab')}"]`)?.click();
if (qp.has('menu')) document.body.classList.add('menuopen');
if (qp.has('hide')) for (const id of qp.get('hide').split(',')) if (parts[id]) parts[id].g.visible = false;
controls.update(); showAlarm(); updData();
requestAnimationFrame(frame);

// ---------- debug hooks ----------
window.__S = S; window.__P = P; window.__F = F; window.__scene = scene; window.__R = renderer; window.__parts = parts; window.__PERF = PERF;
window.__cam = (p, t) => { camTw = null; camera.position.set(...p); controls.target.set(...t); controls.update(); wake(); };
window.__ff = sec => { const was = S.run; S.run = true; for (let i = 0; i < sec * 50; i++) { step(.02); visuals(.02, 0); } S.run = was; scene.updateMatrixWorld(true); wake(); };
window.__set = o => applyParams(o);
window.__triInit = async () => { if (window.__BVH) return; window.__BVH = await import('./vendor/bvh/index.module.js'); };
window.__tri = (opt = {}) => { const { MeshBVH } = window.__BVH; const tol = opt.tol ?? .4; scene.updateMatrixWorld(true); const vis = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const items = []; const roots = partOrder.map(id => parts[id].g);
  for (const root of roots) walk(root, o => { if (!o.isMesh || o.isInstancedMesh || o.isPoints || !vis(o) || o.geometry.type === 'PlaneGeometry' || o.userData.edge) return; const id = partOf(o);
    let body = root; for (let q = o.parent; q && q !== root; q = q.parent) if (q.userData.body) { body = q; break; }
    let al = []; for (let q = o; q; q = q.parent) if (q.userData.allow) al = al.concat(q.userData.allow);
    const g = o.geometry; if (!g.boundsTree) { g.boundsTree = new MeshBVH(g); g.computeBoundingBox(); }
    const bb = g.boundingBox, sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const sh = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z).multiply(new THREE.Matrix4().makeScale(...['x', 'y', 'z'].map(k => Math.max(.01, 1 - 2 * tol / Math.max(sz[k], 1e-3))))).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
    items.push({ id, o, body, al, wb: new THREE.Box3().setFromObject(o, true), M: o.matrixWorld.clone().multiply(sh) }); });
  // nested parts (chuck/disc/vert/tool/stock) are their own roots via walk() skip
  const out = []; const m = new THREE.Matrix4();
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const A_ = items[i], B = items[j]; if (A_.body === B.body) continue;
    if (A_.al.includes(B.id) || B.al.includes(A_.id)) continue; if (!A_.wb.intersectsBox(B.wb)) continue;
    m.copy(A_.M).invert().multiply(B.M); let hit = A_.o.geometry.boundsTree.intersectsGeometry(B.o.geometry, m);
    if (!hit) { const sa = A_.wb.getSize(new THREE.Vector3()).length(), sb = B.wb.getSize(new THREE.Vector3()).length(); const [Sm, Lg] = sa < sb ? [A_, B] : [B, A_];
      if (Lg.o.geometry.type !== 'TubeGeometry' && !(Lg.o.geometry.parameters?.openEnded) && Lg.wb.containsBox(Sm.wb)) { const p = Sm.wb.getCenter(new THREE.Vector3()).applyMatrix4(Lg.o.matrixWorld.clone().invert()); const r = new THREE.Ray(p, new THREE.Vector3(.577, .577, .577)); const hs = Lg.o.geometry.boundsTree.raycast(r, THREE.DoubleSide); if (hs.length % 2 === 1) hit = 'inside'; } }
    if (hit) { const f = b => [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z].map(Math.round).join(','); out.push(`${A_.id}:${A_.o.geometry.type}[${f(A_.wb)}] x ${B.id}:${B.o.geometry.type}[${f(B.wb)}]${hit === 'inside' ? ' INSIDE' : ''}`); } }
  return out; };
window.__triCycle = (sec = 60, dt = .2, opt) => { const all = new Map(); const add = l => l.forEach(s => { const k = s.replace(/\[[^\]]*\]/g, ''); if (!all.has(k)) all.set(k, s); }); add(__tri(opt)); for (let t = 0; t < sec; t += dt) { __ff(dt); add(__tri(opt)); } return [...all.values()]; };
