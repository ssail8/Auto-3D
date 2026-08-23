import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';

const canvas = document.querySelector('#game');
const speedEl = document.querySelector('#speed');
const gearEl = document.querySelector('#gear');
const damageEl = document.querySelector('#damage');
const gforceEl = document.querySelector('#gforce');
const airEl = document.querySelector('#air');
const loading = document.querySelector('#loading');
const resetBtn = document.querySelector('#resetBtn');
const cameraBtn = document.querySelector('#cameraBtn');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const deg = THREE.MathUtils.degToRad;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ecbf0);
scene.fog = new THREE.Fog(0x9ecbf0, 150, 420);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 800);

scene.add(new THREE.HemisphereLight(0xffffff, 0x6b7a55, 1.9));
const sun = new THREE.DirectionalLight(0xfff4df, 3.1);
sun.position.set(90, 120, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -150;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 350;
scene.add(sun);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.45;
world.defaultContactMaterial.restitution = 0.03;
world.defaultContactMaterial.contactEquationStiffness = 1e8;
world.defaultContactMaterial.contactEquationRelaxation = 3;

const asphaltPhysics = new CANNON.Material('asphalt');
const chassisPhysics = new CANNON.Material('chassis');
const concretePhysics = new CANNON.Material('concrete');

world.addContactMaterial(new CANNON.ContactMaterial(chassisPhysics, asphaltPhysics, {
  friction: 0.55,
  restitution: 0.02,
  contactEquationStiffness: 1e8
}));
world.addContactMaterial(new CANNON.ContactMaterial(chassisPhysics, concretePhysics, {
  friction: 0.5,
  restitution: 0.04,
  contactEquationStiffness: 1e8
}));

const dynamicObjects = [];
const staticBodies = [];
const keys = new Set();

function mat(color, roughness = 0.78, metalness = 0.05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x50565e, roughness: 0.96 });
const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.92 });

const grass = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), mat(0x5c9a52, 1));
grass.rotation.x = -Math.PI / 2;
grass.position.y = -0.035;
grass.receiveShadow = true;
scene.add(grass);

const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(270, 270), asphaltMat);
asphalt.rotation.x = -Math.PI / 2;
asphalt.position.y = 0;
asphalt.receiveShadow = true;
scene.add(asphalt);

const groundBody = new CANNON.Body({ mass: 0, material: asphaltPhysics });
groundBody.addShape(new CANNON.Plane());
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

function threeQuaternion(pitch = 0, yaw = 0, roll = 0) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));
}

function addStaticBox({ x = 0, y = 0, z = 0, w = 2, h = 1, l = 2, pitch = 0, yaw = 0, roll = 0, material = concreteMat }) {
  const q = threeQuaternion(pitch, yaw, roll);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), material);
  mesh.position.set(x, y, z);
  mesh.quaternion.copy(q);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const body = new CANNON.Body({ mass: 0, material: concretePhysics });
  body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, l / 2)));
  body.position.set(x, y, z);
  body.quaternion.set(q.x, q.y, q.z, q.w);
  world.addBody(body);
  staticBodies.push(body);
  return { mesh, body };
}

function addRamp({ x, z, width = 11, length = 22, angle = deg(14), yaw = 0, thickness = 0.65, color = 0x747b84 }) {
  const y = Math.abs(Math.sin(angle)) * length / 2 + Math.abs(Math.cos(angle)) * thickness / 2 + 0.015;
  const rampMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.12 });
  return addStaticBox({ x, y, z, w: width, h: thickness, l: length, pitch: angle, yaw, material: rampMaterial });
}

function addPlatform({ x, z, y, w, l, h = 0.8, color = 0x666d75 }) {
  return addStaticBox({
    x, y: y - h / 2, z, w, h, l,
    material: new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.08 })
  });
}

