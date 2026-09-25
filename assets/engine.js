import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
export const FORCE=location.search.includes('force'),reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;export const mobile=innerWidth<860;
THREE.ColorManagement.enabled=false;   // colours below are the colours on screen
const canvas=document.getElementById('gl');
// without WebGL the page still works: the words and controls run, the scene is simply not drawn
let renderer;try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:FORCE})}catch(e){document.documentElement.classList.add('no-gl');renderer={setPixelRatio(){},setSize(){},getPixelRatio:()=>1,render(){}}}
renderer.setPixelRatio(Math.min(2,devicePixelRatio));renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,200);
let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
const ease=u=>u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;
let light=false;
const COL={ink:()=>light?[.08,.08,.075]:[.84,.84,.88],blue:()=>light?[.12,.17,.82]:[.45,.53,1],dim:()=>light?[.7,.69,.65]:[.3,.31,.36],mute:()=>light?[.42,.41,.38]:[.5,.5,.54],green:()=>light?[.1,.5,.28]:[.3,.85,.5]};
function ball(r=1.25){const u=rnd()*6.283,v=Math.acos(2*rnd()-1),k=Math.cbrt(rnd())*r;return [k*Math.sin(v)*Math.cos(u),k*Math.cos(v),k*Math.sin(v)*Math.sin(u)]}
function sphereCurve(fx,fy,fz,px,py,pz,r,t){const X=Math.sin(fx*t+px)*.85,Y=Math.sin(fy*t+py)*.85,Z=Math.sin(fz*t+pz)*.85;
  return [r*X*Math.sqrt(Math.max(0,1-Y*Y/2-Z*Z/2+Y*Y*Z*Z/3)),r*Y*Math.sqrt(Math.max(0,1-Z*Z/2-X*X/2+Z*Z*X*X/3)),r*Z*Math.sqrt(Math.max(0,1-X*X/2-Y*Y/2+X*X*Y*Y/3))]}
const dotTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.35,'rgba(255,255,255,.9)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
const mats=[],inkMats=[],dotMats=[];function M(m){mats.push(m);return m}
const DUR=matchMedia('(prefers-reduced-motion: reduce)').matches?.3:1.3;   // seconds per morph
function dotMat(size){const m=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
  uniforms:{uSize:{value:size},uPx:{value:450},uOpacity:{value:1}},
  vertexShader:`attribute vec3 color;attribute float aS;uniform float uSize,uPx;varying vec3 vC;varying float vA,vP;
    void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;float p=uSize*aS*uPx/-mv.z;gl_PointSize=max(p,0.);vP=p;vC=color;
      vA=smoothstep(0.,1.5,p)*clamp(1.3-(-mv.z-5.)*.1,.45,1.);}`,
  fragmentShader:`uniform float uOpacity;varying vec3 vC;varying float vA,vP;
    void main(){float d=length(gl_PointCoord-.5)*2.;float e=1.-smoothstep(1.-2.4/max(vP,1.),1.,d);if(e<=0.)discard;gl_FragColor=vec4(vC,e*vA*uOpacity);}`});
  dotMats.push(m);return m}
const blend=()=>light?THREE.NormalBlending:THREE.AdditiveBlending;

// A small morph engine: flat arrays eased toward the current shape, staggered, with a slight swirl in flight.
function Morph(n){const cur=new Float32Array(n),from=new Float32Array(n),to=new Float32Array(n);let m=1;
  return {cur,to,start(){from.set(cur);m=0},snap(){cur.set(to);m=1},step(dt,dur,stride,count,swirl){if(m>=1)return;m=Math.min(1,m+dt/dur);
    for(let i=0;i<count;i++){const st=Math.min(1,Math.max(0,m*1.4-(i/count)*.4)),e=ease(st),b=i*stride,
        d=Math.hypot(to[b]-from[b],stride>1?to[b+1]-from[b+1]:0,stride>2?to[b+2]-from[b+2]:0),sw=Math.sin(e*Math.PI)*(swirl||0)*Math.min(1,d/.6);
      for(let j=0;j<stride;j++){const k=i*stride+j;cur[k]=from[k]+(to[k]-from[k])*e+(j<3?sw*Math.sin(i*1.7+j*2.1):0)}}},get done(){return m>=1}}}

