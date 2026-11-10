(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
if(typeof THREE==='undefined'){$('status').textContent='Could not load the 3D engine. Check your internet and reload.';$('startBtn').disabled=true;return}
var clamp=function(v,a,b){return v<a?a:v>b?b:v},rnd=function(a,b){return a+Math.random()*(b-a)};
var IS_TOUCH=(window.matchMedia&&matchMedia('(pointer:coarse)').matches)||('ontouchstart' in window);
if(!IS_TOUCH){['joyzone','lookzone','btns','pauseBtn'].forEach(function(i){$(i).style.display='none'});$('helpTouch').style.display='none'}else{$('helpPC').style.display='none'}

/* ---------- constants ---------- */
var EYE=1.65,R=0.42,ROADS=[-120,-60,0,60,120],RW=6,HALF=152,TEAMSZ=5,SCORE_LIMIT=30,MATCH_TIME=300;
var DIFF={
 easy:{react:.75,turn:3.2,spread:.045,dmg:11,rof:4,view:60,lose:2,hold:30,head:.05},
 normal:{react:.5,turn:4.8,spread:.03,dmg:14,rof:5,view:75,lose:3,hold:28,head:.1},
 hard:{react:.3,turn:7,spread:.02,dmg:17,rof:6,view:90,lose:4,hold:26,head:.18}};
var diff=localStorage.getItem('cs_diff')||'normal',qual=localStorage.getItem('cs_q')||(IS_TOUCH?'low':'high');
if(!DIFF[diff])diff='normal';

/* ---------- renderer / scene ---------- */
var canvas=$('gl'),renderer;
try{renderer=new THREE.WebGLRenderer({canvas:canvas,antialias:!IS_TOUCH,powerPreference:'high-performance'})}
catch(e){$('status').textContent='Your device could not start 3D graphics (WebGL).';$('startBtn').disabled=true;return}
var scene=new THREE.Scene(),SKY=0x070b18;
scene.background=new THREE.Color(SKY);scene.fog=new THREE.Fog(SKY,45,270);
var camera=new THREE.PerspectiveCamera(75,1,0.08,600);camera.rotation.order='YXZ';scene.add(camera);
scene.add(new THREE.HemisphereLight(0x9bbcff,0x1a2233,0.95));
var sun=new THREE.DirectionalLight(0xcfe0ff,0.55);sun.position.set(60,120,40);scene.add(sun);
var W=innerWidth,H=innerHeight;
function resize(){W=innerWidth;H=innerHeight;renderer.setPixelRatio(qual==='high'?Math.min(devicePixelRatio||1,2):Math.min(devicePixelRatio||1,1.25));renderer.setSize(W,H,false);camera.aspect=W/H;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();

/* ---------- procedural textures ---------- */
function canv(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c}
function wrapTex(c){var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t}
var wallA=canv(512,512),wallB=canv(512,512);
(function(){var x=wallA.getContext('2d'),e=wallB.getContext('2d'),S=512;
 x.fillStyle='#2b3550';x.fillRect(0,0,S,S);e.fillStyle='#000';e.fillRect(0,0,S,S);
 x.strokeStyle='#39446a';x.lineWidth=4;x.strokeRect(2,2,S-4,S-4);
 var cols=['#ffd27a','#7ae8ff','#ff8ad9','#b6ff8a','#ffe9b0'];
 for(var r=0;r<2;r++)for(var c=0;c<2;c++){var wx=40+c*236,wy=50+r*230,ww=190,wh=150;
  x.fillStyle='#0b1220';x.fillRect(wx,wy,ww,wh);x.strokeStyle='#4b5a86';x.lineWidth=6;x.strokeRect(wx,wy,ww,wh);
  x.beginPath();x.moveTo(wx+ww/2,wy);x.lineTo(wx+ww/2,wy+wh);x.stroke();
  if(Math.random()<0.55){e.fillStyle=cols[Math.floor(Math.random()*cols.length)];e.globalAlpha=0.5+Math.random()*0.4;e.fillRect(wx+4,wy+4,ww-8,wh-8);e.globalAlpha=1}}
})();
var roofC=canv(256,256);(function(){var x=roofC.getContext('2d');x.fillStyle='#101826';x.fillRect(0,0,256,256);x.strokeStyle='#1d2a40';x.lineWidth=3;for(var i=0;i<=256;i+=64){x.beginPath();x.moveTo(i,0);x.lineTo(i,256);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(256,i);x.stroke()}})();
var matWalls=new THREE.MeshLambertMaterial({map:wrapTex(wallA),emissive:0xffffff,emissiveMap:wrapTex(wallB),vertexColors:true});
var matRoofs=new THREE.MeshLambertMaterial({map:wrapTex(roofC),vertexColors:true});
var matProps=new THREE.MeshLambertMaterial({vertexColors:true});
var matNeon=new THREE.MeshBasicMaterial({vertexColors:true});

/* ---------- static geometry builder ---------- */
function mkG(){return {p:[],n:[],u:[],c:[],i:[]}}
var G={walls:mkG(),roofs:mkG(),props:mkG(),neon:mkG()};
function addQuad(g,c0,c1,c2,c3,nx,ny,nz,uU,vV,col){
 var e1=[c1[0]-c0[0],c1[1]-c0[1],c1[2]-c0[2]],e2=[c2[0]-c0[0],c2[1]-c0[1],c2[2]-c0[2]];
 var cx=e1[1]*e2[2]-e1[2]*e2[1],cy=e1[2]*e2[0]-e1[0]*e2[2],cz=e1[0]*e2[1]-e1[1]*e2[0];
 var flip=(cx*nx+cy*ny+cz*nz)<0;
 var cs=flip?[c0,c3,c2,c1]:[c0,c1,c2,c3];
 var uvs=flip?[[0,0],[0,vV],[uU,vV],[uU,0]]:[[0,0],[uU,0],[uU,vV],[0,vV]];
 var base=g.p.length/3;
 for(var k=0;k<4;k++){g.p.push(cs[k][0],cs[k][1],cs[k][2]);g.n.push(nx,ny,nz);g.u.push(uvs[k][0],uvs[k][1]);g.c.push(col[0],col[1],col[2])}
 g.i.push(base,base+1,base+2,base,base+2,base+3);
}
function pushBox(gs,gt,x0,y0,z0,x1,y1,z1,col,tile){
 var w=x1-x0,d=z1-z0,h=y1-y0,t=tile||4;
 addQuad(gs,[x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],1,0,0,d/t,h/t,col);
 addQuad(gs,[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],-1,0,0,d/t,h/t,col);
 addQuad(gs,[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],0,0,1,w/t,h/t,col);
 addQuad(gs,[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],0,0,-1,w/t,h/t,col);
 addQuad(gt,[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],0,1,0,w/t,d/t,col);
}
function toMesh(g,mat){
 if(!g.p.length)return null;
 var geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(g.p,3));
 geo.setAttribute('normal',new THREE.Float32BufferAttribute(g.n,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(g.u,2));
 geo.setAttribute('color',new THREE.Float32BufferAttribute(g.c,3));
 geo.setIndex(g.i);
 var m=new THREE.Mesh(geo,mat);m.frustumCulled=false;scene.add(m);return m;
}

/* ---------- map generation (same city every time) ---------- */
var _s=1337;function srnd(){_s=(_s*1664525+1013904223)>>>0;return _s/4294967296}
function sr(a,b){return a+srnd()*(b-a)}
function spick(a){return a[Math.floor(srnd()*a.length)]}
var NEONS=[[0.1,0.9,1],[1,0.2,0.75],[0.55,0.4,1],[0.2,1,0.6]];
var WALLTINT=[[0.85,0.95,1],[0.8,0.85,1],[0.9,0.8,1],[0.75,0.95,0.95],[0.95,0.9,0.85],[0.7,0.8,0.95]];
var PROPCOL=[[0.85,0.25,0.2],[0.2,0.45,0.85],[0.9,0.55,0.15],[0.2,0.7,0.45],[0.55,0.6,0.7],[0.6,0.35,0.8]];
var B=[];
function solid(x0,z0,x1,z1,top){B.push({x0:x0,x1:x1,z0:z0,z1:z1,top:top})}
function neonBox(x0,y0,z0,x1,y1,z1,col){pushBox(G.neon,G.neon,x0,y0,z0,x1,y1,z1,col,4)}
function building(x0,z0,x1,z1,h,tint){
 pushBox(G.walls,G.roofs,x0,0,z0,x1,h,z1,tint||spick(WALLTINT),4);solid(x0,z0,x1,z1,h);
 var nc=spick(NEONS),t=0.35;
 neonBox(x0-0.1,h,z0-0.1,x1+0.1,h+t,z0+t,nc);neonBox(x0-0.1,h,z1-t,x1+0.1,h+t,z1+0.1,nc);
 neonBox(x0-0.1,h,z0,x0+t,h+t,z1,nc);neonBox(x1-t,h,z0,x1+0.1,h+t,z1,nc);
 if(h>14){var cx=(x0+x1)/2,cz=(z0+z1)/2;pushBox(G.props,G.props,cx-0.15,h,cz-0.15,cx+0.15,h+6,cz+0.15,[0.5,0.55,0.6],4);neonBox(cx-0.3,h+6,cz-0.3,cx+0.3,h+6.6,cz+0.3,[1,0.2,0.3])}
 if(h>8&&(x1-x0)>10){pushBox(G.props,G.props,x0+2,h,z0+2,x0+5,h+1.4,z0+5,[0.35,0.4,0.48],4)}
 if(h>22){neonBox(x0-0.12,0,z0-0.12,x0+0.25,h,z0+0.25,nc);neonBox(x1-0.25,0,z1-0.25,x1+0.12,h,z1+0.12,nc)}
}
function crate(x,z,s,h){pushBox(G.props,G.props,x-s/2,0,z-s/2,x+s/2,h,z+s/2,spick(PROPCOL),2);solid(x-s/2,z-s/2,x+s/2,z+s/2,h)}
function container(x,z,alongX,stack){
 var l=6,w=2.4,hh=2.6,c=spick(PROPCOL);
 var x0=alongX?x-l/2:x-w/2,x1=alongX?x+l/2:x+w/2,z0=alongX?z-w/2:z-l/2,z1=alongX?z+w/2:z+l/2;
 pushBox(G.props,G.props,x0,0,z0,x1,hh,z1,c,2);solid(x0,z0,x1,z1,hh);
 if(stack){var c2=spick(PROPCOL);pushBox(G.props,G.props,x0,hh,z0,x1,hh*2,z1,c2,2);solid(x0,z0,x1,z1,hh*2)}
}
function barrier(x,z,len,alongX){
 var x0=alongX?x-len/2:x-0.3,x1=alongX?x+len/2:x+0.3,z0=alongX?z-0.3:z-len/2,z1=alongX?z+0.3:z+len/2;
 pushBox(G.props,G.props,x0,0,z0,x1,0.9,z1,[0.5,0.52,0.56],2);solid(x0,z0,x1,z1,0.9);
 neonBox(x0,0.9,z0,x1,1.0,z1,[0.1,0.9,1]);
}
function pylon(x,z){pushBox(G.props,G.props,x-0.4,0,z-0.4,x+0.4,12,z+0.4,[0.4,0.45,0.55],4);solid(x-0.4,z-0.4,x+0.4,z+0.4,12);neonBox(x-0.5,10,z-0.5,x+0.5,12.4,z+0.5,spick(NEONS))}
function layout(x0,x1,z0,z1,kind){
 var w=x1-x0,d=z1-z0,m=2,cx=(x0+x1)/2,cz=(z0+z1)/2,i;
 if(kind===0){building(x0+m,z0+m,x1-m,z1-m,sr(16,36))}
 else if(kind===1){var hz=w>=d;
  if(hz){building(x0+m,z0+m,cx-4,z1-m,sr(9,20));building(cx+4,z0+m,x1-m,z1-m,sr(9,20))}
  else{building(x0+m,z0+m,x1-m,cz-4,sr(9,20));building(x0+m,cz+4,x1-m,z1-m,sr(9,20))}}
 else if(kind===2){var gx=(w-2*m-6)/2,gz=(d-2*m-6)/2;
  for(i=0;i<4;i++){var ix=i%2,iz=i>>1,bx0=x0+m+ix*(gx+6),bz0=z0+m+iz*(gz+6);building(bx0,bz0,bx0+gx,bz0+gz,sr(6,13))}}
 else if(kind===3){
  building(x0+m,z0+m,x1-m,z0+m+d*0.5,6.5,[0.7,0.75,0.8]);
  container(x0+8,z1-6,true,srnd()<.5);container(x1-8,z1-6,true,false);crate(cx,z1-4,2.2,1.2);crate(cx+3,z1-4.5,1.6,0.8);barrier(cx,z1-10,8,true)}
 else{
  for(i=0;i<7;i++){var px=sr(x0+4,x1-4),pz=sr(z0+4,z1-4);if(srnd()<.5)crate(px,pz,sr(1.4,2.4),sr(0.8,1.4));else barrier(px,pz,sr(3,6),srnd()<.5)}
  container(cx,cz,srnd()<.5,true);pylon(x0+3,z0+3);pylon(x1-3,z1-3)}
}
(function buildMap(){
 var lines=[-HALF].concat(ROADS).concat([HALF]),i,j;
 for(i=0;i<6;i++)for(j=0;j<6;j++){
  var xa=lines[i]+(i===0?0:RW),xb=lines[i+1]-(i===5?0:RW),za=lines[j]+(j===0?0:RW),zb=lines[j+1]-(j===5?0:RW);
  if(j===0||j===5){ // team bases: open ground with some cover
   var sgn=j===5?1:-1;
   for(var k=0;k<3;k++)crate((xa+xb)/2+sr(-10,10),sgn*sr(129,134),sr(1.6,2.6),sr(0.9,1.5));
   barrier((xa+xb)/2,sgn*131,8,true);
   if(i===0||i===5){pylon((xa+xb)/2,sgn*146)}
   continue}
  layout(xa,xb,za,zb,Math.floor(srnd()*5));
 }
 // central landmark tower on the middle crossing
 building(-4,-4,4,4,46,[0.6,0.7,0.95]);
 // boundary walls
 building(-HALF-8,-HALF-8,-HALF-2,HALF+8,12,[0.5,0.55,0.7]);building(HALF+2,-HALF-8,HALF+8,HALF+8,12,[0.5,0.55,0.7]);
 building(-HALF-2,-HALF-8,HALF+2,-HALF-2,12,[0.5,0.55,0.7]);building(-HALF-2,HALF+2,HALF+2,HALF+8,12,[0.5,0.55,0.7]);
 // far city backdrop (no collision)
 for(i=0;i<110;i++){var side=Math.floor(srnd()*4),off=sr(HALF+16,HALF+80),al=sr(-HALF-80,HALF+80),bw=sr(12,28),bd=sr(12,28),bh=sr(24,95),px,pz;
  if(side===0){px=off;pz=al}else if(side===1){px=-off;pz=al}else if(side===2){px=al;pz=off}else{px=al;pz=-off}
  pushBox(G.walls,G.roofs,px-bw/2,0,pz-bd/2,px+bw/2,bh,pz+bd/2,spick(WALLTINT),4);
  if(srnd()<.5)neonBox(px-bw/2-0.1,bh,pz-bd/2-0.1,px+bw/2+0.1,bh+0.5,pz-bd/2+0.4,spick(NEONS))}
 toMesh(G.walls,matWalls);toMesh(G.roofs,matRoofs);toMesh(G.props,matProps);toMesh(G.neon,matNeon);
})();

/* ground texture = the city map */
var GT=2048,groundCanvas=canv(GT,GT);
function mapPx(v){return (v+160)/320*GT}
(function(){var x=groundCanvas.getContext('2d'),i,j;
 x.fillStyle='#0a0f19';x.fillRect(0,0,GT,GT);
 var lines=[-HALF].concat(ROADS).concat([HALF]);
 // sidewalks / lots
 x.fillStyle='#161e2c';
 for(i=0;i<6;i++)for(j=0;j<6;j++){var xa=lines[i]+(i===0?0:RW),xb=lines[i+1]-(i===5?0:RW),za=lines[j]+(j===0?0:RW),zb=lines[j+1]-(j===5?0:RW);x.fillRect(mapPx(xa),mapPx(za),mapPx(xb)-mapPx(xa),mapPx(zb)-mapPx(za))}
 // team bases
 x.fillStyle='#0f2a4acc';x.fillRect(mapPx(-HALF),mapPx(126),mapPx(HALF)-mapPx(-HALF),mapPx(HALF)-mapPx(126));
 x.fillStyle='#4a1020cc';x.fillRect(mapPx(-HALF),mapPx(-HALF),mapPx(HALF)-mapPx(-HALF),mapPx(-126)-mapPx(-HALF));
 // road dashes
 x.strokeStyle='#28506a';x.lineWidth=5;x.setLineDash([40,50]);
 for(i=0;i<ROADS.length;i++){x.beginPath();x.moveTo(mapPx(ROADS[i]),mapPx(-HALF));x.lineTo(mapPx(ROADS[i]),mapPx(HALF));x.stroke();x.beginPath();x.moveTo(mapPx(-HALF),mapPx(ROADS[i]));x.lineTo(mapPx(HALF),mapPx(ROADS[i]));x.stroke()}
 x.setLineDash([]);
 // faint grid
 x.strokeStyle='rgba(80,200,255,0.07)';x.lineWidth=2;
 for(var g=-160;g<=160;g+=10){x.beginPath();x.moveTo(mapPx(g),0);x.lineTo(mapPx(g),GT);x.stroke();x.beginPath();x.moveTo(0,mapPx(g));x.lineTo(GT,mapPx(g));x.stroke()}
 // spawn pads
 for(var t=0;t<2;t++){var sz=t===0?142:-142;x.strokeStyle=t===0?'#3fa0ff':'#ff5d73';x.lineWidth=6;
  for(var px=-60;px<=60;px+=15){x.beginPath();x.arc(mapPx(px),mapPx(sz),mapPx(2.2)-mapPx(0),0,7);x.stroke()}}
})();
var gTex=new THREE.CanvasTexture(groundCanvas);gTex.anisotropy=8;
var ground=new THREE.Mesh(new THREE.PlaneGeometry(320,320),new THREE.MeshLambertMaterial({map:gTex}));
ground.rotation.x=-Math.PI/2;scene.add(ground);
var outer=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),new THREE.MeshBasicMaterial({color:0x04070f}));outer.rotation.x=-Math.PI/2;outer.position.y=-0.05;scene.add(outer);
// stars
(function(){var pos=[];for(var i=0;i<350;i++){var a=Math.random()*6.283,e=rnd(0.15,1.3),r=420;pos.push(Math.cos(a)*Math.cos(e)*r,Math.sin(e)*r,Math.sin(a)*Math.cos(e)*r)}
 var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 var s=new THREE.Points(g,new THREE.PointsMaterial({color:0xbfd8ff,size:2,sizeAttenuation:false,fog:false}));scene.add(s)})();

