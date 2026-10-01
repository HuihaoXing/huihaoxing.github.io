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
const COL={ink:()=>light?[.08,.08,.075]:[.84,.84,.88],blue:()=>light?[.12,.17,.82]:[.45,.53,1],dim:()=>light?[.7,.69,.65]:[.3,.31,.36],mute:()=>light?[.42,.41,.38]:[.5,.5,.54],green:()=>light?[.1,.5,.28]:[.3,.85,.5],bg:()=>light?[.953,.953,.937]:[.027,.031,.047]};
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
const PCX=mobile?[-.85,.85]:[-1.1,1.15],PFY=-.55,TOWX=[-1.2,-.4,.4,1.2],ENGX=[-1.25,0,1.25],RY=r=>.9-r*.34,TOWS=[[.42,'ink'],[.29,'ink'],[.22,'ink'],[.07,'blue']];
function Particles(){
  const P=1200,g=new THREE.Group();
  const pos=Morph(P*3),col=Morph(P*3),sc=Morph(P),jit=new Float32Array(P*3);for(let i=0;i<P*3;i++)jit[i]=rnd()-.5;
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos.cur,3));geo.setAttribute('color',new THREE.BufferAttribute(col.cur,3));geo.setAttribute('aS',new THREE.BufferAttribute(sc.cur,1));
  const mat=dotMat(.085);g.add(new THREE.Points(geo,mat));
  const S=mobile?.14:.17,SZ=[.085,.08,.1,.1,.06,.078,.1,.1,.06];
  // a random order of the 100 floor cells on each side: the first k of that order are the visitors who acted
  const perm=[0,1].map(()=>{const a=[...Array(100).keys()];for(let i=99;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}),
    rank=perm.map(a=>{const r=[];a.forEach((k,i)=>r[k]=i);return r});
  const LIFT=.85;
  // stems under the raised dots, drawn from wherever each floor dot currently is
  const stemPos=new Float32Array(200*6),stemGeo=new THREE.BufferGeometry();stemGeo.setAttribute('position',new THREE.BufferAttribute(stemPos,3));
  const stemMat=new THREE.LineBasicMaterial({color:0x7d90ff,transparent:true,opacity:0,depthWrite:false});g.add(new THREE.LineSegments(stemGeo,stemMat));
  const cell=(side,k)=>[PCX[side]+(k%10-4.5)*S,(Math.floor(k/10)-4.5)*S];
  const put=(i,p,c,s=1)=>{pos.to.set(p,i*3);col.to.set(c,i*3);sc.to[i]=s};
  function floors(kL,kR){const K=[kL,kR];for(let i=0;i<P;i++){
    if(i<200){const side=i<100?0:1,k=i%100,[x,z]=cell(side,k),up=rank[side][k]<K[side];put(i,[x,PFY+(up?LIFT:0),z],up?COL.blue():COL.mute())}
    else{const side=i%2,[x,z]=cell(side,i%100);put(i,[x,PFY,z],COL.mute(),0)}}}
  function towers(){let start=0;for(let b=0;b<4;b++){const n=b<3?Math.round(TOWS[b][0]*P):P-start;
    const H=TOWS[b][0]/.42*1.5;for(let k=0;k<n;k++){const i=start+k;put(i,[TOWX[b]+jit[i*3]*.32,PFY+(k/n)*H,jit[i*3+2]*.32],COL[TOWS[b][1]]())}start+=n}}
  // three result pages side by side, six results each: a title line and a shorter snippet line of evenly spaced dots; the first result on every page is ours
  const RP=34,RT=20,RDX=.046;
  function ranking(){for(let i=0;i<P;i++){const r=Math.floor(i/RP)%18,col=Math.floor(r/6),row=r%6,j=i%RP,t=j<RT,
      n=t?(row?12+(col*5+row*3)%8:RT):(row?7+(col*3+row*5)%6:14),k=t?j:j-RT,on=i<18*RP&&k<n;
    put(i,[ENGX[col]-.44+Math.min(k,n-1)*RDX,RY(row)+(t?.035:-.045),0],row?(t?COL.mute():COL.dim()):COL.blue(),on?(t?1:.8):0)}}
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
      const fl=step===2||step===3||step===6||step===7;stemMat.opacity+=((fl?.4:0)*mat.opacity/.9-stemMat.opacity)*Math.min(1,dt*4);
      for(let i=0;i<200;i++){const x=pos.cur[i*3],y=pos.cur[i*3+1],z=pos.cur[i*3+2],o=i*6,lift=fl&&y>PFY+.03;stemPos[o]=x;stemPos[o+1]=PFY;stemPos[o+2]=z;stemPos[o+3]=x;stemPos[o+4]=lift?y:PFY;stemPos[o+5]=z}
      stemGeo.attributes.position.needsUpdate=true;
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
  const HI=7,Y=r=>1.4-r*.2,off=[];for(let i=0;i<R*K;i++)off.push((rnd()-.5)*.34);
  const setLine=(r,f,c)=>{for(let j=0;j<MP;j++){lp.to.set(f(j/(MP-1)),(r*MP+j)*3);lc.to.set(c,(r*MP+j)*3)}};
  const setBus=(r,k,p,c)=>{bp.to.set(p,(r*K+k)*3);bc.to.set(c,(r*K+k)*3)};
  const straight=y=>u=>[-2.3+4.6*u,y,0];
  // Route 14's timetable (evenly spaced ticks) against its actual departures: bunched, then a gap.
  // The rider arrives at a scheduled time (RIDE), that bus has already left early, and the next one leaves at NEXT
  const SCHED=[...Array(K)].map((_,k)=>-2.1+(k+.5)*(4.2/K)),BUNCH=[-2.05,-1.6,-1.45,-.2,.05,1.2,1.35,2.05],RIDE=SCHED[4],NEXT=1.2;
  const tkmat=new THREE.LineBasicMaterial({color:0xecebe6,transparent:true,opacity:0,depthWrite:false});inkMats.push(tkmat);
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(SCHED.flatMap(x=>[new THREE.Vector3(x,-.07,0),new THREE.Vector3(x,.07,0)])),tkmat));
  const wmat=new THREE.LineBasicMaterial({color:0x7d90ff,transparent:true,opacity:0,depthWrite:false}),rmat=new THREE.LineBasicMaterial({color:0xecebe6,transparent:true,opacity:0,depthWrite:false});inkMats.push(rmat);
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([[RIDE,.1],[NEXT,.1],[RIDE,.06],[RIDE,.14],[NEXT,.06],[NEXT,.14]].map(([x,y])=>new THREE.Vector3(x,y,0))),wmat));
  const ring=[];for(let a=0;a<=24;a++)ring.push(new THREE.Vector3(RIDE+Math.cos(a/24*6.283)*.07,Math.sin(a/24*6.283)*.07,0));g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring),rmat));
  // ranked by rider wait: one bar per route, buses spread along it, so a longer bar means longer gaps
  const rank=r=>r===HI?0:r>=4&&r<=10?(r<HI?r-3:r-4):r<4?7+r:r;
  // while Route 14 is explained, the other 14 routes part above and below it, dimmed
  const part=(r,f)=>{const y=r<HI?f+(HI-r)*.1:-f-(r-HI)*.1;setLine(r,straight(y),COL.dim());for(let k=0;k<K;k++)setBus(r,k,[SCHED[k]+off[r*K+k],y,0],COL.dim())};
  function ranked(focus){for(let r=0;r<R;r++){const k=rank(r),y=1.3-k*.18,len=3.5-k*.16,c=focus?(k===0?COL.blue():COL.dim()):(k<7?COL.blue():COL.dim());
    setLine(r,u=>[-1.5+len*u,y,0],c);for(let j=0;j<K;j++)setBus(r,j,[-1.5+len*(j+.5)/K,y,0],c)}}
  const shapes=[
    ()=>{for(let r=0;r<R;r++){const a=tr[r];setLine(r,u=>sphereCurve(a[0],a[1],a[2],a[3],a[4],a[5],a[6],u*6.283),COL.ink());for(let k=0;k<K;k++)setBus(r,k,sphereCurve(a[0],a[1],a[2],a[3],a[4],a[5],a[6],k/K*6.283),COL.ink())}},
    ()=>{for(let r=0;r<R;r++){const hi=r===HI;setLine(r,straight(Y(r)),hi?COL.blue():COL.dim());for(let k=0;k<K;k++)setBus(r,k,[-2.1+(k+.5)*(4.2/K),Y(r),0],hi?COL.blue():COL.ink())}},
    ()=>{for(let r=0;r<R;r++){const hi=r===HI;if(hi){setLine(r,straight(0),COL.blue());for(let k=0;k<K;k++)setBus(r,k,[BUNCH[k],0,0],COL.blue())}
        else part(r,1.05)}},
    ()=>{for(let r=0;r<R;r++){const hi=r===HI;if(hi){setLine(r,straight(0),COL.blue());const xs=[-2.1,-1.4,-.55,-.55,1.55,1.55,2.15,2.15];for(let k=0;k<K;k++)setBus(r,k,[xs[k],0,0],COL.blue())}
        else part(r,1.05)}},
    ()=>ranked(false),
    ()=>ranked(true)
  ];
  if(mobile)g.position.x=-.25;
  return {g,mats:[lmat,bmat],shape(s,now){shapes[s]();for(const x of [lp,lc,bp,bc])now?x.snap():x.start()},
    update(dt,time,step){lp.step(dt,DUR,3,R*MP,.35);lc.step(dt,DUR,3,R*MP,0);bp.step(dt,DUR,3,R*K,.35);bc.step(dt,DUR,3,R*K,0);
      bmat.uniforms.uOpacity.value=bmat.opacity;tkmat.opacity+=((step===2?.55:0)-tkmat.opacity)*Math.min(1,dt*3);const on=step===2&&bp.done;wmat.opacity=on?Math.min(.95,wmat.opacity+.04):Math.max(0,wmat.opacity-.08);rmat.opacity=wmat.opacity;lgeo.attributes.position.needsUpdate=true;lgeo.attributes.color.needsUpdate=true;bgeo.attributes.position.needsUpdate=true;bgeo.attributes.color.needsUpdate=true;g.rotation.y=step===0?g.rotation.y+dt*.12:g.rotation.y*.93}}
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
  const feed=i=>i%3,rec=i=>Math.floor(i/3),rx=[],act=[],err=[];for(let i=0;i<NB;i++)rx.push(-2.2+rnd()*4.4);for(let r=0;r<15;r++){act.push(rnd());err.push((rnd()-.5)*.36)}
  const feedX=i=>{const f=feed(i),k=rec(i);return f===0?rx[i]:f===1?-2.2+k*(4.4/29):[-1.9,-1.8,-1.7,-.2,-.1,1.3,1.4,1.5,1.6,2][k%10]+Math.floor(k/10)*.07};
  const set=(i,p,c,sc=1)=>{cp.to.set(p,i*3);cc.to.set(c,i*3);cs.to[i]=sc};
  const TX=c=>-1.2+c*.7,TY=r=>.95-r*.16,PX=v=>1.05+v*1.25;
  // one hour we follow: a column where every feed has a record; those three records become the table's first row
  const hourOf=i=>Math.max(0,Math.min(11,Math.round((feedX(i)+2.2)/.4)));
  let HC=6,pick=[0,1,2];for(const c of [6,5,7,4,8,3,9]){const p=[0,1,2].map(f=>{for(let n=0;n<15;n++){const i=n*3+f;if(hourOf(i)===c)return i}return -1});if(p.every(x=>x>=0)){HC=c;pick=p;break}}
  const row=i=>{const f=feed(i),n=rec(i);return i===pick[f]?0:n===0?rec(pick[f]):n};
  const HX=-1.45+(-2.2+HC*.4+2.2)*(3.45/4.4);
  const hmat=new THREE.LineBasicMaterial({color:0x7d90ff,transparent:true,opacity:0,depthWrite:false}),rmat2=hmat.clone();
  const box=(x0,x1,y0,y1,z)=>new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>new THREE.Vector3(x,y,z))),null);
  const colBox=box(HX-.14,HX+.14,-.97,.97,.08);colBox.material=hmat;g.add(colBox);
  const rowBox=box(TX(0)-.14,TX(3)+.14,TY(0)-.11,TY(0)+.11,.08);rowBox.material=rmat2;g.add(rowBox);
  // the table: arrival, weather, events from the first 15 records of each feed; the delay column from later arrivals
  function table(mark){for(let i=0;i<NB;i++){const f=feed(i),n=rec(i);
    if(n<15)set(i,[TX(f),TY(row(i)),0],mark&&i===pick[f]?COL.blue():f===0?COL.green():COL.ink());else set(i,[TX(3),TY(n-15),0],COL.blue(),f===0?1:0)}}
  const shapes=[
    ()=>{for(let i=0;i<NB;i++)set(i,ball(1.3),COL.ink())},
    ()=>{for(let i=0;i<NB;i++){const f=feed(i);set(i,[FX(feedX(i)),.8-f*.8,0],f===0?COL.green():COL.ink())}},
    ()=>{const n={};for(const i of [...pick,...Array.from({length:NB},(_,i)=>i).filter(i=>!pick.includes(i))]){const f=feed(i),c=hourOf(i),key=f+'_'+c;n[key]=(n[key]||0)+1;
        set(i,[FX(-2.2+c*.4),.8-f*.8,-(n[key]-1)*.17],pick.includes(i)?COL.blue():f===0?COL.green():COL.ink())}},
    ()=>table(true),
    ()=>{for(let i=0;i<NB;i++){const f=feed(i),n=rec(i);
        if(n<15)set(i,[TX(f),TY(row(i)),0],COL.dim());
        else if(f===0)set(i,[PX(act[n-15]),TY(n-15),0],COL.ink());
        else if(f===1)set(i,[PX(Math.max(0,Math.min(1,act[n-15]+err[n-15]))),TY(n-15),0],COL.blue());
        else set(i,[PX(act[n-15]),TY(n-15),0],COL.dim(),0)}},
    ()=>{for(let i=0;i<NB;i++){const f=feed(i),n=rec(i);
        if(n<15)set(i,[TX(f),TY(row(i)),0],f===0?COL.green():COL.ink());else set(i,[TX(3),TY(n-15),0],COL.blue(),f===1?1:0)}}
  ];
  let st=0;const fade=(m,on,max)=>m.opacity=on?Math.min(max,m.opacity+.03):Math.max(0,m.opacity-.05);
  return {g,hx:HX,mats:[mat],shape(s,now){st=0;shapes[s]();for(const x of [cp,cc,cs])now?x.snap():x.start()},
    update(dt,time,stp){cp.step(dt,DUR,3,NB,.4);cc.step(dt,DUR,3,NB,0);cs.step(dt,DUR,1,NB,0);st+=dt;
      for(let i=0;i<NB;i++){const cx=cp.cur[i*3],cy=cp.cur[i*3+1],cz=cp.cur[i*3+2],k=cs.cur[i];for(let e=0;e<E;e++){const o=(i*E+e)*3;pos[o]=cx+T[e*3]*k;pos[o+1]=cy+T[e*3+1]*k;pos[o+2]=cz+T[e*3+2]*k;col[o]=cc.cur[i*3];col[o+1]=cc.cur[i*3+1];col[o+2]=cc.cur[i*3+2]}}
      geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;
      // the tram runs along the arrivals feed, and above the finished table at the end
      
      const u=(st*.22)%1,edge=Math.min(1,u*6,(1-u)*6);fade(rmat,stp===1,.5);tmat.opacity=rmat.opacity*1.8*edge;gmat.opacity=rmat.opacity*2*edge;tram.position.x=-.9+3.1*u;
      fade(gridMat,stp===2,.55);fade(hmat,stp===2&&cp.done,.9);fade(rmat2,stp===3&&cp.done,.9);g.rotation.y=stp===0?g.rotation.y+dt*.12:g.rotation.y*.93}}
}

