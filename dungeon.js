// A sealed concrete maze. Every pixel is traced to its nearest surface, so the
// flashlight cannot illuminate rooms through walls or around corners.
const Dungeon = (() => {
  const size=27, cell=2.3, height=2.7;
  const map=Array.from({length:size},()=>new Uint8Array(size).fill(1));
  let seed=84117;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const stack=[[1,1]];map[1][1]=0;
  while(stack.length) {
    const [x,z]=stack[stack.length-1];
    const choices=[[0,2],[2,0],[0,-2],[-2,0]].filter(([dx,dz])=>x+dx>0&&z+dz>0&&x+dx<size-1&&z+dz<size-1&&map[z+dz][x+dx]);
    if(!choices.length){stack.pop();continue;}
    const [dx,dz]=choices[Math.floor(random()*choices.length)];
    map[z+dz/2][x+dx/2]=0;map[z+dz][x+dx]=0;stack.push([x+dx,z+dz]);
  }
  // Small cells and irregular junctions interrupt the one-cell-wide passages.
  for(const [x,z,w,d] of [[1,1,2,2],[5,5,2,2],[11,3,2,3],[17,9,3,2],[21,17,2,2],[5,19,3,2],[13,23,2,2]])
    for(let dz=0;dz<d;dz++)for(let dx=0;dx<w;dx++)map[z+dz][x+dx]=0;
  for(let i=0;i<30;i++) {
    const x=2+Math.floor(random()*(size-4)),z=2+Math.floor(random()*(size-4));
    if(map[z][x]&&((!map[z-1][x]&&!map[z+1][x])||(!map[z][x-1]&&!map[z][x+1])))map[z][x]=0;
  }
  // The entry passage turns right into the maze, with a blind corner ahead.
  for(let z=1;z<=5;z++){map[z][1]=0;if(z>2)map[z][2]=1;}
  for(let x=1;x<=3;x++)map[5][x]=0;
  map[6][1]=1;
  map[7][2]=0;
  const spawn={x:cell*1.5,z:cell*1.65,yaw:0};
  const solid=(x,z)=>z<0||x<0||z>=size||x>=size||map[z][x]!==0;
  function canOccupy(x,z,radius=.23) {
    for(let gz=Math.floor((z-radius)/cell);gz<=Math.floor((z+radius)/cell);gz++)
      for(let gx=Math.floor((x-radius)/cell);gx<=Math.floor((x+radius)/cell);gx++) {
        if(!solid(gx,gz))continue;
        const nx=Math.max(gx*cell,Math.min(x,(gx+1)*cell));
        const nz=Math.max(gz*cell,Math.min(z,(gz+1)*cell));
        if((x-nx)**2+(z-nz)**2<radius*radius)return false;
      }
    return true;
  }
  function move(player,dx,dz) {
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.12));
    for(let i=0;i<steps;i++) {
      if(canOccupy(player.x+dx/steps,player.z))player.x+=dx/steps;
      if(canOccupy(player.x,player.z+dz/steps))player.z+=dz/steps;
    }
  }
  function trace(x,y,z,dx,dy,dz,maxDistance=22,out={}) {
    let gx=Math.floor(x/cell),gz=Math.floor(z/cell);
    const stepX=dx<0?-1:1,stepZ=dz<0?-1:1;
    const deltaX=cell/Math.abs(dx),deltaZ=cell/Math.abs(dz);
    let tx=dx===0?Infinity:((gx+(dx>0?1:0))*cell-x)/dx;
    let tz=dz===0?Infinity:((gz+(dz>0?1:0))*cell-z)/dz;
    const plane=dy>0?(height-y)/dy:dy<0?-y/dy:Infinity;
    let t=Math.min(maxDistance,plane),nx=0,ny=dy>0?-1:1,nz=0,kind=dy>0?2:1;
    if(t===maxDistance)kind=-1;
    while(Math.min(tx,tz)<t) {
      if(tx<tz) {
        const wallT=tx;gx+=stepX;tx+=deltaX;
        if(solid(gx,gz)){t=wallT;nx=-stepX;ny=0;nz=0;kind=0;break;}
      } else {
        const wallT=tz;gz+=stepZ;tz+=deltaZ;
        if(solid(gx,gz)){t=wallT;nx=0;ny=0;nz=-stepZ;kind=0;break;}
      }
    }
    out.x=x+dx*t;out.y=y+dy*t;out.z=z+dz*t;out.t=t;
    out.nx=nx;out.ny=ny;out.nz=nz;out.kind=kind;
    return out;
  }
  // Concrete formwork, aggregate, tie holes, water stains and expansion joints.
  const textureSize=128;
  function noise(x,y,salt=0){let v=Math.imul(x+salt,374761393)^Math.imul(y+salt,668265263);v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967295;}
  const textures=[0,1,2].map(kind=>{
    const data=new Uint8Array(textureSize*textureSize);
    for(let y=0;y<textureSize;y++)for(let x=0;x<textureSize;x++) {
      const coarse=noise(x>>3,y>>3,kind*31),fine=noise(x,y,kind*79);
      let value=111+(fine-.5)*27+(coarse-.5)*14;
      if(kind===0) {
        value+=(Math.sin(x*.095+y*.043)+Math.sin(x*.04-y*.065))*6;
        if(x<2||y<2||y===64)value-=27;
        if(y>96)value-=(y-96)*.7;
        const bx=(x%64)-13,by=(y%64)-16;
        if(bx*bx+by*by<7)value-=55;
        if(Math.abs(x-77-Math.sin(y*.13)*2)<.65&&y>30&&y<86)value-=33;
        if(noise(x>>2,0)>.79)value-=Math.max(0,y%64-16)*.25;
      } else {
        value-=kind===1?24:10;
        if(x<2||y<2)value-=25;
        if(kind===1&&Math.sin(x*.08)+Math.cos(y*.067)>.95)value-=18;
        if(kind===2&&x>61&&x<65)value-=24;
      }
      data[y*textureSize+x]=Math.max(15,Math.min(165,value));
    }
    return data;
  });
  let imageData=null,cachedFocal=0,beam=null,lengths=null;
  const impacts=[];
  function impact(hit) { if(hit.kind<0)return;impacts.push({...hit});if(impacts.length>24)impacts.shift(); }
  function render(ctx,width,pixelHeight,player,focal,flashlight,muzzleFlash=0) {
    if(!imageData||imageData.width!==width||imageData.height!==pixelHeight){imageData=ctx.createImageData(width,pixelHeight);cachedFocal=0;}
    const pixels=imageData.data;
    if(cachedFocal!==focal) {
      beam=new Float32Array(width*pixelHeight);lengths=new Float32Array(width*pixelHeight);
      for(let py=0;py<pixelHeight;py++)for(let px=0;px<width;px++) {
        const rx=(px+.5-width/2)/focal,ry=(pixelHeight/2-py-.5)/focal;
        const len=Math.hypot(rx,ry,1),i=py*width+px;
        const falloff=Math.max(0,Math.min(1,(1/len-.78)/.18));
        lengths[i]=len;
        beam[i]=falloff*falloff*(3-2*falloff)*(1+.42*Math.exp(-(rx*rx+ry*ry)*24));
      }
      cachedFocal=focal;
    }
    const cy=Math.cos(player.yaw),sy=Math.sin(player.yaw),cp=Math.cos(player.pitch),sp=Math.sin(player.pitch);
    const cr=Math.cos(player.roll||0),sr=Math.sin(player.roll||0);
    const eye=player.y+player.eye,hit={};
    for(let py=0;py<pixelHeight;py++) {
      const screenY=(pixelHeight/2-py-.5)/focal;
      for(let px=0;px<width;px++) {
        const i=py*width+px,offset=i*4;
        pixels[offset]=0;pixels[offset+1]=0;pixels[offset+2]=0;pixels[offset+3]=255;
        if((!flashlight||beam[i]<.002)&&muzzleFlash<=0)continue;
        const screenX=(px+.5-width/2)/focal;
        const rx=cr*screenX-sr*screenY,ry=sr*screenX+cr*screenY;
        const dy=cp*ry+sp,forward=cp-sp*ry,dx=cy*rx+sy*forward,dz=cy*forward-sy*rx;
        trace(player.x,eye,player.z,dx,dy,dz,18/lengths[i],hit);
        if(hit.kind<0)continue;
        const distance=hit.t*lengths[i];
        const incidence=Math.max(0,-(hit.nx*dx+hit.ny*dy+hit.nz*dz)/lengths[i]);
        const strength=flashlight?beam[i]*Math.min(1.85,3.2/(1+.13*distance*distance))*(.22+.78*incidence):0;
        const flashLight=muzzleFlash*2.5/(1+.6*distance*distance)*(.3+.7*incidence);
        let u,v;
        if(hit.kind===0){u=(hit.nx?hit.z:hit.x)/cell;v=1-hit.y/height;}
        else {u=hit.x/cell;v=hit.z/cell;}
        const tx=((Math.floor(u*128)%128)+128)%128,ty=((Math.floor(v*128)%128)+128)%128;
        let base=textures[hit.kind][ty*128+tx];
        for(const mark of impacts) {
          if(mark.kind!==hit.kind||mark.nx!==hit.nx||mark.nz!==hit.nz)continue;
          const d2=(hit.x-mark.x)**2+(hit.y-mark.y)**2+(hit.z-mark.z)**2;
          if(d2<.0064){base*=d2<.0012?.1:d2<.003?.43:1.23;break;}
        }
        pixels[offset]=Math.min(255,base*(strength+flashLight));
        pixels[offset+1]=Math.min(255,base*(strength*.965+flashLight*.72));
        pixels[offset+2]=Math.min(255,base*(strength*.855+flashLight*.38));
      }
    }
    ctx.putImageData(imageData,0,0);
  }
  return {size,cell,height,map,spawn,solid,canOccupy,move,trace,impact,render};
})();