/* ---------- minimap ---------- */
var mini=$('mini'),mctx=mini.getContext('2d'),MS=mini.width,mapBase=canv(MS,MS);
(function(){var x=mapBase.getContext('2d');x.fillStyle='#0a1422';x.fillRect(0,0,MS,MS);
 function mp(v){return (v+160)/320*MS}
 x.fillStyle='#14223a';for(var i=0;i<B.length;i++){var b=B[i];if(b.top<2)continue;x.fillRect(mp(b.x0),mp(b.z0),Math.max(1,mp(b.x1)-mp(b.x0)),Math.max(1,mp(b.z1)-mp(b.z0)))}
 x.fillStyle='rgba(63,160,255,0.25)';x.fillRect(0,mp(126),MS,MS-mp(126));x.fillStyle='rgba(255,93,115,0.25)';x.fillRect(0,0,MS,mp(-126));
})();

/* ---------- collision + raycasts ---------- */
function resolveXZ(a){
 for(var k=0;k<B.length;k++){var b=B[k];if(a.y>=b.top-0.05)continue;
  var cx=a.x<b.x0?b.x0:a.x>b.x1?b.x1:a.x,cz=a.z<b.z0?b.z0:a.z>b.z1?b.z1:a.z,dx=a.x-cx,dz=a.z-cz,d2=dx*dx+dz*dz;
  if(d2<R*R){
   if(d2>1e-8){var d=Math.sqrt(d2),p=R-d;a.x+=dx/d*p;a.z+=dz/d*p}
   else{var l=a.x-b.x0,r=b.x1-a.x,f=a.z-b.z0,bk=b.z1-a.z,m=Math.min(l,r,f,bk);
    if(m===l)a.x=b.x0-R;else if(m===r)a.x=b.x1+R;else if(m===f)a.z=b.z0-R;else a.z=b.z1+R}}}
}
function moveActor(a,dx,dz){a.x+=dx;resolveXZ(a);a.z+=dz;resolveXZ(a)}
function groundAt(x,z,y){var g=0;for(var k=0;k<B.length;k++){var b=B[k];if(b.top>1.6)continue;
 if(x>b.x0-0.25&&x<b.x1+0.25&&z>b.z0-0.25&&z<b.z1+0.25&&y>=b.top-0.35&&b.top>g)g=b.top}return g}