// ---------- 4. paper, one sheet per lead
function Papers(){
  const NS=48,g=new THREE.Group(),sp=Morph(NS*5),sc=Morph(NS*3);   // x, y, z, rotation, scale
  const pos=new Float32Array(NS*8*3),col=new Float32Array(NS*8*3),geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const mat=M(new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.95,blending:blend(),depthWrite:false}));g.add(new THREE.LineSegments(geo,mat));
  const lk=new THREE.LineBasicMaterial({color:0x7d90ff,transparent:true,opacity:0,depthWrite:false}),links=[],nodes=[];
  for(let j=0;j<5;j++){const y=1.65-j*.33;links.push(new THREE.Vector3(.64,.95,0),new THREE.Vector3(2.05,y,0));nodes.push(new THREE.Vector3(2.05,y,0))}
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
  const fillMat=new THREE.MeshBasicMaterial({color:0x7d90ff,transparent:true,opacity:0,depthWrite:false}),fill=new THREE.Mesh(new THREE.PlaneGeometry(1,1),fillMat);g.add(fill);
  const pile=i=>[-.35-(i%5)*.03,-.9+(i%9)*.02+Math.floor(i/9)*.35,-(i%4)*.02];
  const shapes=[
    ()=>{for(let i=0;i<NS;i++){const p=ball(1.3);set(i,p[0],p[1],p[2],rnd()*3,1,COL.ink())}},
    ()=>{for(let i=0;i<NS;i++){const j=(i+19)%NS,c=j%8,r=Math.floor(j/8);set(i,-2.3+c*.26,.95-r*.38,0,i?(rnd()-.5)*.25:0,i?.85:1,i?COL.mute():COL.blue())}},
    ()=>{for(let i=0;i<NS;i++){if(i<3)set(i,.85,.7-i*.7,0,0,i?1:1.12,i?COL.mute():COL.blue());else set(i,-.35-(i%5)*.03,-.9+(i%9)*.02+Math.floor(i/9)*.35,-(i%4)*.02,(rnd()-.5)*.3,.85,COL.dim())}},
    ()=>{for(let i=0;i<NS;i++){if(i<3)set(i,.5,.95-i*.95,0,0,i?1:1.12,i?COL.mute():COL.blue());else{const p=pile(i);set(i,p[0],p[1],p[2],(rnd()-.5)*.3,.7,COL.dim())}}},
    ()=>{for(let i=0;i<NS;i++){if(i<3)set(i,1.12+i*.02,-.02-i*.02,-i*.01,0,3.1,i?COL.dim():COL.blue());else{const p=pile(i);set(i,p[0]+.5,p[1]*.9,p[2]-.9,(rnd()-.5)*.3,.6,COL.dim())}}},
    ()=>{for(let i=0;i<NS;i++){if(i<3)set(i,DX[i],0,0,0,2.2,i?COL.mute():COL.blue());else{const p=pile(i);set(i,p[0],p[1],p[2],0,0,COL.dim())}}},
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
      fill.position.set(sp.cur[0],sp.cur[1],sp.cur[2]-.002);fill.rotation.z=sp.cur[3];fill.scale.set(W*sp.cur[4],Hh*sp.cur[4],1);fillMat.opacity+=(((step>0&&step<6)?.22:0)*mat.opacity/.95-fillMat.opacity)*Math.min(1,dt*4);
      fade(gm,step===2,.9);fade(lk,step===3,.55);fade(nm,step===3,1);fade(tm,step===4&&sp.done,.9);fade(tm3,step===5&&sp.done,.9);
      g.rotation.y=step===0?g.rotation.y+dt*.12:g.rotation.y*.93}}
}

