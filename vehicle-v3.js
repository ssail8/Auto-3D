export function createVehicle({ THREE, CANNON, scene, world, materials, spawn }) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const { chassisPhysics } = materials;

  const chassisBody = new CANNON.Body({
    mass: 1280,
    material: chassisPhysics,
    angularDamping: 0.55,
    linearDamping: 0.012,
    allowSleep: false
  });

  // Keep the center of mass below the geometric center of the body. A lower
  // mass center makes weight transfer progressive instead of instantly tipping.
  chassisBody.addShape(
    new CANNON.Box(new CANNON.Vec3(0.98, 0.32, 2.08)),
    new CANNON.Vec3(0, 0.20, 0)
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
    dampingRelaxation: 3.6,
    dampingCompression: 4.8,
    maxSuspensionForce: 90000,
    rollInfluence: 0.012,
    axleLocal: new CANNON.Vec3(-1, 0, 0),
    maxSuspensionTravel: 0.15,
    customSlidingRotationalSpeed: -30,
    useCustomSlidingRotationalSpeed: true
  };

  const wheelPoints = [
    [-0.90, 0.02, -1.38],
    [ 0.90, 0.02, -1.38],
    [-0.90, 0.02,  1.36],
    [ 0.90, 0.02,  1.36]
  ];

  for (const p of wheelPoints) {
    vehicle.addWheel({
      ...wheelBase,
      chassisConnectionPointLocal: new CANNON.Vec3(p[0], p[1], p[2])
    });
  }
  vehicle.addToWorld(world);

  // ----- visual car -----
  const carVisual = new THREE.Group();
  scene.add(carVisual);

  const paint = new THREE.MeshStandardMaterial({ color: 0xb7192b, roughness: 0.31, metalness: 0.38 });
  const paintDark = new THREE.MeshStandardMaterial({ color: 0x78101c, roughness: 0.38, metalness: 0.32 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.65, metalness: 0.14 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x6da6c8, roughness: 0.14, metalness: 0.16, transparent: true, opacity: 0.82 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb9c1c8, roughness: 0.28, metalness: 0.82 });
  const whiteLight = new THREE.MeshStandardMaterial({ color: 0xf6f8ff, emissive: 0xd7ebff, emissiveIntensity: 1.8 });
  const redLight = new THREE.MeshStandardMaterial({ color: 0xb91c1c, emissive: 0x7f1d1d, emissiveIntensity: 1.5 });

  function box(name, size, pos, material, parent = carVisual) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.name = name;
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const shellGeometry = new THREE.BoxGeometry(1.98, 0.48, 4.22, 5, 2, 12);
  const shell = new THREE.Mesh(shellGeometry, paint);
  shell.position.y = 0.10;
  shell.castShadow = true;
  shell.receiveShadow = true;
  carVisual.add(shell);
  const shellPos = shellGeometry.attributes.position;
  const shellBase = Float32Array.from(shellPos.array);

  const sillL = box('sillL', [0.16, 0.24, 3.25], [-1.0, 0.00, 0.05], paintDark);
  const sillR = box('sillR', [0.16, 0.24, 3.25], [ 1.0, 0.00, 0.05], paintDark);
  const hood = box('hood', [1.84, 0.17, 1.34], [0, 0.43, -1.32], paint);
  const trunk = box('trunk', [1.78, 0.17, 0.94], [0, 0.43, 1.56], paint);
  const cabin = box('cabin', [1.66, 0.74, 1.72], [0, 0.79, 0.12], glass);
  const roof = box('roof', [1.58, 0.15, 1.45], [0, 1.16, 0.12], paint);
  const frontBumper = box('frontBumper', [1.92, 0.20, 0.22], [0, 0.08, -2.18], black);
  const rearBumper = box('rearBumper', [1.92, 0.20, 0.22], [0, 0.08, 2.18], black);
  const mirrorL = box('mirrorL', [0.22, 0.12, 0.28], [-1.03, 0.82, -0.42], black);
  const mirrorR = box('mirrorR', [0.22, 0.12, 0.28], [ 1.03, 0.82, -0.42], black);
  box('grille', [0.86, 0.16, 0.07], [0, 0.10, -2.15], chrome);
  for (const x of [-0.62, 0.62]) {
    box('headlight', [0.42, 0.16, 0.08], [x, 0.37, -2.14], whiteLight);
    box('tailLight', [0.42, 0.16, 0.08], [x, 0.37, 2.14], redLight);
  }

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

  function deformShell() {
    const f = damage.front;
    const r = damage.rear;
    const l = damage.left;
    const rr = damage.right;
    for (let i = 0; i < shellPos.count; i++) {
      const k = i * 3;
      let x = shellBase[k];
      let y = shellBase[k + 1];
      let z = shellBase[k + 2];

      const fw = clamp((-z - 0.20) / 1.90, 0, 1);
      const rw = clamp(( z - 0.20) / 1.90, 0, 1);
      const lw = clamp((-x - 0.20) / 0.80, 0, 1);
      const rwSide = clamp((x - 0.20) / 0.80, 0, 1);

      z += f * 0.46 * fw;
      z -= r * 0.42 * rw;
      x += l * 0.17 * lw;
      x -= rr * 0.17 * rwSide;
      y += (f * fw + r * rw) * 0.035 * Math.sin(x * 8 + z * 4);
      y -= (l * lw + rr * rwSide) * 0.025;

      shellPos.setXYZ(i, x, y, z);
    }
    shellPos.needsUpdate = true;
    shellGeometry.computeVertexNormals();
    shellGeometry.computeBoundingSphere();

    frontBumper.scale.z = 1 - f * 0.72;
    frontBumper.position.z = -2.18 + f * 0.18;
    hood.scale.z = 1 - f * 0.25;
    hood.position.z = -1.32 + f * 0.21;
    hood.rotation.x = -f * 0.10;
    rearBumper.scale.z = 1 - r * 0.70;
    rearBumper.position.z = 2.18 - r * 0.17;
    trunk.scale.z = 1 - r * 0.23;
    trunk.position.z = 1.56 - r * 0.18;
    trunk.rotation.x = r * 0.08;
    sillL.position.x = -1.0 + l * 0.13;
    sillL.scale.x = 1 - l * 0.42;
    sillR.position.x = 1.0 - rr * 0.13;
    sillR.scale.x = 1 - rr * 0.42;
    cabin.rotation.z = (l - rr) * 0.038;
    roof.rotation.z = (l - rr) * 0.026;
    mirrorL.rotation.z = l * 0.55;
    mirrorR.rotation.z = -rr * 0.55;
  }

  function resetDamage() {
    damage.front = damage.rear = damage.left = damage.right = damage.underbody = 0;
    damage.total = damage.lastImpact = 0;
    for (let i = 0; i < shellPos.count; i++) {
      const k = i * 3;
      shellPos.setXYZ(i, shellBase[k], shellBase[k + 1], shellBase[k + 2]);
    }
    shellPos.needsUpdate = true;
    shellGeometry.computeVertexNormals();
    frontBumper.scale.set(1, 1, 1); frontBumper.position.set(0, 0.08, -2.18);
    rearBumper.scale.set(1, 1, 1); rearBumper.position.set(0, 0.08, 2.18);
    hood.scale.set(1, 1, 1); hood.position.set(0, 0.43, -1.32); hood.rotation.set(0, 0, 0);
    trunk.scale.set(1, 1, 1); trunk.position.set(0, 0.43, 1.56); trunk.rotation.set(0, 0, 0);
    sillL.scale.set(1, 1, 1); sillL.position.set(-1.0, 0.00, 0.05);
    sillR.scale.set(1, 1, 1); sillR.position.set(1.0, 0.00, 0.05);
    cabin.rotation.set(0, 0, 0); roof.rotation.set(0, 0, 0);
    mirrorL.rotation.set(0, 0, 0); mirrorR.rotation.set(0, 0, 0);
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
    deformShell();
  });

  const forwardLocal = new CANNON.Vec3(0, 0, -1);
  const forwardWorld = new CANNON.Vec3();
  const aeroForce = new CANNON.Vec3();

  function getTelemetry() {
    chassisBody.quaternion.vmult(forwardLocal, forwardWorld);
    const signedSpeed = chassisBody.velocity.dot(forwardWorld);
    const speed = chassisBody.velocity.length();
    return { speed, signedSpeed, speedKmh: speed * 3.6 };
  }

  function updateDrive(dt, input) {
    const { speedKmh, signedSpeed, speed } = getTelemetry();
    const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);

    // A real car has much less usable steering angle as speed rises. The old
    // tune still allowed ~22 degrees around 50 km/h, enough to trip the tires
    // and roll the chassis. This curve progressively trades steering for stability.
    let steerMax;
    if (speedKmh < 35) {
      steerMax = lerp(0.46, 0.32, speedKmh / 35);
    } else if (speedKmh < 80) {
      steerMax = lerp(0.32, 0.18, (speedKmh - 35) / 45);
    } else {
      steerMax = lerp(0.18, 0.095, clamp((speedKmh - 80) / 100, 0, 1));
    }
    const steerTarget = steerInput * steerMax;
    const steerResponse = lerp(7.5, 3.2, clamp(speedKmh / 160, 0, 1));
    const steerRate = 1 - Math.exp(-steerResponse * dt);
    steerState = lerp(steerState, steerTarget, steerRate);
    vehicle.setSteeringValue(steerState, 0);
    vehicle.setSteeringValue(steerState, 1);

    // High-speed tire grip is reduced slightly so an abrupt turn produces
    // progressive understeer/slip instead of enough lateral force to flip the car.
    const gripFade = clamp(speedKmh / 180, 0, 1);
    const frontGrip = lerp(3.55, 2.30, gripFade);
    const rearGrip = lerp(3.85, 2.65, gripFade);
    vehicle.wheelInfos[0].frictionSlip = frontGrip;
    vehicle.wheelInfos[1].frictionSlip = frontGrip;
    vehicle.wheelInfos[2].frictionSlip = rearGrip;
    vehicle.wheelInfos[3].frictionSlip = rearGrip;

    let engineForce = 0;
    let autoBrake = 0;
    if (input.throttle) {
      if (signedSpeed < -1.8) {
        autoBrake = 32000;
      } else {
        const curve = lerp(1, 0.12, clamp(Math.max(0, signedSpeed) * 3.6 / 195, 0, 1));
        engineForce = 4500 * curve;
      }
    } else if (input.reverse) {
      if (signedSpeed > 1.8) {
        autoBrake = 36000;
      } else {
        const reverseCurve = lerp(1, 0.22, clamp(Math.max(0, -signedSpeed) * 3.6 / 58, 0, 1));
        engineForce = -2400 * reverseCurve;
      }
    }

    vehicle.applyEngineForce(0, 0);
    vehicle.applyEngineForce(0, 1);
    vehicle.applyEngineForce(engineForce, 2);
    vehicle.applyEngineForce(engineForce, 3);

    const serviceBrake = input.brake ? 42000 : autoBrake;
    vehicle.setBrake(serviceBrake, 0);
    vehicle.setBrake(serviceBrake, 1);
    vehicle.setBrake(serviceBrake * 0.82, 2);
    vehicle.setBrake(serviceBrake * 0.82, 3);
    if (input.handbrake) {
      vehicle.setBrake(60000, 2);
      vehicle.setBrake(60000, 3);
    }

    // Drag opposes motion. Downforce is deliberately world-down while at least
    // two tires are on the ground; this prevents suspension oscillation from
    // turning aerodynamic load into a sideways or lifting force during body roll.
    if (speed > 0.3) {
      const dragMag = Math.min(9000, 0.5 * 1.225 * 0.72 * speed * speed);
      const drag = chassisBody.velocity.clone();
      drag.normalize();
      drag.scale(-dragMag, drag);
      chassisBody.applyForce(drag, chassisBody.position);

      let contacts = 0;
      for (const info of vehicle.wheelInfos) if (info.isInContact) contacts++;
      if (contacts >= 2 && speed > 4) {
        const downforceMag = Math.min(9500, speed * speed * 4.2);
        aeroForce.set(0, -downforceMag, 0);
        chassisBody.applyForce(aeroForce, chassisBody.position);

        // Extra heave damping only counters upward suspension bounce; it does
        // not glue the car to the road or interfere with genuine ramp launches.
        if (contacts >= 3 && chassisBody.velocity.y > 0.25) {
          const heaveDamping = Math.min(6500, (chassisBody.velocity.y - 0.25) * 2400);
          aeroForce.set(0, -heaveDamping, 0);
          chassisBody.applyForce(aeroForce, chassisBody.position);
        }
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
      vehicle.wheelInfos[i].frictionSlip = wheelBase.frictionSlip;
    }
    resetDamage();
    syncVisuals();
  }

  function groundedWheelCount() {
    let n = 0;
    for (const info of vehicle.wheelInfos) if (info.isInContact) n++;
    return n;
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
