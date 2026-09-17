const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const dungeon = new Function(fs.readFileSync(path.join(__dirname, '../dungeon.js'), 'utf8')+';return Dungeon;')();
const {cell, size, height, spawn} = dungeon;

assert(dungeon.canOccupy(spawn.x, spawn.z), 'Spawn must have room for the player');
const visited = new Set();
const queue = [[Math.floor(spawn.x/cell), Math.floor(spawn.z/cell)]];
for (let i=0;i<queue.length;i++) {
  const [x,z]=queue[i], key=`${x},${z}`;
  if(visited.has(key)||dungeon.solid(x,z))continue;
  visited.add(key);
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])queue.push([x+dx,z+dz]);
}
let walkable=0;
for(let z=0;z<size;z++)for(let x=0;x<size;x++) {
  if(!dungeon.solid(x,z))walkable++;
  if(x===0||z===0||x===size-1||z===size-1)assert(dungeon.solid(x,z),'Maze boundary must be sealed');
}
assert.equal(visited.size,walkable,'All rooms and corridors must connect to the spawn');

const player={...spawn,y:0,eye:1.65,pitch:0};
const wall=dungeon.trace(player.x,player.eye,player.z,0,0,1,40);
assert.equal(wall.kind,0);
assert(Math.abs(wall.z-6*cell)<1e-6,'Initial hall ends at its blind corner');
assert.equal(dungeon.trace(player.x,player.eye,player.z,0,1,0).y,height);
assert.equal(dungeon.trace(player.x,player.eye,player.z,0,-1,0).y,0);
const walker={...player};
dungeon.move(walker,0,40);
assert(walker.z<wall.z-.22,'Sprinting must not tunnel through a wall');
assert(dungeon.canOccupy(walker.x,walker.z));
for(let i=0;i<4000;i++) {
  dungeon.move(walker,Math.sin(i*1.37)*.8,Math.cos(i*.53)*.8);
  assert(dungeon.canOccupy(walker.x,walker.z),'Movement must stay clear of walls, including corners');
}

let image;
const ctx={createImageData:(width,height)=>({width,height,data:new Uint8ClampedArray(width*height*4)}),putImageData:value=>{image=value;}};
const width=480,pixelHeight=270,focal=pixelHeight/(2*Math.tan(73*Math.PI/360));
const start=performance.now();
for(let i=0;i<4;i++)dungeon.render(ctx,width,pixelHeight,player,focal,true);
const lit=new Uint8ClampedArray(image.data);
assert(lit.some((value,index)=>index%4!==3&&value>50),'Flashlight should reveal the concrete');
assert(lit.filter((_,index)=>index%4===0&&lit[index]===0).length>width*pixelHeight*.1,'Beam should leave the edges dark');
dungeon.render(ctx,width,pixelHeight,player,focal,false);
assert(image.data.every((value,index)=>value===(index%4===3?255:0)),'Flashlight off must leave no ambient light');
for(const pitch of [-1.42,1.42])dungeon.render(ctx,width,pixelHeight,{...player,pitch},focal,true);
console.log(`PASS: ${walkable} connected cells; walls, ceiling, collision, flashlight blackout. Mean render ${((performance.now()-start)/7).toFixed(1)} ms.`);