// ---------- the four cases: question, reasoning chain, camera, and what each tag names
const ACT=[Particles(),Routes(),Blocks(),Papers()];
export const CASES=[
  {actor:ACT[0],ctx:'Paid search and conversion analysis · WY Industries',q:'A new food brand’s ads got 44% cheaper per click. <em>Should it spend more?</em>',link:'./paid-search.html',steps:[
    {cam:[-0.03,0.15,9.2],look:[-0.03,-0.05,0],mcam:[-0.01,-0.22,8.05],mlook:[-0.01,-0.41,0]},
    {say:['What the dashboard said.','Cost per click fell 44% in four weeks, so the obvious move was a bigger budget.'],cam:[0.22,0.84,9.28],look:[-0.03,0.46,0],mcam:[0.36,1.05,16.59],mlook:[0.02,-0.07,0],tags:[['100','cost per click in week one, indexed',[-2,1.05,0],'','CPC, week 1'],['56','week four: 44% cheaper per click',[2,-.1,0],'blue','week 4, −44%']]},
    {read:4.2,say:['What those visitors did.','I tagged every site visit as ad or other traffic, then counted next steps: a contact, sample or wholesale click, or opening the wholesale form. Each grid is 100 visitors; raised dots took one.'],cam:[0.01,1.44,7.58],look:[0.01,0.01,0],mcam:[-0.05,1.81,10.16],mlook:[0,-0.11,0],tags:[['2.7%','of ad visitors took a next step',[PCX[0],.6,0],'blue','ad visitors'],['17%','of all other visitors took one: 6× the ad rate',[PCX[1],.6,0],'blue','all others, 6×']]},
    {read:4,say:['A fairer comparison.','All ad traffic landed on the wholesale page. Among other visitors on that page, 7% took a next step: the ads still converted at well under half that rate.'],cam:[0.01,1.44,7.58],look:[0.01,0.01,0],mcam:[-0.05,1.81,10.16],mlook:[0,-0.11,0],tags:[['2.7%','of ad visitors took a next step',[PCX[0],.6,0],'blue','ad visitors'],['7%','of others on the same page: still 2.6× the ad rate',[PCX[1],.6,0],'blue','same page, 2.6×']]},
    {read:4,say:['Why.','71% of ad clicks came from two broad search terms, typed by buyers looking for a general distributor, not for this product.'],cam:[0.53,1.62,6.6],look:[0.03,0.37,0],mcam:[0.77,2.35,10.43],mlook:[-0.02,0.08,0],tags:[['42%','of ad clicks: search term A',[TOWX[0],1.1,0],'','of clicks: term A'],['29%','search term B',[TOWX[1],.64,0],'','term B'],['22%','three other broad terms',[TOWX[2],.4,0],'','3 broad terms'],['7%','searched for the product by name',[TOWX[3],-.1,0],'blue','product names']]},
    {dec:'Pause the broad ads. Earn the top result instead.',note:'Management paused them on this analysis, and acquisition moved to unpaid search. I rebuilt the site so AI search engines can read and cite it with structured data and an llms.txt brief; it ranks first for its core category on Google, Gemini and ChatGPT.',cam:[-0.08,0.05,7.4],look:[-0.08,-0.05,0],mcam:[-0.04,-0.01,12.02],mlook:[-0.04,-0.25,0],tags:[['Google','',[ENGX[0],1.2,0],'sm'],['Gemini','',[ENGX[1],1.2,0],'sm'],['ChatGPT','',[ENGX[2],1.2,0],'sm'],['Ranked first on all three','the top answer for the core category search',[ENGX[1],-1.05,0],'blue u']]}],more:[
    {cam:[-0.07,1.48,7.58],look:[-0.07,0.05,0],tags:[['26.9%','of organic-search visitors took a next step',[PCX[0],.6,0],'blue','organic search'],['6.5%','of referral visitors took one',[PCX[1],.6,0],'blue','referral']]},
    {cam:[-0.07,1.48,7.58],look:[-0.07,0.05,0],tags:[['13.7%','homepage next-step rate today',[PCX[0],.6,0],'','rate today'],['17.8%','the rate a 30% lift must reach',[PCX[1],.6,0],'blue','+30% target']]},
    {cam:[0.68,1.02,6.6],look:[0.18,-0.23,0],mcam:[0.84,0.95,10.1],mlook:[-0.05,-0.81,0],tags:[['Paused','the broad search terms',[-.4,-.3,0],'sm'],['7%','product-name searches: the only ones to test again',[TOWX[3],-.1,0],'blue','product names']]}]},
  {actor:ACT[1],ctx:'Rider wait-time metric · GBH News, with BU Spark!',q:'On the timetable, Boston’s buses look on time. <em>So why do some riders wait so long?</em>',link:'./rider-wait.html',steps:[
    {cam:[-0.04,0.14,9.2],look:[-0.04,-0.06,0],mcam:[-0.26,-0.14,8.12],mlook:[-0.26,-0.34,0]},
    {say:['What the schedule says.','The standard on-time measure compares each bus with its own timetable, so most routes look reliable.'],cam:[-0.07,0.43,8.64],look:[-0.07,0.2,0],mcam:[-0.4,0.68,16.43],mlook:[-0.32,0.02,0],tags:[['15 priority routes','one line per route, one dot per bus; Route 14 in blue',[-2.3,1.62,0],'sm l','Route 14 in blue']]},
    {read:5,say:['What riders experience.','Ticks are the timetable; dots are the buses as they actually ran. They bunch, then leave gaps. A rider arrives at a scheduled time and boards the next bus that actually departs; the gap between the two is the wait. (Illustrative.)'],cam:[0.6,0.44,8.46],look:[0.02,-0.03,0],mcam:[1,0.95,18.89],mlook:[-0.24,-0.1,0],tags:[['Rider arrives','at a scheduled time',[.26,.2,0],'sm r','scheduled time'],['Next bus','that actually departs',[1.2,.2,0],'sm l','actual'],['The wait','what the rider experiences',[.73,-.16,0],'blue u'],['Bunched','two buses together, then a gap',[-1.52,-.16,0],'sm u']]},
    {read:3.6,say:['Route 14.','Low frequency makes every missed trip costly: miss the 1:31 pm departure and the next leaves at 3:21 pm, 110 minutes later.'],cam:[-0.3,0.24,8.42],look:[-0.04,-0.03,0],mcam:[-0.57,0.23,17.55],mlook:[-0.25,-0.35,0],tags:[['1:31 pm','',[-.55,.3,0],'sm'],['3:21 pm','',[1.55,.3,0],'sm'],['A 110-minute gap','between two consecutive trips',[.5,-.2,0],'blue u']]},
    {read:4,say:['Across 15 routes.','Ranked by average rider wait, Route 14 averages 16+ minutes, and the longest waits concentrate on routes through Roxbury and Dorchester. (Bar lengths illustrative.)'],cam:[0.19,0.67,8.02],look:[0.19,0.56,0],mcam:[0.29,0.83,17.42],mlook:[0.29,0.3,0],tags:[['Route 14, 16+ min','average rider wait',[-1.5,1.42,0],'sm l blue','average wait'],['Roxbury and Dorchester','where the longest waits (blue) concentrate',[.25,2.15,0],'l blue'],['Other routes','longer bar, longer average wait',[1.45,-.6,0],'sm','longer bar = longer wait']]},
    {dec:'GBH’s project team now measures reliability by rider wait.',note:'The team and a senior editor adopted it as their primary measure. Route 14 riders averaged 16+ minutes.',cam:[0.05,-0.06,8.2],look:[0.05,-0.16,0],mcam:[-0.19,0.22,17.1],mlook:[-0.2,-0.28,0],tags:[['Route 14','',[-1.5,1.42,0],'sm l blue'],['Adopted by the GBH team','as their primary reliability measure',[.25,-1.45,0],'blue u']]}]},
  {actor:ACT[3],ctx:'LLM lead-research tool · WY Industries',q:'Researching each potential buyer took 15 minutes. <em>Can AI do it while a person stays in control?</em>',link:'./sales-ai.html',steps:[
    {cam:[0.04,0.18,9.2],look:[0.04,-0.02,0],mcam:[0.05,-0.04,9.85],mlook:[0.05,-0.28,0]},
    {say:['Find candidates.','Deterministic code queries business directories and de-duplicates. No model calls yet. We follow one lead, in blue.'],cam:[-1.51,0.48,7.2],look:[-1.41,0.18,0],mcam:[-2.57,0.79,13.28],mlook:[-1.17,0.05,0],tags:[['Candidates','one sheet per lead; we follow the blue one',[-1.4,1.3,0],'sm']]},
    {read:4,say:['A person decides.','A reviewer keeps or passes each lead. Model spend begins only after that approval.'],cam:[1.72,0.75,7],look:[0.32,0.15,0],mcam:[2.98,1.31,13.26],mlook:[0.14,0.01,0],tags:[['Kept','a person approves; only then a model runs',[.85,1.25,0],'blue','approved'],['Passed','dropped before any model call',[-.4,-1.2,0],'sm','no model call']]},
    {read:3.6,say:['Research with sources.','A model with web search enriches the approved lead. Every claim carries a public citation; anything unverifiable stays blank.'],cam:[2.6,1.73,6.6],look:[1,0.63,0],mcam:[5.23,3.01,13.9],mlook:[0.96,0.38,0],tags:[['Public sources','one citation per claim',[2.05,1.82,0],'blue']]},
    {say:['A draft, never sent.','A separate model call turns that research into a draft. It opens in the reviewer’s own mail client; the system has no send path.'],cam:[0.48,0.06,5.6],look:[0.78,-0.14,0],mcam:[0.72,0.18,8.8],mlook:[0.71,-0.15,0],tags:[['Draft, never sent','opens in the reviewer’s own mail',[1.2,-.78,0],'blue u']]},
    {dec:'2 to 5 minutes per lead, not 15.',note:'Claude or OpenAI per step, JSON-schema verdicts, capped searches and a monthly budget cap. In use on real leads; outreach at volume waits for product launch.',cam:[0.02,0.09,6.6],look:[0.62,-0.01,0],mcam:[0.1,0.04,8.51],mlook:[0.54,-0.1,0],tags:[['A draft for each kept lead','',[.9,.6,0],'sm'],['2 to 5 min','to review each one, down from 15',[.9,-.5,0],'blue u','per lead, was 15']]}],more:[
    {cam:[-0.19,0.32,7.72],look:[-0.19,0.21,0],mcam:[-0.05,-0.46,14.26],mlook:[-0.05,-0.74,0],tags:[['Code','search, de-duplicate; no AI',[-1.75,1.05,0],'sm','no AI'],['Person','keep or pass',[-.6,1.05,0],'sm','approves'],['Model','cited research, verdict',[.55,1.05,0],'sm blue','research'],['Model','draft, never sent',[1.7,1.05,0],'sm blue','draft']]}]},
  {actor:ACT[2],ctx:'Transit data pipeline · Boston University team project',q:'Do weather and big events go with Green Line delays? <em>First, three data sources had to line up.</em>',link:'./transit-pipeline.html',steps:[
    {cam:[0.02,0.07,9.2],look:[0.02,-0.13,0],mcam:[-0.41,-0.29,8.2],mlook:[-0.41,-0.47,0]},
    {say:['Three feeds, three clocks.','Green Line B arrivals stream by the minute, weather hourly, events at irregular times. As ingested, they cannot be joined.'],cam:[0.69,0.78,7.2],look:[0.29,0.48,0],mcam:[0.68,1.07,12.95],mlook:[-0.22,0.19,0],tags:[['Train arrivals','Green Line B, as they happen',[-1.45,1.72,0],'sm l'],['Weather','every hour',[-1.45,.28,0],'sm l'],['Events','start and end times',[-1.45,-.52,0],'sm l']]},
    {read:4.2,say:['One clock.','Spark jobs clean each feed and bucket every record to the hour, so a 5:42 pm arrival joins the 5 pm weather and that hour’s events.'],cam:[1.73,0.73,7.2],look:[0.33,-0.17,0],mcam:[2.26,1.05,11.59],mlook:[-0.19,-0.3,0],tags:[['Train arrivals','',[-1.45,.98,0],'sm l'],['Weather','',[-1.45,.18,0],'sm l'],['Events','',[-1.45,-.62,0],'sm l'],['One hour, three feeds','every record bucketed to its hour',[ACT[2].hx,-1.1,0],'blue u']]},
    {read:4,say:['One table.','Follow one arrival in the highlighted hour: its weather and that hour’s events join it in one row. Analysis runs on this gold table, not the raw feeds.'],cam:[-0.15,0.06,7.6],look:[-0.15,-0.04,0],mcam:[-0.74,-0.08,12.85],mlook:[-0.59,-0.22,0],tags:[['Arrival','',[-1.2,1.22,0],'sm'],['Weather','',[-.5,1.22,0],'sm'],['Events','',[.2,1.22,0],'sm'],['Delay','',[.9,1.22,0],'blue']]},
    {say:['A model.','An XGBoost regressor predicts each arrival’s delay from stop, time, weather and events. The pairs illustrate actual delay against the prediction in blue; they are not model output.'],cam:[0.52,0.07,7.6],look:[0.52,-0.03,0],mcam:[0.6,0.15,14.46],mlook:[0.11,-0.06,0],tags:[['Inputs','arrival, weather, events',[-.5,1.12,0],'sm'],['Actual vs predicted','white actual, blue predicted; illustrative',[1.7,1.12,0],'blue','illustrative']]},
    {dec:'Three feeds, one reusable delay table.',note:'A model on it reached a 3.56-minute mean absolute error; event hours added about half a minute. Azure Data Factory and Spark.',cam:[0.01,-0.12,7.6],look:[0.01,-0.22,0],mcam:[-0.24,-0.3,13.44],mlook:[-0.32,-0.47,0],tags:[['Gold table','one row per arrival, ready to query',[-.15,1.12,0],'sm'],['Predicted delay','a column the model adds',[.9,-1.42,0],'blue u']]}]}
];
CASES.forEach(c=>{c.actor.shape(0,true);scene.add(c.actor.g)});

