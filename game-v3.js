import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/+esm';
import * as CANNON from 'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/+esm';
import { buildProvingGround } from './map-v3.js';
import { createVehicle } from './vehicle-v3.js';

const canvas = document.querySelector('#game');
const speedEl = document.querySelector('#speed');
const gearEl = document.querySelector('#gear');
const damageEl = document.querySelector('#damage');
const nitroEl = document.querySelector('#nitro');
const conditionEl = document.querySelector('#condition');
const gforceEl = document.querySelector('#gforce');
const airEl = document.querySelector('#air');
const loading = document.querySelector('#loading');
const startScreen = document.querySelector('#startScreen');
const startBtn = document.querySelector('#startBtn');
const wreckNotice = document.querySelector('#wreckNotice');
const resetBtn = document.querySelector('#resetBtn');
const cameraBtn = document.querySelector('#cameraBtn');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa8c97a);
scene.fog = new THREE.Fog(0xa8c97a, 155, 430);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 850);
scene.add(new THREE.HemisphereLight(0xfffffa, 0x60754a, 1.9));
const sun = new THREE.DirectionalLight(0xfff3d9, 2.9);
sun.position.set(90, 120, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -155;
sun.shadow.camera.right = 155;
sun.shadow.camera.top = 155;
sun.shadow.camera.bottom = -155;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 360;
scene.add(sun);

const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;
world.defaultContactMaterial.friction = 0.44;
world.defaultContactMaterial.restitution = 0.025;
world.defaultContactMaterial.contactEquationStiffness = 1e8;
world.defaultContactMaterial.contactEquationRelaxation = 3;

const asphaltPhysics = new CANNON.Material('asphalt');
const concretePhysics = new CANNON.Material('concrete');
const chassisPhysics = new CANNON.Material('chassis');
const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x50565e, roughness: 0.96 });
const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 0.92 });

world.addContactMaterial(new CANNON.ContactMaterial(chassisPhysics, asphaltPhysics, {
  friction: 0.56,
  restitution: 0.018,
  contactEquationStiffness: 1e8,
  contactEquationRelaxation: 3
}));
world.addContactMaterial(new CANNON.ContactMaterial(chassisPhysics, concretePhysics, {
  friction: 0.52,
  restitution: 0.035,
  contactEquationStiffness: 1e8,
  contactEquationRelaxation: 3
}));

const materials = { asphaltPhysics, concretePhysics, chassisPhysics, asphaltMat, concreteMat };
const map = buildProvingGround({ THREE, CANNON, scene, world, materials });
const car = createVehicle({ THREE, CANNON, scene, world, materials, spawn: map.spawn });

const keys = new Set();
let cameraMode = 0;
let airTime = 0;
let started = false;
let lastVelocity = car.chassisBody.velocity.clone();
let cameraOrbitYaw = 0;
let cameraOrbitPitch = 0.18;
let cameraDragId = null;
let cameraDragX = 0;
let cameraDragY = 0;
let nitroFlashUntil = 0;

function setKey(code, down) {
  if (down) keys.add(code);
  else keys.delete(code);
}

function applyNitroBurst() {
  if (!started || car.exploded) return;

  // Instant arcade-style burst: +60 km/h (= 16.666... m/s) along the Cotorrino's
  // current forward direction. This adds to the existing velocity, so pressing
  // nitro at 80 km/h produces roughly 140 km/h immediately.
  const forward = new CANNON.Vec3(0, 0, -1);
  const forwardWorld = new CANNON.Vec3();
  car.chassisBody.quaternion.vmult(forward, forwardWorld);
  const boostMps = 60 / 3.6;
  car.chassisBody.velocity.x += forwardWorld.x * boostMps;
  car.chassisBody.velocity.y += forwardWorld.y * boostMps;
  car.chassisBody.velocity.z += forwardWorld.z * boostMps;
  car.chassisBody.wakeUp();
  nitroFlashUntil = performance.now() + 450;
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!started && e.code !== 'Enter' && e.code !== 'Space') return;
  if (e.code === 'KeyR' && !e.repeat) resetSimulation();
  if (e.code === 'KeyC' && !e.repeat) nextCamera();
  if (e.code === 'KeyN' && !e.repeat) applyNitroBurst();
  setKey(e.code, true);
});
window.addEventListener('keyup', (e) => setKey(e.code, false));
window.addEventListener('blur', () => {
  keys.clear();
  cameraDragId = null;
});

for (const button of document.querySelectorAll('[data-key]')) {
  const code = button.dataset.key;
  const down = (e) => {
    if (!started) return;
    e.preventDefault();
    if (code === 'KeyN') applyNitroBurst();
    setKey(code, true);
    button.setPointerCapture?.(e.pointerId);
  };
  const up = (e) => { e.preventDefault(); setKey(code, false); };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('lostpointercapture', up);
}

canvas.addEventListener('pointerdown', (e) => {
  if (!started) return;
  cameraDragId = e.pointerId;
  cameraDragX = e.clientX;
  cameraDragY = e.clientY;
  canvas.setPointerCapture?.(e.pointerId);
  e.preventDefault();
});