// Exercise the real player update and key handlers against the new environment.
const elements=new Map(),listeners={};
const document={
  getElementById(id){
    if(!elements.has(id))elements.set(id,{width,height:pixelHeight,style:{},classList:{add(){},remove(){},toggle(){}},getContext:()=>ctx,addEventListener(){}});
    return elements.get(id);
  },
  addEventListener(name,fn){listeners[name]=fn;}
};
const CombatEffects=new Function(fs.readFileSync(path.join(__dirname,'../combat-effects.js'),'utf8')+';return CombatEffects;')();
const game={Dungeon:dungeon,CombatEffects,document,window:{addEventListener(){}},performance,requestAnimationFrame(){},Math};
vm.createContext(game);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../main.js'),'utf8'),game);
vm.runInContext('playing=true;keys.add("KeyW");for(let i=0;i<400;i++)update(.016,i*.016);keys.clear();player.vy=7.2;',game);
for(let i=0;i<100;i++) {
  vm.runInContext(`update(.016,${10+i*.016})`,game);
  assert(vm.runInContext('player.y+player.eye',game)<=height-.159,'Jump must stop below the ceiling');
}
assert.equal(vm.runInContext('player.y',game),0,'Player should land after jumping');
listeners.keydown({code:'KeyF',repeat:false});
assert.equal(vm.runInContext('flashlight',game),false);
assert.equal(elements.get('flashlight-value').textContent,'FLASHLIGHT OFF');
vm.runInContext('tryShoot(20)',game);
assert.equal(vm.runInContext('weapons[0].ammo',game),29,'Shooting still works in the dungeon');
console.log('PASS: player movement, ceiling-limited jump, flashlight key, and shooting integration.');

vm.runInContext('Object.assign(player,Dungeon.spawn,{y:0,lean:0,pitch:0});keys.clear();',game);
const bodyX=vm.runInContext('player.x',game);
listeners.keydown({code:'KeyQ',repeat:false});
vm.runInContext('for(let i=0;i<50;i++)update(.016,25+i*.016)',game);
assert(vm.runInContext('getCameraPose().x',game)<bodyX-.35,'Q should move the camera left');
assert.equal(vm.runInContext('player.x',game),bodyX,'Leaning must not move the player body');
listeners.keyup({code:'KeyQ'});
listeners.keydown({code:'KeyE',repeat:false});
vm.runInContext('for(let i=0;i<60;i++)update(.016,27+i*.016)',game);
const rightPose=vm.runInContext('getCameraPose()',game);
assert(rightPose.x>bodyX+.35,'E should move the camera right');
assert(rightPose.roll<0,'Lean should tilt the camera');
dungeon.render(ctx,width,pixelHeight,rightPose,focal,true);
assert(image.data.some((value,index)=>index%4!==3&&value>50),'Flashlight must render while the camera is leaning');
let shotOrigin;
const originalTrace=dungeon.trace;
dungeon.trace=(...args)=>{shotOrigin??=args.slice(0,3);return originalTrace(...args);};
vm.runInContext('tryShoot(30)',game);
assert(Math.abs(shotOrigin[0]-rightPose.x)<1e-6,'Shooting must use the leaned camera position');
dungeon.trace=originalTrace;
listeners.keyup({code:'KeyE'});
vm.runInContext('for(let i=0;i<60;i++)update(.016,31+i*.016)',game);
assert(Math.abs(vm.runInContext('getCameraPose().x',game)-bodyX)<.001,'Releasing lean should return to center');
vm.runInContext('player.x=Dungeon.cell+.24;player.z=Dungeon.cell*3.5;player.lean=-1;',game);
const blockedPose=vm.runInContext('getCameraPose()',game);
assert(blockedPose.x>=cell+.139,'Leaning beside a wall must keep the camera outside it');
assert(dungeon.canOccupy(blockedPose.x,blockedPose.z,.14));
vm.runInContext('clearInput()',game);
assert.equal(vm.runInContext('player.lean',game),0,'Pausing should clear the lean');
console.log('PASS: Q/E direction, camera roll, return to center, leaned shooting, and wall-safe head position.');

// Optional PNG uses the actual game renderer, including its real lighting and textures.
if(process.argv[2]) {
  const zlib=require('node:zlib');
  function crc32(data){let crc=0xffffffff;for(const byte of data){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
  function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,crc]);}
  const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(pixelHeight,4);header[8]=8;header[9]=6;
  const rows=Buffer.alloc((width*4+1)*pixelHeight);
  for(let y=0;y<pixelHeight;y++)Buffer.from(lit.subarray(y*width*4,(y+1)*width*4)).copy(rows,y*(width*4+1)+1);
  fs.writeFileSync(process.argv[2],Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(rows)),chunk('IEND',Buffer.alloc(0))]));
}
