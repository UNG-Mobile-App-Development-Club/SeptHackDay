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
  scene.background = new THREE.Color('#b4b9ce');
  scene.fog = new THREE.Fog('#b4b9ce', 180, 620);
  const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 750);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  ui.scene.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffedda, 0x666080, 2.4));
  const sunlight = new THREE.DirectionalLight(0xffd6a0, 3);
  sunlight.position.set(-30, 50, -60);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunlight.shadow.camera, { left: -35, right: 35, top: 45, bottom: -45, near: 1, far: 180 });
  sunlight.shadow.bias = -.0003;
  scene.add(sunlight);

  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const asphalt = mat('#3d4149'), ground = mat('#536b4b'), line = mat('#eee3c4');
  const dark = mat('#20232d'), glass = mat('#344854'), chrome = mat('#cac5ae');
  chrome.metalness = .85; chrome.roughness = .25;
  glass.metalness = .45; glass.roughness = .12;
  const roadCanvas = document.createElement('canvas'); roadCanvas.width = roadCanvas.height = 256;
  const roadContext = roadCanvas.getContext('2d');
  roadContext.fillStyle = '#45474b'; roadContext.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14000; i++) {
    const shade = 45 + Math.floor(Math.random() * 55);
    roadContext.fillStyle = `rgb(${shade},${shade},${shade})`;
    roadContext.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
  }
  const roadTexture = new THREE.CanvasTexture(roadCanvas);
  roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping; roadTexture.repeat.set(4, 80);
  asphalt.map = roadTexture; asphalt.bumpMap = roadTexture; asphalt.bumpScale = .035;
  function box(w, h, d, material, x, y, z, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = h > .1; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function car(color) {
    const group = new THREE.Group(), paint = mat(color);
    paint.metalness = .5; paint.roughness = .28;
    group.userData.wheels = [];
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
        wheel.castShadow = true; group.userData.wheels.push(wheel);
        const spoke = box(.26, .07, .52, chrome, 0, 0, 0, wheel);
        spoke.rotation.z = Math.PI / 2;
      }
    }
    box(.18, .015, 1.2, dark, -.3, 1.0, -1.05, group);
    box(.18, .015, 1.2, dark, .3, 1.0, -1.05, group);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 4.2), new THREE.MeshBasicMaterial({ color: '#23232b', transparent: true, opacity: .28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = .065; group.add(shadow);
    scene.add(group); return group;
  }
  playDowntown(THREE, scene, camera, renderer, sunlight, box, car,
    { asphalt, ground, line, dark, glass, chrome, mat }, ui);
}