// ---------- 1. particles: floors of 100 visitors; the ones who took a next step rise as pillars
const PCX=mobile?[-.85,.85]:[-1.1,1.15],PFY=-.55,TOWX=[-1.2,-.4,.4,1.2],ENGX=[-1.25,0,1.25],RY=r=>.9-r*.34,TOWS=[[.42,'ink'],[.29,'ink'],[.22,'dim'],[.07,'blue']];
function Particles(){
  const P=1200,g=new THREE.Group();
  const pos=Morph(P*3),col=Morph(P*3),sc=Morph(P),jit=new Float32Array(P*3);for(let i=0;i<P*3;i++)jit[i]=rnd()-.5;
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos.cur,3));geo.setAttribute('color',new THREE.BufferAttribute(col.cur,3));geo.setAttribute('aS',new THREE.BufferAttribute(sc.cur,1));
  const mat=dotMat(.085);g.add(new THREE.Points(geo,mat));
  const S=mobile?.14:.17,SZ=[.085,.08,.1,.1,.06,.078,.1,.1,.06];
  // a random order of the 100 floor cells on each side: the first k of that order are the visitors who acted
  const perm=[0,1].map(()=>{const a=[...Array(100).keys()];for(let i=99;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}),
    rank=perm.map(a=>{const r=[];a.forEach((k,i)=>r[k]=i);return r});
  const cell=(side,k)=>[PCX[side]+(k%10-4.5)*S,(Math.floor(k/10)-4.5)*S];
  const put=(i,p,c,s=1)=>{pos.to.set(p,i*3);col.to.set(c,i*3);sc.to[i]=s};
  function floors(kL,kR){const K=[kL,kR];for(let i=0;i<P;i++){
    if(i<200){const side=i<100?0:1,k=i%100,[x,z]=cell(side,k);put(i,[x,PFY,z],rank[side][k]<K[side]?COL.blue():COL.mute())}
    else{const j=i-200,pl=Math.floor(j/10),layer=j%10,side=pl<kL?0:1,idx=(side?pl-kL:pl)%100,[x,z]=cell(side,perm[side][idx]),on=pl<kL+kR;
      put(i,[x,PFY+(on?(layer+1)*.09:0),z],COL.blue(),on?1:0)}}}
  function towers(){let start=0;for(let b=0;b<4;b++){const n=b<3?Math.round(TOWS[b][0]*P):P-start;
    const H=TOWS[b][0]/.42*1.5;for(let k=0;k<n;k++){const i=start+k;put(i,[TOWX[b]+jit[i*3]*.32,PFY+(k/n)*H,jit[i*3+2]*.32],COL[TOWS[b][1]]())}start+=n}}
  // three result pages side by side, six results each; the first result on every page is ours
  function ranking(){for(let i=0;i<P;i++){const c=i%18,col=Math.floor(c/6),row=c%6,k=Math.floor(i/18)%66,w=row?.62+.3*((col*7+row*3)%5)/4:.92;
    put(i,[ENGX[col]-.46+(k%22)/21*w,RY(row)+(Math.floor(k/22)-1)*.05,jit[i*3+2]*.06],row?(row<2?COL.mute():COL.dim()):COL.blue())}}
  const shapes=[
    ()=>{for(let i=0;i<P;i++)put(i,ball(),COL.ink())},
    ()=>{for(let i=0;i<P;i++){const t=i/P,x=-2+4*t,y=.9-1.24*t;put(i,[x+jit[i*3]*.05,y+jit[i*3+1]*.07,jit[i*3+2]*.25],t>.96?COL.blue():COL.ink())}},
    ()=>floors(3,17),
    ()=>floors(3,7),
    towers,
    ranking,
    ()=>floors(27,7),
    ()=>floors(14,18),
    ()=>{towers();let start=0;for(let b=0;b<3;b++){const n=Math.round(TOWS[b][0]*P);for(let k=0;k<n;k++){const i=start+k;put(i,[TOWX[b]+jit[i*3]*.5,PFY+Math.abs(jit[i*3+1])*.07,jit[i*3+2]*.5],COL.dim())}start+=n}}
  ];
  return {g,mats:[mat],shape(s,now){shapes[s]();for(const x of [pos,col,sc])now?x.snap():x.start()},
    update(dt,time,step){pos.step(dt,DUR,3,P,.35);col.step(dt,DUR,3,P,0);sc.step(dt,DUR,1,P,0);
      geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;geo.attributes.aS.needsUpdate=true;
      const u=mat.uniforms;u.uSize.value+=(SZ[step]*(mobile?1.15:1)-u.uSize.value)*Math.min(1,dt*3);u.uOpacity.value=mat.opacity;
      if(step===0)g.rotation.y+=dt*.15;else{const r=Math.atan2(Math.sin(g.rotation.y),Math.cos(g.rotation.y));g.rotation.y=r+(.08*Math.sin(time*.3)-r)*Math.min(1,dt*1.5)}}}
}