function addBump(x, z, radius = 1.15, visibleHeight = 0.38) {
  const centerY = visibleHeight - radius;
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 12), concreteMat);
  mesh.position.set(x, centerY, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const body = new CANNON.Body({ mass: 0, material: concretePhysics });
  body.addShape(new CANNON.Sphere(radius));
  body.position.set(x, centerY, z);
  world.addBody(body);
  staticBodies.push(body);
}

function addSpeedBump(x, z, w = 5.8, h = 0.18, l = 0.7, yaw = 0) {
  addStaticBox({
    x, y: h / 2, z, w, h, l, yaw,
    material: new THREE.MeshStandardMaterial({ color: 0xd5a527, roughness: 0.8 })
  });
}

function addDynamicBox({ x, y, z, size = 1.2, mass = 14, color = 0xb9803f }) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat(color, 0.82));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const body = new CANNON.Body({
    mass,
    material: concretePhysics,
    shape: new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2)),
    position: new CANNON.Vec3(x, y, z)
  });
  body.linearDamping = 0.16;
  body.angularDamping = 0.14;
  body.allowSleep = true;
  world.addBody(body);
  dynamicObjects.push({ mesh, body });
  return body;
}

function addCone(x, z) {
  const height = 0.9;
  const mesh = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.08, 14), mat(0x222222, 0.85));
  base.position.y = 0.04;
  mesh.add(base);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.28, height, 16), mat(0xf97316, 0.75));
  cone.position.y = 0.5;
  mesh.add(cone);
  scene.add(mesh);

  const body = new CANNON.Body({ mass: 1.7, material: concretePhysics });
  body.addShape(new CANNON.Box(new CANNON.Vec3(0.34, 0.45, 0.34)));
  body.position.set(x, 0.46, z);
  body.linearDamping = 0.25;
  body.angularDamping = 0.2;
  world.addBody(body);
  dynamicObjects.push({ mesh, body });
}

function addBarrel(x, z) {
  const radius = 0.43, height = 1.15;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 18),
    new THREE.MeshStandardMaterial({ color: 0x335f8c, roughness: 0.58, metalness: 0.35 })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const body = new CANNON.Body({
    mass: 24,
    material: concretePhysics,
    shape: new CANNON.Cylinder(radius, radius, height, 16),
    position: new CANNON.Vec3(x, height / 2, z)
  });
  body.linearDamping = 0.08;
  body.angularDamping = 0.08;
  world.addBody(body);
  dynamicObjects.push({ mesh, body });
}

function addLine(x, z, w, l, color = 0xffffff, yaw = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.018, l), new THREE.MeshBasicMaterial({ color }));
  mesh.position.set(x, 0.018, z);
  mesh.rotation.y = yaw;
  scene.add(mesh);
}

function addLabel(text, x, y, z, scale = 7) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(10,18,28,.82)';
  ctx.fillRect(0, 12, 512, 104);
  ctx.strokeStyle = 'rgba(255,255,255,.9)';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 16, 504, 96);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 46px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
  sprite.position.set(x, y, z);
  sprite.scale.set(scale * 2.8, scale * 0.7, 1);
  scene.add(sprite);
}

function addTree(x, z, s = 1) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * s, 0.38 * s, 2.5 * s, 8), mat(0x6b4b2a, 1));
  trunk.position.set(x, 1.25 * s, z);
  trunk.castShadow = true;
  scene.add(trunk);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.5 * s, 4.2 * s, 10), mat(0x2f6f3a, 1));
  crown.position.set(x, 4.1 * s, z);
  crown.castShadow = true;
  scene.add(crown);
}

addStaticBox({ x: 0, y: 1.1, z: -134, w: 270, h: 2.2, l: 1.2 });
addStaticBox({ x: 0, y: 1.1, z: 134, w: 270, h: 2.2, l: 1.2 });
addStaticBox({ x: -134, y: 1.1, z: 0, w: 1.2, h: 2.2, l: 270 });
addStaticBox({ x: 134, y: 1.1, z: 0, w: 1.2, h: 2.2, l: 270 });

