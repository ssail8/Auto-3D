export function createVehicle({ THREE, CANNON, scene, world, materials, spawn }) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const { chassisPhysics } = materials;

  const chassisBody = new CANNON.Body({
    mass: 1280,
    material: chassisPhysics,
    angularDamping: 0.58,
    linearDamping: 0.012,
    allowSleep: false
  });

  chassisBody.addShape(
    new CANNON.Box(new CANNON.Vec3(1.02, 0.30, 2.08)),
    new CANNON.Vec3(0, 0.18, 0)
  );
  chassisBody.position.set(spawn.x, spawn.y, spawn.z);

  const vehicle = new CANNON.RaycastVehicle({
    chassisBody,
    indexRightAxis: 0,
    indexUpAxis: 1,
    indexForwardAxis: 2
  });

  const wheelBase = {
    radius: 0.39,
    directionLocal: new CANNON.Vec3(0, -1, 0),
    suspensionStiffness: 32,
    suspensionRestLength: 0.27,
    frictionSlip: 3.2,
    dampingRelaxation: 3.8,
    dampingCompression: 5.1,
    maxSuspensionForce: 92000,
    rollInfluence: 0.012,
    axleLocal: new CANNON.Vec3(-1, 0, 0),
    maxSuspensionTravel: 0.15,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true
  };

  const wheelPoints = [
    [-0.92, 0.02, -1.38],
    [ 0.92, 0.02, -1.38],
    [-0.92, 0.02,  1.36],
    [ 0.92, 0.02,  1.36]
  ];

  for (const p of wheelPoints) {
    vehicle.addWheel({
      ...wheelBase,
      chassisConnectionPointLocal: new CANNON.Vec3(p[0], p[1], p[2])
    });
  }
  vehicle.addToWorld(world);

  const carVisual = new THREE.Group();
  scene.add(carVisual);

  const green = new THREE.MeshStandardMaterial({ color: 0x9fb64b, roughness: 0.82, metalness: 0.06 });
  const greenDark = new THREE.MeshStandardMaterial({ color: 0x68852e, roughness: 0.88, metalness: 0.05 });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xd7d78b, roughness: 0.85, metalness: 0.02 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf8f7f2, roughness: 0.65, metalness: 0.04 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x8b6116, roughness: 0.42, metalness: 0.22 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.28, metalness: 0.08 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xc9732d, roughness: 0.72, metalness: 0.06 });
  const crestRed = new THREE.MeshStandardMaterial({ color: 0xd64f27, roughness: 0.78, metalness: 0.04 });
  const crestYellow = new THREE.MeshStandardMaterial({ color: 0xf0c94f, roughness: 0.78, metalness: 0.03 });
  const black = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.84, metalness: 0.08 });
  const clawMat = new THREE.MeshStandardMaterial({ color: 0x9d5a26, roughness: 0.76, metalness: 0.04 });

  const bodyGeometry = new THREE.SphereGeometry(1.34, 36, 28);
  const body = new THREE.Mesh(bodyGeometry, green);
  body.scale.set(1.02, 1.00, 1.18);
  body.position.set(0, 0.96, 0.04);
  body.castShadow = true;
  body.receiveShadow = true;
  carVisual.add(body);
  const bodyPos = bodyGeometry.attributes.position;
  const bodyBase = Float32Array.from(bodyPos.array);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.86, 28, 20), bellyMat);
  belly.scale.set(1.00, 0.86, 0.88);
  belly.position.set(0, 0.60, -0.10);
  belly.castShadow = true;
  carVisual.add(belly);

  const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.58, 28, 24), white);
  eyeWhite.position.set(0, 1.08, -1.20);
  eyeWhite.castShadow = true;
  carVisual.add(eyeWhite);

  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 20), irisMat);
  iris.position.set(0, 1.03, -1.70);
  carVisual.add(iris);

  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 16), pupilMat);
  pupil.position.set(0, 1.02, -1.92);
  carVisual.add(pupil);

  const eyeShine = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), white);
  eyeShine.position.set(0.13, 1.16, -1.78);
  carVisual.add(eyeShine);

  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.70, 18), beakMat);
  beak.rotation.x = Math.PI / 2;
  beak.scale.set(1.0, 1.18, 0.90);
  beak.position.set(0, 0.63, -1.53);
  beak.castShadow = true;
  carVisual.add(beak);

  const beakLower = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.24), beakMat);
  beakLower.position.set(0, 0.40, -1.36);
  beakLower.rotation.x = -0.22;
  beakLower.castShadow = true;
  carVisual.add(beakLower);

  const wingL = new THREE.Mesh(new THREE.SphereGeometry(0.46, 22, 18), greenDark);
  wingL.scale.set(0.45, 0.22, 0.84);
  wingL.position.set(-1.22, 0.74, -0.06);
  wingL.rotation.z = 0.36;
  wingL.castShadow = true;
  carVisual.add(wingL);

  const wingR = wingL.clone();
  wingR.position.x = 1.22;
  wingR.rotation.z = -0.36;
  carVisual.add(wingR);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.58, 16), greenDark);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0.76, 1.53);
  tail.castShadow = true;
  carVisual.add(tail);

  const crest1 = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.64, 12), crestYellow);
  crest1.position.set(-0.13, 1.92, -0.16);
  crest1.rotation.z = -0.22;
  crest1.castShadow = true;
  carVisual.add(crest1);

  const crest2 = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.70, 12), crestRed);
  crest2.position.set(0, 2.04, -0.02);
  crest2.rotation.z = -0.04;
  crest2.castShadow = true;
  carVisual.add(crest2);

  const crest3 = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.58, 12), crestYellow);
  crest3.position.set(0.12, 1.94, 0.10);
  crest3.rotation.z = 0.26;
  crest3.castShadow = true;
  carVisual.add(crest3);

  const clawGroup = new THREE.Group();
  clawGroup.position.set(0, -0.10, -0.32);
  for (const side of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.30, 10), beakMat);
    leg.position.set(side, 0.04, 0);
    leg.castShadow = true;
    clawGroup.add(leg);
    for (const toeOffset of [-0.08, 0, 0.08]) {
      const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.18, 8), clawMat);
      toe.rotation.z = Math.PI / 2;
      toe.rotation.y = toeOffset * 3.5;
      toe.position.set(side + toeOffset * 0.4, -0.10, -0.02 + Math.abs(toeOffset) * 0.02);
      toe.castShadow = true;
      clawGroup.add(toe);
    }
  }
  carVisual.add(clawGroup);

  const wheelMeshes = [];
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.92 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xa3aab0, roughness: 0.30, metalness: 0.78 });
  for (let i = 0; i < 4; i++) {
    const group = new THREE.Group();
    const tireGeo = new THREE.CylinderGeometry(0.39, 0.39, 0.29, 28);
    tireGeo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    group.add(tire);
    const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.302, 20);
    rimGeo.rotateZ(Math.PI / 2);
    group.add(new THREE.Mesh(rimGeo, rimMat));
    scene.add(group);
    wheelMeshes.push(group);
  }

  const damage = { front: 0, rear: 0, left: 0, right: 0, underbody: 0, total: 0, lastImpact: 0 };
  let lastImpactMs = -1000;
  let cameraShake = 0;
  let steerState = 0;

  function recomputeDamageTotal() {
    const weighted = damage.front + damage.rear + damage.left + damage.right + damage.underbody * 0.7;
    damage.total = clamp(weighted / 3.0 * 100, 0, 100);
  }

  function deformBody() {
    const f = damage.front;
    const r = damage.rear;
    const l = damage.left;
    const rr = damage.right;
    const u = damage.underbody;
    for (let i = 0; i < bodyPos.count; i++) {
      const k = i * 3;
      let x = bodyBase[k];
      let y = bodyBase[k + 1];
      let z = bodyBase[k + 2];

      const fw = clamp((-z - 0.06) / 1.20, 0, 1);
      const rw = clamp((z - 0.04) / 1.20, 0, 1);
      const lw = clamp((-x - 0.04) / 0.84, 0, 1);
      const sw = clamp((x - 0.04) / 0.84, 0, 1);
      const uw = clamp((-y - 0.10) / 1.00, 0, 1);

      z += f * 0.34 * fw;
      z -= r * 0.28 * rw;
      x += l * 0.14 * lw;
      x -= rr * 0.14 * sw;
      y -= u * 0.16 * uw;
      y += (f * fw + r * rw) * 0.025 * Math.sin((x + z) * 5.5);

      bodyPos.setXYZ(i, x, y, z);
    }
    bodyPos.needsUpdate = true;
    bodyGeometry.computeVertexNormals();
    bodyGeometry.computeBoundingSphere();

    beak.position.z = -1.53 + f * 0.16 - r * 0.04;
    beak.position.y = 0.63 - f * 0.05;
    beak.rotation.x = Math.PI / 2 + f * 0.16;
    beakLower.position.z = -1.36 + f * 0.12;
    beakLower.position.y = 0.40 - f * 0.04;
    eyeWhite.scale.set(1 - f * 0.08, 1 - f * 0.06, 1 + f * 0.04);
    iris.position.x = (rr - l) * 0.03;
    pupil.position.x = (rr - l) * 0.04;
    wingL.position.x = -1.22 + l * 0.10;
    wingR.position.x = 1.22 - rr * 0.10;
    wingL.rotation.z = 0.36 + l * 0.18;
    wingR.rotation.z = -0.36 - rr * 0.18;
    tail.position.z = 1.53 - r * 0.12;
    tail.rotation.x = -Math.PI / 2 - r * 0.18;
    crest1.rotation.x = -f * 0.24;
    crest2.rotation.x = -f * 0.28;
    crest3.rotation.x = -f * 0.20;
    belly.position.y = 0.60 - u * 0.06;
  }

  function resetDamage() {
    damage.front = damage.rear = damage.left = damage.right = damage.underbody = 0;
    damage.total = damage.lastImpact = 0;
    for (let i = 0; i < bodyPos.count; i++) {
      const k = i * 3;
      bodyPos.setXYZ(i, bodyBase[k], bodyBase[k + 1], bodyBase[k + 2]);
    }
    bodyPos.needsUpdate = true;
    bodyGeometry.computeVertexNormals();
    eyeWhite.scale.set(1, 1, 1);
    iris.position.set(0, 1.03, -1.70);
    pupil.position.set(0, 1.02, -1.92);
    beak.position.set(0, 0.63, -1.53);
    beak.rotation.set(Math.PI / 2, 0, 0);
    beakLower.position.set(0, 0.40, -1.36);
    wingL.position.set(-1.22, 0.74, -0.06);
    wingR.position.set(1.22, 0.74, -0.06);
    wingL.rotation.set(0, 0, 0.36);
    wingR.rotation.set(0, 0, -0.36);
    tail.position.set(0, 0.76, 1.53);
    tail.rotation.set(-Math.PI / 2, 0, 0);
    crest1.rotation.set(0, 0, -0.22);
    crest2.rotation.set(0, 0, -0.04);
    crest3.rotation.set(0, 0, 0.26);
    belly.position.set(0, 0.60, -0.10);
  }

  chassisBody.addEventListener('collide', (event) => {
    const impact = Math.abs(event.contact.getImpactVelocityAlongNormal());
    if (impact < 3.0) return;
    const now = performance.now();
    if (now - lastImpactMs < 70 && impact <= damage.lastImpact) return;
    lastImpactMs = now;
    damage.lastImpact = impact;

    const severity = clamp((impact - 2.8) / 18, 0, 1);
    cameraShake = Math.max(cameraShake, severity * 0.48);

    const contact = event.contact;
    const relWorld = contact.bi === chassisBody ? contact.ri : contact.rj;
    const q = chassisBody.quaternion;
    const invQ = new CANNON.Quaternion(-q.x, -q.y, -q.z, q.w);
    const local = new CANNON.Vec3();
    invQ.vmult(relWorld, local);

    if (local.y < -0.16 && Math.abs(local.y) > Math.max(Math.abs(local.x) * 0.55, Math.abs(local.z) * 0.40)) {
      damage.underbody = clamp(damage.underbody + severity * 0.35, 0, 1);
    } else if (Math.abs(local.z) >= Math.abs(local.x)) {
      if (local.z < 0) damage.front = clamp(damage.front + severity * 0.62, 0, 1);
      else damage.rear = clamp(damage.rear + severity * 0.62, 0, 1);
    } else {
      if (local.x < 0) damage.left = clamp(damage.left + severity * 0.58, 0, 1);
      else damage.right = clamp(damage.right + severity * 0.58, 0, 1);
    }

    recomputeDamageTotal();
    deformBody();
  });

  const forwardLocal = new CANNON.Vec3(0, 0, -1);
  const rightLocal = new CANNON.Vec3(1, 0, 0);
  const forwardWorld = new CANNON.Vec3();
  const rightWorld = new CANNON.Vec3();

  function groundedWheelCount() {
    let n = 0;
    for (const info of vehicle.wheelInfos) if (info.isInContact) n++;
    return n;
  }

  function getTelemetry() {
    chassisBody.quaternion.vmult(forwardLocal, forwardWorld);
    const signedSpeed = chassisBody.velocity.dot(forwardWorld);
    const speed = chassisBody.velocity.length();
    return { speed, signedSpeed, speedKmh: speed * 3.6 };
  }

  function updateDrive(dt, input) {
    const { speedKmh, signedSpeed, speed } = getTelemetry();
    const grounded = groundedWheelCount();
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);

    let steerMax;
    if (speedKmh < 35) steerMax = lerp(0.46, 0.32, speedKmh / 35);
    else if (speedKmh < 80) steerMax = lerp(0.32, 0.18, (speedKmh - 35) / 45);
    else steerMax = lerp(0.18, 0.095, clamp((speedKmh - 80) / 100, 0, 1));

    const steerTarget = steerInput * steerMax;
    const steerResponse = 1 - Math.pow(0.00008, dt);
    steerState = lerp(steerState, steerTarget, steerResponse);
    vehicle.setSteeringValue(steerState, 0);
    vehicle.setSteeringValue(steerState, 1);

    let baseGrip;
    if (speedKmh < 40) baseGrip = 3.4;
    else if (speedKmh < 90) baseGrip = lerp(3.4, 2.6, (speedKmh - 40) / 50);
    else baseGrip = lerp(2.6, 1.95, clamp((speedKmh - 90) / 90, 0, 1));

    vehicle.wheelInfos[0].frictionSlip = baseGrip * 1.02;
    vehicle.wheelInfos[1].frictionSlip = baseGrip * 1.02;
    vehicle.wheelInfos[2].frictionSlip = input.handbrake ? 1.1 : baseGrip * 0.98;
    vehicle.wheelInfos[3].frictionSlip = input.handbrake ? 1.1 : baseGrip * 0.98;

    let engineForce = 0;
    let autoBrake = 0;
    if (input.throttle) {
      if (signedSpeed < -1.6) {
        autoBrake = 32000;
      } else {
        const curve = lerp(1, 0.10, clamp(Math.max(0, speedKmh) / 195, 0, 1));
        engineForce = 4200 * curve * (grounded > 0 ? 1 : 0.45);
      }
    } else if (input.reverse) {
      if (signedSpeed > 1.8) {
        autoBrake = 36000;
      } else {
        const reverseCurve = lerp(1, 0.22, clamp(Math.max(0, -signedSpeed) * 3.6 / 58, 0, 1));
        engineForce = -2300 * reverseCurve * (grounded > 0 ? 1 : 0.45);
      }
    }

    vehicle.applyEngineForce(0, 0);
    vehicle.applyEngineForce(0, 1);
    vehicle.applyEngineForce(engineForce, 2);
    vehicle.applyEngineForce(engineForce, 3);

    const serviceBrake = input.brake ? 44000 : autoBrake;
    vehicle.setBrake(serviceBrake, 0);
    vehicle.setBrake(serviceBrake, 1);
    vehicle.setBrake(serviceBrake * 0.82, 2);
    vehicle.setBrake(serviceBrake * 0.82, 3);
    if (input.handbrake) {
      vehicle.setBrake(65000, 2);
      vehicle.setBrake(65000, 3);
    }

    if (speed > 0.3) {
      const dragMag = Math.min(9500, 0.5 * 1.225 * 0.72 * speed * speed);
      const drag = chassisBody.velocity.clone();
      drag.normalize();
      drag.scale(-dragMag, drag);
      chassisBody.applyForce(drag, chassisBody.position);

      if (grounded > 0) {
        const downforceMag = Math.min(8600, speed * speed * 2.25);
        chassisBody.applyForce(new CANNON.Vec3(0, -downforceMag, 0), chassisBody.position);
        if (chassisBody.velocity.y > 0.2) {
          chassisBody.applyForce(new CANNON.Vec3(0, -Math.min(4200, chassisBody.velocity.y * 2300), 0), chassisBody.position);
        }
      }

      chassisBody.quaternion.vmult(rightLocal, rightWorld);
      const lateralSpeed = chassisBody.velocity.dot(rightWorld);
      const yawDamp = clamp(Math.abs(lateralSpeed) * 180, 0, 3200);
      chassisBody.angularVelocity.y *= Math.max(0, 1 - dt * 0.55);
      if (grounded > 1 && yawDamp > 0) {
        const lateralForce = rightWorld.clone();
        lateralForce.scale(-lateralSpeed * 90, lateralForce);
        chassisBody.applyForce(lateralForce, chassisBody.position);
      }
    }

    return { speedKmh, signedSpeed };
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
  }

  function reset() {
    chassisBody.position.set(spawn.x, spawn.y, spawn.z);
    chassisBody.quaternion.setFromEuler(0, 0, 0);
    chassisBody.velocity.setZero();
    chassisBody.angularVelocity.setZero();
    chassisBody.force.setZero();
    chassisBody.torque.setZero();
    chassisBody.wakeUp();
    steerState = 0;
    cameraShake = 0;
    vehicle.setSteeringValue(0, 0);
    vehicle.setSteeringValue(0, 1);
    for (let i = 0; i < 4; i++) {
      vehicle.applyEngineForce(0, i);
      vehicle.setBrake(0, i);
      vehicle.wheelInfos[i].rotation = 0;
      vehicle.wheelInfos[i].deltaRotation = 0;
      vehicle.wheelInfos[i].suspensionLength = wheelBase.suspensionRestLength;
    }
    resetDamage();
    syncVisuals();
  }

  function consumeCameraShake(dt) {
    const value = cameraShake;
    cameraShake *= Math.pow(0.028, dt);
    if (cameraShake < 0.0005) cameraShake = 0;
    return value;
  }

  reset();

  return {
    chassisBody,
    vehicle,
    damage,
    updateDrive,
    syncVisuals,
    reset,
    getTelemetry,
    groundedWheelCount,
    consumeCameraShake
  };
}