// ---------- 2. lines, one per bus route; the dots on them are buses
function Routes(){
  const R=15,MP=110,K=8,g=new THREE.Group(),lp=Morph(R*MP*3),lc=Morph(R*MP*3),bp=Morph(R*K*3),bc=Morph(R*K*3);
  const idx=[];for(let r=0;r<R;r++)for(let j=0;j<MP-1;j++)idx.push(r*MP+j,r*MP+j+1);
  const lgeo=new THREE.BufferGeometry();lgeo.setAttribute('position',new THREE.BufferAttribute(lp.cur,3));lgeo.setAttribute('color',new THREE.BufferAttribute(lc.cur,3));lgeo.setIndex(idx);
  const lmat=M(new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.85,blending:blend(),depthWrite:false}));g.add(new THREE.LineSegments(lgeo,lmat));
  const bgeo=new THREE.BufferGeometry();bgeo.setAttribute('position',new THREE.BufferAttribute(bp.cur,3));bgeo.setAttribute('color',new THREE.BufferAttribute(bc.cur,3));bgeo.setAttribute('aS',new THREE.BufferAttribute(new Float32Array(R*K).fill(1),1));
  const bmat=M(dotMat(mobile?.13:.11));bmat.blending=blend();g.add(new THREE.Points(bgeo,bmat));
  const tr=[];for(let r=0;r<R;r++)tr.push([1+Math.floor(rnd()*3),1+Math.floor(rnd()*3),1+Math.floor(rnd()*3),rnd()*6.3,rnd()*6.3,rnd()*6.3,1.1+rnd()*.3]);
  const HI=7,Y=r=>1.4-r*.2,off=[];for(let i=0;i<R*K;i++)off.push((rnd()-.5)*.34+(i%3===1?.2:0));
  const setLine=(r,f,c)=>{for(let j=0;j<MP;j++){lp.to.set(f(j/(MP-1)),(r*MP+j)*3);lc.to.set(c,(r*MP+j)*3)}};
  const setBus=(r,k,p,c)=>{bp.to.set(p,(r*K+k)*3);bc.to.set(c,(r*K+k)*3)};
  const straight=y=>u=>[-2.3+4.6*u,y,0],short=y=>u=>[-.9+3.2*u,y,0];
  // ranked by rider wait: one bar per route, buses spread along it, so a longer bar means longer gaps
  const rank=r=>r===HI?0:r>=4&&r<=10?(r<HI?r-3:r-4):r<4?7+r:r;
  function ranked(focus){for(let r=0;r<R;r++){const k=rank(r),y=1.3-k*.18,len=3.5-k*.16,c=focus?(k===0?COL.blue():COL.dim()):(k<7?COL.blue():COL.dim());
    setLine(r,u=>[-1.5+len*u,y,0],c);for(let j=0;j<K;j++)setBus(r,j,[-1.5+len*(j+.5)/K,y,0],c)}}
  const shapes=[
    ()=>{for(let r=0;r<R;r++){const a=tr[r];setLine(r,u=>sphereCurve(a[0],a[1],a[2],a[3],a[4],a[5],a[6],u*6.283),COL.ink());for(let k=0;k<K;k++)setBus(r,k,sphereCurve(a[0],a[1],a[2],a[3],a[4],a[5],a[6],k/K*6.283),COL.ink())}},
    ()=>{for(let r=0;r<R;r++){setLine(r,straight(Y(r)),COL.dim());for(let k=0;k<K;k++)setBus(r,k,[-2.1+(k+.5)*(4.2/K),Y(r),0],COL.ink())}},
    ()=>{for(let r=0;r<R;r++){const hi=r===HI;setLine(r,straight(Y(r)),hi?COL.blue():COL.dim());for(let k=0;k<K;k++){let x=-2.1+(k+.5)*(4.2/K)+off[r*K+k];if(hi)x=[-2.05,-1.6,-1.45,-.2,.05,1.2,1.35,2.05][k];setBus(r,k,[x,Y(r),0],hi?COL.blue():COL.ink())}}},
    ()=>{for(let r=0;r<R;r++){const hi=r===HI;if(hi){setLine(r,straight(0),COL.blue());const xs=[-2.1,-1.4,-.55,-.55,1.55,1.55,2.15,2.15];for(let k=0;k<K;k++)setBus(r,k,[xs[k],0,0],COL.blue())}
        else{const y=r<HI?1.2+(HI-r)*.08:-1.2-(r-HI)*.08;setLine(r,short(y),COL.dim());for(let k=0;k<K;k++)setBus(r,k,[-.8+(k+.5)*(3/K)+off[r*K+k]*.7,y,0],COL.dim())}}},
    ()=>ranked(false),
    ()=>ranked(true)
  ];
  if(mobile)g.position.x=-.25;
  return {g,mats:[lmat,bmat],shape(s,now){shapes[s]();for(const x of [lp,lc,bp,bc])now?x.snap():x.start()},
    update(dt,time,step){lp.step(dt,DUR,3,R*MP,.35);lc.step(dt,DUR,3,R*MP,0);bp.step(dt,DUR,3,R*K,.35);bc.step(dt,DUR,3,R*K,0);
      bmat.uniforms.uOpacity.value=bmat.opacity;lgeo.attributes.position.needsUpdate=true;lgeo.attributes.color.needsUpdate=true;bgeo.attributes.position.needsUpdate=true;bgeo.attributes.color.needsUpdate=true;g.rotation.y=step===0?g.rotation.y+dt*.12:g.rotation.y*.93}}
}

