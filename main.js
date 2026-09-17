const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;
const W = canvas.width, H = canvas.height;
const $ = id => document.getElementById(id);

const player = { ...Dungeon.spawn, y: 0, vy: 0, pitch: 0, eye: 1.65, health: 100, bob: 0, lean: 0 };
let flashlight = true;
const weapons = [
  { name: 'AK-47', type: 'ASSAULT RIFLE', magazine: 30, ammo: 30, reserve: 90, delay: .105, damage: 25, reload: 1.55 },
  { name: 'PISTOL', type: 'SIDEARM', magazine: 12, ammo: 12, reserve: 48, delay: .3, damage: 35, reload: 1.12 }
];
let selected = 0, playing = false, aiming = false, firing = false, reloadUntil = 0, nextShot = 0;
let recoil = 0, toastUntil = 0, lastTime = performance.now();
const keys = new Set();
const weaponView = { aim: 0, inspect: 0, swayX: 0, swayY: 0 };
const combat = CombatEffects.create(Dungeon);
let viewMuzzle = null;
let inspecting = false;

function toast(message, duration = 1.2) { $('toast').textContent = message; toastUntil = performance.now() / 1000 + duration; $('toast').classList.add('visible'); }
function updateHud() {
  const gun = weapons[selected];
  $('weapon-name').textContent = gun.name;
  $('weapon-sub').textContent = gun.type;
  $('ammo-current').textContent = String(gun.ammo).padStart(2, '0');
  $('ammo-reserve').textContent = gun.reserve;
  $('weapon-slot').textContent = `0${selected + 1} / 02`;
  $('slot-one').classList.toggle('selected', selected === 0);
  $('slot-two').classList.toggle('selected', selected === 1);
  $('health-value').textContent = player.health;
  $('health-fill').style.width = `${player.health}%`;
}
function switchWeapon(index) { if (index === selected) return; selected = index; reloadUntil = 0; firing = false; recoil = 0; updateHud(); toast(weapons[index].name + ' EQUIPPED', .8); }
function reload() {
  const gun = weapons[selected];
  if (reloadUntil || gun.ammo === gun.magazine || gun.reserve === 0) return;
  reloadUntil = performance.now() / 1000 + gun.reload;
  toast('RELOADING...', gun.reload);
}
function getCameraPose() {
  const reach=.38*player.lean,dx=Math.cos(player.yaw)*reach,dz=-Math.sin(player.yaw)*reach;
  const steps=Math.max(1,Math.ceil(Math.abs(reach)/.04));
  let allowed=1;
  // Sweep the head sideways, so a lean cannot cross a wall or a corner.
  for(let i=1;i<=steps;i++) {
    if(Dungeon.canOccupy(player.x+dx*i/steps,player.z+dz*i/steps,.14))continue;
    let low=(i-1)/steps,high=i/steps;
    for(let j=0;j<8;j++) {
      const middle=(low+high)/2;
      if(Dungeon.canOccupy(player.x+dx*middle,player.z+dz*middle,.14))low=middle;
      else high=middle;
    }
    allowed=low;break;
  }
  const lean=player.lean*allowed;
  return {...player,x:player.x+dx*allowed,z:player.z+dz*allowed,y:player.y-Math.abs(lean)*.045,roll:-lean*.12,lean};
}
function tryShoot(now) {
  const gun = weapons[selected];
  if (now < nextShot || reloadUntil) return;
  if (!gun.ammo) { toast('EMPTY  ·  PRESS R TO RELOAD'); nextShot = now + .3; return; }
  gun.ammo--; nextShot = now + gun.delay; recoil = aiming ? .2 : .38;
  inspecting = false;
  updateHud();
  const dirX = Math.sin(player.yaw) * Math.cos(player.pitch);
  const dirZ = Math.cos(player.yaw) * Math.cos(player.pitch);
  const dirY = Math.sin(player.pitch);
  const camera=getCameraPose();
  const hit=Dungeon.trace(camera.x,camera.y+camera.eye,camera.z,dirX,dirY,dirZ,40);
  const tip=viewMuzzle?.weapon===selected?viewMuzzle.point:{x:.13,y:-.23,z:1.6};
  const projectionRatio=Math.tan((aiming?53:73)*Math.PI/360)/Math.tan(65*Math.PI/360);
  const x=tip.x*projectionRatio,y=tip.y*projectionRatio,z=tip.z;
  const cr=Math.cos(camera.roll),sr=Math.sin(camera.roll),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
  const right=cr*x-sr*y,up=sr*x+cr*y,forward=cp*z-sp*up;
  let mx=Math.cos(camera.yaw)*right+Math.sin(camera.yaw)*forward;
  let my=cp*up+sp*z,mz=Math.cos(camera.yaw)*forward-Math.sin(camera.yaw)*right;
  const length=Math.hypot(mx,my,mz);mx/=length;my/=length;mz/=length;
  const nearWall=Dungeon.trace(camera.x,camera.y+camera.eye,camera.z,mx,my,mz,.28);
  const reach=nearWall.kind<0?.28:Math.max(.005,nearWall.t-.025);
  combat.fire({x:camera.x+mx*reach,y:camera.y+camera.eye+my*reach,z:camera.z+mz*reach},hit,selected);
}