// ---------- the stage: which case is on, where the camera is, labels, theme
const layout=document.body.dataset.layout||'hero',tagEls=[...document.querySelectorAll('.tag')];
export const state={ck:-1,step:0,t:0};
export const stepsOf=k=>CASES[k].steps.concat(CASES[k].more||[]);
let adjust=null;export function setAdjust(fn){adjust=fn}
// phone shots were framed on the homepage of a 390×844 screen, where the scene had the band MREG[k*6+s] (px from the top).
// On any other phone or layout, scale and shift the shot so the same framing lands in the band available now (band() → [top,bottom])
const MREG=[[290,638],[329,638],[367,638],[367,638],[348,638],[363,638],[342,638],[399,638],[380,638],[399,638],[399,638],[390,638],[316,638],[373,638],[412,638],[373,638],[392,638],[389,638],[316,638],[373,638],[373,638],[373,638],[392,638],[364,638]];
// The case pages' extra scenes (steps past 5) were framed on the case layout instead, in its top band, pulled back 1.1
export function bandAdjust(band){return (camTo,lookTo)=>{if(!mobile||window.__fitting)return;const more=state.step>5,r=more?[63,408]:MREG[state.ck*6+state.step];if(!r)return;
  const H=innerHeight,W=innerWidth,[top,bot]=band(),h=Math.max(60,bot-top),shift=layout==='case'?-.15:.13,base=more?-.15:.13;
  const z=Math.max(.8,(H/844)*Math.max((r[1]-r[0])/h,(390-32)/(W-32)))*(more?1.1:1);camTo.sub(lookTo).multiplyScalar(z).add(lookTo);
  const d=camTo.distanceTo(lookTo),worldH=2*d*Math.tan(Math.PI/10),dy=((top+bot)/2/H-((r[0]+r[1])/2/844-base+shift))*worldH;camTo.y+=dy;lookTo.y+=dy}}