// ---------- 3. blocks, one per record, and a Green Line tram
function Blocks(){
  const NB=90,g=new THREE.Group(),cp=Morph(NB*3),cc=Morph(NB*3),cs=Morph(NB);
  const T=new THREE.EdgesGeometry(new THREE.BoxGeometry(.13,.13,.13)).attributes.position.array,E=T.length/3;
  const pos=new Float32Array(NB*E*3),col=new Float32Array(NB*E*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const mat=M(new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9,blending:blend(),depthWrite:false}));g.add(new THREE.LineSegments(geo,mat));
  const tram=new THREE.Group(),tmat=new THREE.LineBasicMaterial({color:0xecebe6,transparent:true,opacity:0,depthWrite:false}),gmat=new THREE.LineBasicMaterial({color:0x3ccf7a,transparent:true,opacity:0,depthWrite:false});inkMats.push(tmat);
  [-.36,.36].forEach(x=>{const b=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.7,.26,.24)),tmat);b.position.x=x;tram.add(b);
    for(let w=0;w<4;w++){const wi=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(.1,.08)),tmat);wi.position.set(x-.24+w*.16,.04,.121);tram.add(wi)}
    tram.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x-.35,-.07,.122),new THREE.Vector3(x+.35,-.07,.122)]),gmat))});
  tram.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.13,0),new THREE.Vector3(.1,.26,0),new THREE.Vector3(.1,.26,0),new THREE.Vector3(-.08,.3,0)]),tmat));
  const rmat=tmat.clone();inkMats.push(rmat);const track=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.6,.98,0),new THREE.Vector3(2.15,.98,0)]),rmat);tram.position.y=1.12;g.add(tram);g.add(track);
  const gridMat=new THREE.LineBasicMaterial({color:0x7d90ff,transparent:true,opacity:0,depthWrite:false}),gl=[],FX=x=>-1.45+(x+2.2)*(3.45/4.4);for(let c=0;c<12;c++){gl.push(new THREE.Vector3(FX(-2.2+c*.4),-1,0),new THREE.Vector3(FX(-2.2+c*.4),1.1,0))}
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(gl),gridMat));
  if(mobile)g.position.x=-.45;
  // 30 records per feed: i%3 is the feed, i/3 the record
  const feed=i=>i%3,rec=i=>Math.floor(i/3),rx=[],act=[],err=[];for(let i=0;i<NB;i++)rx.push(-2.2+rnd()*4.4);for(let r=0;r<15;r++){act.push(rnd());err.push((rnd()-.5)*.14)}
  const feedX=i=>{const f=feed(i),k=rec(i);return f===0?rx[i]:f===1?-2.2+k*(4.4/29):[-1.9,-1.8,-1.7,-.2,-.1,1.3,1.4,1.5,1.6,2][k%10]+Math.floor(k/10)*.07};
  const set=(i,p,c,sc=1)=>{cp.to.set(p,i*3);cc.to.set(c,i*3);cs.to[i]=sc};
  const TX=c=>-.95+c*.55,TY=r=>.95-r*.16,PX=v=>1.05+v*1.25;
  // the table: arrival, weather, events from the first 15 records of each feed; the delay column from later arrivals
  function table(){for(let i=0;i<NB;i++){const f=feed(i),n=rec(i);
    if(n<15)set(i,[TX(f),TY(n),0],f===0?COL.green():COL.ink());else set(i,[TX(3),TY(n-15),0],COL.blue(),f===0?1:0)}}
  const shapes=[
    ()=>{for(let i=0;i<NB;i++)set(i,ball(1.3),COL.ink())},
    ()=>{for(let i=0;i<NB;i++){const f=feed(i);set(i,[FX(feedX(i)),.8-f*.8,0],f===0?COL.green():COL.ink())}},
    ()=>{const n={};for(let i=0;i<NB;i++){const f=feed(i),c=Math.max(0,Math.min(11,Math.round((feedX(i)+2.2)/.4))),key=f+'_'+c;n[key]=(n[key]||0)+1;
        set(i,[FX(-2.2+c*.4),.8-f*.8,-(n[key]-1)*.17],f===0?COL.green():COL.ink())}},
    table,
    ()=>{for(let i=0;i<NB;i++){const f=feed(i),n=rec(i);
        if(n<15)set(i,[TX(f),TY(n),0],COL.dim());
        else if(f===0)set(i,[PX(act[n-15]),TY(n-15),0],COL.ink());
        else if(f===1)set(i,[PX(act[n-15]+err[n-15]),TY(n-15),0],COL.blue());
        else set(i,[PX(act[n-15]),TY(n-15),0],COL.dim(),0)}},
    ()=>{for(let i=0;i<NB;i++){const f=feed(i),n=rec(i);
        if(n<15)set(i,[TX(f),TY(n),0],f===0?COL.green():COL.ink());else set(i,[TX(3),TY(n-15),0],COL.blue(),f===1?1:0)}}
  ];
  let st=0;const fade=(m,on,max)=>m.opacity=on?Math.min(max,m.opacity+.03):Math.max(0,m.opacity-.05);
  return {g,mats:[mat],shape(s,now){st=0;shapes[s]();for(const x of [cp,cc,cs])now?x.snap():x.start()},
    update(dt,time,stp){cp.step(dt,DUR,3,NB,.4);cc.step(dt,DUR,3,NB,0);cs.step(dt,DUR,1,NB,0);st+=dt;
      for(let i=0;i<NB;i++){const cx=cp.cur[i*3],cy=cp.cur[i*3+1],cz=cp.cur[i*3+2],k=cs.cur[i];for(let e=0;e<E;e++){const o=(i*E+e)*3;pos[o]=cx+T[e*3]*k;pos[o+1]=cy+T[e*3+1]*k;pos[o+2]=cz+T[e*3+2]*k;col[o]=cc.cur[i*3];col[o+1]=cc.cur[i*3+1];col[o+2]=cc.cur[i*3+2]}}
      geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;
      // the tram runs along the arrivals feed, and above the finished table at the end
      
      const u=(st*.22)%1,edge=Math.min(1,u*6,(1-u)*6);fade(rmat,stp===1,.5);tmat.opacity=rmat.opacity*1.8*edge;gmat.opacity=rmat.opacity*2*edge;tram.position.x=-.9+3.1*u;
      fade(gridMat,stp===2,.55);g.rotation.y=stp===0?g.rotation.y+dt*.12:g.rotation.y*.93}}
}

