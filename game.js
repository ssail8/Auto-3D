import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';

const canvas = document.querySelector('#game');
const speedEl = document.querySelector('#speed');
const airEl = document.querySelector('#air');
const boostsEl = document.querySelector('#boosts');
const loading = document.querySelector('#loading');
const resetBtn = document.querySelector('#resetBtn');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87b9e8);
scene.fog = new THREE.Fog(0x87b9e8, 110, 280);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 500);

scene.add(new THREE.HemisphereLight(0xffffff, 0x567044, 2.25));
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(45, 70, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
scene.add(sun);

const grass = new THREE.Mesh(
  new THREE.PlaneGeometry(320, 320),
  new THREE.MeshStandardMaterial({ color: 0x5f9f50, roughness: 1 })
);
grass.rotation.x = -Math.PI / 2;
grass.receiveShadow = true;
scene.add(grass);

const arena = new THREE.Mesh(
  new THREE.CylinderGeometry(95, 95, 0.3, 64),
  new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.95 })
);
arena.position.y = 0.15;
arena.receiveShadow = true;
scene.add(arena);

const structures = [];
const boosts = [];
const bumps = [];

function material(color) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.04 });
}

function addBox({ x, z, y = 0, w, h, l, yaw = 0, color = 0x6b7280 }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), material(color));
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = yaw;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  structures.push({ type: 'box', x, z, y, w, h, l, yaw });
}

function addRamp({ x, z, w = 10, l = 18, h = 5, yaw = 0, color = 0x64748b, reverse = false }) {
  const hw = w / 2;
  const hl = l / 2;
  const low = reverse ? h : 0;
  const high = reverse ? 0 : h;

  const vertices = new Float32Array([
    -hw, 0, -hl,   hw, 0, -hl,   -hw, low, hl,
     hw, 0, -hl,    hw, high, hl, -hw, low, hl,

    -hw, 0, -hl,   -hw, low, hl,  -hw, 0, hl,
    -hw, 0, hl,    -hw, low, hl,  -hw, low, hl,

     hw, 0, -hl,    hw, 0, hl,     hw, high, hl,
     hw, 0, -hl,    hw, high, hl,  hw, high, hl,

    -hw, 0, -hl,    hw, 0, hl,    hw, 0, -hl,
    -hw, 0, -hl,   -hw, 0, hl,    hw, 0, hl,

    -hw, low, hl,   hw, high, hl, -hw, 0, hl,
    -hw, 0, hl,     hw, high, hl,  hw, 0, hl
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.position.set(x, 0, z);
  mesh.rotation.y = yaw;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  structures.push({ type: 'ramp', x, z, w, l, h, yaw, reverse });
}

function addBoost({ x, z, w = 7, l = 5, yaw = 0 }) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x22d3ee,
    emissive: 0x0891b2,
    emissiveIntensity: 1.2,
    roughness: 0.45
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, l), mat);
  mesh.position.set(x, 0.38, z);
  mesh.rotation.y = yaw;
  scene.add(mesh);
  boosts.push({ x, z, w, l, yaw, mesh, cooldown: 0 });
}

function addBump(x, z, r = 1.8) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    material(0x94a3b8)
  );
  mesh.scale.y = 0.5;
  mesh.position.set(x, 0.34, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  bumps.push({ x, z, r, height: 0.9 });
}

function addCone(x, z) {
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 1.4, 14),
    material(0xf97316)
  );
  cone.position.set(x, 0.85, z);
  cone.castShadow = true;
  scene.add(cone);
}

function localPoint(x, z, obj) {
  const dx = x - obj.x;
  const dz = z - obj.z;
  const c = Math.cos(-obj.yaw);
  const s = Math.sin(-obj.yaw);
  return { x: dx * c - dz * s, z: dx * s + dz * c };
}

function worldHeight(x, z) {
  let h = 0.32;

  for (const o of structures) {
    const p = localPoint(x, z, o);
    if (Math.abs(p.x) > o.w / 2 || Math.abs(p.z) > o.l / 2) continue;

    if (o.type === 'box') {
      h = Math.max(h, o.y + o.h);
    } else {
      let t = (p.z + o.l / 2) / o.l;
      if (o.reverse) t = 1 - t;
      h = Math.max(h, Math.max(0, Math.min(o.h, t * o.h)));
    }
  }

  for (const b of bumps) {
    const d = Math.hypot(x - b.x, z - b.z);
    if (d < b.r) {
      const t = 1 - d / b.r;
      h = Math.max(h, 0.32 + Math.sin(t * Math.PI / 2) * b.height);
    }
  }
  return h;
}