addLine(0, 18, 0.18, 205, 0xf5f5f5);
for (let z = 105; z > -105; z -= 10) {
  addLine(-7.5, z, 0.1, 4.5, 0xcbd5e1);
  addLine(7.5, z, 0.1, 4.5, 0xcbd5e1);
}

addRamp({ x: 0, z: 28, width: 11, length: 23, angle: deg(15), color: 0x69717b });
addPlatform({ x: 0, z: 10, y: 5.8, w: 11, l: 11, h: 0.75 });
addRamp({ x: 0, z: -8, width: 11, length: 23, angle: deg(-15), color: 0x69717b });
addLabel('SALTO PRINCIPAL', 0, 8.5, 16, 5.6);

addStaticBox({
  x: 0, y: 1.4, z: -103, w: 22, h: 2.8, l: 2.4,
  material: new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.94 })
});
addStaticBox({ x: -11.5, y: 0.7, z: -76, w: 0.5, h: 1.4, l: 54, material: concreteMat });
addStaticBox({ x: 11.5, y: 0.7, z: -76, w: 0.5, h: 1.4, l: 54, material: concreteMat });
addLabel('PRUEBA DE CHOQUE', 0, 5.5, -98, 5.5);
for (let row = 0; row < 3; row++) {
  for (let col = -2; col <= 2; col++) {
    addDynamicBox({ x: col * 1.35, y: 0.62 + row * 1.25, z: -82, size: 1.15, mass: 10 });
  }
}

addLabel('SUSPENSIÓN', -34, 6, 72, 4.6);
for (let i = 0; i < 12; i++) {
  addBump(-37 + (i % 2) * 5.5, 60 - i * 7.0, 1.22, 0.38 + (i % 3) * 0.09);
}
for (let i = 0; i < 8; i++) addSpeedBump(-34, -27 - i * 3.2, 7.2, 0.14 + (i % 2) * 0.08, 0.65);
addLine(-34, 14, 7.5, 102, 0xd9dee3);

addLabel('PENDIENTE 24°', 39, 8.5, 57, 4.8);
addRamp({ x: 39, z: 42, width: 11, length: 26, angle: deg(24), color: 0x626b75 });
addPlatform({ x: 39, z: 20, y: 10.9, w: 12, l: 18, h: 0.85 });
addRamp({ x: 39, z: -2, width: 11, length: 26, angle: deg(-24), color: 0x626b75 });

addLabel('ARTICULACIÓN', 73, 6, 68, 4.6);
for (let i = 0; i < 7; i++) {
  const angle = i % 2 === 0 ? deg(8) : deg(-8);
  addRamp({ x: 73, z: 52 - i * 10.5, width: 9, length: 10, angle, thickness: 0.48, color: 0x707981 });
}

addLabel('SLALOM', -74, 5.5, 62, 4.4);
for (let i = 0; i < 13; i++) addCone(-74 + (i % 2 ? 3.2 : -3.2), 50 - i * 8);
addLine(-74, 1, 9, 116, 0xd9dee3);

addLabel('IMPACTO LATERAL', 78, 5.5, -45, 4.6);
for (let i = 0; i < 12; i++) addBarrel(72 + (i % 4) * 2.0, -55 - Math.floor(i / 4) * 2.0);
addStaticBox({ x: 91, y: 1.0, z: -59, w: 2.0, h: 2.0, l: 26, yaw: deg(18), material: concreteMat });

addRamp({ x: -69, z: -72, width: 8, length: 13, angle: deg(18), yaw: deg(12), color: 0x59636e });
addRamp({ x: 68, z: 91, width: 9, length: 16, angle: deg(20), yaw: deg(-20), color: 0x59636e });

for (let i = 0; i < 58; i++) {
  const a = (i / 58) * Math.PI * 2;
  const r = 155 + (i % 4) * 7;
  addTree(Math.cos(a) * r, Math.sin(a) * r, 0.9 + (i % 3) * 0.12);
}

