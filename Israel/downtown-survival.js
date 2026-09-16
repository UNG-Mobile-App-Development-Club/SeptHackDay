function playDowntown(THREE, scene, camera, renderer, sunlight, box, car, materials, ui) {
  const world = buildDowntown(THREE, scene, box, materials);
  const { mat, dark, chrome, glass } = materials;
  const $ = id => document.getElementById(id), keys = new Set();
  const clamp = THREE.MathUtils.clamp, damp = THREE.MathUtils.damp;
  const angleDelta = (a,b) => Math.atan2(Math.sin(b-a),Math.cos(b-a));
  const turn = (a,b,k,dt) => a + angleDelta(a,b)*(1-Math.exp(-k*dt));
  const flat = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
  let progress = { energy: 0, total: 0, best: 0 };
  try {
    const stored = JSON.parse(localStorage.getItem('atlanta-laser-survival-v1'));
    for (const key of Object.keys(progress)) if (Number.isFinite(stored?.[key])) progress[key] = clamp(stored[key],0,1e9);
  } catch {}
  const save = () => {try {localStorage.setItem('atlanta-laser-survival-v1',JSON.stringify(progress));}catch{}};
  const thresholds = [0,60,160,300,480,700,960,1260,1600,1980];
  const level = () => thresholds.filter(n=>progress.energy>=n).length;
  const beams = () => Math.min(9,3+Math.floor((level()-1)/2)*2);
  let state='ready', hp=100, kills=0, speed=0, heading=0, steering=0, nitro=1, onFoot=false;
  let elapsed=0,last=performance.now(),cooldown=0,beamLife=0,toastTime=0,lastDamage=-10,invincible=6;
  let spawnClock=0,enemyShotClock=0,combo=0,comboClock=0,hitFlash=0,walkCycle=0,view=0;
  let cameraYaw=0,desiredYaw=0,pitch=.2,zoom=1,lookHold=0,waypoint=null,aimYaw=0;
  const viewNames=['CHASE','SHOULDER','FIRST PERSON','BIRD’S EYE'];
  const velocity=new THREE.Vector3(), moveInput=new THREE.Vector3();
  const player=car('#d8e6eb');player.position.copy(world.spawn);
  const person=new THREE.Group();scene.add(person);person.visible=false;
  const suit=mat('#e4ae57'),joints=mat('#364a57');
  box(.48,.6,.3,suit,0,1.15,0,person);box(.34,.4,.16,joints,0,1.15,.21,person);
  const helmet=new THREE.Mesh(new THREE.SphereGeometry(.23,20,16),chrome);helmet.position.y=1.66;person.add(helmet);
  box(.33,.12,.07,glass,0,1.68,-.2,person);
  const legs=[],arms=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group();leg.position.set(side*.14,.84,0);person.add(leg);
    box(.19,.62,.2,joints,0,-.32,0,leg);box(.2,.12,.3,dark,0,-.66,-.05,leg);legs.push(leg);
    const arm=new THREE.Group();arm.position.set(side*.32,1.4,0);person.add(arm);
    box(.16,.5,.17,suit,0,-.23,0,arm);arms.push(arm);
  }
  box(.17,.17,.6,dark,.34,1.13,-.34,person);
  const glow=new THREE.MeshBasicMaterial({color:'#65fff4'});
  box(.13,.1,.08,glow,.34,1.13,-.65,person);
  const turret=new THREE.Group();turret.position.y=1.52;player.add(turret);
  box(.65,.16,.8,dark,0,0,0,turret);
  for(const x of [-.45,0,.45]){box(.16,.16,.8,chrome,x,.15,-.25,turret);box(.1,.1,.08,glow,x,.15,-.7,turret);}
  const active=()=>onFoot?person:player;
  const solidBounds=world.blockers.map(b=>new THREE.Box3(new THREE.Vector3(b.x-b.w,-1,b.z-b.d),new THREE.Vector3(b.x+b.w,b.h||90,b.z+b.d)));
  const ray=new THREE.Ray(),rayHit=new THREE.Vector3();
  function wallDistance(origin,direction,max){
    let nearest=max;ray.set(origin,direction);
    for(const bounds of solidBounds){const hit=ray.intersectBox(bounds,rayHit);if(hit)nearest=Math.min(nearest,origin.distanceTo(hit));}
    return nearest;
  }
  function visibleBetween(a,b){const direction=new THREE.Vector3().subVectors(b,a),length=direction.length();return length<.01||wallDistance(a,direction.normalize(),length)>=length-.2;}
  function move(entity,dx,dz,radius){
    let hit=false;const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.6));
    for(let i=0;i<steps;i++){
      const x=entity.position.x+dx/steps,z=entity.position.z+dz/steps;
      if(!world.blocked(x,entity.position.z,radius))entity.position.x=x;else hit=true;
      if(!world.blocked(entity.position.x,z,radius))entity.position.z=z;else hit=true;
    }
    return hit;
  }
  function toast(message){$('toast').textContent=message;toastTime=3.5;}
  function addEnergy(amount){
    const old=level();progress.energy+=amount;
    if(level()>old){hp=Math.min(100,hp+25);nitro=1;toast(`LASER LEVEL ${level()}! More damage, faster fire, ${beams()} beams. +25 HP`);}
    save();
  }
  function toggleVehicle(){
    if(state!=='running')return;
    if(onFoot){if(flat(person.position,player.position)>4){toast('Your white car is marked on the radar.');return;}onFoot=false;heading=player.rotation.y;}
    else{
      const exits=[[2.8,0],[-2.8,0],[0,3.6],[0,-3.6]].map(([x,z])=>({x:player.position.x+x*Math.cos(heading)+z*Math.sin(heading),z:player.position.z-x*Math.sin(heading)+z*Math.cos(heading)}));
      const exit=exits.find(p=>!world.blocked(p.x,p.z,.5));
      if(!exit){toast('Move into open space to exit.');return;}
      person.position.set(exit.x,0,exit.z);person.rotation.y=heading;onFoot=true;speed=0;
    }
    velocity.set(0,0,0);beamLife=0;keys.clear();$('vehicle').blur();
  }
  function changeView(){view=(view+1)%viewNames.length;toast(`VIEW: ${viewNames[view]} / drag to look around`);$('view').blur();}
  const beam=new THREE.Group();scene.add(beam);beam.visible=false;
  const beamRays=[];
  for(let i=-4;i<=4;i++){
    const group=new THREE.Group();group.userData.index=i;beam.add(group);
    for(const [radius,opacity,color] of [[.16,.22,'#32cfff'],[.045,1,'#d7ffff']]){
      const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,1,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false}));
      mesh.rotation.x=Math.PI/2;group.add(mesh);
    }
    beamRays.push(group);
  }
  const sparks=[],pickups=[],bullets=[];
  const sparkGeometry=new THREE.IcosahedronGeometry(.13,0),sparkMaterial=new THREE.MeshBasicMaterial({color:'#ffd788'});
  const coreGeometry=new THREE.OctahedronGeometry(.55),coreMaterial=new THREE.MeshStandardMaterial({color:'#6bfff0',emissive:'#25bbaf',emissiveIntensity:1});
  const healthMaterial=new THREE.MeshBasicMaterial({color:'#8cff9b'}),bulletGeometry=new THREE.SphereGeometry(.25,8,6),bulletMaterial=new THREE.MeshBasicMaterial({color:'#ff9567'});
  function burst(position,count=12){for(let i=0;i<count&&sparks.length<140;i++){const mesh=new THREE.Mesh(sparkGeometry,sparkMaterial);mesh.position.copy(position);scene.add(mesh);sparks.push({mesh,life:.7,velocity:new THREE.Vector3((Math.random()-.5)*10,Math.random()*7,(Math.random()-.5)*10)});}}
  function drop(position,health=false){
    if(pickups.length>=80){scene.remove(pickups.shift().mesh);}
    const mesh=new THREE.Mesh(coreGeometry,health?healthMaterial:coreMaterial);mesh.position.set(position.x,1,position.z);scene.add(mesh);pickups.push({mesh,health,life:45});
  }
  // Navigation grid lets ground bots route through streets and alleys around solid buildings.
  const cellSize=8,gridSize=71,gridMin=-280;
  const cell=(x,z)=>clamp(Math.round((z-gridMin)/cellSize),0,gridSize-1)*gridSize+clamp(Math.round((x-gridMin)/cellSize),0,gridSize-1);
  const point=id=>({x:gridMin+(id%gridSize)*cellSize,z:gridMin+Math.floor(id/gridSize)*cellSize});
  const walkable=Array.from({length:gridSize*gridSize},(_,id)=>{const p=point(id);return !world.blocked(p.x,p.z,1.1);});
  function nearestCell(position){let id=cell(position.x,position.z);if(walkable[id])return id;let best=Infinity;for(let i=0;i<walkable.length;i++){if(!walkable[i])continue;const d=flat(point(i),position);if(d<best){best=d;id=i;}}return id;}
  const field=new Int16Array(gridSize*gridSize),queue=new Int16Array(gridSize*gridSize);
  let navigationTime=0,lastGoal=-1;
  function neighbors(id){const x=id%gridSize,z=Math.floor(id/gridSize),result=[];if(x>0)result.push(id-1);if(x<gridSize-1)result.push(id+1);if(z>0)result.push(id-gridSize);if(z<gridSize-1)result.push(id+gridSize);return result;}
  function updateField(){
    const goal=nearestCell(active().position);if(goal===lastGoal)return;lastGoal=goal;field.fill(-1);let head=0,tail=1;queue[0]=goal;field[goal]=0;
    while(head<tail){const current=queue[head++];for(const next of neighbors(current)){if(walkable[next]&&field[next]<0){field[next]=field[current]+1;queue[tail++]=next;}}}
  }
  const bots=[];
  const botArmor=mat('#566778'),heavyArmor=mat('#7a5b71'),enemyGlow=new THREE.MeshBasicMaterial({color:'#ff625e'});
  const healthBack=new THREE.SpriteMaterial({color:'#331d27'}),healthFront=new THREE.SpriteMaterial({color:'#ff8272'});
  for(let i=0;i<20;i++){
    const mesh=new THREE.Group();scene.add(mesh);mesh.visible=false;const heavy=i%5===4;
    box(.8,.8,.6,heavy?heavyArmor:botArmor,0,1.15,0,mesh);box(.65,.45,.6,dark,0,1.82,0,mesh);
    box(.48,.1,.04,enemyGlow,0,1.85,-.32,mesh);
    const limbs=[];for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.26,.82,0);box(.26,.75,.32,dark,0,-.37,0,leg);mesh.add(leg);limbs.push(leg);box(.25,.28,.85,botArmor,side*.6,1.2,-.1,mesh);}
    const warning=new THREE.Sprite(new THREE.SpriteMaterial({color:'#ffca55'}));warning.position.y=2.9;warning.scale.set(.22,.4,1);warning.visible=false;mesh.add(warning);
    const back=new THREE.Sprite(healthBack);back.position.y=2.55;back.scale.set(1.4,.12,1);mesh.add(back);
    const bar=new THREE.Sprite(healthFront);bar.position.set(0,2.55,.01);bar.scale.set(1.4,.1,1);mesh.add(bar);
    bots.push({mesh,heavy,limbs,bar,warning,hp:0,maxHp:heavy?80:38,shot:2+Math.random()*3,windup:0,nav:-1});
  }
  function spawnBot(){
    const bot=bots.find(b=>!b.mesh.visible);if(!bot)return;
    const focus=active().position;
    for(let i=0;i<70;i++){
      const a=Math.random()*Math.PI*2,r=38+Math.random()*45,x=focus.x+Math.sin(a)*r,z=focus.z+Math.cos(a)*r;
      if(world.blocked(x,z,1.2)||bots.some(b=>b.mesh.visible&&flat(b.mesh.position,{x,z})<4))continue;
      bot.mesh.position.set(x,0,z);bot.mesh.visible=true;bot.hp=bot.maxHp;bot.shot=2+Math.random()*3;bot.windup=0;bot.nav=-1;return;
    }
  }
  function eliminate(bot){
    if(!bot.mesh.visible)return;
    bot.mesh.visible=false;kills++;progress.total++;progress.best=Math.max(progress.best,kills);combo=comboClock>0?combo+1:1;comboClock=6;
    burst(bot.mesh.position.clone().add(new THREE.Vector3(0,1,0)),18);drop(bot.mesh.position);
    if(kills%3===0||hp<45)drop(bot.mesh.position,true);
    addEnergy(20+(combo>=3?5:0));hp=Math.min(100,hp+3);hitFlash=.12;
    if(combo%5===0)toast(`${combo} BOT STREAK! Keep collecting blue power cores.`);
  }
  function damage(amount){
    if(state!=='running'||invincible>0)return;
    hp=Math.max(0,hp-amount);lastDamage=elapsed;invincible=.65;$('damage-flash').classList.add('hit');
    if(hp===0){
      state='down';keys.clear();velocity.set(0,0,0);speed=0;beamLife=0;
      progress.best=Math.max(progress.best,kills);save();ui.overlay.hidden=false;ui.title.textContent='BACK IN THE FIGHT.';
      ui.message.textContent=`${kills} bots eliminated. Your laser level is saved. Come back with full HP.`;ui.start.textContent='RESPAWN / KEEP UPGRADES';ui.pause.disabled=true;
    }
  }
  const pointer=new THREE.Vector2(0,0),aimRay=new THREE.Raycaster(),aimPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-1.2),aimPoint=new THREE.Vector3();
  let pointerAim=false,drag=null;
  function firing(){return keys.has('KeyF')||keys.has('MouseFire');}
  function updateAim(dt){
    const origin=active().position;
    aimYaw=cameraYaw;
    if(pointerAim&&!drag&&view!==2){aimRay.setFromCamera(pointer,camera);if(aimRay.ray.intersectPlane(aimPlane,aimPoint)&&flat(origin,aimPoint)>2)aimYaw=Math.atan2(origin.x-aimPoint.x,origin.z-aimPoint.z);}
    // Gentle aim assist: pick the closest visible bot inside a generous forward cone.
    let best=null,score=Infinity;
    const eye=new THREE.Vector3(origin.x,1.3,origin.z);
    for(const bot of bots){if(!bot.mesh.visible)continue;const p=bot.mesh.position,d=flat(p,origin),angle=Math.atan2(origin.x-p.x,origin.z-p.z),off=Math.abs(angleDelta(aimYaw,angle));
      if(d<95&&off<.5&&off+d*.002<score&&visibleBetween(eye,new THREE.Vector3(p.x,1.3,p.z))){score=off+d*.002;best=angle;}}
    if(best!==null)aimYaw=best;
    turret.rotation.y=turn(turret.rotation.y,aimYaw-heading,16,dt);
  }
  function fire(){
    if(state!=='running'||cooldown>0)return;
    cooldown=Math.max(.1,.32-(level()-1)*.023);beamLife=.11;
    const origin=active().position.clone();origin.y=1.3;
    beam.position.copy(origin);beam.rotation.y=aimYaw;
    const hit=new Set();
    for(const group of beamRays){
      const i=group.userData.index;group.visible=Math.abs(i)<=Math.floor(beams()/2);if(!group.visible)continue;
      group.rotation.y=i*.047;const a=aimYaw+group.rotation.y,dir=new THREE.Vector3(-Math.sin(a),0,-Math.cos(a));
      const length=wallDistance(origin,dir,85+level()*4);
      group.children.forEach(mesh=>{mesh.scale.y=length;mesh.position.z=-length/2;mesh.scale.x=mesh.scale.z=1+(level()-1)*.07;});
      for(const bot of bots){
        if(!bot.mesh.visible||hit.has(bot))continue;
        const dx=bot.mesh.position.x-origin.x,dz=bot.mesh.position.z-origin.z,forward=dx*dir.x+dz*dir.z;
        if(forward>0&&forward<length&&Math.abs(dx*dir.z-dz*dir.x)<1.15){hit.add(bot);bot.hp-=25+(level()-1)*10;hitFlash=.15;burst(new THREE.Vector3(bot.mesh.position.x,1.3,bot.mesh.position.z),4);if(bot.hp<=0)eliminate(bot);}
      }
    }
  }
  function updateBots(dt){
    navigationTime-=dt;if(navigationTime<=0){updateField();navigationTime=.5;}
    spawnClock-=dt;const cap=Math.min(18,8+Math.floor(elapsed/40));
    if(spawnClock<=0){if(bots.filter(b=>b.mesh.visible).length<cap)spawnBot();spawnClock=1.7;}
    enemyShotClock=Math.max(0,enemyShotClock-dt);
    const focus=active().position,target=new THREE.Vector3(focus.x,1.3,focus.z);
    for(const bot of bots){
      if(!bot.mesh.visible)continue;const position=bot.mesh.position,d=flat(position,focus);
      if(d>150){bot.mesh.visible=false;continue;}
      const eye=new THREE.Vector3(position.x,1.3,position.z),clear=visibleBetween(eye,target);
      let destination=focus;
      if(!clear){
        if(bot.nav<0||flat(position,point(bot.nav))<2){
          const id=nearestCell(position);let best=id;
          for(const n of neighbors(id))if(field[n]>=0&&(field[best]<0||field[n]<field[best]))best=n;
          bot.nav=best;
        }
        destination=point(bot.nav);
      }else bot.nav=-1;
      const dx=destination.x-position.x,dz=destination.z-position.z,len=Math.hypot(dx,dz)||1;
      if(d>12||!clear){
        let vx=dx/len,vz=dz/len;
        for(const other of bots)if(other!==bot&&other.mesh.visible){const spacing=flat(position,other.mesh.position);if(spacing>0&&spacing<2.5){vx+=(position.x-other.mesh.position.x)/spacing*.6;vz+=(position.z-other.mesh.position.z)/spacing*.6;}}
        const norm=Math.hypot(vx,vz)||1,pace=bot.heavy?2.6:3.5;
        if(move(bot.mesh,vx/norm*pace*dt,vz/norm*pace*dt,.8))bot.nav=-1;
      }
      bot.mesh.rotation.y=turn(bot.mesh.rotation.y,Math.atan2(position.x-focus.x,position.z-focus.z),8,dt);
      bot.limbs.forEach((leg,i)=>leg.rotation.x=d>12?Math.sin(elapsed*7+i*Math.PI)*.35:0);
      bot.bar.scale.x=1.4*Math.max(0,bot.hp/bot.maxHp);
      bot.warning.visible=bot.windup>0;
      bot.shot-=dt;
      if(bot.windup>0){
        bot.windup-=dt;bot.mesh.scale.setScalar(1+Math.sin(elapsed*35)*.035);
        if(bot.windup<=0&&clear&&d<48&&bullets.length<36){
          const aim=target.clone().sub(eye);aim.x+=(Math.random()-.5)*3;aim.z+=(Math.random()-.5)*3;
          const mesh=new THREE.Mesh(bulletGeometry,bulletMaterial);mesh.position.copy(eye);scene.add(mesh);
          bullets.push({mesh,velocity:aim.normalize().multiplyScalar(12),life:4});bot.shot=3.5+Math.random()*2;bot.mesh.scale.setScalar(1);
        }
      }else if(bot.shot<=0&&d<48&&clear&&enemyShotClock<=0&&elapsed>6){bot.windup=.7;enemyShotClock=.8;}
      if(d<2.2)damage(3);
      if(!onFoot&&d<3&&Math.abs(speed)>18){eliminate(bot);speed*=.85;}
    }
  }
  function updateEffects(dt){
    for(let i=bullets.length-1;i>=0;i--){
      const b=bullets[i];b.life-=dt;const step=b.velocity.clone().multiplyScalar(dt);
      const blocked=wallDistance(b.mesh.position,step.clone().normalize(),step.length())<step.length();
      b.mesh.position.add(step);
      if(!blocked&&flat(b.mesh.position,active().position)<(onFoot?.9:1.8)){damage(4);b.life=0;}
      if(blocked||b.life<=0){scene.remove(b.mesh);bullets.splice(i,1);}
    }
    for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.life-=dt;p.mesh.position.addScaledVector(p.velocity,dt);p.velocity.y-=12*dt;if(p.life<=0){scene.remove(p.mesh);sparks.splice(i,1);}}
    for(let i=pickups.length-1;i>=0;i--){
      const p=pickups[i];p.life-=dt;p.mesh.rotation.y+=dt*2;p.mesh.position.y=1+Math.sin(elapsed*3+i)*.15;
      const d=flat(p.mesh.position,active().position);
      if(d<12&&visibleBetween(p.mesh.position,new THREE.Vector3(active().position.x,1,active().position.z)))p.mesh.position.lerp(new THREE.Vector3(active().position.x,1,active().position.z),1-Math.exp(-5*dt));
      if(d<2){if(p.health){hp=Math.min(100,hp+24);}else addEnergy(12);p.life=0;}
      if(p.life<=0){scene.remove(p.mesh);pickups.splice(i,1);}
    }
  }
  const traffic=Array.from({length:8},(_,i)=>{const mesh=car(['#8b9dad','#a26858','#537f76'][i%3]);const axis=i%2?'x':'z',lane=world.roads[i%5]+5;mesh.position.set(axis==='x'?-260+i*55:lane,0,axis==='z'?-260+i*55:lane);mesh.rotation.y=axis==='x'?-Math.PI/2:Math.PI;return{mesh,axis};});
  const map=$('minimap'),mapCtx=map.getContext('2d');
  function drawMap(){
    const ctx=mapCtx,px=n=>(n+300)*.4;ctx.fillStyle='#11272c';ctx.fillRect(0,0,240,240);ctx.fillStyle='#435057';
    world.roads.forEach(r=>{ctx.fillRect(px(r-12),0,9.6,240);ctx.fillRect(0,px(r-12),240,9.6);});
    ctx.fillStyle='#687b80';world.blockers.forEach(b=>ctx.fillRect(px(b.x-b.w),px(b.z-b.d),b.w*.8,b.d*.8));
    for(const bot of bots)if(bot.mesh.visible){ctx.fillStyle='#ff716a';ctx.beginPath();ctx.arc(px(bot.mesh.position.x),px(bot.mesh.position.z),2.6,0,Math.PI*2);ctx.fill();}
    for(const p of pickups){ctx.fillStyle=p.health?'#9bff9e':'#70fff4';ctx.fillRect(px(p.mesh.position.x)-1,px(p.mesh.position.z)-1,3,3);}
    if(onFoot){ctx.fillStyle='#fff';ctx.fillRect(px(player.position.x)-3,px(player.position.z)-3,6,6);}
    if(waypoint){ctx.strokeStyle='#ffda86';ctx.beginPath();ctx.arc(px(waypoint.x),px(waypoint.z),5,0,Math.PI*2);ctx.stroke();}
    ctx.save();ctx.translate(px(active().position.x),px(active().position.z));ctx.rotate(-cameraYaw);ctx.fillStyle='#eaffb0';ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(-4,4);ctx.lineTo(4,4);ctx.fill();ctx.restore();
  }
  map.onclick=e=>{if(state!=='running')return;const r=map.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*600-300,z=(e.clientY-r.top)/r.height*600-300;const n=point(nearestCell({x,z}));waypoint=n;toast('Waypoint placed. Explore anywhere.');};
  const marker=new THREE.Mesh(new THREE.TorusGeometry(3,.14,8,32),new THREE.MeshBasicMaterial({color:'#ffda86'}));marker.rotation.x=-Math.PI/2;marker.visible=false;scene.add(marker);
  function clearInput(){keys.clear();drag=null;velocity.set(0,0,0);}
  function pause(){if(state!=='running'&&state!=='paused')return;if(state==='running'){state='paused';clearInput();ui.overlay.hidden=false;ui.title.textContent='TAKE A BREATHER.';ui.message.textContent='The bots can wait. Your laser upgrades are saved.';ui.start.textContent='RESUME';}else{state='running';ui.overlay.hidden=true;ui.start.blur();}ui.pause.textContent=state==='paused'?'▶':'Ⅱ';}
  function respawn(){
    state='running';hp=100;kills=0;combo=0;comboClock=0;speed=0;steering=0;nitro=1;onFoot=false;heading=0;desiredYaw=cameraYaw=0;elapsed=0;lastDamage=-10;invincible=6;spawnClock=0;beamLife=0;cooldown=0;
    player.position.copy(world.spawn);player.rotation.set(0,0,0);clearInput();
    for(const b of bots){b.mesh.visible=false;b.mesh.scale.setScalar(1);}
    for(const item of [...bullets,...pickups,...sparks])scene.remove(item.mesh);bullets.length=pickups.length=sparks.length=0;
    lastGoal=-1;for(let i=0;i<8;i++)spawnBot();
    ui.overlay.hidden=true;ui.pause.disabled=false;ui.start.blur();toast('Hold F or FIRE. Defeat bots and collect blue cores to power up!');
  }
  ui.start.disabled=false;ui.start.textContent='ENTER THE CITY';ui.start.onclick=()=>state==='paused'?pause():respawn();ui.pause.onclick=pause;
  $('vehicle').onclick=toggleVehicle;$('view').onclick=changeView;
  const controls=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyF','KeyQ','KeyC'];
  addEventListener('keydown',e=>{if(controls.includes(e.code)){e.preventDefault();if(state==='running')keys.add(e.code);}if(!e.repeat){if(e.code==='KeyE')toggleVehicle();if(e.code==='KeyV'){e.preventDefault();changeView();}if(e.code==='Escape'||e.code==='KeyP')pause();}});
  addEventListener('keyup',e=>keys.delete(e.code));
  const canvas=renderer.domElement;
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(state!=='running')return;
    canvas.setPointerCapture(e.pointerId);
    if(e.button===2||e.pointerType==='touch'){drag={id:e.pointerId,x:e.clientX,y:e.clientY};pointerAim=false;}
    else if(e.button===0){keys.add('MouseFire');}
  });
  canvas.addEventListener('pointermove',e=>{
    if(state!=='running')return;
    if(drag&&drag.id===e.pointerId){desiredYaw-=(e.clientX-drag.x)*.006;pitch=clamp(pitch+(e.clientY-drag.y)*.004,-.6,1);drag.x=e.clientX;drag.y=e.clientY;lookHold=2.5;pointerAim=false;}
    else if(e.pointerType!=='touch'){pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);pointerAim=true;}
  });
  function releasePointer(e){if(drag?.id===e.pointerId)drag=null;keys.delete('MouseFire');}
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,releasePointer);
  addEventListener('pointerup',()=>keys.delete('MouseFire'));
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=clamp(zoom+e.deltaY*.001,.65,1.65);},{passive:false});
  document.querySelectorAll('[data-key]').forEach(button=>{button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);if(state==='running')keys.add(button.dataset.key);});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(button.dataset.key));});
  addEventListener('blur',()=>{clearInput();if(state==='running')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='running')pause();});
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();state='paused';clearInput();ui.overlay.hidden=false;ui.title.textContent='ENGINE INTERRUPTED';ui.message.textContent='Reload to restore the city. Your laser upgrades are saved.';ui.start.textContent='RELOAD';ui.start.onclick=()=>location.reload();});
  const look=new THREE.Vector3(),desiredCamera=new THREE.Vector3();camera.position.set(12,8,44);scene.add(sunlight.target);
  function updateCamera(dt){
    const focus=active().position;
    const pivot=new THREE.Vector3(focus.x,onFoot?1.55:1.8,focus.z);
    if(view===2){
      desiredCamera.copy(pivot);look.set(pivot.x-Math.sin(cameraYaw)*20,pivot.y-Math.sin(pitch)*15,pivot.z-Math.cos(cameraYaw)*20);
    }else{
      const distance=(view===0?10:view===1?5:25)*zoom,height=view===3?30:(view===1?1.5:4)+pitch*6;
      desiredCamera.set(pivot.x+Math.sin(cameraYaw)*distance,pivot.y+height,pivot.z+Math.cos(cameraYaw)*distance);
      if(view===1){desiredCamera.x+=Math.cos(cameraYaw)*1.5;desiredCamera.z-=Math.sin(cameraYaw)*1.5;}
      const offset=desiredCamera.clone().sub(pivot),length=offset.length(),safe=wallDistance(pivot,offset.normalize(),length);
      if(safe<length)desiredCamera.copy(pivot).addScaledVector(offset,Math.max(.5,safe-.5));
      look.set(pivot.x-Math.sin(cameraYaw)*3,pivot.y-.2,pivot.z-Math.cos(cameraYaw)*3);
    }
    camera.position.lerp(desiredCamera,1-Math.exp(-(view===2?18:8)*dt));
    // Clamp the smoothed camera too, so a transition cannot pass through a building.
    const offset=camera.position.clone().sub(pivot),length=offset.length();if(length>.01){const safe=wallDistance(pivot,offset.normalize(),length);if(safe<length)camera.position.copy(pivot).addScaledVector(offset,Math.max(.35,safe-.3));}
    camera.lookAt(look);camera.fov=damp(camera.fov,view===2?76:62,5,dt);camera.updateProjectionMatrix();
    person.visible=onFoot&&view!==2;player.visible=onFoot||view!==2;
    sunlight.position.set(focus.x-30,65,focus.z-40);sunlight.target.position.copy(focus);
  }
  let mapTime=0;
  function frame(now){
    requestAnimationFrame(frame);const dt=Math.min(Math.max(0,(now-last)/1000),.05);last=now;
    if(state==='running'){
      elapsed+=dt;cooldown=Math.max(0,cooldown-dt);beamLife=Math.max(0,beamLife-dt);toastTime=Math.max(0,toastTime-dt);hitFlash=Math.max(0,hitFlash-dt);invincible=Math.max(0,invincible-dt);comboClock=Math.max(0,comboClock-dt);lookHold=Math.max(0,lookHold-dt);
      if(elapsed-lastDamage>5)hp=Math.min(100,hp+7*dt);
      if(comboClock===0)combo=0;
      if(elapsed-lastDamage>.3)$('damage-flash').classList.remove('hit');
      const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
      const side=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
      const orbit=Number(keys.has('KeyQ'))-Number(keys.has('KeyC'));
      if(orbit){desiredYaw+=orbit*1.8*dt;lookHold=2.5;pointerAim=false;}
      if(!onFoot&&lookHold===0&&!drag&&Math.abs(speed)>4)desiredYaw=turn(desiredYaw,heading,3,dt);
      cameraYaw=turn(cameraYaw,desiredYaw,12,dt);
      if(onFoot){
        const pace=keys.has('Space')?10:6.5,length=Math.hypot(side,forward)||1;
        moveInput.set((Math.cos(cameraYaw)*side-Math.sin(cameraYaw)*forward)/length*pace,0,(-Math.sin(cameraYaw)*side-Math.cos(cameraYaw)*forward)/length*pace);
        velocity.lerp(moveInput,1-Math.exp(-(forward||side?9:12)*dt));
        const before=person.position.clone();move(person,velocity.x*dt,velocity.z*dt,.45);
        const relative=person.position.clone().sub(player.position);
        if(Math.abs(relative.x*Math.cos(heading)-relative.z*Math.sin(heading))<1.3&&Math.abs(relative.x*Math.sin(heading)+relative.z*Math.cos(heading))<2.3)person.position.copy(before);
        const moving=velocity.length(),face=firing()?aimYaw:moving>.2?Math.atan2(-velocity.x,-velocity.z):person.rotation.y;
        person.rotation.y=turn(person.rotation.y,face,11,dt);walkCycle+=moving*dt*1.5;
        legs.forEach((leg,i)=>leg.rotation.x=damp(leg.rotation.x,Math.sin(walkCycle+i*Math.PI)*Math.min(.55,moving*.07),14,dt));
        arms.forEach((arm,i)=>arm.rotation.x=damp(arm.rotation.x,firing()?-.55:-legs[i].rotation.x*.6,12,dt));
      }else{
        const boost=keys.has('Space')&&nitro>.02&&forward>0,target=forward>0?(boost?145:100):forward<0?-28:0;
        speed=damp(speed,target,forward<0?2:forward>0?.8:1.5,dt);steering=damp(steering,side,7,dt);
        heading-=steering*Math.min(Math.abs(speed)/20,1)*1.65*dt*Math.sign(speed);
        const travel=speed/3.6*dt;if(move(player,-Math.sin(heading)*travel,-Math.cos(heading)*travel,1.8))speed*=.5;
        player.rotation.set(0,heading,damp(player.rotation.z,-steering*Math.min(Math.abs(speed)/100,1)*.025,8,dt));player.userData.wheels.forEach(w=>w.rotation.x-=travel/.36);
        nitro=clamp(nitro+(boost?-.24:.19)*dt,0,1);
      }
      updateAim(dt);if(firing())fire();updateBots(dt);updateEffects(dt);
      for(const t of traffic){t.mesh.position[t.axis]+=7*dt;if(t.mesh.position[t.axis]>280)t.mesh.position[t.axis]=-280;t.mesh.userData.wheels.forEach(w=>w.rotation.x-=7*dt/.36);}
      if(waypoint&&flat(active().position,waypoint)<5){waypoint=null;toast('Destination reached.');}
      world.animate?.(elapsed,dt);
    }
    updateCamera(dt);beam.visible=beamLife>0&&state==='running';marker.visible=!!waypoint;if(waypoint)marker.position.set(waypoint.x,.25,waypoint.z);
    const power=level(),next=thresholds[power],previous=thresholds[power-1];
    $('hp-value').textContent=`${Math.ceil(hp)} / 100`;$('hp-fill').style.width=`${hp}%`;$('health').classList.toggle('low',hp<30);
    $('power-level').textContent=`LASER ${power}`;$('power-fill').style.width=`${next?(progress.energy-previous)/(next-previous)*100:100}%`;
    $('power-detail').textContent=next?`${next-progress.energy} POWER TO UPGRADE / ${beams()} BEAMS`:`MAX POWER / ${beams()} BEAMS`;
    $('kills').textContent=kills;$('best').textContent=Math.max(progress.best,kills);$('streak').textContent=combo>=2?`${combo} STREAK`:'EASY / AIM ASSIST ON';
    $('bot-count').textContent=`${bots.filter(b=>b.mesh.visible).length} HOSTILE BOTS`;
    $('view').textContent=`V / ${viewNames[view]}`;$('vehicle').textContent=onFoot?'E / ENTER CAR':'E / EXIT CAR';$('vehicle').disabled=state!=='running';
    $('toast').hidden=toastTime<=0;$('crosshair').classList.toggle('confirmed',hitFlash>0);
    $('crosshair').style.left=`${pointerAim&&!drag&&view!==2?(pointer.x+1)*50:50}%`;$('crosshair').style.top=`${pointerAim&&!drag&&view!==2?(1-pointer.y)*50:50}%`;
    $('district').textContent=world.landmarks.reduce((a,b)=>flat(a,active().position)<flat(b,active().position)?a:b).name.toUpperCase();
    ui.speed.textContent=Math.round(onFoot?velocity.length()*3.6:Math.abs(speed));ui.nitro.style.width=`${nitro*100}%`;
    mapTime+=dt;if(mapTime>.12){drawMap();mapTime=0;}renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);
}