let camMove=0;const camPos=new THREE.Vector3(0,.2,9.2).multiplyScalar(mobile?1.8:1),camLook=new THREE.Vector3(),camFrom=new THREE.Vector3(),camTo=new THREE.Vector3(),lookFrom=new THREE.Vector3(),lookTo=new THREE.Vector3();let camT=1;
const vis=CASES.map(()=>({a:0,d:1}));
// show case k at step s; snap skips the transition (first paint, or a page opened mid-scroll)
export function show(k,s,snap){const c=CASES[k];
  if(state.ck!==k){state.ck=k;c.actor.shape(0,true);if(snap)vis.forEach((v,i)=>{v.a=i===k?1:0;v.d=i===k?0:1})}
  state.step=s;state.t=0;c.actor.shape(s,!!snap);aim(snap)}
// point the camera at the current step; reframe() re-aims after the words beside the scene change size
function aim(snap){const S=stepsOf(state.ck)[state.step];
  camFrom.copy(camPos);if(mobile&&S.mcam){camTo.set(...S.mcam);lookTo.set(...S.mlook)}else{camTo.set(...S.cam).multiplyScalar(mobile?1.8:1);lookTo.set(...S.look)}lookFrom.copy(camLook);camT=0;
  if(adjust)adjust(camTo,lookTo,S);camMove=camFrom.distanceTo(camTo)+lookFrom.distanceTo(lookTo);
  if(snap){camPos.copy(camTo);camLook.copy(lookTo);camT=1}}