const chassisBody = new CANNON.Body({
  mass: 1280,
  material: chassisPhysics,
  angularDamping: 0.36,
  linearDamping: 0.015
});
chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(0.96, 0.31, 2.06)), new CANNON.Vec3(0, -0.05, 0));
chassisBody.position.set(0, 1.15, 92);

const vehicle = new CANNON.RaycastVehicle({
  chassisBody,
  indexRightAxis: 0,
  indexUpAxis: 1,
  indexForwardAxis: 2
});

const wheelOptions = {
  radius: 0.39,
  directionLocal: new CANNON.Vec3(0, -1, 0),
  suspensionStiffness: 42,
  suspensionRestLength: 0.31,
  frictionSlip: 4.8,
  dampingRelaxation: 2.5,
  dampingCompression: 4.6,
  maxSuspensionForce: 90000,
  rollInfluence: 0.045,
  axleLocal: new CANNON.Vec3(-1, 0, 0),
  chassisConnectionPointLocal: new CANNON.Vec3(0, -0.02, 0),
  maxSuspensionTravel: 0.24,
  customSlidingRotationalSpeed: -28,
  useCustomSlidingRotationalSpeed: true
};

const wheelPoints = [
  [-0.86, -0.03, -1.38],
  [0.86, -0.03, -1.38],
  [-0.86, -0.03, 1.36],
  [0.86, -0.03, 1.36]
];
for (const p of wheelPoints) {
  vehicle.addWheel({ ...wheelOptions, chassisConnectionPointLocal: new CANNON.Vec3(p[0], p[1], p[2]) });
}
vehicle.addToWorld(world);

const carVisual = new THREE.Group();
scene.add(carVisual);

const paint = new THREE.MeshStandardMaterial({ color: 0xb7192b, roughness: 0.32, metalness: 0.36 });
const paintDark = new THREE.MeshStandardMaterial({ color: 0x7e101d, roughness: 0.38, metalness: 0.34 });
const black = new THREE.MeshStandardMaterial({ color: 0x101318, roughness: 0.62, metalness: 0.15 });
const glass = new THREE.MeshStandardMaterial({ color: 0x6da6c8, roughness: 0.15, metalness: 0.18, transparent: true, opacity: 0.82 });
const chrome = new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.28, metalness: 0.8 });
const lightWhite = new THREE.MeshStandardMaterial({ color: 0xf3f7ff, emissive: 0xc6e2ff, emissiveIntensity: 1.6 });
const lightRed = new THREE.MeshStandardMaterial({ color: 0xb91c1c, emissive: 0x7f1d1d, emissiveIntensity: 1.4 });

function carBox(name, size, position, material, group = carVisual) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

const lowerBody = carBox('lowerBody', [1.98, 0.48, 4.22], [0, -0.02, 0], paint);
const sillL = carBox('sillL', [0.16, 0.25, 3.25], [-1.0, -0.12, 0.05], paintDark);
const sillR = carBox('sillR', [0.16, 0.25, 3.25], [1.0, -0.12, 0.05], paintDark);
const hood = carBox('hood', [1.84, 0.18, 1.35], [0, 0.30, -1.32], paint);
const trunk = carBox('trunk', [1.78, 0.18, 0.95], [0, 0.30, 1.55], paint);
const roof = carBox('roof', [1.58, 0.16, 1.45], [0, 1.03, 0.12], paint);
const cabinCore = carBox('cabin', [1.66, 0.75, 1.72], [0, 0.66, 0.12], glass);
const frontBumper = carBox('frontBumper', [1.92, 0.20, 0.22], [0, -0.05, -2.18], black);
const rearBumper = carBox('rearBumper', [1.92, 0.20, 0.22], [0, -0.05, 2.18], black);