// Mapa de testeo
addRamp({ x: 0, z: 20, w: 12, l: 22, h: 6, color: 0x64748b });
addBox({ x: 0, z: 39, y: 5.9, w: 14, h: 1, l: 13, color: 0x475569 });
addRamp({ x: 0, z: 57, w: 12, l: 22, h: 6, reverse: true, color: 0x64748b });

addRamp({ x: 28, z: 5, w: 11, l: 20, h: 4.5, yaw: -Math.PI / 2, color: 0x737d8c });
addRamp({ x: -28, z: 5, w: 11, l: 20, h: 4.5, yaw: Math.PI / 2, color: 0x737d8c });

addRamp({ x: 50, z: -30, w: 12, l: 24, h: 8, yaw: 0.35, color: 0x52525b });
addBox({ x: 58, z: -7, y: 7.8, w: 9, h: 1, l: 9, yaw: 0.35, color: 0x3f3f46 });

addBox({ x: -55, z: -20, y: 2.8, w: 7, h: 1, l: 36, yaw: -0.28, color: 0x334155 });
addRamp({ x: -57, z: 1, w: 9, l: 16, h: 3, yaw: -0.28, color: 0x475569 });

for (let i = 0; i < 6; i++) addBump(-38 + i * 7, -42);
for (let i = 0; i < 5; i++) addBump(-32 + i * 8, -55, 2.2);

addBoost({ x: 0, z: 7 });
addBoost({ x: 0, z: 34 });
addBoost({ x: 47, z: -38, yaw: 0.35 });
addBoost({ x: -48, z: -17, yaw: -0.28 });

for (let i = 0; i < 18; i++) {
  const a = (i / 18) * Math.PI * 2;
  addCone(Math.cos(a) * 74, Math.sin(a) * 74);
}

// Árboles alrededor del campo
const trunkMat = material(0x6b4f2f);
const leafMat = material(0x2f6f3b);
for (let i = 0; i < 42; i++) {
  const a = (i / 42) * Math.PI * 2;
  const r = 112 + (i % 3) * 7;
  const x = Math.cos(a) * r;
  const z = Math.sin(a) * r;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.5, 3, 8), trunkMat);
  trunk.position.set(x, 1.5, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(2.1, 5, 10), leafMat);
  leaves.position.set(x, 5.1, z);
  leaves.castShadow = true;
  scene.add(leaves);
}

// Auto
const car = new THREE.Group();
const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.72, 4.6), material(0xdc2626));
body.position.y = 0.9;
body.castShadow = true;
car.add(body);

const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(1.75, 0.7, 2.05),
  new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.25, metalness: 0.1 })
);
cabin.position.set(0, 1.58, -0.15);
cabin.castShadow = true;
car.add(cabin);

const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.1, 0.42), material(0x111827));
spoiler.position.set(0, 1.23, 2.05);
car.add(spoiler);

const wheels = [];
const wheelGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.4, 18);
wheelGeo.rotateZ(Math.PI / 2);
for (const [x, y, z] of [[-1, .5, 1.5], [1, .5, 1.5], [-1, .5, -1.5], [1, .5, -1.5]]) {
  const wheel = new THREE.Mesh(wheelGeo, material(0x111111));
  wheel.position.set(x, y, z);
  wheel.castShadow = true;
  car.add(wheel);
  wheels.push(wheel);
}
scene.add(car);

const keys = new Set();
const state = {
  x: 0,
  y: 1,
  z: -15,
  heading: 0,
  pitch: 0,
  roll: 0,
  speed: 0,
  vy: 0,
  grounded: true,
  airTime: 0,
  boostCount: 0
};

function reset() {
  state.x = 0;
  state.z = -15;
  state.y = worldHeight(state.x, state.z) + 0.55;
  state.heading = 0;
  state.pitch = 0;
  state.roll = 0;
  state.speed = 0;
  state.vy = 0;
  state.grounded = true;
  state.airTime = 0;
  car.position.set(state.x, state.y, state.z);
}

function setKey(code, down) {
  if (down) keys.add(code);
  else keys.delete(code);
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyR') reset();
  setKey(e.code, true);
});
window.addEventListener('keyup', (e) => setKey(e.code, false));

for (const button of document.querySelectorAll('[data-key]')) {
  const code = button.dataset.key;
  const down = (e) => { e.preventDefault(); setKey(code, true); };
  const up = (e) => { e.preventDefault(); setKey(code, false); };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('pointerleave', up);
}
resetBtn.addEventListener('click', reset);

