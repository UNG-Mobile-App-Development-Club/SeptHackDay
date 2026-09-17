const CombatEffects = (() => {
  function create(dungeon, random=Math.random) {
    const bullets=[],particles=[];
    let flash=0,flashDuration=.075,flashWeapon=0,flashAngle=0;
    const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
    function impact(hit) {
      if(hit.kind<0)return;
      dungeon.impact(hit);
      const normal={x:hit.nx,y:hit.ny,z:hit.nz};
      particles.push({x:hit.x+normal.x*.03,y:hit.y+normal.y*.03,z:hit.z+normal.z*.03,
        vx:0,vy:0,vz:0,type:'flash',age:0,life:.065,size:.065});
      for(let i=0;i<22;i++) {
        const type=i<9?'spark':i<15?'chip':'dust';
        let vx=random()*2-1,vy=random()*2-1,vz=random()*2-1;
        const inward=vx*normal.x+vy*normal.y+vz*normal.z;
        if(inward<0){vx-=2*inward*normal.x;vy-=2*inward*normal.y;vz-=2*inward*normal.z;}
        const speed=type==='spark'?2+random()*2:type==='chip'?1+random():.3+random()*.45;
        const life=type==='spark'?.1+random()*.16:type==='chip'?.35+random()*.25:.45+random()*.3;
        particles.push({x:hit.x+normal.x*.025,y:hit.y+normal.y*.025,z:hit.z+normal.z*.025,
          vx:(vx+normal.x*.25)*speed,vy:(vy+normal.y*.25)*speed,vz:(vz+normal.z*.25)*speed,
          type,age:0,life,size:type==='dust'?.045:.014});
      }
      if(particles.length>180)particles.splice(0,particles.length-180);
    }
    function fire(origin,aimHit,weapon) {
      const dx=aimHit.x-origin.x,dy=aimHit.y-origin.y,dz=aimHit.z-origin.z;
      const length=Math.hypot(dx,dy,dz);
      if(length>.0001) {
        // Check the muzzle-to-target path too; the barrel may be beside a corner.
        const hit=dungeon.trace(origin.x,origin.y,origin.z,dx/length,dy/length,dz/length,length+.002);
        const end={x:hit.x,y:hit.y,z:hit.z};
        bullets.push({origin:{...origin},end,hit:{...hit},distance:Math.hypot(end.x-origin.x,end.y-origin.y,end.z-origin.z),speed:weapon===0?130:95,age:0,impacted:false});
        if(bullets.length>12)bullets.shift();
      }
      flashWeapon=weapon;flashDuration=weapon===0?.075:.09;flash=flashDuration;flashAngle=random()*Math.PI;
    }
    function update(dt) {
      flash=Math.max(0,flash-dt);
      for(let i=particles.length-1;i>=0;i--) {
        const p=particles[i];p.age+=dt;
        if(p.age>=p.life){particles.splice(i,1);continue;}
        p.vy-=(p.type==='flash'?0:p.type==='dust'?.12:5)*dt;
        const dx=p.vx*dt,dy=p.vy*dt,dz=p.vz*dt,distance=Math.hypot(dx,dy,dz);
        if(distance>0) {
          const hit=dungeon.trace(p.x,p.y,p.z,dx/distance,dy/distance,dz/distance,distance);
          if(hit.kind>=0){p.x=hit.x+hit.nx*.012;p.y=hit.y+hit.ny*.012;p.z=hit.z+hit.nz*.012;p.vx*=.1;p.vy*=.1;p.vz*=.1;}
          else {p.x+=dx;p.y+=dy;p.z+=dz;}
        }
      }
      // Spawn new impact particles after updating existing ones so every hit
      // gets a visible first frame, even when a frame takes longer than usual.
      for(let i=bullets.length-1;i>=0;i--) {
        const b=bullets[i];b.age+=dt;
        if(!b.impacted&&b.age*b.speed>=b.distance){b.impacted=true;impact(b.hit);}
        if(b.age>b.distance/b.speed+.035)bullets.splice(i,1);
      }
    }
    function draw(ctx,camera,width,height,focal,flashlight) {
      const cy=Math.cos(camera.yaw),sy=Math.sin(camera.yaw),cp=Math.cos(camera.pitch),sp=Math.sin(camera.pitch);
      const cr=Math.cos(camera.roll||0),sr=Math.sin(camera.roll||0),eye=camera.y+camera.eye;
      function project(p) {
        const dx=p.x-camera.x,dy=p.y-eye,dz=p.z-camera.z;
        const right=cy*dx-sy*dz,forward=sy*dx+cy*dz,up=cp*dy-sp*forward,depth=sp*dy+cp*forward;
        if(depth<=.08)return null;
        const x=cr*right+sr*up,y=-sr*right+cr*up;
        const sx=width/2+x/depth*focal,sy2=height/2-y/depth*focal;
        if(sx<0||sy2<0||sx>=width||sy2>=height)return null;
        const distance=Math.hypot(dx,dy,dz);
        const obstruction=dungeon.trace(camera.x,eye,camera.z,dx/distance,dy/distance,dz/distance,distance);
        if(obstruction.kind>=0&&obstruction.t<distance-.035)return null;
        return {x:sx,y:sy2,depth,cone:depth/distance};
      }
      ctx.save();
      for(const b of bullets) {
        const head=Math.min(b.distance,b.age*b.speed),tail=Math.max(0,head-1.6);
        // Sample the streak in world space so it clips at walls and screen edges.
        const steps=Math.max(2,Math.ceil((head-tail)/.045));
        for(let j=0;j<=steps;j++) {
          const p=project(mix(b.origin,b.end,(tail+(head-tail)*j/steps)/Math.max(.001,b.distance)));
          if(!p)continue;
          ctx.globalAlpha=.25+.75*j/steps;
          ctx.fillStyle=j>steps*.75?'#fff8c7':'#ffba57';
          ctx.fillRect(Math.round(p.x),Math.round(p.y),j===steps?2:1,1);
        }
      }
      const visible=particles.map(p=>({p,screen:project(p)})).filter(item=>item.screen).sort((a,b)=>b.screen.depth-a.screen.depth);
      for(const {p,screen:s} of visible) {
        const fade=1-p.age/p.life;
        const emissive=p.type==='spark'||p.type==='flash';
        if(!emissive&&!flashlight&&flash===0)continue;
        const visibility=emissive?1:flashlight?Math.max(0,Math.min(1,(s.cone-.78)/.18)):flash/flashDuration;
        const size=Math.max(1,Math.min(9,(p.size+(p.type==='dust'?p.age*.13:0))*focal/s.depth));
        ctx.globalAlpha=fade*visibility*(p.type==='dust'?.32:.95);
        ctx.fillStyle=p.type==='flash'?'#fff8d1':p.type==='spark'?(fade>.6?'#fff0ad':'#e78336'):p.type==='chip'?'#b2a48d':'#8d877b';
        ctx.fillRect(Math.round(s.x-size/2),Math.round(s.y-size/2),Math.ceil(size),Math.ceil(size));
      }
      ctx.restore();
    }
    function drawMuzzle(ctx,point,width,height,focal,weapon) {
      if(flash<=0||weapon!==flashWeapon||point.z<=.08)return;
      const fade=flash/flashDuration,x=width/2+point.x/point.z*focal,y=height/2-point.y/point.z*focal;
      const radius=(weapon===0?10:8)*(focal/210)/Math.max(.7,point.z*.48)*(.65+.35*fade);
      ctx.save();ctx.globalCompositeOperation='lighter';
      const glow=ctx.createRadialGradient(x,y,0,x,y,radius*2.3);
      glow.addColorStop(0,`rgba(255,151,46,${fade*.48})`);glow.addColorStop(1,'rgba(255,105,20,0)');
      ctx.fillStyle=glow;ctx.fillRect(x-radius*2.3,y-radius*2.3,radius*4.6,radius*4.6);
      for(const [scale,color] of [[1,'#fa892f'],[.67,'#ffd969'],[.34,'#fffbe0']]) {
        ctx.globalAlpha=fade;ctx.fillStyle=color;ctx.beginPath();
        for(let i=0;i<12;i++) {
          const angle=i*Math.PI/6+flashAngle,r=radius*scale*(i%2?.32:1);
          const px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r;
          if(i)ctx.lineTo(px,py);else ctx.moveTo(px,py);
        }
        ctx.closePath();ctx.fill();
      }
      ctx.restore();
    }
    return {fire,update,draw,drawMuzzle,get flashStrength(){return flash/flashDuration;},get counts(){return {bullets:bullets.length,particles:particles.length};}};
  }
  return {create};
})();