canvas.addEventListener('pointermove', (e) => {
  if (!started || e.pointerId !== cameraDragId) return;
  const dx = e.clientX - cameraDragX;
  const dy = e.clientY - cameraDragY;
  cameraDragX = e.clientX;
  cameraDragY = e.clientY;
  const yawSensitivity = e.pointerType === 'touch' ? 0.0062 : 0.0048;
  const pitchSensitivity = e.pointerType === 'touch' ? 0.0050 : 0.0038;
  cameraOrbitYaw -= dx * yawSensitivity;
  cameraOrbitPitch = clamp(cameraOrbitPitch - dy * pitchSensitivity, -0.18, 0.78);
  e.preventDefault();
});

function endCameraDrag(e) {
  if (e.pointerId !== cameraDragId) return;
  cameraDragId = null;
  try { canvas.releasePointerCapture?.(e.pointerId); } catch {}
  e.preventDefault();
}

canvas.addEventListener('pointerup', endCameraDrag);
canvas.addEventListener('pointercancel', endCameraDrag);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function inputState() {
  if (!started) {
    return { throttle: false, reverse: false, left: false, right: false, brake: false, handbrake: false, nitro: false };
  }
  return {
    throttle: keys.has('KeyW') || keys.has('ArrowUp'),
    reverse: keys.has('KeyS') || keys.has('ArrowDown'),
    left: keys.has('KeyA') || keys.has('ArrowLeft'),
    right: keys.has('KeyD') || keys.has('ArrowRight'),
    brake: keys.has('Space'),
    handbrake: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    nitro: keys.has('KeyN')
  };
}

function nextCamera() {
  cameraMode = (cameraMode + 1) % 3;
  cameraBtn.textContent = `Cámara ${cameraMode + 1}`;
}

function resetSimulation() {
  keys.clear();
  car.reset();
  airTime = 0;
  nitroFlashUntil = 0;
  lastVelocity.copy(car.chassisBody.velocity);
  cameraInitialized = false;
  wreckNotice.classList.add('hidden');
}

function startGame() {
  started = true;
  keys.clear();
  cameraOrbitYaw = 0;
  cameraOrbitPitch = 0.18;
  resetSimulation();
  startScreen.classList.add('hidden');
}

startBtn.addEventListener('click', startGame);
resetBtn.addEventListener('click', resetSimulation);
cameraBtn.addEventListener('click', nextCamera);

const cameraDesired = new THREE.Vector3();
const cameraTargetDesired = new THREE.Vector3();
const cameraTargetSmooth = new THREE.Vector3();
const bodyQ = new THREE.Quaternion();
const bodyP = new THREE.Vector3();
const forward3 = new THREE.Vector3();
const right3 = new THREE.Vector3();
const orbitDirection = new THREE.Vector3();
let cameraInitialized = false;

function syncBodyBasis() {
  const b = car.chassisBody;
  bodyQ.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  bodyP.set(b.position.x, b.position.y, b.position.z);
  forward3.set(0, 0, -1).applyQuaternion(bodyQ);
  right3.set(1, 0, 0).applyQuaternion(bodyQ);
}

function localPoint(x, y, z) {
  return new THREE.Vector3(x, y, z).applyQuaternion(bodyQ).add(bodyP);
}

function setOrbitCamera(flatForward, flatRight, distance, baseHeight, yawOffset = 0) {
  const yaw = cameraOrbitYaw + yawOffset;
  const horizontalDistance = Math.max(2.5, Math.cos(cameraOrbitPitch) * distance);
  orbitDirection
    .copy(flatForward)
    .multiplyScalar(-Math.cos(yaw))
    .addScaledVector(flatRight, Math.sin(yaw))
    .normalize();
  cameraDesired.copy(bodyP).addScaledVector(orbitDirection, horizontalDistance);
  cameraDesired.y += baseHeight + Math.sin(cameraOrbitPitch) * distance;
  cameraTargetDesired.copy(bodyP).addScaledVector(flatForward, 0.8);
  cameraTargetDesired.y += 0.95;
}