function rayBox(ox,oy,oz,dx,dy,dz,b,maxT){
 var t0=0,t1=maxT,a,c,s;
 if(Math.abs(dx)<1e-9){if(ox<b.x0||ox>b.x1)return -1}else{a=(b.x0-ox)/dx;c=(b.x1-ox)/dx;if(a>c){s=a;a=c;c=s}if(a>t0)t0=a;if(c<t1)t1=c;if(t0>t1)return -1}
 if(Math.abs(dy)<1e-9){if(oy<0||oy>b.top)return -1}else{a=(0-oy)/dy;c=(b.top-oy)/dy;if(a>c){s=a;a=c;c=s}if(a>t0)t0=a;if(c<t1)t1=c;if(t0>t1)return -1}
 if(Math.abs(dz)<1e-9){if(oz<b.z0||oz>b.z1)return -1}else{a=(b.z0-oz)/dz;c=(b.z1-oz)/dz;if(a>c){s=a;a=c;c=s}if(a>t0)t0=a;if(c<t1)t1=c;if(t0>t1)return -1}
 return t0;
}
function wallDist(ox,oy,oz,dx,dy,dz,maxT){var best=maxT;for(var k=0;k<B.length;k++){var t=rayBox(ox,oy,oz,dx,dy,dz,B[k],best);if(t>=0&&t<best)best=t}return best}
function raySphere(ox,oy,oz,dx,dy,dz,cx,cy,cz,r){var px=ox-cx,py=oy-cy,pz=oz-cz,b=px*dx+py*dy+pz*dz,c=px*px+py*py+pz*pz-r*r,disc=b*b-c;if(disc<0)return -1;var t=-b-Math.sqrt(disc);return t>0?t:-1}
function hasLOS(a,e){var ox=a.x,oy=a.y+EYE,oz=a.z,dx=e.x-ox,dy=e.y+1.3-oy,dz=e.z-oz,d=Math.sqrt(dx*dx+dy*dy+dz*dz);if(d<0.01)return true;
 return wallDist(ox,oy,oz,dx/d,dy/d,dz/d,d)>=d-0.3}