// ---------- 4. paper, one sheet per lead
function Papers(){
  const NS=48,g=new THREE.Group(),sp=Morph(NS*5),sc=Morph(NS*3);   // x, y, z, rotation, scale
  const pos=new Float32Array(NS*8*3),col=new Float32Array(NS*8*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const mat=M(new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.95,blending:blend(),depthWrite:false}));g.add(new THREE.LineSegments(geo,mat));
  const lk=new THREE.LineBasicMaterial({color:0x7d90ff,transparent:true,opacity:0,depthWrite:false}),links=[],nodes=[];
  [.95,0,-.95].forEach(y=>[-.3,0,.3].forEach(d=>{links.push(new THREE.Vector3(.7,y,0),new THREE.Vector3(2.1,y+d*1.4,0));nodes.push(new THREE.Vector3(2.1,y+d*1.4,0))}));
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(links),lk));
  const nm=new THREE.PointsMaterial({size:.14,map:dotTex,color:0x7d90ff,transparent:true,opacity:0,depthWrite:false});g.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(nodes),nm));
  const gm=new THREE.LineBasicMaterial({color:0x7d90ff,transparent:true,opacity:0,depthWrite:false});g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(.1,-1.4,0),new THREE.Vector3(.1,1.4,0)]),gm));
  const txt=[];for(let r=0;r<9;r++){const w=r===8?.3:.55+rnd()*.2;txt.push(new THREE.Vector3(.8,.68-r*.16,.01),new THREE.Vector3(.8+w,.68-r*.16,.01))}
  const tm=new THREE.LineBasicMaterial({color:0xecebe6,transparent:true,opacity:0,depthWrite:false});inkMats.push(tm);g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(txt),tm));
  const set=(i,x,y,z,rot,s,c)=>{sp.to.set([x,y,z,rot,s],i*5);sc.to.set(c,i*3)};
  // the ending: three drafts side by side, each with a few lines of text
  const DX=[.15,.9,1.65],t3=[];DX.forEach(x=>{for(let r=0;r<6;r++){const w=r===5?.14:.24+rnd()*.1;t3.push(new THREE.Vector3(x-.19,.22-r*.085,.01),new THREE.Vector3(x-.19+w,.22-r*.085,.01))}});
  const tm3=new THREE.LineBasicMaterial({color:0xecebe6,transparent:true,opacity:0,depthWrite:false});inkMats.push(tm3);g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(t3),tm3));
  const LX=[-1.75,-.6,.55,1.7];
  const pile=i=>[-.35-(i%5)*.03,-.9+(i%9)*.02+Math.floor(i/9)*.35,-(i%4)*.02];
  const shapes=[
    ()=>{for(let i=0;i<NS;i++){const p=ball(1.3);set(i,p[0],p[1],p[2],rnd()*3,1,COL.ink())}},
    ()=>{for(let i=0;i<NS;i++){const c=i%8,r=Math.floor(i/8);set(i,-2.3+c*.26,.95-r*.38,0,(rnd()-.5)*.25,.85,COL.ink())}},
    ()=>{for(let i=0;i<NS;i++){if(i<3)set(i,.85,.7-i*.7,0,0,1,COL.blue());else set(i,-.35-(i%5)*.03,-.9+(i%9)*.02+Math.floor(i/9)*.35,-(i%4)*.02,(rnd()-.5)*.3,.85,COL.dim())}},
    ()=>{for(let i=0;i<NS;i++){if(i<3)set(i,.5,.95-i*.95,0,0,1,COL.blue());else{const p=pile(i);set(i,p[0],p[1],p[2],(rnd()-.5)*.3,.7,COL.dim())}}},
    ()=>{for(let i=0;i<NS;i++){if(i<3)set(i,1.12+i*.02,-.02-i*.02,-i*.01,0,3.1,COL.blue());else{const p=pile(i);set(i,p[0]+.5,p[1]*.9,p[2]-.9,(rnd()-.5)*.3,.6,COL.dim())}}},
    ()=>{for(let i=0;i<NS;i++){if(i<3)set(i,DX[i],0,0,0,2.2,COL.blue());else{const p=pile(i);set(i,p[0],p[1],p[2],0,0,COL.dim())}}},
    // code finds, a person decides, models research and draft
    ()=>{for(let i=0;i<NS;i++){if(i<9){const lane=3-Math.floor(i/3),r=i%3;set(i,LX[lane],.55-r*.55,0,0,.95,lane<2?COL.ink():COL.blue())}
      else{const j=i-9;set(i,LX[0]-.3+(j%5)*.15,.85-Math.floor(j/5)*.24,0,(rnd()-.5)*.2,.5,COL.dim())}}}
  ];
  const fade=(m,on,max)=>m.opacity=on?Math.min(max,m.opacity+.03):Math.max(0,m.opacity-.05);
  return {g,mats:[mat],shape(s,now){shapes[s]();now?(sp.snap(),sc.snap()):(sp.start(),sc.start())},
    update(dt,time,step){sp.step(dt,DUR,5,NS,.4);sc.step(dt,DUR,3,NS,0);const W=.24,Hh=.32;
      for(let i=0;i<NS;i++){const b=i*5,x=sp.cur[b],y=sp.cur[b+1],z=sp.cur[b+2],r=sp.cur[b+3],s=sp.cur[b+4],c=Math.cos(r),sn=Math.sin(r);
        const C=[[-W/2,-Hh/2],[W/2,-Hh/2],[W/2,Hh/2],[-W/2,Hh/2]].map(([a,bb])=>[x+(a*c-bb*sn)*s,y+(a*sn+bb*c)*s,z]);
        [0,1,1,2,2,3,3,0].forEach((k,e)=>{const o=(i*8+e)*3;pos[o]=C[k][0];pos[o+1]=C[k][1];pos[o+2]=C[k][2];col[o]=sc.cur[i*3];col[o+1]=sc.cur[i*3+1];col[o+2]=sc.cur[i*3+2]})}
      geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;
      fade(gm,step===2,.9);fade(lk,step===3,.55);fade(nm,step===3,1);fade(tm,step===4&&sp.done,.9);fade(tm3,step===5&&sp.done,.9);
      g.rotation.y=step===0?g.rotation.y+dt*.12:g.rotation.y*.93}}
}

