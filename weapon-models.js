// Solid weapon meshes in local 3D space: X across, Y up, Z toward the muzzle.
// The view-model renderer projects these vertices every frame; no weapon sprites are used.
const WeaponModels = (() => {
  const metal = [62, 72, 77], dark = [27, 33, 37], edge = [89, 99, 104];
  const wood = [155, 79, 37], woodLight = [190, 109, 51], skin = [182, 137, 100];
  function mesh() { return []; }
  function extrude(out, profile, width, color, centerX = 0) {
    let area = 0;
    profile.forEach(([z,y], i) => { const b = profile[(i+1)%profile.length]; area += z*b[1]-b[0]*y; });
    const ring = area > 0 ? profile : [...profile].reverse();
    const left = ring.map(([z,y]) => [centerX-width/2,y,z]);
    const right = ring.map(([z,y]) => [centerX+width/2,y,z]);
    out.push({ vertices:left, color }, { vertices:[...right].reverse(), color });
    ring.forEach((_,i) => { const j=(i+1)%ring.length; out.push({vertices:[left[i],right[i],right[j],left[j]],color}); });
  }
  function block(out, x,y,z, width,height,length,color) {
    extrude(out,[[z-length/2,y-height/2],[z+length/2,y-height/2],[z+length/2,y+height/2],[z-length/2,y+height/2]],width,color,x);
  }
  function tube(out,x,y,z,length,radius,color,sides=8) {
    const front=[],back=[];
    for(let i=0;i<sides;i++) { const a=i/sides*Math.PI*2; back.push([x+Math.cos(a)*radius,y+Math.sin(a)*radius,z]); front.push([x+Math.cos(a)*radius,y+Math.sin(a)*radius,z+length]); }
    out.push({vertices:[...back].reverse(),color},{vertices:front,color});
    for(let i=0;i<sides;i++) { const j=(i+1)%sides;out.push({vertices:[back[i],back[j],front[j],front[i]],color}); }
  }
  const ak=mesh();
  // Buttstock, stamped receiver and faceted dust cover.
  extrude(ak,[[-.62,-.18],[-.56,.02],[-.16,.07],[.01,.015],[.01,-.07],[-.34,-.11]],.115,wood);
  block(ak,0,-.08,-.605,.127,.23,.035,dark);
  block(ak,0,-.005,.28,.135,.15,.6,metal);
  tube(ak,0,.075,.015,.58,.076,metal);
  block(ak,0,-.087,.3,.145,.02,.59,dark);
  block(ak,.074,.045,.29,.014,.046,.3,dark);
  block(ak,.095,.06,.36,.07,.026,.037,edge);
  block(ak,.077,-.01,.18,.012,.015,.23,edge);
  // Wood handguard and upper gas tube.
  extrude(ak,[[.58,-.076],[1.04,-.045],[1.04,.037],[.61,.048]],.15,woodLight);
  block(ak,0,-.012,.6,.164,.13,.036,dark);
  block(ak,0,-.001,1.03,.15,.11,.033,metal);
  tube(ak,0,.085,.67,.42,.046,wood);
  for(let z=.74;z<1;z+=.075) block(ak,.077,.009,z,.006,.038,.03,dark);
  tube(ak,0,.09,1.045,.1,.036,metal);
  tube(ak,0,.025,1.045,.62,.025,dark);
  tube(ak,0,.025,1.65,.07,.036,metal);
  // Rear notch and front post share a sight line at Y=.205.
  block(ak,0,.123,.49,.095,.06,.09,dark);
  block(ak,-.036,.187,.46,.027,.057,.026,edge);
  block(ak,.036,.187,.46,.027,.057,.026,edge);
  block(ak,0,.105,1.51,.046,.15,.035,metal);
  block(ak,0,.189,1.51,.013,.032,.018,dark);
  block(ak,-.047,.157,1.51,.015,.085,.027,metal);
  block(ak,.047,.157,1.51,.015,.085,.027,metal);
  // Tapered grip, open trigger guard and curved, ribbed magazine.
  extrude(ak,[[.035,-.073],[.17,-.073],[.055,-.36],[-.07,-.32]],.094,wood);
  block(ak,0,-.19,.22,.025,.016,.19,dark);
  block(ak,0,-.135,.31,.025,.12,.018,dark);
  block(ak,0,-.124,.23,.018,.08,.024,edge);
  extrude(ak,[[.36,-.07],[.58,-.07],[.6,-.27],[.67,-.46],[.77,-.58],[.65,-.66],[.51,-.52],[.42,-.32]],.105,dark);
  for(const x of [-.055,.055]) {
    extrude(ak,[[.405,-.13],[.431,-.13],[.485,-.34],[.568,-.52],[.691,-.622],[.667,-.636],[.544,-.534],[.459,-.35]],.008,metal,x);
    extrude(ak,[[.5,-.13],[.526,-.13],[.557,-.32],[.619,-.46],[.724,-.573],[.706,-.591],[.596,-.475],[.532,-.33]],.008,metal,x);
  }
  // Blocky hands actually wrap around the solid grip and handguard.
  block(ak,.015,-.25,.045,.145,.14,.16,skin);
  block(ak,.095,-.43,-.04,.19,.29,.19,[54,74,78]);
  block(ak,-.016,-.105,.85,.19,.12,.18,skin);
  extrude(ak,[[.74,-.16],[.9,-.16],[.5,-.53],[.3,-.52]],.19,[54,74,78],-.085);

  const pistol=mesh();
  block(pistol,0,.055,.32,.12,.125,.57,metal);
  block(pistol,0,-.03,.26,.113,.052,.47,dark);
  tube(pistol,0,.055,.607,.02,.031,dark);
  extrude(pistol,[[.005,-.03],[.17,-.03],[.085,-.32],[-.06,-.32]],.105,wood);
  block(pistol,0,-.12,.22,.027,.015,.15,dark);
  block(pistol,0,-.078,.3,.028,.1,.018,dark);
  block(pistol,0,.144,.55,.015,.05,.023,dark);
  block(pistol,-.034,.139,.08,.025,.04,.026,dark);
  block(pistol,.034,.139,.08,.025,.04,.026,dark);
  for(let z=.06;z<.19;z+=.035) block(pistol,.063,.05,z,.006,.08,.012,edge);
  block(pistol,0,-.19,.03,.16,.145,.145,skin);
  block(pistol,.01,-.4,-.025,.2,.29,.2,[54,74,78]);
  return [ak,pistol];
})();