function applyBoosts(dt) {
  for (const b of boosts) {
    b.cooldown = Math.max(0, b.cooldown - dt);
    b.mesh.material.emissiveIntensity = b.cooldown > 0 ? 2.2 : 1.2;
    const p = localPoint(state.x, state.z, b);
    if (Math.abs(p.x) < b.w / 2 && Math.abs(p.z) < b.l / 2 && b.cooldown === 0) {
      state.speed = Math.min(52, state.speed + 18);
      state.boostCount++;
      boostsEl.textContent = state.boostCount;
      b.cooldown = 0.7;
    }
  }
}

function updateCar(dt) {
  const forward = keys.has('KeyW') || keys.has('ArrowUp');
  const back = keys.has('KeyS') || keys.has('ArrowDown');
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');
  const braking = keys.has('Space');

  if (forward) state.speed += 23 * dt;
  if (back) state.speed -= 13 * dt;
  if (!forward && !back) {
    const drag = 5.5 * dt;
    state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), drag);
  }
  if (braking) {
    const brake = 30 * dt;
    state.speed -= Math.sign(state.speed) * Math.min(Math.abs(state.speed), brake);
  }
  state.speed = THREE.MathUtils.clamp(state.speed, -16, 45);

  const steer = (left ? 1 : 0) - (right ? 1 : 0);
  const steerAmount = 1.8 * Math.min(1, Math.abs(state.speed) / 10) * (state.grounded ? 1 : 0.35);
  state.heading += steer * steerAmount * dt * (state.speed >= 0 ? 1 : -1);

  state.x += Math.sin(state.heading) * state.speed * dt;
  state.z += Math.cos(state.heading) * state.speed * dt;
  applyBoosts(dt);

  const floor = worldHeight(state.x, state.z) + 0.55;
  const ahead = worldHeight(state.x + Math.sin(state.heading) * 1.4, state.z + Math.cos(state.heading) * 1.4) + 0.55;
  const behind = worldHeight(state.x - Math.sin(state.heading) * 1.4, state.z - Math.cos(state.heading) * 1.4) + 0.55;

  const slope = Math.atan2(ahead - behind, 2.8);

  if (state.grounded) {
    state.y = floor;
    state.pitch += (slope - state.pitch) * Math.min(1, dt * 10);

    // Si deja una rampa a velocidad suficiente, despega.
    if (floor < state.y - 0.35 || Math.abs(slope) > 0.11 && worldHeight(
      state.x + Math.sin(state.heading) * 2.4,
      state.z + Math.cos(state.heading) * 2.4
    ) + 0.55 < state.y - 0.45) {
      state.grounded = false;
      state.vy = Math.max(2.5, Math.abs(state.speed) * Math.max(0, Math.sin(Math.abs(state.pitch))) * 0.55);
    }
  } else {
    state.vy -= 18 * dt;
    state.y += state.vy * dt;
    state.airTime += dt;
    state.pitch += (-state.vy * 0.025 - state.pitch) * Math.min(1, dt * 2.4);

    if (state.y <= floor && state.vy <= 0) {
      state.y = floor;
      state.vy = 0;
      state.grounded = true;
      state.airTime = 0;
    }
  }

  const lateral = steer * Math.min(0.16, Math.abs(state.speed) * 0.004);
  state.roll += (lateral - state.roll) * Math.min(1, dt * 7);

  if (Math.hypot(state.x, state.z) > 150 || state.y < -15) reset();

  car.position.set(state.x, state.y, state.z);
  car.rotation.set(state.pitch, state.heading, state.roll, 'XYZ');
  for (const wheel of wheels) wheel.rotation.x -= state.speed * dt * 1.8;

  speedEl.textContent = Math.round(Math.abs(state.speed) * 6);
  airEl.textContent = state.airTime.toFixed(1);
}

function updateCamera(dt) {
  const distance = 9.5 + Math.min(4, Math.abs(state.speed) * 0.08);
  const desired = new THREE.Vector3(
    state.x - Math.sin(state.heading) * distance,
    state.y + 5.2,
    state.z - Math.cos(state.heading) * distance
  );
  const t = 1 - Math.pow(0.001, dt);
  camera.position.lerp(desired, t);
  camera.lookAt(
    state.x + Math.sin(state.heading) * 4,
    state.y + 1.1,
    state.z + Math.cos(state.heading) * 4
  );
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
reset();
loading.remove();

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.035);
  last = now;
  updateCar(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