for (const x of [-0.62, 0.62]) {
  carBox('headlight', [0.42, 0.16, 0.08], [x, 0.24, -2.14], lightWhite);
  carBox('tailLight', [0.42, 0.16, 0.08], [x, 0.24, 2.14], lightRed);
}
carBox('grille', [0.86, 0.16, 0.07], [0, -0.02, -2.15], chrome);
const mirrorL = carBox('mirrorL', [0.22, 0.12, 0.28], [-1.03, 0.69, -0.42], black);
const mirrorR = carBox('mirrorR', [0.22, 0.12, 0.28], [1.03, 0.69, -0.42], black);

const wheelMeshes = [];
const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.35, metalness: 0.72 });
for (let i = 0; i < 4; i++) {
  const group = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.28, 24);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  group.add(tire);
  const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.295, 18);
  rimGeo.rotateZ(Math.PI / 2);
  group.add(new THREE.Mesh(rimGeo, rimMat));
  scene.add(group);
  wheelMeshes.push(group);
}

const damageState = { front: 0, rear: 0, left: 0, right: 0, total: 0, lastImpact: 0 };
let cameraShake = 0;
let airTime = 0;
let cameraMode = 0;

function applyVisualDamage() {
  const f = damageState.front;
  const r = damageState.rear;
  const l = damageState.left;
  const rr = damageState.right;
  frontBumper.scale.z = 1 - f * 0.70;
  frontBumper.position.z = -2.18 + f * 0.16;
  hood.scale.z = 1 - f * 0.24;
  hood.position.z = -1.32 + f * 0.20;
  hood.rotation.x = -f * 0.09;
  rearBumper.scale.z = 1 - r * 0.68;
  rearBumper.position.z = 2.18 - r * 0.16;
  trunk.scale.z = 1 - r * 0.22;
  trunk.position.z = 1.55 - r * 0.17;
  trunk.rotation.x = r * 0.07;
  sillL.position.x = -1.0 + l * 0.12;
  sillL.scale.x = 1 - l * 0.36;
  sillR.position.x = 1.0 - rr * 0.12;
  sillR.scale.x = 1 - rr * 0.36;
  lowerBody.scale.x = 1 - Math.max(l, rr) * 0.055;
  cabinCore.rotation.z = (l - rr) * 0.035;
  roof.rotation.z = (l - rr) * 0.022;
  mirrorL.rotation.z = l * 0.45;
  mirrorR.rotation.z = -rr * 0.45;
}

chassisBody.addEventListener('collide', (event) => {
  const contact = event.contact;
  const impact = Math.abs(contact.getImpactVelocityAlongNormal());
  if (impact < 2.6) return;
  damageState.lastImpact = impact;
  const severity = clamp((impact - 2.5) / 17, 0, 1);
  damageState.total = clamp(damageState.total + severity * 18, 0, 100);
  cameraShake = Math.max(cameraShake, severity * 0.42);

  const rel = contact.bi === chassisBody ? contact.ri : contact.rj;
  const invQ = new CANNON.Quaternion();
  chassisBody.quaternion.conjugate(invQ);
  const local = new CANNON.Vec3();
  invQ.vmult(rel, local);

  if (Math.abs(local.z) > Math.abs(local.x)) {
    if (local.z < 0) damageState.front = clamp(damageState.front + severity * 0.7, 0, 1);
    else damageState.rear = clamp(damageState.rear + severity * 0.7, 0, 1);
  } else {
    if (local.x < 0) damageState.left = clamp(damageState.left + severity * 0.65, 0, 1);
    else damageState.right = clamp(damageState.right + severity * 0.65, 0, 1);
  }
  applyVisualDamage();
});

function resetCar() {
  chassisBody.position.set(0, 1.25, 92);
  chassisBody.quaternion.setFromEuler(0, 0, 0);
  chassisBody.velocity.setZero();
  chassisBody.angularVelocity.setZero();
  chassisBody.force.setZero();
  chassisBody.torque.setZero();
  damageState.front = 0;
  damageState.rear = 0;
  damageState.left = 0;
  damageState.right = 0;
  damageState.total = 0;
  damageState.lastImpact = 0;
  cameraShake = 0;
  airTime = 0;
  applyVisualDamage();
  vehicle.setSteeringValue(0, 0);
  vehicle.setSteeringValue(0, 1);
  for (let i = 0; i < 4; i++) {
    vehicle.applyEngineForce(0, i);
    vehicle.setBrake(0, i);
  }
}