function updateCamera(dt) {
  syncBodyBasis();
  const speed = car.chassisBody.velocity.length();
  const shake = car.consumeCameraShake(dt);
  const flatForward = forward3.clone();
  flatForward.y = 0;
  if (flatForward.lengthSq() < 0.001) flatForward.set(0, 0, -1);
  flatForward.normalize();
  const flatRight = right3.clone();
  flatRight.y = 0;
  if (flatRight.lengthSq() < 0.001) flatRight.set(1, 0, 0);
  flatRight.normalize();

  if (!started) {
    const orbit = performance.now() * 0.00028;
    cameraDesired.set(
      bodyP.x + Math.cos(orbit) * 8.8,
      bodyP.y + 3.5,
      bodyP.z + Math.sin(orbit) * 8.8
    );
    cameraTargetDesired.copy(bodyP);
    cameraTargetDesired.y += 1.2;
  } else if (cameraMode === 0) {
    const distance = 7.2 + Math.min(2.0, speed * 0.035);
    setOrbitCamera(flatForward, flatRight, distance, 1.8);
  } else if (cameraMode === 1) {
    cameraDesired.copy(localPoint(0, 1.52, -0.20));
    const cosPitch = Math.cos(cameraOrbitPitch * 0.72);
    const localLook = new THREE.Vector3(
      Math.sin(cameraOrbitYaw) * cosPitch,
      Math.sin(cameraOrbitPitch * 0.72),
      -Math.cos(cameraOrbitYaw) * cosPitch
    ).applyQuaternion(bodyQ).normalize();
    cameraTargetDesired.copy(cameraDesired).addScaledVector(localLook, 18);
  } else {
    const distance = 12.8 + Math.min(2.5, speed * 0.025);
    setOrbitCamera(flatForward, flatRight, distance, 3.4, 0.48);
  }

  if (shake > 0.001) {
    const a = shake * 0.42;
    cameraDesired.x += (Math.random() - 0.5) * a;
    cameraDesired.y += (Math.random() - 0.5) * a;
    cameraDesired.z += (Math.random() - 0.5) * a;
  }

  const posSmooth = 1 - Math.pow(0.00055, dt);
  const targetSmooth = 1 - Math.pow(0.00018, dt);
  if (!cameraInitialized) {
    camera.position.copy(cameraDesired);
    cameraTargetSmooth.copy(cameraTargetDesired);
    cameraInitialized = true;
  } else {
    camera.position.lerp(cameraDesired, posSmooth);
    cameraTargetSmooth.lerp(cameraTargetDesired, targetSmooth);
  }
  camera.lookAt(cameraTargetSmooth);

  const burstActive = performance.now() < nitroFlashUntil;
  const targetFov = !started ? 54 : (cameraMode === 1 ? 66 : 60 + clamp(speed * 0.16, 0, (car.nitroActive || burstActive) ? 15 : 9));
  camera.fov = lerp(camera.fov, targetFov, 1 - Math.pow(0.02, dt));
  camera.updateProjectionMatrix();
}

function gearLabel(signedKmh, input) {
  if (signedKmh < -1.5 || (input.reverse && signedKmh < 3)) return 'R';
  if (!input.throttle && !input.reverse && Math.abs(signedKmh) < 1.5) return 'N';
  const s = Math.max(0, signedKmh);
  if (s < 30) return '1';
  if (s < 56) return '2';
  if (s < 88) return '3';
  if (s < 124) return '4';
  if (s < 160) return '5';
  return '6';
}

function conditionLabel(damage, exploded) {
  if (exploded) return 'DESTRUIDO';
  if (damage < 20) return 'ÓPTIMO';
  if (damage < 45) return 'GOLPEADO';
  if (damage < 72) return 'DESGASTADO';
  return 'CRÍTICO';
}

function updateHud(dt, driveData, input) {
  const grounded = car.groundedWheelCount();
  if (grounded === 0 && started) airTime += dt;
  else if (grounded > 0) airTime = 0;

  const v = car.chassisBody.velocity;
  const ax = (v.x - lastVelocity.x) / Math.max(dt, 0.001);
  const ay = (v.y - lastVelocity.y) / Math.max(dt, 0.001);
  const az = (v.z - lastVelocity.z) / Math.max(dt, 0.001);
  const properX = ax;
  const properY = ay + 9.82;
  const properZ = az;
  const feltG = clamp(Math.hypot(properX, properY, properZ) / 9.82, 0, 9.9);
  lastVelocity.copy(v);

  speedEl.textContent = Math.round(driveData.speedKmh);
  gearEl.textContent = driveData.exploded ? 'X' : gearLabel(driveData.signedSpeed * 3.6, input);
  damageEl.textContent = `${Math.round(car.damage.total)}%`;
  nitroEl.textContent = Math.round(car.nitro);
  conditionEl.textContent = conditionLabel(car.damage.total, car.exploded);
  gforceEl.textContent = `${feltG.toFixed(1)} g`;
  airEl.textContent = `${airTime.toFixed(1)} s`;
  damageEl.classList.toggle('danger', car.damage.total > 60);
  conditionEl.classList.toggle('warn', car.damage.total >= 45 && !car.exploded);
  conditionEl.classList.toggle('critical', car.damage.total >= 72 || car.exploded);
  wreckNotice.classList.toggle('hidden', !car.exploded);
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

resetSimulation();
loading.classList.add('hidden');
startScreen.classList.remove('hidden');

let last = performance.now();
const mobile = matchMedia('(max-width: 800px)').matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const fixedStep = mobile ? 1 / 60 : 1 / 120;
const maxSubSteps = mobile ? 4 : 8;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const input = inputState();
  const driveData = car.updateDrive(dt, input);
  world.step(fixedStep, dt, maxSubSteps);
  car.syncVisuals();
  car.updateEffects(dt);
  map.syncDynamics();
  updateCamera(dt);
  updateHud(dt, driveData, input);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);