/* ---------- actors ---------- */
var net={role:'off',peer:null,conns:[],hostConn:null,myId:0,spawn:null,snapT:0,posT:0,uiOpen:false,code:''};
var actors=[],me=null,time=0,state='menu',blueScore=0,redScore=0,matchLeft=MATCH_TIME,countdown=0,fired=false;
function newActor(id,team,isPlayer,name){return {id:id,team:team,isPlayer:isPlayer,name:name,x:0,y:0,z:0,vy:0,yaw:0,pitch:0,hp:100,alive:true,kills:0,deaths:0,respawnAt:0,invuln:0,lastHurt:-99,
 ammo:30,reloadT:0,fireT:0,onGround:true,walk:0,mesh:null,parts:null,flash:null,
 target:null,sees:false,scanT:rnd(0,.3),engageT:0,lastSeen:{x:0,z:0,t:-99},alert:null,alertT:0,node:-1,strafe:1,strafeT:0,burst:0,burstPause:0,stuckT:0,px:0,pz:0,hurtT:-99,pause:0,aimHead:false,spreadAdd:0,human:false,conn:null,tag:null,lastShot:0,vx:0,vz:0,vyaw:0,flashT:0}}
var MAT={};
function lam(c,e){return new THREE.MeshLambertMaterial({color:c,emissive:e||0x000000})}
function bm(w,h,d,mat){return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat)}
function makeBotMesh(team){
 var body=lam(team===0?0x1d8fff:0xff3b4d),dark=lam(0x141c2a),vis=new THREE.MeshBasicMaterial({color:team===0?0x7be8ff:0xff9aa6});
 var g=new THREE.Group(),torso=bm(0.5,0.65,0.3,body);torso.position.y=1.05;g.add(torso);
 var head=bm(0.27,0.27,0.27,dark);head.position.y=1.55;g.add(head);
 var v=bm(0.23,0.07,0.04,vis);v.position.set(0,1.57,-0.14);g.add(v);
 var legL=new THREE.Group(),legR=new THREE.Group();legL.position.set(-0.13,0.72,0);legR.position.set(0.13,0.72,0);
 var l1=bm(0.2,0.72,0.22,dark);l1.position.y=-0.36;legL.add(l1);var l2=bm(0.2,0.72,0.22,dark);l2.position.y=-0.36;legR.add(l2);g.add(legL);g.add(legR);
 var armL=bm(0.13,0.55,0.15,body);armL.position.set(-0.33,1.05,-0.05);g.add(armL);
 var armR=bm(0.13,0.5,0.15,body);armR.position.set(0.3,1.2,-0.2);armR.rotation.x=-1.2;g.add(armR);
 var gun=bm(0.08,0.1,0.6,dark);gun.position.set(0.22,1.2,-0.45);g.add(gun);
 var flash=bm(0.16,0.16,0.2,new THREE.MeshBasicMaterial({color:0xfff2a0}));flash.position.set(0.22,1.2,-0.85);flash.visible=false;g.add(flash);
 return {group:g,legL:legL,legR:legR,flash:flash,armL:armL};
}
function nameTag(text,team){
 var c=canv(256,64),x=c.getContext('2d');x.font='bold 34px system-ui,sans-serif';x.textAlign='center';x.fillStyle=team===0?'#9fd6ff':'#ffb0ba';x.strokeStyle='#000';x.lineWidth=6;x.strokeText(text,128,42);x.fillText(text,128,42);
 var s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));s.scale.set(1.8,0.45,1);s.position.y=2.1;s.renderOrder=5;return s;
}
function attachTag(a){if(!a.mesh)return;if(a.tag)a.mesh.group.remove(a.tag);a.tag=nameTag(a.name,a.team);a.mesh.group.add(a.tag)}
var BOTN=['Viper','Nova','Ghost','Rex','Blaze','Echo','Hunter','Zed','Raven','Titan','Neo','Axel'];
function buildTeams(){
 for(var i=0;i<actors.length;i++){if(actors[i].mesh)scene.remove(actors[i].mesh.group)}
 actors=[];var id=0,names=BOTN.slice().sort(function(){return Math.random()-0.5}),pn=($('name').value.trim()||'Player').slice(0,14);
 me=newActor(id++,0,true,pn);actors.push(me);
 for(var t=0;t<2;t++)for(var k=0;k<TEAMSZ;k++){if(t===0&&k===TEAMSZ-1)continue;
  var a=newActor(id++,t,false,names.pop()||('Bot'+id));a.mesh=makeBotMesh(t);scene.add(a.mesh.group);attachTag(a);actors.push(a)}
}
function enemyNear(a,x,z,r){for(var i=0;i<actors.length;i++){var e=actors[i];if(e.team===a.team||!e.alive)continue;if(Math.hypot(e.x-x,e.z-z)<r)return true}return false}
function spawnActor(a){
 var side=a.team===0?1:-1,x=0,z=0;
 for(var k=0;k<8;k++){x=rnd(-60,60);z=side*rnd(137,148);if(!enemyNear(a,x,z,30))break}
