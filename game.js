const ui = Object.fromEntries(['scene', 'overlay', 'title', 'message', 'start', 'pause', 'distance', 'best', 'speed', 'nitro'].map(id => [id, document.getElementById(id)]));

try {
  if (!window.THREE) throw new Error('The local three.min.js file is missing or could not be loaded.');
  init(window.THREE);
} catch (error) {
  ui.title.textContent = 'ENGINE OFFLINE';
  ui.message.textContent = `The game could not start: ${error.message}. Make sure three.min.js is beside index.html and your browser supports WebGL.`;
  ui.start.textContent = 'RELOAD';
  ui.start.disabled = false;
  ui.start.onclick = () => location.reload();
  console.error(error);
}

function init(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#d49183');
  scene.fog = new THREE.Fog('#d49183', 65, 240);
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 500);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  ui.scene.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffedda, 0x666080, 2.4));
  const sunlight = new THREE.DirectionalLight(0xffd6a0, 3);
  sunlight.position.set(-30, 50, -60);
  scene.add(sunlight);

  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const asphalt = mat('#3d4149'), sand = mat('#c29478'), line = mat('#eee3c4');
  const dark = mat('#20232d'), glass = mat('#344854'), chrome = mat('#cac5ae');
  function box(w, h, d, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  box(600, .2, 600, sand, 0, -.2, -140);
  box(14, .12, 360, asphalt, 0, -.03, -135);
  for (const x of [-6.6, 6.6]) box(.12, .02, 360, line, x, .05, -135);
  const moving = [];
  // Roadside detail is recycled with the road, keeping the scene bounded.
  for (const x of [-7.7, 7.7]) {
    box(.18, .18, 360, chrome, x, .85, -135);
    box(.18, .12, 360, chrome, x, .55, -135);
  }
  const rockGeometry = new THREE.DodecahedronGeometry(1, 0), rockMaterial = mat('#9b7868');
  for (let i = 0; i < 65; i++) {
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set((i % 2 ? -1 : 1) * (9 + Math.random() * 55), .3, -Math.random() * 280);
    rock.scale.set(1 + Math.random() * 2, .4 + Math.random(), .6 + Math.random());
    scene.add(rock); moving.push(rock);
  }
  for (let z = -260; z < 20; z += 40) {
    const lamp = new THREE.Group();
    box(.18, 7, .18, dark, -8.5, 3.5, 0, lamp);
    box(3, .16, .16, dark, -7.1, 7, 0, lamp);
    box(.8, .12, .5, new THREE.MeshBasicMaterial({ color: '#fff0b0' }), -5.9, 6.85, 0, lamp);
    lamp.position.z = z; scene.add(lamp); moving.push(lamp);
  }
  const signCanvas = document.createElement('canvas'); signCanvas.width = 512; signCanvas.height = 256;
  const signContext = signCanvas.getContext('2d');
  signContext.fillStyle = '#176455'; signContext.fillRect(0, 0, 512, 256);
  signContext.strokeStyle = '#f3ecd4'; signContext.lineWidth = 10; signContext.strokeRect(10, 10, 492, 236);
  signContext.fillStyle = '#fff8e9'; signContext.font = 'bold 45px sans-serif'; signContext.textAlign = 'center';
  signContext.fillText('SUNSET HIGHWAY', 256, 80); signContext.font = '30px sans-serif';
  signContext.fillText('DESTRUCTION ZONE', 256, 140); signContext.fillText('KEEP GOING  ↑', 256, 205);
  const gantry = new THREE.Group();
  for (const x of [-8, 8]) box(.3, 8.5, .3, chrome, x, 4.25, 0, gantry);
  box(16.5, .3, .3, chrome, 0, 8.4, 0, gantry);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(signCanvas) }));
  sign.position.set(0, 7, .2); gantry.add(sign); gantry.position.z = -180; scene.add(gantry); moving.push(gantry);
  for (let z = -260; z < 25; z += 9) {
    for (const x of [-2.2, 2.2]) moving.push(box(.12, .025, 4, line, x, .055, z));
  }
  for (let z = -270; z < 30; z += 10) {
    for (const x of [-7.3, 7.3]) {
      const post = new THREE.Group();
      box(.16, .85, .16, chrome, x, .4, 0, post);
      box(.19, .18, .19, mat('#f6e1a1'), x, .7, 0, post);
      post.position.z = z;
      scene.add(post); moving.push(post);
    }
  }
  const sun = new THREE.Mesh(new THREE.SphereGeometry(19, 40, 24), new THREE.MeshBasicMaterial({ color: '#ffe2a0', fog: false }));
  sun.position.set(-58, 36, -235); scene.add(sun);
  for (let i = 0; i < 28; i++) {
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(18 + Math.random() * 27, 15 + Math.random() * 32, 4), mat(i % 2 ? '#ac7f80' : '#b98a83'));
    mountain.position.set((i % 2 ? -1 : 1) * (35 + Math.random() * 140), 6, -80 - Math.random() * 180);
    mountain.rotation.y = Math.random() * Math.PI; scene.add(mountain);
  }
  const cactusMaterial = mat('#626f57');
  for (let i = 0; i < 42; i++) {
    const cactus = new THREE.Group();
    const h = 1.8 + Math.random() * 2.3;
    box(.4, h, .4, cactusMaterial, 0, h / 2, 0, cactus);
    box(1.3, .3, .3, cactusMaterial, .5, h * .55, 0, cactus);
    box(.3, h * .45, .3, cactusMaterial, 1, h * .75, 0, cactus);
    cactus.position.set((i % 2 ? -1 : 1) * (10 + Math.random() * 32), 0, -Math.random() * 280);
    scene.add(cactus); moving.push(cactus);
  }

  function car(color) {
    const group = new THREE.Group(), paint = mat(color);
    box(1.85, .48, 3.8, paint, 0, .62, 0, group);
    box(1.62, .32, 1.3, paint, 0, .83, -1.05, group);
    box(1.5, .58, 1.65, glass, 0, 1.12, .2, group);
    box(1.55, .08, 1.45, paint, 0, 1.43, .24, group);
    box(1.9, .13, .15, chrome, 0, .48, 1.94, group);
    for (const side of [-1, 1]) {
      box(.12, .18, .35, paint, side * 1.03, 1.06, -.55, group);
      box(.035, .45, .08, paint, side * .77, 1.12, .15, group);
      box(.035, .035, 2.8, chrome, side * .935, .88, 0, group);
      for (const z of [-.25, .8]) box(.045, .06, .23, chrome, side * .95, .78, z, group);
      for (const z of [-1.17, 1.2]) {
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, .025, 12), chrome);
        rim.rotation.z = Math.PI / 2; rim.position.set(side * 1.09, .36, z); group.add(rim);
      }
    }
    box(.22, .15, .35, dark, -.6, .3, 1.9, group);
    for (const x of [-.66, .66]) {
      box(.42, .15, .04, new THREE.MeshBasicMaterial({ color: '#ff5c45' }), x, .72, 1.92, group);
      box(.4, .16, .04, mat('#fff3cd'), x, .74, -1.92, group);
      for (const z of [-1.17, 1.2]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.36, .36, .24, 12), dark);
        wheel.rotation.z = Math.PI / 2; wheel.position.set(Math.sign(x) * .96, .36, z); group.add(wheel);
      }
    }
    box(.18, .015, 1.2, dark, -.3, 1.0, -1.05, group);
    box(.18, .015, 1.2, dark, .3, 1.0, -1.05, group);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 4.2), new THREE.MeshBasicMaterial({ color: '#23232b', transparent: true, opacity: .28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .065; group.add(shadow);
    scene.add(group); return group;
  }
  // A simple Corolla-inspired sedan, built locally from geometry.
  const player = car('#e7e9e8'); player.position.set(2.2, 0, 7);
  box(1.4, .25, .06, dark, 0, .53, -1.94, player);
  box(1.6, .1, .07, chrome, 0, .84, -1.95, player);
  box(1.58, .14, .7, mat('#e7e9e8'), 0, .95, 1.25, player);
  for (const x of [-.76, .76]) box(.065, .54, 1.65, mat('#e7e9e8'), x, 1.12, .2, player);
  function badge(text, z, width) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const context = canvas.getContext('2d');
    context.fillStyle = '#e7e9e8'; context.fillRect(0, 0, 512, 128);
    context.fillStyle = '#222932'; context.font = 'bold 48px sans-serif'; context.textAlign = 'center';
    context.fillText(text, 256, 82);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) }));
    mesh.position.set(0, .78, z); if (z < 0) mesh.rotation.y = Math.PI; player.add(mesh);
  }
  badge('TOYOTA  COROLLA', 1.956, 1.18); badge('TOYOTA', -1.99, .7);
  const laserMaterial = new THREE.MeshBasicMaterial({ color: '#55ffff' });
  for (const x of [-.72, .72]) {
    box(.22, .22, .7, dark, x, .9, -1.9, player);
    box(.15, .15, .08, laserMaterial, x, .9, -2.27, player);
  }
  const traffic = Array.from({ length: 7 }, (_, i) => car(['#ec795f', '#d4d8cf', '#668d9a', '#a9ad80'][i % 4]));
  const keys = new Set();
  let state = 'ready', speed = 0, distance = 0, nitro = 1, best = 0, last = performance.now();
  let fireTime = 0, shotCooldown = 0, destroyed = 0, effectTime = 0;
  let beamTime = 0, shake = 0;
  const beam = new THREE.Group(); scene.add(beam); beam.visible = false;
  const beamLength = 145;
  for (const [radius, color, opacity] of [[1.35, '#0066ff', .18], [.8, '#0088ff', .48], [.3, '#bafaff', 1]]) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, beamLength, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.rotation.x = Math.PI / 2; mesh.position.z = -beamLength / 2; beam.add(mesh);
  }
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#6cdeff', transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.add(muzzle);
  const laserLight = new THREE.PointLight('#0088ff', 0, 20); scene.add(laserLight);
  const combatHud = document.getElementById('combat');
  const particles = [];
  const particleGeometry = new THREE.IcosahedronGeometry(.25, 0);
  const flameMaterials = ['#ff5020', '#ff9d19', '#fff29a'].map(color => new THREE.MeshBasicMaterial({ color }));
  const flames = new THREE.Group(); player.add(flames);
  for (let i = 0; i < 22; i++) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(.26, 1.6, 5), flameMaterials[i % 3]);
    flame.position.set((Math.random() - .5) * 1.9, .9, (Math.random() - .5) * 3.7);
    flame.rotation.x = .4; flames.add(flame);
  }
  flames.visible = false;
  const pickups = Array.from({ length: 3 }, () => {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.8, .13, 6, 20), flameMaterials[1]);
    group.add(ring);
    const core = new THREE.Mesh(new THREE.ConeGeometry(.48, 1.4, 5), flameMaterials[0]);
    group.add(core); scene.add(group); return group;
  });
  function resetCombat() {
    for (const item of particles) scene.remove(item.mesh);
    particles.length = 0;
    fireTime = 0; shotCooldown = 0; destroyed = 0; effectTime = 0; flames.visible = false;
    beamTime = 0; shake = 0; beam.visible = false; laserLight.intensity = 0;
    pickups.forEach((item, i) => item.position.set([0, -4.4, 4.4][i], 1.35, -65 - i * 125));
  }
  function recycle(car) {
    car.position.z = Math.min(-110, ...traffic.map(other => other.position.z)) - 32 - Math.random() * 18;
    car.position.x = [-4.4, 0, 4.4][Math.floor(Math.random() * 3)];
  }
  function explode(car) {
    destroyed++;
    shake = Math.max(shake, .35);
    // Throw actual body panels and wheels away from the destroyed car.
    car.children.filter(child => child.isMesh).slice(0, 20).forEach((part, i) => {
      if (particles.length >= 420) return;
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.position.copy(part.position).add(car.position); mesh.rotation.copy(part.rotation);
      scene.add(mesh);
      particles.push({ mesh, life: 2.4, debris: true, velocity: new THREE.Vector3((Math.random() - .5) * 18, 5 + Math.random() * 10, (Math.random() - .5) * 18), spin: new THREE.Vector3(i % 3 + 2, 4, 3) });
    });
    for (let i = 0; i < 45 && particles.length < 420; i++) {
      const mesh = new THREE.Mesh(particleGeometry, flameMaterials[i % 3]);
      mesh.position.copy(car.position); mesh.position.y = 1;
      scene.add(mesh);
      particles.push({ mesh, life: 1.3, velocity: new THREE.Vector3((Math.random() - .5) * 20, 3 + Math.random() * 12, (Math.random() - .5) * 20) });
    }
    recycle(car);
  }
  function updateCombat(dt, travel) {
    effectTime += dt; fireTime = Math.max(0, fireTime - dt); shotCooldown -= dt;
    beamTime = Math.max(0, beamTime - dt); shake = Math.max(0, shake - dt);
    if ((keys.has('MouseFire') || keys.has('KeyF')) && shotCooldown <= 0) fireMegaLaser();
    beam.visible = beamTime > 0;
    beam.position.set(player.position.x, .95, player.position.z - 2.3);
    muzzle.scale.setScalar(.8 + Math.sin(effectTime * 50) * .2);
    laserLight.position.copy(beam.position); laserLight.intensity = beam.visible ? 12 : 0;
    if (beam.visible) {
      for (const car of traffic) {
        if (Math.abs(car.position.x - player.position.x) < 2.2 && car.position.z < player.position.z - 2 && car.position.z > player.position.z - beamLength) explode(car);
      }
    }
    for (const pickup of pickups) {
      pickup.position.z += travel; pickup.rotation.y += dt * 2;
      if (Math.abs(pickup.position.z - player.position.z) < 2.5 && Math.abs(pickup.position.x - player.position.x) < 1.4) {
        fireTime = 8; nitro = 1; pickup.position.z = -340;
        pickup.position.x = [-4.4, 0, 4.4][Math.floor(Math.random() * 3)];
      } else if (pickup.position.z > 25) pickup.position.z = -340;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const particle = particles[i]; particle.life -= dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.position.z += travel; particle.velocity.y -= 12 * dt;
      if (particle.debris) {
        particle.mesh.rotation.x += particle.spin.x * dt; particle.mesh.rotation.y += particle.spin.y * dt;
        if (particle.mesh.position.y < .25) { particle.mesh.position.y = .25; particle.velocity.y = Math.abs(particle.velocity.y) * .35; }
      } else particle.mesh.scale.setScalar(Math.max(.01, particle.life * 4));
      if (particle.life <= 0) { scene.remove(particle.mesh); particles.splice(i, 1); }
    }
    flames.visible = fireTime > 0;
    flames.children.forEach((flame, i) => flame.scale.setScalar(.65 + .5 * Math.abs(Math.sin(effectTime * 18 + i))));
  }
  resetCombat();
  function fireMegaLaser() {
    if (state !== 'running') return;
    beamTime = .65; shotCooldown = .8; shake = .18;
  }
  document.getElementById('game').addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button, a') || state !== 'running') return;
    e.preventDefault(); keys.add('MouseFire'); fireMegaLaser();
  });
  addEventListener('pointerup', () => keys.delete('MouseFire'));
  addEventListener('pointercancel', () => keys.delete('MouseFire'));
  try { best = Number(localStorage.getItem('sunset-run-best')) || 0; } catch {}
  ui.best.textContent = best.toFixed(2);
  function resetTraffic() {
    traffic.forEach((car, i) => { car.position.set([-4.4, 0, 4.4][Math.floor(Math.random() * 3)], 0, -40 - i * 38); });
  }
  resetTraffic();
  function start() {
    ui.start.blur();
    keys.clear(); speed = 40; distance = 0; nitro = 1;
    resetCombat();
    player.position.x = 0; player.rotation.set(0, 0, 0);
    resetTraffic(); state = 'running'; ui.overlay.hidden = true;
    ui.pause.disabled = false; ui.pause.textContent = 'Ⅱ'; ui.pause.setAttribute('aria-label', 'Pause game');
  }
  function showOverlay(title, message, button) {
    ui.title.textContent = title; ui.message.textContent = message;
    ui.start.textContent = button; ui.overlay.hidden = false;
  }
  function pause() {
    if (state === 'running') {
      state = 'paused'; keys.clear();
      showOverlay('PIT STOP.', 'Take a breath. Your highway is waiting.', 'RESUME RUN ↗');
      ui.pause.textContent = '▶'; ui.pause.setAttribute('aria-label', 'Resume game');
    } else if (state === 'paused') {
      ui.start.blur(); ui.pause.blur();
      state = 'running'; ui.overlay.hidden = true;
      ui.pause.textContent = 'Ⅱ'; ui.pause.setAttribute('aria-label', 'Pause game');
    }
  }
  function crash() {
    state = 'crashed'; speed = 0; keys.clear(); ui.pause.disabled = true;
    if (distance > best) {
      best = distance;
      try { localStorage.setItem('sunset-run-best', String(best)); } catch {}
      ui.best.textContent = best.toFixed(2);
    }
    showOverlay('END OF THE ROAD.', `You made it ${distance.toFixed(2)} km. One more run?`, 'TRY AGAIN ↗');
  }
  ui.start.disabled = false; ui.start.innerHTML = 'START YOUR ENGINE <span>↗</span>';
  ui.start.onclick = () => state === 'paused' ? pause() : start();
  ui.pause.onclick = pause;
  const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyF'];
  addEventListener('keydown', e => {
    if (gameKeys.includes(e.code) && e.target.tagName !== 'BUTTON') { e.preventDefault(); keys.add(e.code); }
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) pause();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); if (state === 'running') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'running') pause(); });
  document.querySelectorAll('[data-key]').forEach(button => {
    button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); keys.add(button.dataset.key); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => keys.delete(button.dataset.key));
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
  });
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault(); state = 'paused'; keys.clear();
    showOverlay('ENGINE INTERRUPTED', 'Graphics connection lost. Refresh the page to restart.', 'RELOAD ↗');
    ui.start.onclick = () => location.reload(); ui.pause.disabled = true;
  });
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, .05); last = now;
    let boost = false;
    if (state === 'running') {
      const accelerate = keys.has('ArrowUp') || keys.has('KeyW');
      const brake = keys.has('ArrowDown') || keys.has('KeyS');
      boost = keys.has('Space') && nitro > .02 && !brake;
      const target = brake ? 28 : fireTime > 0 ? 290 : boost ? 245 : accelerate ? 185 : 100;
      speed = THREE.MathUtils.damp(speed, target, brake ? 2 : .65, dt);
      nitro = THREE.MathUtils.clamp(nitro + (boost ? -.26 : .12) * dt, 0, 1);
      const steer = Number(keys.has('ArrowRight') || keys.has('KeyD')) - Number(keys.has('ArrowLeft') || keys.has('KeyA'));
      player.position.x = THREE.MathUtils.clamp(player.position.x + steer * dt * (3 + speed / 55), -5.55, 5.55);
      player.rotation.z = THREE.MathUtils.damp(player.rotation.z, -steer * .055, 8, dt);
      player.rotation.y = THREE.MathUtils.damp(player.rotation.y, -steer * .10, 8, dt);
      distance += speed * dt / 3600;
      if (distance >= best + .01) {
        best = distance; ui.best.textContent = best.toFixed(2);
        try { localStorage.setItem('sunset-run-best', String(best)); } catch {}
      }
      const travel = speed / 3.6 * dt;
      updateCombat(dt, travel);
      moving.forEach(item => { item.position.z += travel; if (item.position.z > 35) item.position.z -= 300; });
      for (const car of traffic) {
        car.position.z += Math.max(6, speed / 3.6 - 12) * dt;
        if (Math.abs(car.position.z - player.position.z) < 3.55 && Math.abs(car.position.x - player.position.x) < 1.78) {
          explode(car);
          if (fireTime <= 0) speed *= .8;
          continue;
        }
        if (car.position.z > 22) {
          recycle(car);
        }
      }
    }
    const preview = state === 'ready';
    combatHud.textContent = fireTime > 0 ? `ON FIRE! ${fireTime.toFixed(1)}s / ${destroyed} WRECKED` : `LEFT CLICK: MEGA LASER / ${destroyed} WRECKED / RAM EVERYTHING`;
    combatHud.classList.toggle('on-fire', fireTime > 0);
    camera.position.set(preview ? 9 : player.position.x * .32, preview ? 6 : 5.1, preview ? 19 : 17);
    camera.lookAt(preview ? 0 : player.position.x * .5, .8, preview ? -15 : -12);
    if (state === 'running' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      camera.position.x += Math.sin(effectTime * 65) * shake * .4;
      camera.position.y += Math.cos(effectTime * 53) * shake * .25;
    }
    camera.fov = THREE.MathUtils.damp(camera.fov, boost ? 67 : 58, 3, dt); camera.updateProjectionMatrix();
    ui.speed.textContent = Math.round(speed); ui.distance.textContent = distance.toFixed(2); ui.nitro.style.width = `${nitro * 100}%`;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