export function reframe(){if(state.ck>=0)aim(false)}
export const CAM_SECS=reduce?.3:1.7;
export const isLight=()=>light;
export function setLight(v){light=v;mats.forEach(m=>{m.blending=blend();m.needsUpdate=true});inkMats.forEach(m=>m.color.set(light?0x141312:0xecebe6));
  CASES.forEach((c,i)=>c.actor.shape(i===state.ck?state.step:0,true))}

let mx=0,my=0;addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5});
// the scene sits right of the text column; on phones it sits below the text (home) or above it (case pages)
function size(){const w=innerWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);dotMats.forEach(m=>m.uniforms.uPx.value=h*renderer.getPixelRatio()/2);camera.aspect=w/h;
  if(mobile)camera.setViewOffset(w,h,0,layout==='case'?h*.15:-h*.13,w,h);else camera.setViewOffset(w,h,-w*.17,0,w,h);camera.updateProjectionMatrix()}size();addEventListener('resize',size);
// on desktop a label never starts inside the text column (or the fade beside it)
const col=document.querySelector('.left')||document.querySelector('.beat');
const v=new THREE.Vector3();function place(el,p,i){v.set(...p);v.project(camera);const r=canvas.getBoundingClientRect(),w=el.offsetWidth,n=nudge[i]||[0,0];
  let x=(v.x*.5+.5)*r.width;const dx=el.classList.contains('l')?-8:el.classList.contains('r')?8-w:-w/2;
  if(!mobile&&col){const min=col.getBoundingClientRect().right+48;if(x+dx<min)x=min-dx}
  el.style.transform=`translate(${x+dx+n[0]}px,${(-v.y*.5+.5)*r.height+n[1]}px) translate(0,${el.classList.contains('u')?'6px':'-100%'})`}