// ---------- the four cases: question, reasoning chain, camera, and what each tag names
const ACT=[Particles(),Routes(),Blocks(),Papers()];
export const CASES=[
  {actor:ACT[0],q:'Ads got 44% cheaper. <em>Should we spend more?</em>',link:'./paid-search.html',steps:[
    {cam:[-0.08,0.22,9.2],look:[-0.08,0.02,0],mcam:[-0.01,-0.34,7.47],mlook:[-0.01,-0.52,0]},
    {say:['What the dashboard said.','Cost per click fell 44% by week four.'],cam:[0.11,0.89,8.96],look:[-0.13,0.52,0],mcam:[0.26,0.47,14.22],mlook:[-0.03,-0.49,0],tags:[['100','cost per click, week one',[-2,1.05,0]],['56','week four, 44% less',[2,-.1,0],'blue']]},
    {say:['What those visitors did.','I joined every ad click to on-site behaviour. Each grid is 100 visitors; raised dots took a next step: a contact, sample or wholesale request.'],cam:[-0.07,1.48,7.58],look:[-0.07,0.05,0],mcam:[-0.03,1.26,9.86],mlook:[0.01,-0.62,0],tags:[['2.7%','of ad visitors took a next step',[PCX[0],.6,0],'blue'],['17%','of everyone else did',[PCX[1],.6,0],'blue']]},
    {say:['A fairer comparison.','All ad traffic landed on the wholesale page. Among other visitors on that page, 7% took a next step.'],cam:[0.09,1.5,7.59],look:[-0.07,0.06,0],mcam:[0.16,1.3,9.87],mlook:[-0.01,-0.61,0],tags:[['2.7%','of ad visitors',[PCX[0],.6,0],'blue'],['7%','of others on the same page',[PCX[1],.6,0],'blue']]},
    {say:['Why.','Two broad-match terms drove 71% of ad clicks, from buyers looking for a general distributor rather than a specialty manufacturer.'],cam:[0.49,1.66,6.6],look:[-0.01,0.41,0],mcam:[0.63,1.6,8.58],mlook:[-0.02,-0.27,0],tags:[['42%','search term A',[TOWX[0],1.1,0]],['29%','search term B',[TOWX[1],.64,0]],['22%','three other terms',[TOWX[2],.4,0]],['7%','product-name searches',[TOWX[3],-.1,0],'blue']]},
    {dec:'Pause the broad ads. Earn the top result instead.',note:'Rebuilt the site for AI search with structured data and an llms.txt brief. It now ranks first for its core category on Google, Gemini and ChatGPT.',cam:[-0.1,0.1,7.4],look:[-0.1,0,0],mcam:[-0.02,-0.42,10.22],mlook:[-0.02,-0.62,0],tags:[['Google','',[ENGX[0],1.2,0],'sm'],['Gemini','',[ENGX[1],1.2,0],'sm'],['ChatGPT','',[ENGX[2],1.2,0],'sm'],['Ranked first on all three','for the core category search',[ENGX[1],-1.05,0],'blue u']]}],more:[
    {cam:[-0.07,1.48,7.58],look:[-0.07,0.05,0],tags:[['26.9%','of organic-search visitors took a next step',[PCX[0],.6,0],'blue'],['6.5%','of referral visitors did',[PCX[1],.6,0],'blue']]},
    {cam:[-0.07,1.48,7.58],look:[-0.07,0.05,0],tags:[['13.7%','the homepage rate today',[PCX[0],.6,0]],['17.8%','what a 30% lift would look like',[PCX[1],.6,0],'blue']]},
    {cam:[0.68,1.02,6.6],look:[0.18,-0.23,0],mcam:[0.84,0.95,10.1],mlook:[-0.05,-0.81,0],tags:[['Paused','the broad search terms',[-.4,-.3,0],'sm'],['7%','product-name searches: the only ones to test again',[TOWX[3],-.1,0],'blue']]}]},
  {actor:ACT[3],q:'Each lead took 15 minutes of research. <em>Can AI do it without acting on its own?</em>',link:'./sales-ai.html',steps:[
    {cam:[-0.08,0.22,9.2],look:[-0.08,0.02,0],mcam:[-0.06,-0.41,8.41],mlook:[-0.06,-0.6,0]},
    {say:['Find candidates.','Deterministic code queries business directories and de-duplicates. No model calls, so discovery costs almost nothing.'],cam:[-1.57,0.53,7.2],look:[-1.47,0.23,0],mcam:[-2.23,0.07,10.12],mlook:[-1.17,-0.49,0],tags:[['Candidates','one sheet per lead',[-1.4,1.3,0],'sm']]},
    {say:['A person decides.','A reviewer keeps or passes each lead. Model spend begins only after that approval.'],cam:[1.62,0.79,7],look:[0.22,0.19,0],mcam:[2.28,0.42,9.9],mlook:[0.16,-0.55,0],tags:[['Kept','3 of 48, for example',[.85,1.25,0],'blue'],['Passed','',[-.4,-1.2,0],'sm']]},
    {say:['Research with sources.','A model with web search enriches approved leads only. Every claim carries a public citation; anything unverifiable stays blank.'],cam:[2.55,1.43,6.6],look:[0.95,0.33,0],mcam:[4.04,1.48,10.1],mlook:[0.94,-0.43,0],tags:[['Public sources','',[2.1,1.5,0],'blue']]},
    {say:['A draft, never sent.','A separate model call drafts outreach from the saved research. It opens in the reviewer’s own mail client; the system has no send path.'],cam:[0.39,0.22,5.6],look:[0.69,0.02,0],mcam:[0.73,-0.26,7.32],mlook:[0.71,-0.54,0],tags:[['Draft, never sent','opens in the reviewer’s own mail',[1.2,-.78,0],'blue u']]},
    {dec:'2 to 5 minutes per lead, not 15.',note:'Claude or OpenAI per step, JSON-schema verdicts, capped searches and a monthly budget cap. Validated end to end; outreach begins at product launch.',cam:[-0.04,0.13,6.6],look:[0.56,0.03,0],mcam:[0.16,-0.34,7.29],mlook:[0.54,-0.46,0],tags:[['A draft for each kept lead','',[.9,.6,0],'sm'],['2 to 5 min','to review each one, down from 15',[.9,-.5,0],'blue u']]}],more:[
    {cam:[-0.19,0.32,7.72],look:[-0.19,0.21,0],mcam:[-0.05,-0.46,14.26],mlook:[-0.05,-0.74,0],tags:[['Code','search, de-duplicate; no AI',[-1.75,1.05,0],'sm'],['Person','keep or pass',[-.6,1.05,0],'sm'],['Model','cited research, verdict',[.55,1.05,0],'sm blue'],['Model','draft, never sent',[1.7,1.05,0],'sm blue']]}]},
  {actor:ACT[1],q:'Boston’s buses log 20 million boardings. <em>Which riders are being failed?</em>',link:'./rider-wait.html',steps:[
    {cam:[-0.08,0.22,9.2],look:[-0.08,0.02,0],mcam:[-0.26,-0.27,7.96],mlook:[-0.26,-0.46,0]},
    {say:['What the schedule says.','The standard on-time measure compares each bus with its own timetable, so most routes look reliable.'],cam:[-0.09,0.48,8.47],look:[-0.09,0.25,0],mcam:[-0.39,-0.14,14.21],mlook:[-0.32,-0.71,0],tags:[['15 priority routes','one line each',[-2.3,1.62,0],'sm l']]},
    {say:['What riders experience.','Buses bunch, then leave gaps. I measured from the rider’s side: arrive on schedule, board the next bus that actually departs. (Illustrative.)'],cam:[0.53,0.49,8.46],look:[-0.05,0.02,0],mcam:[0.63,-0.12,13.05],mlook:[-0.23,-0.86,0],tags:[['Bunched, then a gap','that gap is the rider\'s wait',[-.1,.28,0],'blue']]},
    {say:['Route 14.','Low frequency makes every missed trip costly: miss the 1:31 pm departure and the next leaves at 3:21 pm.'],cam:[-0.01,0.26,7.75],look:[0.23,0.02,0],mcam:[-0.23,-0.46,13.95],mlook:[0.02,-0.91,0],tags:[['1:31 pm','',[-.55,.3,0],'sm'],['3:21 pm','',[1.55,.3,0],'sm'],['16+ minutes','average wait on Route 14',[.5,-.55,0],'blue']]},
    {say:['Where.','Ranked by rider wait and joined to demographic data, the longest waits concentrate on routes through Roxbury and Dorchester.'],cam:[0.02,0.38,7.4],look:[0.02,0.28,0],mcam:[-0.04,-0.2,11.32],mlook:[-0.04,-0.54,0],tags:[['Roxbury and Dorchester','routes with the longest waits',[.25,1.5,0],'blue'],['Other routes','',[1.45,-.6,0],'sm']]},
    {dec:'Route 14 riders wait 16+ minutes.',note:'GBH’s project team adopted rider wait as its primary reliability measure.',cam:[0.01,0.27,8.2],look:[0.01,0.17,0],mcam:[-0.21,-0.46,11.93],mlook:[-0.22,-0.81,0],tags:[['Route 14','',[-1.5,1.42,0],'sm l blue'],['Rider wait, ranked','the newsroom’s new reliability measure',[.25,-1.45,0],'blue u']]}]},
  {actor:ACT[2],q:'Trains, weather and events run on three clocks. <em>Can they share one?</em>',link:'./transit-pipeline.html',steps:[
    {cam:[-0.08,0.22,9.2],look:[-0.08,0.02,0],mcam:[-0.49,-0.38,8.35],mlook:[-0.49,-0.57,0]},
    {say:['Three feeds, three clocks.','Green Line B arrivals stream by the minute, weather hourly, events at irregular times. As ingested, they cannot be joined.'],cam:[0.63,0.72,7.2],look:[0.23,0.42,0],mcam:[0.55,0.47,11.02],mlook:[-0.22,-0.28,0],tags:[['Train arrivals','Green Line B, as they happen',[-1.45,1.72,0],'sm l'],['Weather','every hour',[-1.45,.28,0],'sm l'],['Events','start and end times',[-1.45,-.52,0],'sm l']]},
    {say:['One clock.','Spark jobs clean each feed and bucket every record to the hour, so a 5:42 pm arrival joins the 5 pm weather and that hour’s events.'],cam:[1.68,0.76,7.2],look:[0.28,-0.14,0],mcam:[2.17,0.32,11.02],mlook:[-0.17,-0.96,0],tags:[['One clock','every record snapped to its hour',[.3,-1.12,0],'blue u']]},
    {say:['One table.','One row per arrival: delay, stop, direction, hourly weather and event count. Analysis runs on this gold table, not the raw feeds.'],cam:[-0.19,0.06,7.6],look:[-0.19,-0.04,0],mcam:[-0.68,-0.55,9.92],mlook:[-0.57,-0.66,0],tags:[['Arrival','',[-.95,1.12,0],'sm'],['Weather','',[-.4,1.12,0],'sm'],['Events','',[.15,1.12,0],'sm'],['Delay','',[.7,1.12,0],'blue']]},
    {say:['A model.','An XGBoost regressor predicts each arrival’s delay from stop, time, weather and events. Each pair shows the actual delay and, in blue, the prediction.'],cam:[0.57,0.12,7.6],look:[0.57,0.02,0],mcam:[0.57,-0.59,11.63],mlook:[0.18,-0.76,0],tags:[['Inputs','arrival, weather, events',[-.4,1.12,0],'sm'],['Actual vs predicted','each pair is one arrival',[1.7,1.12,0],'blue']]},
    {dec:'One delay table, 3.56 minutes of error.',note:'Event hours added about half a minute of delay: significant, but small. Master’s team project on Azure Data Factory and Spark.',cam:[0.11,0.12,7.6],look:[0.11,0.02,0],mcam:[-0.33,-0.74,11.49],mlook:[-0.4,-0.9,0],tags:[['Arrival','',[-.95,1.12,0],'sm'],['Weather','',[-.4,1.12,0],'sm'],['Events','',[.15,1.12,0],'sm'],['Predicted delay','off by 3.56 min on average',[.7,-1.42,0],'blue u']]}]}
];
CASES.forEach(c=>{c.actor.shape(0,true);scene.add(c.actor.g)});

