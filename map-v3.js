export function buildProvingGround({ THREE, CANNON, scene, world, materials }) {
  const dynamicObjects = [];
  const staticBodies = [];
  const animatedObjects = [];
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

  function addRamp({ x, z, width = 11, length = 22, angle, yaw = 0, thickness = 0.62, color = 0x727982 }) {
    const absSin = Math.abs(Math.sin(angle));
    const absCos = Math.abs(Math.cos(angle));
    const surfaceLowY = 0.025;
    const y = absSin * length * 0.5 - absCos * thickness * 0.5 + surfaceLowY;
    const highSurfaceY = surfaceLowY + absSin * length;
    const rampMaterial = new THREE.MeshStandardMaterial({ color, roughness: 0.84, metalness: 0.10 });
    const item = addStaticBox({ x, y, z, w: width, h: thickness, l: length, pitch: angle, yaw, material: rampMaterial });
    return { ...item, highSurfaceY, surfaceLowY };
  }

  function addPlatform({ x, z, topY, w, l, h = 0.75, color = 0x646b73 }) {
    return addStaticBox({
      x, y: topY - h / 2, z, w, h, l,
      material: new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.07 })
    });
  }

  function addBump(x, z, radius = 1.15, visibleHeight = 0.38) {
    const centerY = visibleHeight - radius;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 18), concreteMat);
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

  function createTextTexture(text, width = 1024, height = 256, options = {}) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, width, height);
    if (options.background !== false) {
      ctx.fillStyle = options.background || 'rgba(8,14,24,.72)';
      const pad = 14;
      const radius = 32;
      ctx.beginPath();
      ctx.moveTo(pad + radius, pad);
      ctx.arcTo(width - pad, pad, width - pad, height - pad, radius);
      ctx.arcTo(width - pad, height - pad, pad, height - pad, radius);
      ctx.arcTo(pad, height - pad, pad, pad, radius);
      ctx.arcTo(pad, pad, width - pad, pad, radius);
      ctx.closePath();
      ctx.fill();
    }
    if (options.border !== false) {
      ctx.strokeStyle = options.border || 'rgba(255,255,255,.92)';
      ctx.lineWidth = options.borderWidth || 8;
      ctx.strokeRect(18, 18, width - 36, height - 36);
    }
    ctx.fillStyle = options.color || '#ffffff';
    ctx.font = `${options.weight || 800} ${options.fontSize || 84}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function addLabel(text, x, y, z, scale = 6) {
    const texture = createTextTexture(text, 768, 180, { fontSize: 54 });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
    sprite.position.set(x, y, z);
    sprite.scale.set(scale * 2.8, scale * 0.7, 1);
    scene.add(sprite);
  }

  function addSkySpinner(text, x, y, z, w = 34, h = 7.6) {
    const group = new THREE.Group();
    const texture = createTextTexture(text, 1200, 240, {
      background: 'rgba(16,24,42,.70)',
      border: 'rgba(255,247,214,.96)',
      fontSize: 112,
      color: '#fff6ca'
    });
    const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const planeBack = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    planeBack.rotation.y = Math.PI;
    group.add(plane, planeBack);
    group.position.set(x, y, z);
    scene.add(group);
    animatedObjects.push({
      update(time) {
        group.rotation.y = time * 0.00042;
        group.position.y = y + Math.sin(time * 0.0011) * 1.6;
      }
    });
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

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshStandardMaterial({ color: 0x77ab60, roughness: 1 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.04;
  grass.receiveShadow = true;
  scene.add(grass);

  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), asphaltMat);
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = 0;
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  const shoulder = new THREE.Mesh(
    new THREE.RingGeometry(152, 176, 56),
    new THREE.MeshStandardMaterial({ color: 0x89b56a, roughness: 1 })
  );
  shoulder.rotation.x = -Math.PI / 2;
  shoulder.position.y = -0.035;
  shoulder.receiveShadow = true;
  scene.add(shoulder);

  const groundBody = new CANNON.Body({ mass: 0, material: asphaltPhysics });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);
  staticBodies.push(groundBody);

  addStaticBox({ x: 0, y: 1.25, z: -149, w: 300, h: 2.5, l: 1.2 });
  addStaticBox({ x: 0, y: 1.25, z: 149, w: 300, h: 2.5, l: 1.2 });
  addStaticBox({ x: -149, y: 1.25, z: 0, w: 1.2, h: 2.5, l: 300 });
  addStaticBox({ x: 149, y: 1.25, z: 0, w: 1.2, h: 2.5, l: 300 });

  addSkySpinner('oda judie', 0, 76, -8, 38, 8.4);

  for (let r = 48; r <= 126; r += 26) {
    const pts = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.06, Math.sin(a) * r));
    }
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: r === 48 ? 0xffffff : 0xd9e3f0, transparent: true, opacity: r === 48 ? 0.34 : 0.16 })
    );
    scene.add(line);
  }

  for (let z = 128; z > -136; z -= 10) {
    addLine(0, z, 0.18, 4.8, 0xffffff);
  }
  for (let z = 128; z > -136; z -= 12) {
    addLine(-8.7, z, 0.1, 4.6, 0xcfd8e3);
    addLine(8.7, z, 0.1, 4.6, 0xcfd8e3);
  }

  addLabel('RECTA PRINCIPAL', 0, 7, 98, 5.2);

  const mainUp = addRamp({ x: 0, z: 34, width: 12, length: 24, angle: THREE.MathUtils.degToRad(16), color: 0x6a7380 });
  addPlatform({ x: 0, z: 13, topY: mainUp.highSurfaceY, w: 12, l: 15, h: 0.78, color: 0x5f6772 });
  addRamp({ x: 0, z: -12, width: 12, length: 24, angle: THREE.MathUtils.degToRad(-14), color: 0x6a7380 });
  addLabel('SALTO PRINCIPAL', 0, 9.6, 22, 5.5);

  const sideJumpL = addRamp({ x: -40, z: 16, width: 10, length: 18, angle: THREE.MathUtils.degToRad(18), yaw: THREE.MathUtils.degToRad(16), color: 0x6f7782 });
  addPlatform({ x: -34, z: -2, topY: sideJumpL.highSurfaceY, w: 9, l: 11, h: 0.72, color: 0x666f79 });
  const sideJumpR = addRamp({ x: 40, z: 16, width: 10, length: 18, angle: THREE.MathUtils.degToRad(18), yaw: THREE.MathUtils.degToRad(-16), color: 0x6f7782 });
  addPlatform({ x: 34, z: -2, topY: sideJumpR.highSurfaceY, w: 9, l: 11, h: 0.72, color: 0x666f79 });
  addLabel('RAMPAS LATERALES', 0, 6.5, 3, 5);

  addLabel('SUSPENSIÓN', -54, 6.4, 74, 4.8);
  for (let i = 0; i < 12; i++) {
    addBump(-58 + (i % 2) * 7.5, 58 - i * 8.0, 1.25, 0.34 + (i % 3) * 0.09);
  }
  for (let i = 0; i < 9; i++) addSpeedBump(-47, -8 - i * 3.1, 10.5, 0.11 + (i % 2) * 0.08, 0.70);
  addLine(-52, 24, 12, 112, 0xd9dee3);

  addLabel('SLOPE 24°', 53, 8.6, 63, 4.8);
  const hillUp = addRamp({ x: 52, z: 48, width: 13, length: 28, angle: THREE.MathUtils.degToRad(24), color: 0x646c75 });
  addPlatform({ x: 52, z: 22, topY: hillUp.highSurfaceY, w: 14, l: 22, h: 0.9, color: 0x5d6670 });
  addRamp({ x: 52, z: -8, width: 13, length: 28, angle: THREE.MathUtils.degToRad(-24), color: 0x646c75 });

  addLabel('ARTICULACIÓN', 90, 6.2, 66, 4.7);
  for (let i = 0; i < 7; i++) {
    const a = i % 2 === 0 ? THREE.MathUtils.degToRad(9) : THREE.MathUtils.degToRad(-9);
    addRamp({ x: 90, z: 52 - i * 10.3, width: 10, length: 9.8, angle: a, thickness: 0.46, color: 0x757f89 });
  }

  addLabel('SLALOM', -96, 6.5, -8, 4.6);
  for (let i = 0; i < 16; i++) {
    const x = -96 + (i % 2 === 0 ? -5.5 : 5.5);
    const z = 28 - i * 7;
    addCone(x, z);
  }
  addLine(-96, -26, 14, 118, 0xf8fafc);

  addLabel('PRUEBA DE CHOQUE', 0, 6.2, -112, 5.3);
  addStaticBox({
    x: 0, y: 1.4, z: -128, w: 28, h: 2.8, l: 2.6,
    material: new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.94 })
  });
  addStaticBox({ x: -14.5, y: 0.7, z: -102, w: 0.5, h: 1.4, l: 54 });
  addStaticBox({ x: 14.5, y: 0.7, z: -102, w: 0.5, h: 1.4, l: 54 });
  for (let row = 0; row < 3; row++) {
    for (let col = -3; col <= 3; col++) {
      addDynamicBox({ x: col * 1.35, y: 0.62 + row * 1.18, z: -112, size: 1.10, mass: 9.5, color: row === 2 ? 0xc58d46 : 0xb9803f });
    }
  }

  addLabel('BARRILES', 82, 6.1, -56, 4.4);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      addBarrel(72 + col * 3.1, -48 - row * 3.1);
    }
  }

  addLabel('DROP TEST', -38, 7.8, -58, 4.8);
  addPlatform({ x: -38, z: -50, topY: 5.2, w: 14, l: 18, h: 5.2, color: 0x6a737c });
  addRamp({ x: -38, z: -28, width: 11, length: 18, angle: THREE.MathUtils.degToRad(17), color: 0x7b848d });
  addRamp({ x: -38, z: -70, width: 11, length: 14, angle: THREE.MathUtils.degToRad(-28), color: 0x7b848d });

  addLabel('WALL RIDE', 94, 8.2, 4, 4.8);
  addStaticBox({
    x: 112, y: 4.8, z: 4, w: 2.2, h: 9.6, l: 26,
    pitch: 0,
    yaw: 0,
    roll: THREE.MathUtils.degToRad(24),
    material: new THREE.MeshStandardMaterial({ color: 0x737d86, roughness: 0.88 })
  });
  addStaticBox({ x: 98, y: 0.5, z: 4, w: 18, h: 1, l: 32, material: asphaltMat });

  addLabel('MINI JUMPS', -92, 6.3, 92, 4.6);
  for (let i = 0; i < 4; i++) {
    addRamp({ x: -92, z: 78 - i * 12, width: 10, length: 8.6, angle: THREE.MathUtils.degToRad(12 + i * 2), thickness: 0.42, color: 0x737d86 });
  }

  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const r = 168 + (i % 3) * 6;
    addTree(Math.cos(a) * r, Math.sin(a) * r, 0.94 + (i % 5) * 0.05);
  }
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + 0.18;
    const r = 140 + (i % 2) * 9;
    addTree(Math.cos(a) * r, Math.sin(a) * r, 0.76 + (i % 4) * 0.06);
  }

  const spawn = { x: 0, y: 1.2, z: 118 };

  function syncDynamics() {
    for (const { mesh, body } of dynamicObjects) {
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
    }
    const time = performance.now();
    for (const item of animatedObjects) item.update(time);
  }

  return { spawn, syncDynamics, dynamicObjects, staticBodies };
}