// labels keep clear of the drawing and of each other: once a step's labels appear (and again when the shapes settle),
// project the visible geometry to the screen and move each label to the nearest spot at least GAP px from any mark
const nudge=tagEls.map(()=>[0,0]),GAP=mobile?16:32,TGAP=mobile?10:20;let nudgeKey='',nudgePass=0;
const CANDS=[];for(let y=-72;y<=72;y+=6)for(let x=-72;x<=72;x+=8)CANDS.push([x,y]);CANDS.sort((a,b)=>Math.hypot(a[0],a[1]*1.2)-Math.hypot(b[0],b[1]*1.2));
const pv=new THREE.Vector3();
function screenPts(){const G=CASES[state.ck].actor.g,R=canvas.getBoundingClientRect(),out=[],bg=COL.bg();G.updateMatrixWorld(true);
  G.traverse(o=>{if(!o.geometry||!o.visible||o.isMesh)return;const ms=[].concat(o.material||[]);if(ms.length&&ms.every(m=>m.opacity<.08))return;
    const a=o.geometry.attributes.position,c=o.geometry.attributes.color;if(!a)return;const n=a.count,lines=o.isLineSegments||o.isLine,st=o.isLineSegments?2:1;
    const hid=i=>c&&Math.abs(c.getX(i)-bg[0])+Math.abs(c.getY(i)-bg[1])+Math.abs(c.getZ(i)-bg[2])<.06;
    const add=(x,y,z)=>{pv.set(x,y,z).applyMatrix4(o.matrixWorld).project(camera);if(pv.z>1)return;const sx=(pv.x*.5+.5)*R.width+R.left,sy=(-pv.y*.5+.5)*R.height+R.top;if(sx>=R.left&&sx<=R.right&&sy>=R.top&&sy<=R.bottom)out.push(sx,sy)};
    if(lines){for(let i=0;i+1<n;i+=st){if(hid(i))continue;for(let k=0;k<=6;k++){const u=k/6;add(a.getX(i)+(a.getX(i+1)-a.getX(i))*u,a.getY(i)+(a.getY(i+1)-a.getY(i))*u,a.getZ(i)+(a.getZ(i+1)-a.getZ(i))*u)}}}
    else{const s=Math.max(1,Math.floor(n/2500));for(let i=0;i<n;i+=s)if(!hid(i))add(a.getX(i),a.getY(i),a.getZ(i))}});
  return out}