// ---------- the stage: which case is on, where the camera is, labels, theme
const layout=document.body.dataset.layout||'hero',tagEls=[...document.querySelectorAll('.tag')];
export const state={ck:-1,step:0,t:0};
export const stepsOf=k=>CASES[k].steps.concat(CASES[k].more||[]);
let adjust=null;export function setAdjust(fn){adjust=fn}
const camPos=new THREE.Vector3(0,.2,9.2).multiplyScalar(mobile?1.8:1),camLook=new THREE.Vector3(),camFrom=new THREE.Vector3(),camTo=new THREE.Vector3(),lookFrom=new THREE.Vector3(),lookTo=new THREE.Vector3();let camT=1;
const vis=CASES.map(()=>({a:0,d:1}));
// show case k at step s; snap skips the transition (first paint, or a page opened mid-scroll)
export function show(k,s,snap){const c=CASES[k];
  if(state.ck!==k){state.ck=k;c.actor.shape(0,true);if(snap)vis.forEach((v,i)=>{v.a=i===k?1:0;v.d=i===k?0:1})}
  state.step=s;state.t=0;c.actor.shape(s,!!snap);aim(snap)}
// point the camera at the current step; reframe() re-aims after the words beside the scene change size
function aim(snap){const S=stepsOf(state.ck)[state.step];
  camFrom.copy(camPos);if(mobile&&S.mcam){camTo.set(...S.mcam);lookTo.set(...S.mlook)}else{camTo.set(...S.cam).multiplyScalar(mobile?1.8:1);lookTo.set(...S.look)}lookFrom.copy(camLook);camT=0;
  if(adjust)adjust(camTo,lookTo,S);
  if(snap){camPos.copy(camTo);camLook.copy(lookTo);camT=1}}
