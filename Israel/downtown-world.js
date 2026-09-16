// A compact, Atlanta-inspired playground rather than a street-for-street replica.
function buildDowntown(THREE, scene, box, materials) {
  const { asphalt, ground, line, dark, glass, chrome, mat } = materials;
  const roads = [-240, -120, 0, 120, 240], blockers = [], animations = [];
  const concrete = mat('#a6a39a'), brick = mat('#9e624c'), grass = mat('#4b7450');
  box(620, .2, 620, ground, 0, -.2, 0);
  for (const n of roads) {
    box(24, .12, 590, asphalt, n, -.03, 0);
    box(590, .12, 24, asphalt, 0, -.02, n);
    for (let k = -280; k <= 280; k += 12) {
      if (roads.some(r => Math.abs(k - r) < 17)) continue;
      box(.18, .02, 5, line, n, .06, k);
      box(5, .02, .18, line, k, .07, n);
    }
  }
  function label(text, x, y, z, width = 20, color = '#173b35') {
    const c = document.createElement('canvas'); c.width = 512; c.height = 96;
    const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = '#fff6dd'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(text, 256, 59);
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthWrite: false }));
    sprite.position.set(x, y, z); sprite.scale.set(width, width * 96 / 512, 1); scene.add(sprite);
    return sprite;
  }
  function facade(base, windows) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 256;
    const ctx = c.getContext('2d'); ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 256);
    for (let y = 4; y < 256; y += 13) for (let x = 4; x < 128; x += 16) {
      ctx.fillStyle = Math.random() > .72 ? '#efcb89' : windows; ctx.fillRect(x, y, 9, 8);
    }
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map, roughness: .4, metalness: .3, emissive: '#af9474', emissiveMap: map, emissiveIntensity: .16 });
  }
  const facades = [facade('#516578', '#81a3b5'), facade('#9d7864', '#394b58'), facade('#33464d', '#77a0a4')];
  function building(x, z, w, d, h, material) {
    box(w, h, d, [material,material,concrete,concrete,material,material], x, h / 2, z);
    box(w + .4, .6, d + .4, concrete, x, h, z);
    box(3, 1.5, 3, dark, x, h + 1, z);
    blockers.push({ x, z, w: w / 2, d: d / 2, h: h + 2 });
  }
  const landmarks = [
    { name: 'Centennial Olympic Park', x: -60, z: -60, color: '#8ded9c' },
    { name: 'Stadium District', x: -180, z: 180, color: '#ff927c' },
    { name: 'Five Points', x: 60, z: 60, color: '#ffd379' },
    { name: 'Peachtree Center', x: 60, z: -180, color: '#93caff' },
    { name: 'Fairlie-Poplar', x: -60, z: 60, color: '#ceb4ff' },
    { name: 'Sweet Auburn', x: 180, z: 60, color: '#ffa5c3' }
  ];
  const leafGeometry = new THREE.IcosahedronGeometry(1, 1), leafMaterial = mat('#3d704c');
  function tree(x, z) {
    box(.5, 3, .5, brick, x, 1.5, z);
    const leaves = new THREE.Mesh(leafGeometry, leafMaterial); leaves.position.set(x, 4, z);
    leaves.scale.set(2.5, 3, 2.5); leaves.castShadow = true; scene.add(leaves);
  }
  for (const x of [-180, -60, 60, 180]) for (const z of [-180, -60, 60, 180]) {
    box(94, .2, 94, concrete, x, -.01, z);
    const district = landmarks.find(l => l.x === x && l.z === z);
    if (district) {
      label(district.name.toUpperCase(), x, 5, z + 43, 19);
      for(const side of [-1,1])box(.16,5,.16,dark,x+side*8,2.5,z+43);
    }
    if (x === -60 && z === -60) {
      box(80, .15, 80, grass, x, .13, z);
      box(9, .06, 86, concrete, x, .24, z); box(86, .06, 9, concrete, x, .25, z);
      for (let i = 0; i < 5; i++) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.7, .22, 8, 24), new THREE.MeshStandardMaterial({ color: ['#67baff','#f3d767','#fff1d6','#70d889','#ef897c'][i] }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(-73 + i * 6.5, .4, -77); scene.add(ring);
      }
      // Ferris wheel beside the park, with cabins that rotate with the wheel.
      const wheel = new THREE.Group(); wheel.position.set(-86, 15, -38); scene.add(wheel);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(12, .28, 8, 48), chrome); wheel.add(rim);
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        const spoke = box(.12, 24, .12, chrome, 0, 0, 0, wheel); spoke.rotation.z = a;
        box(1.4, 1.6, 1.4, glass, Math.sin(a) * 12, Math.cos(a) * 12, 0, wheel);
      }
      box(1, 15, 1, chrome, -86, 7.5, -38);
      animations.push((time,dt)=>{wheel.rotation.z+=dt*.035;});
      for (const dx of [-32, 32]) for (const dz of [-32, 0, 32]) tree(x + dx, z + dz);
    } else if (x === -180 && z === 180) {
      building(x, z, 70, 58, 15, facades[2]);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(46, 11, 8), chrome); roof.position.set(x, 20, z); roof.rotation.y = Math.PI / 8; scene.add(roof);
      label('ATLANTA STADIUM', x, 10, z + 33, 30, '#5c2831');
    } else if (x === 60 && z === -180) {
      for (const dx of [-23, 23]) for (const dz of [-23, 23]) building(x + dx, z + dz, 22, 22, 55 + (dx > 0 ? 24 : 0), facades[0]);
      const hotel = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 85, 32), facades[2]); hotel.position.set(x, 42.5, z); scene.add(hotel);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(13, 11, 4, 32), chrome); top.position.set(x, 86, z); scene.add(top);
      blockers.push({ x, z, w: 11, d: 11, h: 89 });
    } else {
      for (const dx of [-25, 25]) for (const dz of [-25, 25]) {
        const low = district && ['Five Points', 'Sweet Auburn', 'Fairlie-Poplar'].includes(district.name);
        building(x + dx, z + dz, 28, 28, low ? 7 + Math.random() * 15 : 20 + Math.random() * 55, facades[Math.floor(Math.random() * 3)]);
        box(22, .25, 2, brick, x + dx, 3, z + dz + 15);
      }
      if (district) label(district.name === 'Five Points' ? 'MARTA / FIVE POINTS' : 'COFFEE   MUSIC   LOCAL SHOPS', x, 4, z + 40, 24);
      for (const dx of [-40, 40]) tree(x + dx, z);
    }
  }
  for (const x of roads) for (const z of roads) {
    for (const k of [-8, -4, 0, 4, 8]) {
      box(2, .02, 4, line, x + k, .08, z + 16);
      box(4, .02, 2, line, x + 16, .08, z + k);
    }
    box(.25, 7, .25, dark, x + 15, 3.5, z + 15);
    box(4, .2, .2, dark, x + 13, 7, z + 15);
    box(1, .2, .6, new THREE.MeshBasicMaterial({ color: '#ffe5ad' }), x + 11.5, 6.9, z + 15);
  }
  label('PEACHTREE ST', 0, 7, -120, 18);
  label('AUBURN AVE', 120, 7, 0, 18);
  label('CENTENNIAL OLYMPIC PARK DR', -120, 7, -120, 26);
  // Repeated street furniture is instanced to keep the detailed city responsive.
  const instances = new Map();
  function detail(material,x,y,z,w,h,d,angle=0){
    if(!instances.has(material))instances.set(material,[]);
    instances.get(material).push({x,y,z,w,h,d,angle});
  }
  const curb=mat('#d0c9b6'),wood=mat('#946645'),steel=mat('#40545a'),red=mat('#b4503b'),yellow=mat('#d6b052');
  const warm=new THREE.MeshBasicMaterial({color:'#ffe3a3'}),shopGlass=mat('#325b67');shopGlass.metalness=.4;shopGlass.roughness=.2;
  for(const x of [-180,-60,60,180])for(const z of [-180,-60,60,180]){
    for(const side of [-1,1]){
      detail(curb,x+side*47,.18,z, .35,.35,94);
      detail(curb,x,.18,z+side*47,94,.35,.35);
      for(const k of [-32,0,32]){
        const bx=x+k,bz=z+side*43;
        detail(wood,bx,.65,bz,3,.18,.75);detail(wood,bx,1,bz+side*.32,3,.7,.13);
        detail(steel,bx-1,.3,bz,.15,.6,.6);detail(steel,bx+1,.3,bz,.15,.6,.6);
        detail(steel,bx+3,.55,bz,.65,1.1,.65);
        detail(concrete,x+side*43,.55,z+k,1.6,1,1.6);detail(leafMaterial,x+side*43,1.3,z+k,1.8,1,1.8);
      }
      detail(red,x+side*45,.6,z+38,.4,1.1,.4);detail(red,x+side*45,.8,z+38,.85,.2,.25);
      for(let k=-36;k<=36;k+=12){detail(dark,x+k,.115,z+side*46,1,.025,.45);}
    }
    if((x===-60&&z===-60)||(x===-180&&z===180)||(x===60&&z===-180))continue;
    for(const dx of [-25,25])for(const dz of [-25,25]){
      const bx=x+dx,bz=z+dz;
      for(const k of [-9,-3,3,9]){
        detail(shopGlass,bx+k,1.65,bz+14.1,4.5,2.8,.15);
        detail(warm,bx+k,3.25,bz+14.2,3.8,.09,.2);
        detail(concrete,bx+k,1.6,bz+14.25,.12,3.2,.2);
      }
      detail(dark,bx,1.5,bz+14.3,1.5,3,.2);
      detail(dx>0?red:steel,bx,3.5,bz+15,25,.2,2.4);
      detail(dx>0?red:steel,bx,3.15,bz+16.1,25,.6,.15);
      detail(chrome,bx-12,1.6,bz+16,.08,3.2,.08);detail(chrome,bx+12,1.6,bz+16,.08,3.2,.08);
    }
  }
  const shopNames=['PEACHTREE COFFEE','ATL RECORDS','SWEET AUBURN MARKET','FIVE POINTS DELI'];
  for(let i=0;i<4;i++)label(shopNames[i],[-85,35,155,85][i],4.5,[101,51,101,101][i],18,'#23414b');
  for(const n of roads)for(const k of [-180,-60,60,180]){
    for(const side of [-1,1]){
      detail(yellow,n+side*10,.075,k,.12,.025,65);
      detail(yellow,k,.08,n+side*10,65,.025,.12);
      detail(dark,n+side*15,3.2,k,.17,6.4,.17);
      detail(warm,n+side*14.2,6.4,k,1.5,.15,.6);
    }
  }
  const redSignal=new THREE.MeshBasicMaterial({color:'#ff6350'}),greenSignal=new THREE.MeshBasicMaterial({color:'#8affbd'});
  for(const x of roads)for(const z of roads){
    detail(dark,x-14,3,z-14,.16,6,.16);detail(dark,x-12,6,z-14,4,.12,.12);
    detail(dark,x-10,5.5,z-14,.55,1.4,.4);detail(redSignal,x-10,5.9,z-13.77,.25,.25,.06);detail(greenSignal,x-10,5.05,z-13.77,.25,.25,.06);
  }
  const geometry=new THREE.BoxGeometry(1,1,1),dummy=new THREE.Object3D();
  for(const [material,items] of instances){
    const mesh=new THREE.InstancedMesh(geometry,material,items.length);
    items.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.scale.set(p.w,p.h,p.d);dummy.rotation.set(0,p.angle,0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.receiveShadow=true;mesh.castShadow=false;scene.add(mesh);
  }
  // A fountain plaza and low seating walls add a distinct park interior.
  const water=new THREE.MeshStandardMaterial({color:'#65a9b7',metalness:.45,roughness:.18,transparent:true,opacity:.85});
  const pool=new THREE.Mesh(new THREE.CylinderGeometry(7,7,.25,40),water);pool.position.set(-60,.4,-42);scene.add(pool);
  const fountain=new THREE.Mesh(new THREE.CylinderGeometry(.15,.8,3,12),new THREE.MeshBasicMaterial({color:'#b9e8ef',transparent:true,opacity:.55}));fountain.position.set(-60,1.8,-42);scene.add(fountain);
  animations.push(time=>{fountain.scale.y=1+Math.sin(time*2)*.1;});
  const spawn = new THREE.Vector3(4, 0, 30);
  function blocked(x, z, radius) {
    return Math.abs(x) > 284 - radius || Math.abs(z) > 284 - radius || blockers.some(b => Math.abs(x - b.x) < b.w + radius && Math.abs(z - b.z) < b.d + radius);
  }
  return { roads, blockers, landmarks, spawn, blocked, label, animate(time,dt){animations.forEach(fn=>fn(time,dt));} };
}