const gapTo=(P,L,T,w,h)=>{let m=1e9;for(let j=0;j<P.length;j+=2){const dx=Math.max(L-P[j],0,P[j]-L-w),dy=Math.max(T-P[j+1],0,P[j+1]-T-h),d=dx*dx+dy*dy;if(d<m){m=d;if(!m)return 0}}return Math.sqrt(m)};
const boxGap=(a,b)=>Math.hypot(Math.max(a[0]-b[0]-b[2],b[0]-a[0]-a[2],0),Math.max(a[1]-b[1]-b[3],b[1]-a[1]-a[3],0));
function settle(){const P=screenPts(),minX=!mobile&&col?col.getBoundingClientRect().right+48:8,bar=document.querySelector('.bar,.rail'),maxY=(bar?bar.getBoundingClientRect().top:innerHeight)-8,minY=mobile&&layout==='hero'&&document.querySelector('.left')?document.querySelector('.left').getBoundingClientRect().bottom+4:64,placed=[];
  tagEls.forEach((el,i)=>{if(el.style.opacity!=='1')return;const r=el.getBoundingClientRect(),bx=r.left-nudge[i][0],by=r.top-nudge[i][1],w=r.width,h=r.height;
    let best=[0,0],bs=-1e9;for(const [dx,dy] of CANDS){const L=bx+dx,T=by+dy;if(L<minX||L+w>innerWidth-8||T<minY||T+h>maxY)continue;
      const g=Math.min(gapTo(P,L,T,w,h),GAP),tg=Math.min(TGAP,...placed.map(q=>boxGap(q,[L,T,w,h])));if(g>=GAP&&tg>=TGAP){best=[dx,dy];break}
      const sc=g+tg*2-Math.hypot(dx,dy)*.05;if(sc>bs){bs=sc;best=[dx,dy]}}
    nudge[i]=best;placed.push([bx+best[0],by+best[1],w,h])})}
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
  if(camT<1)camT=Math.min(1,camT+dt/CAM_SECS);const e=ease(camT),arc=Math.sin(e*Math.PI)*.35;
  camPos.lerpVectors(camFrom.lengthSq()?camFrom:camPos,camTo.lengthSq()?camTo:camPos,e);camLook.lerpVectors(lookFrom,lookTo,e);
  camera.position.set(camPos.x+mx*.6,camPos.y+arc-my*.4,camPos.z);camera.lookAt(camLook);
  const S=state.ck>=0&&stepsOf(state.ck)[state.step],show=S&&S.tags&&state.t>DUR*.85&&(camT>=.85||camMove<.05);   // labels appear as the scene and camera come to rest, so they never drift while being read
  const key=show?state.ck+'.'+state.step+'.'+innerWidth+'x'+innerHeight:'';if(key!==nudgeKey){nudge.forEach(n=>{n[0]=n[1]=0});nudgePass=0}
  tagEls.forEach((el,i)=>{const tg=show&&S.tags[i];el.style.opacity=tg?1:0;if(tg){el.className='tag '+(tg[3]||'');const sub=mobile?tg[4]:tg[1];el.innerHTML=`<b>${tg[0]}</b>${sub?`<span${mobile?' class="m"':''}>${sub}</span>`:''}`;const G=CASES[state.ck].actor.g,k=G.scale.x;place(el,[tg[2][0]*k+G.position.x,tg[2][1]*k+G.position.y,tg[2][2]*k],i)}});
  if(show&&(key!==nudgeKey||(nudgePass<2&&state.t>DUR*(1+nudgePass*.8)))){nudgeKey=key;nudgePass++;settle()}else if(!show)nudgeKey='';
  renderer.render(scene,camera);
}
requestAnimationFrame(frame);
export const debug={camera,CASES,ff:sec=>{for(let i=0;i<sec*30;i++)tick(1/30)}};