export function reframe(){if(state.ck>=0)aim(false)}
export const isLight=()=>light;
export function setLight(v){light=v;mats.forEach(m=>{m.blending=blend();m.needsUpdate=true});inkMats.forEach(m=>m.color.set(light?0x141312:0xecebe6));
  CASES.forEach((c,i)=>c.actor.shape(i===state.ck?state.step:0,true))}

let mx=0,my=0;addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5});
// the scene sits right of the text column; on phones it sits below the text (home) or above it (case pages)
function size(){const w=innerWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);dotMats.forEach(m=>m.uniforms.uPx.value=h*renderer.getPixelRatio()/2);camera.aspect=w/h;
  if(mobile)camera.setViewOffset(w,h,0,layout==='case'?h*.15:-h*.13,w,h);else camera.setViewOffset(w,h,-w*.17,0,w,h);camera.updateProjectionMatrix()}size();addEventListener('resize',size);
const v=new THREE.Vector3();function place(el,p){v.set(...p);v.project(camera);const r=canvas.getBoundingClientRect();el.style.transform=`translate(${(v.x*.5+.5)*r.width}px,${(-v.y*.5+.5)*r.height}px) translate(${el.classList.contains('l')?'-8px':'-50%'},${el.classList.contains('u')?'6px':'-100%'})`}
const hooks=[];export function onTick(fn){hooks.push(fn)}
let onscreen=true;export function setOnscreen(v){onscreen=v}
let last=performance.now(),time=0;
function frame(now){if(FORCE)setTimeout(()=>frame(performance.now()),33);else requestAnimationFrame(frame);
  const dt=Math.min(.05,(now-last)/1000);last=now;if((document.hidden||!onscreen)&&!FORCE)return;tick(dt)}
export function tick(dt){time+=dt;state.t+=dt;hooks.forEach(f=>f(dt));
  // only the current case's material is on stage; the others drift out and fade
  CASES.forEach((c,i)=>{const on=i===state.ck,ta=on?1:0,td=on?0:1;
    vis[i].a+=(ta-vis[i].a)*Math.min(1,dt*2.2);vis[i].d+=(td-vis[i].d)*Math.min(1,dt*1.8);
    c.actor.g.visible=vis[i].a>.01;c.actor.g.scale.setScalar((mobile?.84:1)*(1+vis[i].d*2.4));c.actor.mats.forEach(m=>m.opacity=Math.max(0,vis[i].a)*(m.isPointsMaterial?1:.9));
    if(c.actor.g.visible)c.actor.update(dt,time,i===state.ck?state.step:0)});
  if(camT<1)camT=Math.min(1,camT+dt/(reduce?.3:1.7));const e=ease(camT),arc=Math.sin(e*Math.PI)*.35;
  camPos.lerpVectors(camFrom.lengthSq()?camFrom:camPos,camTo.lengthSq()?camTo:camPos,e);camLook.lerpVectors(lookFrom,lookTo,e);
  camera.position.set(camPos.x+mx*.6,camPos.y+arc-my*.4,camPos.z);camera.lookAt(camLook);
  const S=state.ck>=0&&stepsOf(state.ck)[state.step],show=S&&S.tags&&state.t>1;
  tagEls.forEach((el,i)=>{const tg=show&&S.tags[i];el.style.opacity=tg?1:0;if(tg){el.className='tag '+(tg[3]||'');el.innerHTML=`<b>${tg[0]}</b>${tg[1]?`<span>${tg[1]}</span>`:''}`;const G=CASES[state.ck].actor.g,k=G.scale.x;place(el,[tg[2][0]*k+G.position.x,tg[2][1]*k+G.position.y,tg[2][2]*k])}});
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);
export const debug={camera,CASES,ff:sec=>{for(let i=0;i<sec*30;i++)tick(1/30)}};
