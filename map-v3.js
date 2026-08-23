export function buildProvingGround({ THREE, CANNON, scene, world, materials }) {
  const dynamicObjects = [];
  const staticBodies = [];
  const { asphaltPhysics, concretePhysics, asphaltMat, concreteMat } = materials;

  const qFromEuler = (pitch = 0, yaw = 0, roll = 0) =>
    new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, roll, 'YXZ'));

  function addStaticBox({ x = 0, y = 0, z = 0, w = 2, h = 1, l = 2, pitch = 0, yaw = 0, roll = 0, material = concreteMat }) {
    const q = qFromEuler(pitch, yaw, roll);
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

  // A rotated box is used as a ramp collider, but the TOP driving face is
  // anchored at y≈0 on the low edge. The previous version anchored the bottom
  // corner instead, leaving a ~0.6 m vertical lip that looked like a floating ramp.
  function addRamp({ x, z, width = 11, length = 22, angle, yaw = 0, thickness = 0.62, color = 0x727982 }) {
    const absSin = Math.abs(Math.sin(angle));
    const absCos = Math.abs(Math.cos(angle));
    const surfaceLowY = 0.025;
    const y = absSin * length * 0.5 - absCos * thickness * 0.5 + surfaceLowY;
    const highSurfaceY = surfaceLowY + absSin * length;
    const rampMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.84, metalness: 0.10 });
    const item = addStaticBox({ x, y, z, w: width, h: thickness, l: length, pitch: angle, yaw, material: rampMaterial });
    return { ...item, highSurfaceY };
  }

  function addPlatform({ x, z, topY, w, l, h = 0.75, color = 0x646b73 }) {
    return addStaticBox({
      x, y: topY - h / 2, z, w, h, l,
      material: new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.07 })
    });
  }

  function addBump(x, z, radius = 1.15, visibleHeight = 0.38) {
    const centerY = visibleHeight - radius;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 14), concreteMat);
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

  function addSpeedBump(x, z, w = 6.0, h = 0.17, l = 0.72, yaw = 0) {
    addStaticBox({
      x, y: h / 2, z, w, h, l, yaw,
      material: new THREE.MeshStandardMaterial({ color: 0xd4a326, roughness: 0.82 })
    });
  }

  function addDynamicBox({ x, y, z, size = 1.15, mass = 10, color = 0xb9803f }) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.82 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const body = new CANNON.Body({
      mass,
      material: concretePhysics,
      shape: new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2)),
      position: new CANNON.Vec3(x, y, z)
    });
    body.linearDamping = 0.14;
    body.angularDamping = 0.12;
    body.allowSleep = true;
    world.addBody(body);
    dynamicObjects.push({ mesh, body });
  }

  function addCone(x, z) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.38, 0.08, 14),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9 })
    );
    base.position.y = 0.04;
    group.add(base);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.9, 16),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.74 })
    );
    cone.position.y = 0.50;
    group.add(cone);
    scene.add(group);

    const body = new CANNON.Body({ mass: 1.6, material: concretePhysics });
    body.addShape(new CANNON.Box(new CANNON.Vec3(0.34, 0.45, 0.34)));
    body.position.set(x, 0.46, z);
    body.linearDamping = 0.24;
    body.angularDamping = 0.2;
    body.allowSleep = true;
    world.addBody(body);
    dynamicObjects.push({ mesh: group, body });
  }

  function addBarrel(x, z) {
    const radius = 0.43;
    const height = 1.15;
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, height, 20),
      new THREE.MeshStandardMaterial({ color: 0x335f8c, roughness: 0.58, metalness: 0.34 })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const body = new CANNON.Body({ mass: 24, material: concretePhysics });
    const cylinder = new CANNON.Cylinder(radius, radius, height, 18);
    // cannon-es cylinders are created on the Z axis; rotate the collision shape
    // to match Three.js' Y-axis cylinder so the barrel no longer collides sideways.
    const shapeQ = new CANNON.Quaternion();
    shapeQ.setFromEuler(Math.PI / 2, 0, 0);
    body.addShape(cylinder, new CANNON.Vec3(), shapeQ);
    body.position.set(x, height / 2, z);
    body.linearDamping = 0.08;
    body.angularDamping = 0.08;
    body.allowSleep = true;
    world.addBody(body);
    dynamicObjects.push({ mesh, body });
  }

  function addLine(x, z, w, l, color = 0xffffff, yaw = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.018, l), new THREE.MeshBasicMaterial({ color }));
    mesh.position.set(x, 0.014, z);
    mesh.rotation.y = yaw;
    scene.add(mesh);
  }

  function addLabel(text, x, y, z, scale = 6) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(10,18,28,.86)';
    ctx.fillRect(0, 12, 512, 104);
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 16, 504, 96);
    ctx.fillStyle = '#fff';
    ctx.font = '700 44px system-ui';
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
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28 * s, 0.38 * s, 2.5 * s, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4b2a, roughness: 1 })
    );
    trunk.position.set(x, 1.25 * s, z);
    trunk.castShadow = true;
    scene.add(trunk);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(1.5 * s, 4.2 * s, 10),
      new THREE.MeshStandardMaterial({ color: 0x2f6f3a, roughness: 1 })
    );
    crown.position.set(x, 4.1 * s, z);
    crown.castShadow = true;
    scene.add(crown);
  }

  // Environment and physical ground.
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(520, 520),
    new THREE.MeshStandardMaterial({ color: 0x5c9a52, roughness: 1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.04;
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
  staticBodies.push(groundBody);

  // Outer barrier.
  addStaticBox({ x: 0, y: 1.1, z: -134, w: 270, h: 2.2, l: 1.2 });
  addStaticBox({ x: 0, y: 1.1, z: 134, w: 270, h: 2.2, l: 1.2 });
  addStaticBox({ x: -134, y: 1.1, z: 0, w: 1.2, h: 2.2, l: 270 });
  addStaticBox({ x: 134, y: 1.1, z: 0, w: 1.2, h: 2.2, l: 270 });

  // Center acceleration lane.
  addLine(0, 18, 0.16, 206, 0xf5f5f5);
  for (let z = 106; z > -106; z -= 10) {
    addLine(-7.5, z, 0.1, 4.5, 0xcbd5e1);
    addLine(7.5, z, 0.1, 4.5, 0xcbd5e1);
  }

  // Main connected jump table. No physical gaps between ramps and platform.
  const mainUp = addRamp({ x: 0, z: 28, width: 11, length: 23, angle: THREE.MathUtils.degToRad(15), color: 0x69717b });
  addPlatform({ x: 0, z: 10, topY: mainUp.highSurfaceY, w: 11, l: 13, h: 0.75 });
  addRamp({ x: 0, z: -8, width: 11, length: 23, angle: THREE.MathUtils.degToRad(-15), color: 0x69717b });
  addLabel('SALTO PRINCIPAL', 0, 8.2, 16, 5.4);

  // Crash corridor.
  addStaticBox({
    x: 0, y: 1.4, z: -103, w: 22, h: 2.8, l: 2.4,
    material: new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.94 })
  });
  addStaticBox({ x: -11.5, y: 0.7, z: -76, w: 0.5, h: 1.4, l: 54 });
  addStaticBox({ x: 11.5, y: 0.7, z: -76, w: 0.5, h: 1.4, l: 54 });
  addLabel('PRUEBA DE CHOQUE', 0, 5.5, -98, 5.2);
  for (let row = 0; row < 3; row++) {
    for (let col = -2; col <= 2; col++) {
      addDynamicBox({ x: col * 1.35, y: 0.60 + row * 1.18, z: -82, size: 1.12, mass: 9.5 });
    }
  }

  // Suspension lane: alternating domes + speed bumps.
  addLabel('SUSPENSIÓN', -34, 6, 72, 4.5);
  for (let i = 0; i < 12; i++) {
    addBump(-37 + (i % 2) * 5.5, 60 - i * 7.0, 1.22, 0.36 + (i % 3) * 0.08);
  }
  for (let i = 0; i < 8; i++) addSpeedBump(-34, -27 - i * 3.2, 7.2, 0.13 + (i % 2) * 0.07, 0.68);
  addLine(-34, 14, 7.5, 102, 0xd9dee3);

  // Steep grade with exact ramp/platform height matching.
  addLabel('PENDIENTE 24°', 39, 8.4, 57, 4.6);
  const hillUp = addRamp({ x: 39, z: 42, width: 11, length: 26, angle: THREE.MathUtils.degToRad(24), color: 0x626b75 });
  addPlatform({ x: 39, z: 20, topY: hillUp.highSurfaceY, w: 12, l: 18, h: 0.85 });
  addRamp({ x: 39, z: -2, width: 11, length: 26, angle: THREE.MathUtils.degToRad(-24), color: 0x626b75 });

  // Cross-axle articulation section.
  addLabel('ARTICULACIÓN', 73, 6, 68, 4.5);
  for (let i = 0; i < 7; i++) {
    const a = i % 2 === 0 ? THREE.MathUtils.degToRad(8) : THREE.MathUtils.degToRad(-8);
    addRamp({ x: 73, z: 52 - i * 10.5, width: 9, length: 10, angle: a, thickness: 0.44, color: 0x707981 });
  }

  // Slalom and movable props.
  addLabel('SLALOM', -74, 5.5, 62, 4.3);
  for (let i = 0; i < 13; i++) addCone(-74 + (i % 2 ? 3.2 : -3.2), 50 - i * 8);
  addLine(-74, 1, 9, 116, 0xd9dee3);

  addLabel('IMPACTO LATERAL', 78, 5.5, -45, 4.4);
  for (let i = 0; i < 12; i++) addBarrel(72 + (i % 4) * 2.0, -55 - Math.floor(i / 4) * 2.0);
  addStaticBox({ x: 91, y: 1.0, z: -59, w: 2.0, h: 2.0, l: 26, yaw: THREE.MathUtils.degToRad(18) });

  // Two standalone launch ramps with flush low edges.
  addRamp({ x: -69, z: -72, width: 8, length: 13, angle: THREE.MathUtils.degToRad(18), yaw: THREE.MathUtils.degToRad(12), color: 0x59636e });
  addRamp({ x: 68, z: 91, width: 9, length: 16, angle: THREE.MathUtils.degToRad(20), yaw: THREE.MathUtils.degToRad(-20), color: 0x59636e });

  // Perimeter trees are visual only, deliberately outside the physical barrier.
  for (let i = 0; i < 58; i++) {
    const a = (i / 58) * Math.PI * 2;
    const r = 155 + (i % 4) * 7;
    addTree(Math.cos(a) * r, Math.sin(a) * r, 0.9 + (i % 3) * 0.12);
  }

  return {
    dynamicObjects,
    staticBodies,
    spawn: { x: 0, y: 0.82, z: 92 },
    syncDynamics() {
      for (const item of dynamicObjects) {
        item.mesh.position.copy(item.body.position);
        item.mesh.quaternion.copy(item.body.quaternion);
      }
    }
  };
}