function setKey(code, down) {
  if (down) keys.add(code);
  else keys.delete(code);
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyR') resetCar();
  if (e.code === 'KeyC' && !e.repeat) {
    cameraMode = (cameraMode + 1) % 3;
    cameraBtn.textContent = `Cámara ${cameraMode + 1}`;
  }
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
resetBtn.addEventListener('click', resetCar);
cameraBtn.addEventListener('click', () => {
  cameraMode = (cameraMode + 1) % 3;
  cameraBtn.textContent = `Cámara ${cameraMode + 1}`;
});

function driveVehicle(dt) {
  const throttle = keys.has('KeyW') || keys.has('ArrowUp');
  const reverse = keys.has('KeyS') || keys.has('ArrowDown');
  const left = keys.has('KeyA') || keys.has('ArrowLeft');
  const right = keys.has('KeyD') || keys.has('ArrowRight');
  const brake = keys.has('Space');
  const handbrake = keys.has('ShiftLeft') || keys.has('ShiftRight');

  const velocity = chassisBody.velocity.length();
  const speedKmh = velocity * 3.6;
  const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
  const steerMax = lerp(0.50, 0.16, clamp(speedKmh / 150, 0, 1));
  const steering = steerInput * steerMax;
  vehicle.setSteeringValue(steering, 0);
  vehicle.setSteeringValue(steering, 1);

  let engineForce = 0;
  if (throttle) {
    const torqueFade = lerp(1, 0.16, clamp(speedKmh / 190, 0, 1));
    engineForce = -4300 * torqueFade;
  } else if (reverse) {
    engineForce = 2200 * lerp(1, 0.25, clamp(speedKmh / 55, 0, 1));
  }

  vehicle.applyEngineForce(0, 0);
  vehicle.applyEngineForce(0, 1);
  vehicle.applyEngineForce(engineForce, 2);
  vehicle.applyEngineForce(engineForce, 3);

  const serviceBrake = brake ? 62 : 0;
  vehicle.setBrake(serviceBrake, 0);
  vehicle.setBrake(serviceBrake, 1);
  vehicle.setBrake(brake ? 48 : 0, 2);
  vehicle.setBrake(brake ? 48 : 0, 3);
  if (handbrake) {
    vehicle.setBrake(95, 2);
    vehicle.setBrake(95, 3);
  }

  if (velocity > 0.2) {
    const dragCoefficientArea = 0.72;
    const dragMag = Math.min(9000, 0.5 * 1.225 * dragCoefficientArea * velocity * velocity);
    const drag = chassisBody.velocity.clone();
    drag.normalize();
    drag.scale(-dragMag, drag);
    chassisBody.applyForce(drag, chassisBody.position);
    const downforce = Math.min(7500, velocity * velocity * 2.1);
    chassisBody.applyForce(new CANNON.Vec3(0, -downforce, 0), chassisBody.position);
  }

  if (speedKmh > 70 && Math.abs(steerInput) < 0.1) chassisBody.angularVelocity.y *= Math.pow(0.992, dt * 60);
}

function syncVisuals() {
  carVisual.position.copy(chassisBody.position);
  carVisual.quaternion.copy(chassisBody.quaternion);
  for (let i = 0; i < vehicle.wheelInfos.length; i++) {
    vehicle.updateWheelTransform(i);
    const t = vehicle.wheelInfos[i].worldTransform;
    wheelMeshes[i].position.copy(t.position);
    wheelMeshes[i].quaternion.copy(t.quaternion);
  }
  for (const item of dynamicObjects) {
    item.mesh.position.copy(item.body.position);
    item.mesh.quaternion.copy(item.body.quaternion);
  }
}

const cameraPos = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const tmpForward = new CANNON.Vec3();
const tmpBack = new CANNON.Vec3();
const localForward = new CANNON.Vec3(0, 0, -1);
const localBack = new CANNON.Vec3(0, 0, 1);

function updateCamera(dt) {
  chassisBody.quaternion.vmult(localForward, tmpForward);
  chassisBody.quaternion.vmult(localBack, tmpBack);
  const p = chassisBody.position;
  const speed = chassisBody.velocity.length();

  if (cameraMode === 0) {
    cameraPos.set(p.x + tmpBack.x * (7.4 + speed * 0.035), p.y + 3.0 + speed * 0.018, p.z + tmpBack.z * (7.4 + speed * 0.035));
    cameraTarget.set(p.x + tmpForward.x * 6.0, p.y + 0.75, p.z + tmpForward.z * 6.0);
  } else if (cameraMode === 1) {
    cameraPos.set(p.x + tmpForward.x * 0.62, p.y + 0.92, p.z + tmpForward.z * 0.62);
    cameraTarget.set(p.x + tmpForward.x * 16, p.y + 0.55, p.z + tmpForward.z * 16);
  } else {
    cameraPos.set(p.x + tmpBack.x * 11.5 + 6.0, p.y + 8.5, p.z + tmpBack.z * 11.5 + 4.0);
    cameraTarget.set(p.x, p.y + 0.4, p.z);
  }

  if (cameraShake > 0.001) {
    const amount = cameraShake * 0.45;
    cameraPos.x += (Math.random() - 0.5) * amount;
    cameraPos.y += (Math.random() - 0.5) * amount;
    cameraPos.z += (Math.random() - 0.5) * amount;
    cameraShake *= Math.pow(0.035, dt);
  }

  const smoothing = 1 - Math.pow(0.0007, dt);
  camera.position.lerp(cameraPos, smoothing);
  camera.lookAt(cameraTarget);
}

function currentGear(speedKmh, forwardInput, reverseInput) {
  if (reverseInput && speedKmh < 16) return 'R';
  if (!forwardInput && !reverseInput && speedKmh < 2) return 'N';
  if (speedKmh < 28) return '1';
  if (speedKmh < 52) return '2';
  if (speedKmh < 82) return '3';
  if (speedKmh < 118) return '4';
  if (speedKmh < 158) return '5';
  return '6';
}

const lastVelocity = new CANNON.Vec3();
function updateHud(dt) {
  const speedKmh = chassisBody.velocity.length() * 3.6;
  const forwardInput = keys.has('KeyW') || keys.has('ArrowUp');
  const reverseInput = keys.has('KeyS') || keys.has('ArrowDown');
  let groundedWheels = 0;
  for (const info of vehicle.wheelInfos) if (info.isInContact) groundedWheels++;
  if (groundedWheels === 0) airTime += dt;
  else airTime = 0;

  const dv = new CANNON.Vec3(
    chassisBody.velocity.x - lastVelocity.x,
    chassisBody.velocity.y - lastVelocity.y,
    chassisBody.velocity.z - lastVelocity.z
  );
  const gforce = clamp(dv.length() / Math.max(dt, 0.001) / 9.82, 0, 9.9);
  lastVelocity.copy(chassisBody.velocity);

  speedEl.textContent = Math.round(speedKmh);
  gearEl.textContent = currentGear(speedKmh, forwardInput, reverseInput);
  damageEl.textContent = `${Math.round(damageState.total)}%`;
  gforceEl.textContent = `${gforce.toFixed(1)} g`;
  airEl.textContent = `${airTime.toFixed(1)} s`;
  damageEl.classList.toggle('danger', damageState.total > 60);
}

function resize() {
  const w = Math.max(320, window.innerWidth);
  const h = Math.max(320, window.innerHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

resetCar();
loading.classList.add('hidden');

let last = performance.now();
const fixedStep = 1 / 60;
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  driveVehicle(dt);
  world.step(fixedStep, dt, 4);
  syncVisuals();
  updateCamera(dt);
  updateHud(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