function project(point, focal) { return { x: W / 2 + point.x / point.z * focal, y: H / 2 - point.y / point.z * focal }; }
function clipNear(points) {
  const output = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const ai = a.z > .12, bi = b.z > .12;
    if (ai) output.push(a);
    if (ai !== bi) { const t = (.12 - a.z) / (b.z - a.z); output.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: .12 }); }
  }
  return output;
}
function drawWorld(focal) {
  const camera=getCameraPose();
  Dungeon.render(ctx,W,H,camera,focal,flashlight,combat.flashStrength);
  combat.draw(ctx,camera,W,H,focal,flashlight);
}
function drawGun(dt, now) {
  const blend = 1 - Math.exp(-dt * 13);
  weaponView.aim += ((aiming && !reloadUntil ? 1 : 0) - weaponView.aim) * blend;
  weaponView.inspect += ((inspecting && !aiming && !firing ? 1 : 0) - weaponView.inspect) * blend;
  weaponView.swayX *= Math.exp(-dt * 9);
  weaponView.swayY *= Math.exp(-dt * 9);
  const a = weaponView.aim, inspect = weaponView.inspect;
  const lean=getCameraPose().lean;
  const moving = playing && ['KeyW','KeyA','KeyS','KeyD'].some(key => keys.has(key));
  const bob = moving && player.y === 0 ? Math.sin(player.bob * 11) * .012 * (1-a*.85) : 0;
  const reloadProgress = reloadUntil ? Math.max(0, 1-(reloadUntil-now)/weapons[selected].reload) : 0;
  const reloadTilt = Math.sin(reloadProgress*Math.PI);
  const yaw = -.3*(1-a) - inspect*1.05 + weaponView.swayX*(1-a*.85);
  const pitch = .035*(1-a) + recoil*.16 - reloadTilt*.22 + weaponView.swayY*(1-a*.85);
  const roll = -.08*(1-a) + inspect*.13 + reloadTilt*.65 - lean*.07*(1-a);
  const position = {
    x: .53*(1-a) + inspect*.12 + lean*.025*(1-a),
    y: -.3*(1-a) - (selected===0?.205:.164)*a + bob - reloadTilt*.17 + inspect*.07,
    z: .97*(1-a) + .32*a + inspect*.68 - recoil*.12
  };
  const cy=Math.cos(yaw), sy=Math.sin(yaw), cp=Math.cos(pitch), sp=Math.sin(pitch), cr=Math.cos(roll), sr=Math.sin(roll);
  function transform([x,y,z]) {
    const px=x, py=cp*y+sp*z, pz=cp*z-sp*y;
    const rx=cy*px+sy*pz, rz=cy*pz-sy*px;
    return {x:cr*rx-sr*py+position.x,y:sr*rx+cr*py+position.y,z:rz+position.z};
  }
  const faces = [];
  for (const face of WeaponModels[selected]) {
    const points=face.vertices.map(transform), p=points[0], q=points[1], r=points[2];
    const u={x:q.x-p.x,y:q.y-p.y,z:q.z-p.z}, v={x:r.x-p.x,y:r.y-p.y,z:r.z-p.z};
    const normal={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x};
    if (normal.x*p.x+normal.y*p.y+normal.z*p.z >= 0) continue;
    const length=Math.hypot(normal.x,normal.y,normal.z);
    const light=(flashlight ? .06+.49*Math.max(0,(.18*normal.x+.45*normal.y-.87*normal.z)/length) : 0)+combat.flashStrength*.8;
    faces.push({points,color:`rgb(${face.color.map(c=>Math.round(c*light)).join(',')})`,depth:points.reduce((sum,p)=>sum+p.z,0)/points.length});
  }
  // Sort all mesh faces together, so hands, magazine and receiver occlude each other.
  faces.sort((a,b)=>b.depth-a.depth);
  const focal=H/(2*Math.tan(65*Math.PI/360));
  for(const face of faces) {
    const points=clipNear(face.points); if(points.length<3) continue;
    ctx.beginPath();
    points.forEach((p,i)=>{const s=project(p,focal);if(i)ctx.lineTo(s.x,s.y);else ctx.moveTo(s.x,s.y);});
    ctx.closePath();ctx.fillStyle=face.color;ctx.fill();
  }
  viewMuzzle={weapon:selected,point:transform([0,selected===0?.025:.055,selected===0?1.735:.64])};
  combat.drawMuzzle(ctx,viewMuzzle.point,W,H,focal,selected);
  $('crosshair').style.opacity=a>.85?'0':'1';
}
function update(dt, now) {
  if (!playing) return;
  combat.update(dt);
  const leanIntent=Number(keys.has('KeyE'))-Number(keys.has('KeyQ'));
  player.lean+=(leanIntent-player.lean)*(1-Math.exp(-dt*12));
  const crouch = keys.has('ControlLeft') || keys.has('ControlRight');
  const sprint = !crouch && (keys.has('ShiftLeft') || keys.has('ShiftRight'));
  const speed = crouch ? 1.2 : sprint ? 4.4 : 2.6;
  let forward = Number(keys.has('KeyW')) - Number(keys.has('KeyS'));
  let strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA'));
  const len = Math.hypot(forward,strafe) || 1; forward /= len; strafe /= len;
  Dungeon.move(player,(Math.sin(player.yaw)*forward + Math.cos(player.yaw)*strafe)*speed*dt,
    (Math.cos(player.yaw)*forward - Math.sin(player.yaw)*strafe)*speed*dt);
  if (forward || strafe) player.bob += dt * (sprint ? 1.5 : crouch ? .65 : 1);
  player.vy -= 18*dt; player.y += player.vy*dt;
  if (player.y < 0) { player.y=0; player.vy=0; }
  player.eye += ((crouch ? 1.02 : 1.65) - player.eye)*Math.min(1,dt*12);
  const ceilingLimit=Dungeon.height-player.eye-.16;
  if(player.y>ceilingLimit){player.y=ceilingLimit;player.vy=Math.min(0,player.vy);}
  $('stance-value').textContent = player.y > .02 ? 'AIRBORNE' : crouch ? 'CROUCHED' : sprint && (forward||strafe) ? 'SPRINTING' : 'STANDING';
  const cameraLean=getCameraPose().lean;
  if(Math.abs(cameraLean)>.1)$('stance-value').textContent+=cameraLean<0?' / LEAN LEFT':' / LEAN RIGHT';
  if (reloadUntil && now >= reloadUntil) { const gun=weapons[selected], amount=Math.min(gun.magazine-gun.ammo,gun.reserve); gun.ammo+=amount;gun.reserve-=amount;reloadUntil=0;updateHud(); }
  if (firing && selected === 0) tryShoot(now);
  recoil=Math.max(0,recoil-dt*2.8);
  if (now > toastUntil) $('toast').classList.remove('visible');
}
function frame(time) {
  const dt=Math.min(.05,(time-lastTime)/1000);lastTime=time; const now=time/1000;
  update(dt,now);
  const focal=H/(2*Math.tan((aiming?53:73)*Math.PI/360));
  drawWorld(focal); drawGun(dt,now); requestAnimationFrame(frame);
}
let lockPending = false;
canvas.tabIndex = -1;
function clearInput() {
  firing = false; aiming = false; keys.clear();
  player.lean = 0;
  weaponView.swayX = 0; weaponView.swayY = 0;
  $('crosshair').classList.remove('aiming');
}
function syncLock() {
  playing = document.pointerLockElement === canvas;
  lockPending = false;
  clearInput();
  $('overlay').classList.toggle('hidden', playing);
  $('play-button').disabled = false;
  canvas.style.cursor = playing ? 'none' : '';
  if (playing) $('lock-error').hidden = true;
}
function lockFailed() {
  if (document.pointerLockElement === canvas) { syncLock(); return; }
  syncLock();
  $('lock-error').textContent = 'Mouse capture was blocked. Click Enter Dungeon to retry. If this browser keeps blocking it, open the game in Chrome or Edge.';
  $('lock-error').hidden = false;
}
function lock() {
  if (lockPending || document.pointerLockElement === canvas) return;
  $('lock-error').hidden = true;
  if (typeof canvas.requestPointerLock !== 'function') { lockFailed(); return; }
  lockPending = true;
  $('play-button').disabled = true;
  canvas.focus({ preventScroll: true });
  // Only pointerlockchange starts play. Never run with an uncaptured cursor.
  try {
    const request = canvas.requestPointerLock();
    if (request && typeof request.catch === 'function') request.catch(lockFailed);
  } catch (_) { lockFailed(); }
}
function pause() {
  clearInput();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  playing = false;
  $('overlay').classList.remove('hidden');
}
$('play-button').addEventListener('click',lock);
canvas.addEventListener('click',()=>{ if (!playing) lock(); });
document.addEventListener('pointerlockchange',syncLock);
document.addEventListener('pointerlockerror',lockFailed);
document.addEventListener('mousemove',e=>{ if (!playing) return; player.yaw += e.movementX*.0026*(aiming?.57:1); player.pitch = Math.max(-1.42,Math.min(1.42,player.pitch-e.movementY*.0026*(aiming?.57:1))); weaponView.swayX=Math.max(-.07,Math.min(.07,weaponView.swayX-e.movementX*.0005)); weaponView.swayY=Math.max(-.05,Math.min(.05,weaponView.swayY+e.movementY*.0005)); });
document.addEventListener('mousedown',e=>{ if (!playing) return; if (e.button===0) { firing=true;tryShoot(performance.now()/1000); } if (e.button===2) { aiming=true;$('crosshair').classList.add('aiming'); } });
document.addEventListener('mouseup',e=>{ if (e.button===0) firing=false; if (e.button===2) { aiming=false;$('crosshair').classList.remove('aiming'); } });
document.addEventListener('contextmenu',e=>e.preventDefault());
document.addEventListener('keydown',e=>{
  if (!playing) return;
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape') { pause(); return; }
  keys.add(e.code);
  if (e.code==='Space' && player.y===0) player.vy=7.2;
  if (e.code==='Digit1') switchWeapon(0);
  if (e.code==='Digit2') switchWeapon(1);
  if (e.code==='KeyR') reload();
  if (e.code==='KeyI' && !e.repeat) inspecting=!inspecting;
  if (e.code==='KeyF' && !e.repeat) { flashlight=!flashlight; $('flashlight-value').textContent=flashlight?'FLASHLIGHT ON':'FLASHLIGHT OFF'; }
});
document.addEventListener('keyup',e=>keys.delete(e.code));
document.addEventListener('wheel',e=>{ if (!playing) return; e.preventDefault(); switchWeapon(selected===0?1:0); },{passive:false});
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{ if(document.hidden) pause(); });
updateHud();requestAnimationFrame(frame);
