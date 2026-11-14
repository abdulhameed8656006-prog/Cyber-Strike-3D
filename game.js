(function(){
'use strict';
var $=function(id){return document.getElementById(id)};
if(typeof THREE==='undefined'){$('status').textContent='Could not load the 3D engine. Check your internet and reload.';$('startBtn').disabled=true;return}
var clamp=function(v,a,b){return v<a?a:v>b?b:v},rnd=function(a,b){return a+Math.random()*(b-a)};
var IS_TOUCH=(window.matchMedia&&matchMedia('(pointer:coarse)').matches)||('ontouchstart' in window);
if(!IS_TOUCH){['joyzone','lookzone','btns','pauseBtn'].forEach(function(i){$(i).style.display='none'});$('helpTouch').style.display='none'}else{$('helpPC').style.display='none'}

/* ---------- constants ---------- */
var EYE=1.65,R=0.42,ROADS=[-72,-36,0,36,72],RW=6,HALF=100,TEAMSZ=5,SCORE_LIMIT=30,MATCH_TIME=300;
var MAPH=HALF+8,BASE0=ROADS[4]+RW;
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
var scene=new THREE.Scene(),SKY=0xb9cfe4;
scene.background=new THREE.Color(SKY);scene.fog=new THREE.Fog(SKY,60,300);
var camera=new THREE.PerspectiveCamera(75,1,0.08,600);camera.rotation.order='YXZ';scene.add(camera);
scene.add(new THREE.HemisphereLight(0xe6efff,0x8e9db5,1.05));
var sun=new THREE.DirectionalLight(0xfff2dc,0.6);sun.position.set(60,120,40);scene.add(sun);
var W=innerWidth,H=innerHeight;
function resize(){W=innerWidth;H=innerHeight;renderer.setPixelRatio(qual==='high'?Math.min(devicePixelRatio||1,2):Math.min(devicePixelRatio||1,1.25));renderer.setSize(W,H,false);camera.aspect=W/H;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();

/* ---------- procedural textures ---------- */
function canv(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c}
function wrapTex(c){var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t}
var wallA=canv(512,512),wallB=canv(512,512);
(function(){var x=wallA.getContext('2d'),e=wallB.getContext('2d'),S=512;
 x.fillStyle='#c9d4e4';x.fillRect(0,0,S,S);e.fillStyle='#000';e.fillRect(0,0,S,S);
 x.strokeStyle='#9fb1cf';x.lineWidth=4;x.strokeRect(2,2,S-4,S-4);
 var cols=['#ffd27a','#7ae8ff','#ff8ad9','#b6ff8a','#ffe9b0'];
 for(var r=0;r<2;r++)for(var c=0;c<2;c++){var wx=40+c*236,wy=50+r*230,ww=190,wh=150;
  x.fillStyle='#46607f';x.fillRect(wx,wy,ww,wh);x.strokeStyle='#e8eef8';x.lineWidth=6;x.strokeRect(wx,wy,ww,wh);
  x.beginPath();x.moveTo(wx+ww/2,wy);x.lineTo(wx+ww/2,wy+wh);x.stroke();
  if(Math.random()<0.55){e.fillStyle=cols[Math.floor(Math.random()*cols.length)];e.globalAlpha=0.5+Math.random()*0.4;e.fillRect(wx+4,wy+4,ww-8,wh-8);e.globalAlpha=1}}
})();
var roofC=canv(256,256);(function(){var x=roofC.getContext('2d');x.fillStyle='#eef4fb';x.fillRect(0,0,256,256);x.strokeStyle='#c9d6e8';x.lineWidth=3;for(var i=0;i<=256;i+=64){x.beginPath();x.moveTo(i,0);x.lineTo(i,256);x.stroke();x.beginPath();x.moveTo(0,i);x.lineTo(256,i);x.stroke()}})();
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
var WALLTINT=[[0.93,0.96,1],[0.85,0.9,0.98],[0.92,0.86,0.8],[0.8,0.88,0.95],[0.95,0.93,0.9],[0.76,0.83,0.92]];
var PROPCOL=[[0.85,0.25,0.2],[0.2,0.45,0.85],[0.9,0.55,0.15],[0.2,0.7,0.45],[0.55,0.6,0.7],[0.6,0.35,0.8]];
var B=[],BLD=[];
function solid(x0,z0,x1,z1,top){B.push({x0:x0,x1:x1,z0:z0,z1:z1,top:top})}
function neonBox(x0,y0,z0,x1,y1,z1,col){pushBox(G.neon,G.neon,x0,y0,z0,x1,y1,z1,col,4)}
function building(x0,z0,x1,z1,h,tint){
 pushBox(G.walls,G.roofs,x0,0,z0,x1,h,z1,tint||spick(WALLTINT),4);solid(x0,z0,x1,z1,h);BLD.push([x0,z0,x1,z1,h]);
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
   for(var k=0;k<3;k++)crate((xa+xb)/2+sr(-10,10),sgn*sr(BASE0+3,BASE0+8),sr(1.6,2.6),sr(0.9,1.5));
   barrier((xa+xb)/2,sgn*(BASE0+5),8,true);
   if(i===0||i===5){pylon((xa+xb)/2,sgn*(HALF-6))}
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
function mapPx(v){return (v+MAPH)/(2*MAPH)*GT}
(function(){var x=groundCanvas.getContext('2d'),i,j;
 x.fillStyle='#dbe6f2';x.fillRect(0,0,GT,GT);
 var lines=[-HALF].concat(ROADS).concat([HALF]);
 // sidewalks / lots
 x.fillStyle='#f4f8fd';
 for(i=0;i<6;i++)for(j=0;j<6;j++){var xa=lines[i]+(i===0?0:RW),xb=lines[i+1]-(i===5?0:RW),za=lines[j]+(j===0?0:RW),zb=lines[j+1]-(j===5?0:RW);x.fillRect(mapPx(xa),mapPx(za),mapPx(xb)-mapPx(xa),mapPx(zb)-mapPx(za))}
 // team bases
 x.fillStyle='#9cc2f2cc';x.fillRect(mapPx(-HALF),mapPx(BASE0),mapPx(HALF)-mapPx(-HALF),mapPx(HALF)-mapPx(BASE0));
 x.fillStyle='#f2adb8cc';x.fillRect(mapPx(-HALF),mapPx(-HALF),mapPx(HALF)-mapPx(-HALF),mapPx(-BASE0)-mapPx(-HALF));
 // road dashes
 x.strokeStyle='#8ea8c4';x.lineWidth=5;x.setLineDash([40,50]);
 for(i=0;i<ROADS.length;i++){x.beginPath();x.moveTo(mapPx(ROADS[i]),mapPx(-HALF));x.lineTo(mapPx(ROADS[i]),mapPx(HALF));x.stroke();x.beginPath();x.moveTo(mapPx(-HALF),mapPx(ROADS[i]));x.lineTo(mapPx(HALF),mapPx(ROADS[i]));x.stroke()}
 x.setLineDash([]);
 // faint grid
 x.strokeStyle='rgba(70,110,160,0.10)';x.lineWidth=2;
 for(var g=-HALF;g<=HALF;g+=10){x.beginPath();x.moveTo(mapPx(g),0);x.lineTo(mapPx(g),GT);x.stroke();x.beginPath();x.moveTo(0,mapPx(g));x.lineTo(GT,mapPx(g));x.stroke()}
 // spawn pads
 for(var t=0;t<2;t++){var sz=t===0?HALF-10:-(HALF-10);x.strokeStyle=t===0?'#3fa0ff':'#ff5d73';x.lineWidth=6;
  for(var px=-40;px<=40;px+=10){x.beginPath();x.arc(mapPx(px),mapPx(sz),mapPx(2.2)-mapPx(0),0,7);x.stroke()}}
})();
var gTex=new THREE.CanvasTexture(groundCanvas);gTex.anisotropy=8;
var ground=new THREE.Mesh(new THREE.PlaneGeometry(2*MAPH,2*MAPH),new THREE.MeshLambertMaterial({map:gTex}));
ground.rotation.x=-Math.PI/2;scene.add(ground);
var outer=new THREE.Mesh(new THREE.PlaneGeometry(1400,1400),new THREE.MeshBasicMaterial({color:0x04070f}));outer.rotation.x=-Math.PI/2;outer.position.y=-0.05;scene.add(outer);
// stars
(function(){var pos=[];for(var i=0;i<350;i++){var a=Math.random()*6.283,e=rnd(0.15,1.3),r=420;pos.push(Math.cos(a)*Math.cos(e)*r,Math.sin(e)*r,Math.sin(a)*Math.cos(e)*r)}
 var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 var s=new THREE.Points(g,new THREE.PointsMaterial({color:0xbfd8ff,size:2,sizeAttenuation:false,fog:false}));scene.add(s)})();

/* ---------- minimap ---------- */
var mini=$('mini'),mctx=mini.getContext('2d'),MS=mini.width,mapBase=canv(MS,MS);
(function(){var x=mapBase.getContext('2d');x.fillStyle='#0a1422';x.fillRect(0,0,MS,MS);
 function mp(v){return (v+MAPH)/(2*MAPH)*MS}
 x.fillStyle='#14223a';for(var i=0;i<B.length;i++){var b=B[i];if(b.top<2)continue;x.fillRect(mp(b.x0),mp(b.z0),Math.max(1,mp(b.x1)-mp(b.x0)),Math.max(1,mp(b.z1)-mp(b.z0)))}
 x.fillStyle='rgba(63,160,255,0.25)';x.fillRect(0,mp(BASE0),MS,MS-mp(BASE0));x.fillStyle='rgba(255,93,115,0.25)';x.fillRect(0,0,MS,mp(-BASE0));
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
 target:null,sees:false,scanT:rnd(0,.3),engageT:0,lastSeen:{x:0,z:0,t:-99},alert:null,alertT:0,node:-1,strafe:1,strafeT:0,burst:0,burstPause:0,stuckT:0,px:0,pz:0,hurtT:-99,pause:0,aimHead:false,spreadAdd:0,human:false,conn:null,tag:null,lastShot:0,vx:0,vz:0,vyaw:0,flashT:0,wi:(isPlayer?0:(Math.random()<0.5?0:1)),mags:[0,0,0,0,0]}}
var MAT={};
function lam(c,e){return new THREE.MeshLambertMaterial({color:c,emissive:e||0x000000})}
function bm(w,h,d,mat){return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat)}
/* ---------- weapons ---------- */
var GUNS=[
 {id:0,dmg:26,rof:0.1,mag:30,rel:1.9,spr:0.004,rec:0.0045,pel:1,pspr:0,fov:55,zs:0.6,flash:-0.68,ads:0.095,lz:-0.26,ly:-0.05},
 {id:1,dmg:17,rof:0.065,mag:35,rel:1.6,spr:0.008,rec:0.003,pel:1,pspr:0,fov:60,zs:0.7,flash:-0.5,ads:0.09,lz:-0.16,ly:-0.05},
 {id:2,dmg:11,rof:0.85,mag:6,rel:2.4,spr:0.003,rec:0.02,pel:8,pspr:0.042,fov:62,zs:0.8,flash:-0.78,ads:0.085,lz:-0.34,ly:-0.07},
 {id:3,dmg:85,rof:1.2,mag:5,rel:2.6,spr:0.0004,rec:0.03,pel:1,pspr:0,fov:22,zs:0.25,flash:-1.02,ads:0.1,lz:-0.3,ly:-0.04},
 {id:4,dmg:22,rof:0.22,mag:12,rel:1.2,spr:0.006,rec:0.012,pel:1,pspr:0,fov:62,zs:0.8,flash:-0.26,ads:0.08,lz:-0.02,ly:-0.08}];
var GUNC={},muteShot=false;
function buildGun(id){
 var g=new THREE.Group(),dark=lam(0x1b2433,0x0a1018),mid=lam(0x33425e,0x0a1018),neon=new THREE.MeshBasicMaterial({color:0x4fe3ff});
 function P(w,h,d,x,y,z,m,rx){var b=bm(w,h,d,m||dark);b.position.set(x,y,z);if(rx)b.rotation.x=rx;g.add(b);return b}
 function C(r,len,x,y,z,m){var c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,10),m||dark);c.rotation.x=Math.PI/2;c.position.set(x,y,z);g.add(c);return c}
 if(id===0){
  P(0.07,0.1,0.5,0,0,-0.1);C(0.018,0.3,0,0.015,-0.47);P(0.06,0.07,0.22,0,0,-0.34,mid);P(0.05,0.14,0.07,0,-0.11,-0.05,dark,0.15);
  P(0.06,0.09,0.2,0,-0.01,0.25);P(0.03,0.04,0.08,0,0.075,-0.2);P(0.04,0.1,0.05,0,-0.09,0.08,mid,0.2);P(0.075,0.012,0.4,0,0.052,-0.1,neon);
 }else if(id===1){
  P(0.07,0.1,0.34,0,0,-0.05);C(0.015,0.16,0,0.01,-0.3);C(0.03,0.17,0,0.01,-0.4,mid);P(0.04,0.2,0.05,0,-0.14,0);
  P(0.04,0.06,0.12,0,0,0.18);P(0.03,0.035,0.06,0,0.07,-0.12);P(0.04,0.1,0.05,0,-0.09,0.06,mid,0.2);P(0.075,0.012,0.28,0,0.052,-0.05,neon);
 }else if(id===2){
  P(0.07,0.1,0.38,0,0,0);C(0.02,0.55,0,0.02,-0.45);C(0.02,0.5,0,-0.035,-0.42);P(0.07,0.06,0.17,0,-0.04,-0.4,mid);
  P(0.06,0.1,0.28,0,-0.015,0.27,dark,0.1);P(0.015,0.045,0.015,0,0.065,-0.72);P(0.03,0.03,0.03,0,0.07,-0.1);P(0.075,0.012,0.3,0,0.052,0,neon);
 }else if(id===3){
  P(0.07,0.1,0.45,0,0,-0.05);C(0.016,0.62,0,0.015,-0.66);C(0.028,0.1,0,0.015,-0.98,mid);
  C(0.032,0.3,0,0.1,-0.15,mid);C(0.036,0.03,0,0.1,-0.31,neon);C(0.036,0.03,0,0.1,0.01,neon);P(0.03,0.04,0.03,0,0.065,-0.05);P(0.03,0.04,0.03,0,0.065,-0.25);
  P(0.045,0.1,0.06,0,-0.09,-0.02,dark,0.1);P(0.06,0.11,0.32,0,-0.01,0.3);P(0.05,0.04,0.18,0,0.06,0.28,mid);P(0.04,0.1,0.05,0,-0.09,0.1,mid,0.2);
 }else{
  P(0.05,0.06,0.2,0,0.03,-0.1);P(0.045,0.04,0.18,0,-0.015,-0.08,mid);P(0.04,0.12,0.055,0,-0.09,0.02,dark,0.22);
  P(0.015,0.03,0.015,0,0.075,-0.19);P(0.03,0.025,0.02,0,0.07,-0.01);P(0.052,0.01,0.2,0,0.062,-0.1,neon);
 }
 return g;
}
function gunClone(id){return (GUNC[id]||(GUNC[id]=buildGun(id))).clone()}
function aimLimb(o,fx,fy,fz,tx,ty,tz){
 var dx=tx-fx,dy=ty-fy,dz=tz-fz,d=Math.sqrt(dx*dx+dy*dy+dz*dz)||0.01;
 o.position.set((fx+tx)/2,(fy+ty)/2,(fz+tz)/2);o.rotation.order='YXZ';o.rotation.y=Math.atan2(dx,dz);o.rotation.x=-Math.asin(dy/d);o.scale.z=d;
}
function makeBotMesh(team){
 var tc=team===0?0x1d8fff:0xff3b4d,tl=team===0?0x7be8ff:0xff9aa6;
 var body=lam(tc),armor=lam(team===0?0x16487f:0x7f1624),dark=lam(0x141c2a),pants=lam(0x1a2436),skin=lam(0xd9a88a),boot=lam(0x0a0f16),vis=new THREE.MeshBasicMaterial({color:tl});
 var g=new THREE.Group(),up=new THREE.Group();g.add(up);
 function add(p,w,h,d,x,y,z,m){var b=bm(w,h,d,m);b.position.set(x,y,z);p.add(b);return b}
 add(g,0.44,0.16,0.26,0,0.93,0,dark);
 add(up,0.5,0.46,0.3,0,1.3,0,body);add(up,0.42,0.36,0.08,0,1.32,-0.18,armor);add(up,0.3,0.04,0.02,0,1.43,-0.225,vis);add(up,0.32,0.38,0.14,0,1.3,0.22,dark);
 add(up,0.1,0.08,0.1,0,1.55,0,skin);add(up,0.22,0.24,0.22,0,1.68,0,skin);
 var helmet=new THREE.Mesh(new THREE.SphereGeometry(0.17,10,8),armor);helmet.scale.set(1,0.85,1.1);helmet.position.set(0,1.74,0.01);up.add(helmet);
 add(up,0.2,0.07,0.04,0,1.69,-0.125,vis);
 add(up,0.17,0.13,0.2,0.33,1.5,0,armor);add(up,0.17,0.13,0.2,-0.33,1.5,0,armor);
 var legL=new THREE.Group(),legR=new THREE.Group();legL.position.set(-0.13,0.9,0);legR.position.set(0.13,0.9,0);
 [legL,legR].forEach(function(l){add(l,0.2,0.44,0.22,0,-0.22,0,pants);add(l,0.19,0.1,0.06,0,-0.46,-0.12,armor);add(l,0.18,0.4,0.2,0,-0.64,0.01,dark);add(l,0.2,0.12,0.3,0,-0.85,-0.04,boot);g.add(l)});
 var limbR=bm(0.11,0.11,1,body),limbL=bm(0.11,0.11,1,body),gloveR=bm(0.1,0.1,0.1,dark),gloveL=bm(0.1,0.1,0.1,dark);
 up.add(limbR);up.add(limbL);up.add(gloveR);up.add(gloveL);
 var holder=new THREE.Group();holder.position.set(0.1,1.33,-0.3);up.add(holder);
 var flash=bm(0.16,0.16,0.2,new THREE.MeshBasicMaterial({color:0xfff2a0}));flash.visible=false;holder.add(flash);
 var m={group:g,upper:up,legL:legL,legR:legR,flash:flash,holder:holder,gun:null,gunId:-1,limbL:limbL,gloveL:gloveL};
 aimLimb(limbR,0.3,1.46,0,0.1,1.27,-0.26);gloveR.position.set(0.1,1.27,-0.26);
 setBotGun(m,0);return m;
}
function setBotGun(m,id){
 if(!(id>=0&&id<GUNS.length))id=0;if(m.gunId===id)return;m.gunId=id;
 if(m.gun)m.holder.remove(m.gun);m.gun=gunClone(id);m.holder.add(m.gun);
 var G2=GUNS[id];m.flash.position.set(0,0.015,G2.flash);
 var hx=0.1,hy=1.33+G2.ly,hz=-0.3+G2.lz;
 aimLimb(m.limbL,-0.3,1.46,0,hx,hy,hz);m.gloveL.position.set(hx,hy,hz);
}
/* ---------- 3D models (your low-poly gun pack + snow pack) ---------- */
var GMOD=[{f:'rifle',flash:-0.62,lz:-0.252,ads:0.093},{f:'smg',flash:-0.396,lz:-0.158,ads:0.107},{f:'shotgun',flash:-0.427,lz:-0.171,ads:0.114},{f:'sniper',flash:-0.641,lz:-0.261,ads:0.084},{f:'pistol',flash:-0.26,lz:-0.101,ads:0.038}];
function parseBin(buf){
 var dv=new DataView(buf),mn=[dv.getFloat32(0,true),dv.getFloat32(4,true),dv.getFloat32(8,true)],ex=[dv.getFloat32(12,true),dv.getFloat32(16,true),dv.getFloat32(20,true)],n=dv.getUint16(24,true),o=28,g=new THREE.Group();
 for(var k=0;k<n;k++){
  var r=dv.getUint8(o),gg=dv.getUint8(o+1),bb=dv.getUint8(o+2),nv=dv.getUint16(o+4,true),nt=dv.getUint16(o+6,true);o+=8;
  var q=new Uint8Array(buf,o,nv*3),pos=new Float32Array(nv*3),i;
  for(i=0;i<nv;i++){pos[i*3]=mn[0]+q[i*3]/255*ex[0];pos[i*3+1]=mn[1]+q[i*3+1]/255*ex[1];pos[i*3+2]=mn[2]+q[i*3+2]/255*ex[2]}
  o+=nv*3+((nv*3)&1);
  var idx=new Uint16Array(buf.slice(o,o+nt*6));o+=nt*6;
  var geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setIndex(new THREE.BufferAttribute(idx,1));geo.computeVertexNormals();
  var col=new THREE.Color((r<<16)|(gg<<8)|bb);
  g.add(new THREE.Mesh(geo,new THREE.MeshPhongMaterial({color:col,emissive:col.clone().multiplyScalar(0.16),flatShading:true,shininess:10,specular:0x181818})));
 }
 return g;
}
function fetchBin(url,cb,ef){
 var fin=false;function end(g){if(fin)return;fin=true;if(g)cb(g);else if(ef)ef()}
 try{fetch(url).then(function(r){if(!r.ok)throw 0;return r.arrayBuffer()}).then(function(bf){var g=null;try{g=parseBin(bf)}catch(e){}end(g)}).catch(function(){end(null)})}catch(e){end(null)}
}
function loadGunModels(){
 GMOD.forEach(function(gm,id){
  fetchBin('models/guns/'+gm.f+'.bin',function(root){
   var w=new THREE.Group();w.add(root);GUNC[id]=w;
   var q=GUNS[id];q.flash=gm.flash;q.lz=gm.lz;q.ads=gm.ads;
   vmSwap(me?me.wi:startWi);
   for(var i=0;i<actors.length;i++){if(actors[i].mesh)actors[i].mesh.gunId=-1}
  });
 });
}
/* snow map decoration: positions are planned immediately (same for every player), models appear when loaded */
var SNOWP=[],snowDone=false;
function planSnow(){
 var s=987654321;function rnd(){s=(s*1664525+1013904223)>>>0;return s/4294967296}
 function freeAt(x,z,m){for(var k=0;k<B.length;k++){var b=B[k];if(x>b.x0-m&&x<b.x1+m&&z>b.z0-m&&z<b.z1+m)return false}return true}
 function nearRoad(v){for(var i=0;i<ROADS.length;i++){if(Math.abs(v-ROADS[i])<RW+1.5)return true}return false}
 var x,z,h;
 [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(function(c){x=c[0]*96;z=c[1]*96;h=16;SNOWP.push({n:'tower',x:x,z:z,h:h,ry:0});solid(x-3.6,z-3.6,x+3.6,z+3.6,h)});
 [1,2,3].forEach(function(ri){[-1,1].forEach(function(sg){x=ROADS[ri];z=sg*BASE0;h=6.4;SNOWP.push({n:'gate',x:x,z:z,h:h,ry:0});solid(x-3.95,z-0.4,x-3.35,z+0.4,h);solid(x+3.35,z-0.4,x+3.95,z+0.4,h)})});
 var types=['fir','snowfir','rock'],want={fir:45,snowfir:25,rock:28},cnt={fir:0,snowfir:0,rock:0};
 for(var ti=0;ti<types.length;ti++){
  var t=types[ti],tries=0;
  while(cnt[t]<want[t]&&tries<900){
   tries++;x=(rnd()*2-1)*(HALF-8);z=(rnd()*2-1)*(BASE0-4);
   if(nearRoad(x)||nearRoad(z))continue;
   if(!freeAt(x,z,t==='rock'?3.2:2.7))continue;
   h=t==='rock'?1.2+rnd()*1.1:5+rnd()*2.6;
   var ry=rnd()*6.283;
   SNOWP.push({n:t,x:x,z:z,h:h,ry:ry});
   if(t==='rock'){var hw=h*0.5;solid(x-hw,z-hw*0.85,x+hw,z+hw*0.85,h*0.8)}else solid(x-0.45,z-0.45,x+0.45,z+0.45,7);
   cnt[t]++;
  }
 }
}
function dressSnow(P){
 if(snowDone)return;snowDone=true;
 for(var i=0;i<SNOWP.length;i++){var d=SNOWP[i],g=P[d.n];if(!g)continue;
  var o=g.clone();o.scale.setScalar(d.h);o.position.set(d.x,0,d.z);o.rotation.y=d.ry;scene.add(o)}
}
function loadSnow(){
 var P={},names=['fir','snowfir','rock','gate','tower'],left=names.length;
 function done(){if(--left===0)dressSnow(P)}
 names.forEach(function(nm){fetchBin('models/snow/'+nm+'.bin',function(g){P[nm]=g;done()},done)});
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
 for(var k=0;k<8;k++){x=rnd(-45,45);z=side*rnd(HALF-15,HALF-4);if(!enemyNear(a,x,z,30))break}
 a.x=x;a.z=z;a.y=0;a.vy=0;a.hp=100;a.alive=true;a.invuln=time+2.5;a.ammo=GUNS[a.wi].mag;if(a.isPlayer)for(var gi=0;gi<GUNS.length;gi++)a.mags[gi]=GUNS[gi].mag;a.reloadT=0;a.yaw=side>0?0:Math.PI;a.pitch=0;a.vx=x;a.vz=z;a.vyaw=a.yaw;a.flashT=0;
 a.target=null;a.sees=false;a.alert=null;a.node=-1;a.burst=0;a.burstPause=0;a.lastHurt=-99;
 if(a.mesh)a.mesh.group.visible=true;
}

/* ---------- navigation graph (road crossings) ---------- */
var NODES=[];
(function(){for(var i=0;i<5;i++)for(var j=0;j<5;j++)NODES.push({x:ROADS[i],z:ROADS[j],nb:[],skip:(i===2&&j===2)});
 for(var i2=0;i2<5;i2++)for(var j2=0;j2<5;j2++){var n=NODES[i2*5+j2];if(n.skip)continue;
  [[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var a=i2+d[0],b=j2+d[1];if(a<0||b<0||a>4||b>4)return;var m=NODES[a*5+b];if(!m.skip)n.nb.push(a*5+b)})}})();
function nearestNode(x,z){var best=-1,bd=1e9;for(var i=0;i<NODES.length;i++){if(NODES[i].skip)continue;var d=Math.hypot(NODES[i].x-x,NODES[i].z-z);if(d<bd){bd=d;best=i}}return best}

/* ---------- effects ---------- */
var tracers=[],tIdx=0,impacts=[],iIdx=0,i0;
var tracerGeo=new THREE.BoxGeometry(0.03,0.03,1);
for(i0=0;i0<40;i0++){var tm=new THREE.Mesh(tracerGeo,new THREE.MeshBasicMaterial({color:0x7be8ff}));tm.visible=false;scene.add(tm);tracers.push({m:tm,life:0})}
var impGeo=new THREE.BoxGeometry(0.16,0.16,0.16),impMat=new THREE.MeshBasicMaterial({color:0xffe08a});
for(i0=0;i0<24;i0++){var im=new THREE.Mesh(impGeo,impMat);im.visible=false;scene.add(im);impacts.push({m:im,life:0})}
function addTracer(x0,y0,z0,x1,y1,z1,color){
 var t=tracers[tIdx++%tracers.length],dx=x1-x0,dy=y1-y0,dz=z1-z0,len=Math.sqrt(dx*dx+dy*dy+dz*dz);if(len<0.5)return;
 t.m.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);t.m.lookAt(x1,y1,z1);t.m.scale.set(1,1,len);t.m.material.color.setHex(color);t.m.visible=true;t.life=0.07;
}
function addImpact(x,y,z){var t=impacts[iIdx++%impacts.length];t.m.position.set(x,y,z);t.m.visible=true;t.life=0.18}
function stepEffects(dt){
 for(var i=0;i<tracers.length;i++){var t=tracers[i];if(t.life>0){t.life-=dt;if(t.life<=0)t.m.visible=false}}
 for(var j=0;j<impacts.length;j++){var p=impacts[j];if(p.life>0){p.life-=dt;p.m.scale.setScalar(Math.max(0.1,p.life/0.18));if(p.life<=0)p.m.visible=false}}
}

/* ---------- audio (made in code) ---------- */
var ac=null,noiseBuf=null;
function initAudio(){if(ac)return;try{ac=new (window.AudioContext||window.webkitAudioContext)();var n=ac.sampleRate*0.3,b=ac.createBuffer(1,n,ac.sampleRate),d=b.getChannelData(0);for(var i=0;i<n;i++)d[i]=Math.random()*2-1;noiseBuf=b}catch(e){ac=null}}
function sfxShot(vol){if(!ac||vol<0.02)return;var t=ac.currentTime,s=ac.createBufferSource();s.buffer=noiseBuf;var f=ac.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(2400,t);f.frequency.exponentialRampToValueAtTime(300,t+0.12);
 var g=ac.createGain();g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.14);s.connect(f);f.connect(g);g.connect(ac.destination);s.start(t);s.stop(t+0.16);
 var o=ac.createOscillator(),og=ac.createGain();o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(40,t+0.1);og.gain.setValueAtTime(vol*0.8,t);og.gain.exponentialRampToValueAtTime(0.001,t+0.12);o.connect(og);og.connect(ac.destination);o.start(t);o.stop(t+0.14)}
function sfxTone(f0,f1,dur,vol,type){if(!ac)return;var t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f0,t);o.frequency.exponentialRampToValueAtTime(f1,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(0.001,t+dur);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+dur+0.02)}
function sfxClick(){if(!ac)return;var t=ac.currentTime,s=ac.createBufferSource();s.buffer=noiseBuf;var g=ac.createGain();g.gain.setValueAtTime(0.25,t);g.gain.exponentialRampToValueAtTime(0.001,t+0.04);s.connect(g);g.connect(ac.destination);s.start(t);s.stop(t+0.05)}

/* ---------- HUD helpers ---------- */
var hudCache={},msgT=0,bigT=0,hitT=0,dmgA=0,hdA=0;
function setText(id,v){if(hudCache[id]!==v){hudCache[id]=v;$(id).textContent=v}}
function feed(att,vic,head){var d=document.createElement('div');d.innerHTML='<span class="'+(att.team?'r':'b')+'">'+esc(att.name)+'</span> '+(head?'&#9737; ':'&#10005; ')+'<span class="'+(vic.team?'r':'b')+'">'+esc(vic.name)+'</span>';
 var f=$('feed');f.appendChild(d);while(f.children.length>5)f.removeChild(f.firstChild);setTimeout(function(){if(d.parentNode)d.parentNode.removeChild(d)},5000)}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function showMsg(t,col){var m=$('msg');m.textContent=t;m.style.color=col||'#fff';m.style.opacity=1;msgT=1.4}
function showBig(t){var b=$('big');b.textContent=t;b.style.opacity=1;bigT=0.9}
function hitMarker(head){var h=$('hit');h.className='hud'+(head?' hs':'');h.style.opacity=1;hitT=0.14}

/* ---------- shooting / damage ---------- */
var PLAYER_DMG=26,lastShooter=null;
function r2(v){return Math.round(v*100)/100}
function castShot(a,yaw,pitch,spread,dmg,visual){
 var ey=a.y+EYE,sy=yaw+(Math.random()-0.5)*2*spread,sp=pitch+(Math.random()-0.5)*2*spread,cp=Math.cos(sp),
  dx=-Math.sin(sy)*cp,dy=Math.sin(sp),dz=-Math.cos(sy)*cp,maxT=140,pad=a.human?0.2:0;
 var tw=wallDist(a.x,ey,a.z,dx,dy,dz,maxT),best=tw,hitA=null,head=false;
 for(var i=0;i<actors.length;i++){var e=actors[i];if(e.team===a.team||!e.alive)continue;
  var th=raySphere(a.x,ey,a.z,dx,dy,dz,e.x,e.y+1.62,e.z,0.22+pad),tb=raySphere(a.x,ey,a.z,dx,dy,dz,e.x,e.y+1.15,e.z,0.38+pad),tl=raySphere(a.x,ey,a.z,dx,dy,dz,e.x,e.y+0.55,e.z,0.34+pad),t=-1,h=false;
  if(th>0){t=th;h=true}if(tb>0&&(t<0||tb<t)){t=tb;h=false}if(tl>0&&(t<0||tl<t)){t=tl;h=false}
  if(t>0&&t<best){best=t;hitA=e;head=h}}
 var rx=Math.cos(yaw),rz=-Math.sin(yaw),mx=a.x-Math.sin(yaw)*0.9+rx*0.2,mz=a.z-Math.cos(yaw)*0.9+rz*0.2,my=ey-0.17;
 var hx=a.x+dx*best,hy=ey+dy*best,hz=a.z+dz*best,wallHit=!hitA&&best<maxT;
 addTracer(mx,my,mz,hx,hy,hz,a.team===0?0x7be8ff:0xff7a8b);
 if(wallHit)addImpact(hx,hy,hz);
 if(!visual){
  if(hitA)damage(hitA,head?dmg*2:dmg,a,head);
  for(var k=0;k<actors.length;k++){var b=actors[k];if(b.isPlayer||b.human||b.team===a.team||!b.alive||b.target)continue;if(Math.hypot(b.x-a.x,b.z-a.z)<60){b.alert={x:a.x,z:a.z};b.alertT=time+6}}}
 var md=Math.hypot(me.x-a.x,me.z-a.z);if(!muteShot)sfxShot(a===me?0.5:clamp(0.35*(1-md/110),0,0.35));
 if(a.mesh){a.mesh.flash.visible=true;a.flashT=0.05}
 a.spotT=time+2;
 if(net.role==='host')netAll({t:'fx',i:a.id,m:[r2(mx),r2(my),r2(mz)],h:[r2(hx),r2(hy),r2(hz)],w:wallHit?1:0},a.conn);
 return [sy,sp];
}
function showHurt(ax,az,amt){var dx=ax-me.x,dz=az-me.z,rel=Math.atan2(-dx,-dz)-me.yaw;dmgA=Math.min(1,0.35+amt/50);$('hd').style.transform='rotate('+(-rel)+'rad)';hdA=1;sfxTone(160,60,0.12,0.4,'square')}
function damage(v,amt,att,head){
 if(!v.alive||time<v.invuln)return;
 v.hp-=amt;v.lastHurt=time;v.hurtT=time;
 if(v.isPlayer)showHurt(att.x,att.z,amt);
 else if(v.human)netSend(v.conn,{t:'hurt',ax:r2(att.x),az:r2(att.z),d:Math.round(amt)});
 if(att.isPlayer){hitMarker(head);sfxTone(head?1700:1200,head?1400:1000,0.05,0.25,'square')}
 else if(att.human)netSend(att.conn,{t:'hit',h:head?1:0});
 if(!v.isPlayer&&!v.human&&!v.target){v.alert={x:att.x,z:att.z};v.alertT=time+6}
 if(v.hp<=0)kill(v,att,head);
}
function onKillFeed(att,v,head){
 feed(att,v,head);
 if(att===me){showMsg(head?'HEADSHOT +1':'+1 KILL','#7be8ff');sfxTone(700,1400,0.18,0.3,'triangle')}
 if(v===me){showMsg('Eliminated by '+att.name,'#ff7a8b');sfxTone(300,60,0.5,0.4,'sawtooth')}
}
function kill(v,att,head){
 v.alive=false;v.hp=0;v.deaths++;att.kills++;if(att.team===0)blueScore++;else redScore++;
 v.respawnAt=time+3.5;if(v.mesh)v.mesh.group.visible=false;
 onKillFeed(att,v,head);
 if(net.role==='host'){netAll({t:'kill',a:att.id,v:v.id,h:head?1:0});if(v.human)netSend(v.conn,{t:'died',by:att.id,rt:3.5})}
 if(v.isPlayer)lastShooter=att;
 if(blueScore>=SCORE_LIMIT||redScore>=SCORE_LIMIT)endMatch();
}

/* ---------- input ---------- */
var keys={},mdown=false,aimHeld=false,joy={x:0,y:0},look={dx:0,dy:0},touchFire=false,touchAim=false,jumpReq=false,reloadReq=false,locked=false;
addEventListener('keydown',function(e){keys[e.code]=true;if(e.code==='Space'){jumpReq=true;e.preventDefault()}if(e.code==='KeyR')reloadReq=true;if(e.code==='Escape'&&state==='playing'&&!locked)pauseGame()});
addEventListener('keyup',function(e){keys[e.code]=false});
canvas.addEventListener('mousedown',function(e){if(state!=='playing'&&state!=='countdown')return;if(!locked){if(!IS_TOUCH)canvas.requestPointerLock&&canvas.requestPointerLock();return}if(e.button===0)mdown=true;if(e.button===2)aimHeld=true});
addEventListener('mouseup',function(e){if(e.button===0)mdown=false;if(e.button===2)aimHeld=false});
addEventListener('contextmenu',function(e){e.preventDefault()});
addEventListener('mousemove',function(e){if(locked){look.dx+=e.movementX||0;look.dy+=e.movementY||0}});
document.addEventListener('pointerlockchange',function(){locked=document.pointerLockElement===canvas;if(!locked){mdown=false;aimHeld=false;if(state==='playing'&&!IS_TOUCH)pauseGame()}});
// touch
var joyId=-1,joyOx=0,joyOy=0,lookId=-1,lookX=0,lookY=0,fireId=-1,fireX=0,fireY=0,JR=55;
var jz=$('joyzone'),lz=$('lookzone'),jb=$('joybase'),jk=$('joyknob');
function joyMove(e){var dx=e.clientX-joyOx,dy=e.clientY-joyOy,l=Math.hypot(dx,dy)||1,m=Math.min(JR,l);joy.x=dx/l*m/JR;joy.y=dy/l*m/JR;jk.style.transform='translate('+(dx/l*m)+'px,'+(dy/l*m)+'px)'}
jz.addEventListener('pointerdown',function(e){if(joyId>=0)return;joyId=e.pointerId;jz.setPointerCapture(e.pointerId);joyOx=e.clientX;joyOy=e.clientY;jb.style.display='block';jb.style.left=(joyOx-60)+'px';jb.style.top=(joyOy-60)+'px';joyMove(e);e.preventDefault()});
jz.addEventListener('pointermove',function(e){if(e.pointerId===joyId)joyMove(e)});
function joyEnd(e){if(e.pointerId!==joyId)return;joyId=-1;joy.x=joy.y=0;jb.style.display='none';jk.style.transform='translate(0,0)'}
jz.addEventListener('pointerup',joyEnd);jz.addEventListener('pointercancel',joyEnd);
lz.addEventListener('pointerdown',function(e){if(lookId>=0)return;lookId=e.pointerId;lz.setPointerCapture(e.pointerId);lookX=e.clientX;lookY=e.clientY;e.preventDefault()});
lz.addEventListener('pointermove',function(e){if(e.pointerId!==lookId)return;look.dx+=(e.clientX-lookX)*1.6;look.dy+=(e.clientY-lookY)*1.6;lookX=e.clientX;lookY=e.clientY});
function lookEnd(e){if(e.pointerId===lookId)lookId=-1}
lz.addEventListener('pointerup',lookEnd);lz.addEventListener('pointercancel',lookEnd);
var bF=$('bFire');
bF.addEventListener('pointerdown',function(e){fireId=e.pointerId;bF.setPointerCapture(e.pointerId);fireX=e.clientX;fireY=e.clientY;touchFire=true;bF.classList.add('on');e.preventDefault()});
bF.addEventListener('pointermove',function(e){if(e.pointerId!==fireId)return;look.dx+=(e.clientX-fireX)*1.6;look.dy+=(e.clientY-fireY)*1.6;fireX=e.clientX;fireY=e.clientY});
function fireEnd(e){if(e.pointerId!==fireId)return;fireId=-1;touchFire=false;bF.classList.remove('on')}
bF.addEventListener('pointerup',fireEnd);bF.addEventListener('pointercancel',fireEnd);
$('bAim').addEventListener('pointerdown',function(e){touchAim=!touchAim;this.classList.toggle('on',touchAim);e.preventDefault()});
$('bJump').addEventListener('pointerdown',function(e){jumpReq=true;e.preventDefault()});
$('bReload').addEventListener('pointerdown',function(e){reloadReq=true;e.preventDefault()});
$('pauseBtn').addEventListener('pointerdown',function(e){pauseGame();e.preventDefault()});

/* ---------- viewmodel (your gun) ---------- */
var vm=new THREE.Group(),vmHold=new THREE.Group();vm.add(vmHold);
var vmSkin=lam(0x1d8fff),vmGlove=lam(0x10161f);
var vmArmR=bm(0.09,0.09,1,vmSkin),vmArmL=bm(0.08,0.08,1,vmSkin),vmHandR=bm(0.07,0.08,0.09,vmGlove),vmHandL=bm(0.07,0.07,0.09,vmGlove);
vm.add(vmArmR);vm.add(vmArmL);vm.add(vmHandR);vm.add(vmHandL);
var vmFlash=bm(0.12,0.12,0.14,new THREE.MeshBasicMaterial({color:0xfff2a0}));vmFlash.visible=false;vm.add(vmFlash);
function vmSwap(id){
 var G2=GUNS[id];vmHold.clear();vmHold.add(gunClone(id));
 vmFlash.position.set(0,0.015,G2.flash);
 vmHandR.position.set(0,-0.07,0.06);aimLimb(vmArmR,0.1,-0.3,0.4,0,-0.07,0.08);
 vmHandL.position.set(-0.01,G2.ly-0.01,G2.lz);aimLimb(vmArmL,-0.22,-0.32,0.3,-0.01,G2.ly-0.01,G2.lz+0.03);
}
vmSwap(0);camera.add(vm);
var kick=0,flashT=0,adsT=0,bob=0,shake=0;

/* ---------- player update ---------- */
function updatePlayer(dt){
 var p=me,isC=net.role==='client',ui=net.uiOpen;
 if(!p.alive){
  if(!isC&&time>=p.respawnAt&&state==='playing'){spawnActor(p);showMsg('GO!','#7be8ff')}
  setText('spawn',p.alive?'':'Respawning in '+Math.max(0,Math.ceil(p.respawnAt-time)));$('spawn').style.opacity=p.alive?0:1;look.dx=look.dy=0;return}
 $('spawn').style.opacity=0;
 var sens=IS_TOUCH?0.0045:0.0022,ads=!ui&&(aimHeld||touchAim);
 if(ads)sens*=GUNS[p.wi].zs;
 if(!ui){p.yaw-=look.dx*sens;p.pitch=clamp(p.pitch-look.dy*sens,-1.45,1.45)}
 look.dx=look.dy=0;
 var uk=ui?0:1,fx=((keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joy.y)*uk,sx=((keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x)*uk,l=Math.hypot(fx,sx);
 if(l>1){fx/=l;sx/=l}
 var sprint=(keys.ShiftLeft||keys.ShiftRight||(IS_TOUCH&&l>0.92))&&fx>0&&!ads,spd=(sprint?6.6:4.6)*(ads?0.65:1);
 moveActor(p,(-Math.sin(p.yaw)*fx+Math.cos(p.yaw)*sx)*spd*dt,(-Math.cos(p.yaw)*fx-Math.sin(p.yaw)*sx)*spd*dt);
 if(jumpReq&&p.onGround&&!ui){p.vy=7.2;p.onGround=false}jumpReq=false;
 p.vy-=22*dt;p.y+=p.vy*dt;var g=groundAt(p.x,p.z,p.y);if(p.y<=g){p.y=g;p.vy=0;p.onGround=true}else p.onGround=false;
 var moving=l>0.1&&p.onGround;bob+=dt*(moving?(sprint?13:9):0);
 if(wpnReq>=0){if(!ui&&wpnReq!==p.wi&&wpnReq<GUNS.length)doSwitch(p,wpnReq);wpnReq=-1}
 if(wpnDir!==0){if(!ui)doSwitch(p,(p.wi+wpnDir+GUNS.length)%GUNS.length);wpnDir=0}
 var gn=GUNS[p.wi];
 if(p.reloadT>0){p.reloadT-=dt;if(p.reloadT<=0){p.ammo=gn.mag;p.reloadT=0}}
 else if(!ui&&(reloadReq||p.ammo<=0)&&p.ammo<gn.mag){p.reloadT=gn.rel;sfxClick();setTimeout(sfxClick,gn.rel*470)}
 reloadReq=false;
 p.fireT-=dt;p.spreadAdd=Math.max(0,p.spreadAdd-dt*0.05);
 var wantFire=!ui&&((mdown&&locked)||touchFire);
 if(IS_TOUCH&&wantFire){assist(p,dt)}
 if(wantFire&&p.fireT<=0&&p.reloadT<=0&&p.ammo>0){
  p.fireT=gn.rof;p.ammo--;
  var base=gn.spr+(moving?(gn.id===3?0.03:0.01):0)+(p.onGround?0:0.03)+p.spreadAdd;if(ads)base*=(gn.id===3?0.1:0.4);
  var shots=[];
  for(var pi=0;pi<gn.pel;pi++){muteShot=pi>0;var ang=castShot(p,p.yaw,p.pitch,base+(gn.pel>1?gn.pspr:0),gn.dmg,isC);shots.push([r2(ang[0]),r2(ang[1])])}
  muteShot=false;
  if(isC)netSend(net.hostConn,{t:'shot',w:p.wi,s:shots});
  p.spreadAdd=Math.min(0.02,p.spreadAdd+((gn.pel>1||gn.id===3)?0:0.003));
  p.pitch+=gn.rec;p.yaw+=(Math.random()-0.5)*gn.rec*0.7;kick=(gn.id===2||gn.id===3)?1.8:1;flashT=0.04;shake=gn.id===3?0.05:0.02}
 if(!isC&&p.hp<100&&time-p.lastHurt>6)p.hp=Math.min(100,p.hp+15*dt);
 adsT+=((ads?1:0)-adsT)*Math.min(1,dt*10);
}
function assist(p,dt){
 var best=null,bd=0.07;
 for(var i=0;i<actors.length;i++){var e=actors[i];if(e.team===p.team||!e.alive)continue;
  var dx=e.x-p.x,dz=e.z-p.z,dist=Math.hypot(dx,dz);if(dist>70||dist<2)continue;
  var wy=Math.atan2(-dx,-dz),wp=Math.atan2(e.y+1.3-(p.y+EYE),dist),ey=Math.atan2(Math.sin(wy-p.yaw),Math.cos(wy-p.yaw)),ep=wp-p.pitch,err=Math.hypot(ey,ep);
  if(err<bd&&hasLOS(p,e)){bd=err;best={y:ey,p:ep}}}
 if(best){var k=Math.min(1,dt*7);p.yaw+=best.y*k;p.pitch+=best.p*k}
}

/* ---------- bots ---------- */
function angDiff(a,b){return Math.atan2(Math.sin(a-b),Math.cos(a-b))}
function acquire(b,P){
 var best=null,bd=1e9;
 for(var i=0;i<actors.length;i++){var e=actors[i];if(e.team===b.team||!e.alive)continue;
  var dx=e.x-b.x,dz=e.z-b.z,d=Math.hypot(dx,dz);if(d>P.view)continue;
  if(d>9&&time-b.hurtT>2&&Math.abs(angDiff(Math.atan2(-dx,-dz),b.yaw))>1.5)continue;
  if(!hasLOS(b,e))continue;if(d<bd){bd=d;best=e}}
 if(best){if(b.target!==best){b.target=best;b.engageT=0}b.sees=true;b.lastSeen={x:best.x,z:best.z,t:time}}
 else{b.sees=false;if(b.target&&time-b.lastSeen.t>P.lose)b.target=null}
}
function botThink(b,dt){
 var P=DIFF[diff],speed=4.4,mx=0,mz=0,wantYaw=b.yaw,wantPitch=0,turn=P.turn;
 b.scanT-=dt;if(b.scanT<=0){b.scanT=0.18+Math.random()*0.1;acquire(b,P)}
 if(b.hp<100&&time-b.lastHurt>6)b.hp=Math.min(100,b.hp+15*dt);
 if(b.reloadT>0){b.reloadT-=dt;if(b.reloadT<=0){b.ammo=30;b.reloadT=0}}
 var t=b.target,moving=false;
 if(t&&t.alive&&b.sees){
  var dx=t.x-b.x,dz=t.z-b.z,dist=Math.hypot(dx,dz)||1;b.engageT+=dt;
  wantYaw=Math.atan2(-dx,-dz);
  var ty=t.y+(b.aimHead?1.58:1.25);wantPitch=Math.atan2(ty-(b.y+EYE),dist);
  b.strafeT-=dt;if(b.strafeT<=0){b.strafeT=rnd(0.7,1.7);b.strafe=Math.random()<0.5?-1:1;b.aimHead=Math.random()<P.head}
  var f=dist>P.hold?1:(dist<10?-1:0.15);
  var sxv=-dz/dist*b.strafe*0.8,szv=dx/dist*b.strafe*0.8;
  mx=dx/dist*f+sxv;mz=dz/dist*f+szv;speed=3.4;moving=true;
  var err=Math.abs(angDiff(wantYaw,b.yaw))+Math.abs(wantPitch-b.pitch);
  b.fireT-=dt;
  if(b.burstPause>0)b.burstPause-=dt;
  if(b.engageT>P.react&&err<0.1&&b.fireT<=0&&b.burstPause<=0&&b.reloadT<=0){
   if(b.ammo<=0){b.reloadT=1.8}
   else{
    if(b.burst<=0)b.burst=4+Math.floor(Math.random()*6);
    b.fireT=1/P.rof;b.ammo--;b.burst--;if(b.burst<=0)b.burstPause=rnd(0.35,0.8);
    var sp=P.spread*(1+dist/60)*(moving?1.2:1);castShot(b,b.yaw,b.pitch,sp,P.dmg)}}
 }else if(t&&t.alive&&time-b.lastSeen.t<P.lose){
  var lx=b.lastSeen.x-b.x,lz=b.lastSeen.z-b.z,ld=Math.hypot(lx,lz);if(ld>2){mx=lx/ld;mz=lz/ld;wantYaw=Math.atan2(-lx,-lz);moving=true;speed=4.6}
 }else if(b.alert&&time<b.alertT){
  var ax=b.alert.x-b.x,az=b.alert.z-b.z,ad=Math.hypot(ax,az);if(ad>4){mx=ax/ad;mz=az/ad;wantYaw=Math.atan2(-ax,-az);moving=true;speed=4.8}else b.alert=null;
 }else{
  if(b.node<0)b.node=nearestNode(b.x,b.z);
  var n=NODES[b.node],nx=n.x-b.x,nz=n.z-b.z,nd=Math.hypot(nx,nz);
  if(b.pause>0){b.pause-=dt;wantYaw=b.yaw+Math.sin(time*1.3+b.id)*0.6}
  else if(nd<3){
   var opts=n.nb,fwd=b.team===0?-1:1,pick=opts[Math.floor(Math.random()*opts.length)],bestScore=-1e9;
   for(var k=0;k<opts.length;k++){var q=NODES[opts[k]],sc=(q.z-n.z)*fwd*0.5+Math.random()*60;if(sc>bestScore){bestScore=sc;pick=opts[k]}}
   b.node=pick;b.pause=Math.random()<0.3?rnd(0.3,1.2):0}
  else{mx=nx/nd;mz=nz/nd;wantYaw=Math.atan2(-nx,-nz);moving=true;turn=P.turn*0.8}
 }
 // turn toward wanted direction
 var dy=angDiff(wantYaw,b.yaw),step=turn*dt;b.yaw+=clamp(dy,-step,step);
 var dp=wantPitch-b.pitch;b.pitch+=clamp(dp,-step,step);if(!t||!b.sees)b.pitch*=0.9;
 // move
 var ml=Math.hypot(mx,mz);
 if(moving&&ml>0.01){moveActor(b,mx/ml*speed*dt,mz/ml*speed*dt)}
 // stuck handling
 b.stuckT+=dt;if(b.stuckT>0.9){if(moving&&Math.hypot(b.x-b.px,b.z-b.pz)<0.5){b.strafe=-b.strafe;if(b.node>=0&&!b.sees){var o=NODES[b.node].nb;b.node=o[Math.floor(Math.random()*o.length)]}b.alert=null}b.px=b.x;b.pz=b.z;b.stuckT=0}
 b.walk+=dt*(moving?speed*1.6:0);
}
function updateBotMesh(b,dt){
 var m=b.mesh;if(!m)return;
 var px=b.x,pz=b.z,pyaw=b.yaw;
 if(b.human&&net.role==='host'){var k=Math.min(1,dt*14);b.vx+=(b.x-b.vx)*k;b.vz+=(b.z-b.vz)*k;b.vyaw+=angDiff(b.yaw,b.vyaw)*k;px=b.vx;pz=b.vz;pyaw=b.vyaw}
 m.group.position.set(px,b.y,pz);m.group.rotation.y=pyaw;
 var s=Math.sin(b.walk)*0.7;m.legL.rotation.x=s;m.legR.rotation.x=-s;m.upper.position.y=Math.abs(Math.sin(b.walk))*0.03;if(m.gunId!==b.wi)setBotGun(m,b.wi|0);
 if(b.flashT>0){b.flashT-=dt;if(b.flashT<=0)m.flash.visible=false}
 if(b.tag)b.tag.visible=(me&&b.team===me.team&&b!==me);
}
function interp(a,dt){
 if(a.tx===undefined)return;var k=Math.min(1,dt*12),ox=a.x,oz=a.z;
 a.x+=(a.tx-a.x)*k;a.y+=(a.ty-a.y)*k;a.z+=(a.tz-a.z)*k;a.yaw+=angDiff(a.tyaw,a.yaw)*k;a.pitch+=(a.tpitch-a.pitch)*k;
 a.walk+=Math.hypot(a.x-ox,a.z-oz)*1.7;
}

/* ---------- match flow ---------- */
function closeOverlays(){$('end').style.display='none';$('menu').style.display='none';$('pause').style.display='none'}
function prepDevice(){
 initAudio();if(ac&&ac.state==='suspended')ac.resume();
 if(IS_TOUCH){
  try{var el=document.documentElement,rf=el.requestFullscreen||el.webkitRequestFullscreen;if(rf&&!document.fullscreenElement&&!document.webkitFullscreenElement){var pr=rf.call(el);if(pr&&pr.catch)pr.catch(function(){})}}catch(e){}
  try{if(screen.orientation&&screen.orientation.lock){var lp=screen.orientation.lock('landscape');if(lp&&lp.catch)lp.catch(function(){})}}catch(e){}
 }
}
var paused=false,lastCd=0,camFov=75;
function getName(){var n=($('name').value.trim()||'Player').slice(0,14);try{localStorage.setItem('cs_name',n)}catch(e){}return n}
function setStatus(t){$('status').textContent=t||''}
function byId(id){for(var i=0;i<actors.length;i++)if(actors[i].id===id)return actors[i];return null}

function resetMatch(){
 me.wi=startWi;
 blueScore=0;redScore=0;matchLeft=MATCH_TIME;paused=false;net.uiOpen=false;lastShooter=null;
 for(var i=0;i<actors.length;i++){var a=actors[i];a.kills=0;a.deaths=0;a.target=null;a.alert=null;a.lastShot=0;a.spotT=0;spawnActor(a);a.invuln=time+7}
 me.ammo=GUNS[me.wi].mag;vmSwap(me.wi);me.reloadT=0;me.fireT=0;me.spreadAdd=0;kick=0;adsT=0;dmgA=0;hdA=0;
 state='countdown';countdown=3.5;lastCd=0;
 $('spawn').style.opacity=0;$('feed').innerHTML='';
}
function showMain(){$('mainBtns').style.display='block';$('lobby').style.display='none'}
function toMenu(){
 state='menu';paused=false;mdown=false;touchFire=false;aimHeld=false;net.uiOpen=false;
 if(document.exitPointerLock&&locked)document.exitPointerLock();
 for(var i=0;i<actors.length;i++){if(actors[i].mesh)actors[i].mesh.group.visible=false}
 $('end').style.display='none';$('pause').style.display='none';$('menu').style.display='grid';
 showMain();
}
function startOffline(){
 prepDevice();closeNet();setStatus('');
 buildTeams();resetMatch();closeOverlays();getName();
 if(!IS_TOUCH&&canvas.requestPointerLock)canvas.requestPointerLock();
}
function pauseGame(){
 if((state!=='playing'&&state!=='countdown')||paused)return;
 paused=true;net.uiOpen=true;mdown=false;touchFire=false;aimHeld=false;
 if(document.exitPointerLock&&locked)document.exitPointerLock();
 $('pause').style.display='grid';
}
function resumeGame(){
 paused=false;net.uiOpen=false;$('pause').style.display='none';
 if(!IS_TOUCH&&canvas.requestPointerLock)canvas.requestPointerLock();
}
function rowsNow(){var r=[];for(var i=0;i<actors.length;i++){var a=actors[i];r.push([a.id,a.name,a.team,a.kills,a.deaths])}return r}
function endMatch(){
 if(state==='ended'||state==='menu')return;
 var rows=rowsNow();
 if(net.role==='host')netAll({t:'end',bs:blueScore,rs:redScore,r:rows});
 showEnd(blueScore,redScore,rows);
}
function showEnd(bs,rs,rows){
 state='ended';mdown=false;touchFire=false;aimHeld=false;blueScore=bs;redScore=rs;
 if(document.exitPointerLock&&locked)document.exitPointerLock();
 var win=bs>rs?0:rs>bs?1:-1,t=$('endTitle');
 if(win<0){t.textContent='DRAW';t.style.color='#ffe08a'}
 else if(win===me.team){t.textContent='VICTORY';t.style.color='#7be8ff'}
 else{t.textContent='DEFEAT';t.style.color='#ff7a8b'}
 $('endSub').innerHTML='<span class="b">BLUE '+bs+'</span> &nbsp;-&nbsp; <span class="r">'+rs+' RED</span>';
 rows=rows.slice().sort(function(a,b){return b[3]-a[3]||a[4]-b[4]});
 var h='<table><tr><th>#</th><th>Player</th><th>Kills</th><th>Deaths</th></tr>';
 for(var i=0;i<rows.length;i++){var r=rows[i];h+='<tr'+(r[0]===me.id?' class="me"':'')+'><td>'+(i+1)+'</td><td class="'+(r[2]?'r':'b')+'">'+esc(r[1])+'</td><td>'+r[3]+'</td><td>'+r[4]+'</td></tr>'}
 $('endTable').innerHTML=h+'</table>';
 setIcon('againBtn',net.role==='client'?IC.leave:IC.replay,net.role==='client'?'Leave room':'Play again');
 $('spawn').style.opacity=0;$('end').style.display='grid';
}

/* ---------- online rooms (PeerJS, host is the referee) ---------- */
function netSend(c,m){if(c&&c.open){try{c.send(m)}catch(e){}}}
function netAll(m,except){for(var i=0;i<net.conns.length;i++){if(net.conns[i]!==except)netSend(net.conns[i],m)}}
function closeNet(){
 var hc=net.hostConn,cs=net.conns,pr=net.peer;
 net.role='off';net.peer=null;net.conns=[];net.hostConn=null;net.inLobby=false;net.uiOpen=false;net.code='';
 try{if(hc)hc.close()}catch(e){}
 for(var i=0;i<cs.length;i++){try{cs[i].close()}catch(e){}}
 try{if(pr)pr.destroy()}catch(e){}
}
function renderLobby(list,isHost){
 var h=(isHost?'Share this code with your friends:':'Connected. Waiting for the host to start...')+'<br>';
 for(var i=0;i<list.length;i++)h+='<span class="'+(list[i][1]?'r':'b')+'">'+esc(list[i][0])+'</span>'+(i<list.length-1?' &middot; ':'');
 h+='<br><small>Empty slots are filled with bots. 5 vs 5.</small>';
 $('lobbyTxt').innerHTML=h;
}
function showLobby(code,isHost){
 $('mainBtns').style.display='none';$('lobby').style.display='block';
 $('roomCode').textContent=code;$('goBtn').style.display=isHost?'block':'none';setStatus('');
}
function lobbyList(){var l=[[getName(),0]];for(var i=0;i<net.conns.length;i++){var m=net.conns[i].meta;if(m)l.push([m.name,m.team])}return l}
function refreshLobby(){var l=lobbyList();renderLobby(l,true);netAll({t:'lobby',p:l})}
function makeCode(){var s='',cs='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';for(var i=0;i<5;i++)s+=cs.charAt(Math.floor(Math.random()*cs.length));return s}
function pickTeam(){var n=[1,0];for(var i=0;i<net.conns.length;i++){if(net.conns[i].meta)n[net.conns[i].meta.team]++}return n[0]<=n[1]?0:1}

function hostRoom(){
 if(typeof Peer==='undefined'){setStatus('Online play could not load. Check your internet and reload.');return}
 prepDevice();closeNet();tryHost(0);
}
function tryHost(n){
 var code=makeCode(),p;
 setStatus('Creating room...');
 try{p=new Peer('cs3d-'+code)}catch(e){setStatus('Could not start online play.');return}
 net.peer=p;net.role='host';net.code=code;net.conns=[];net.inLobby=true;
 p.on('open',function(){if(net.peer!==p)return;showLobby(code,true);refreshLobby()});
 p.on('connection',function(c){if(net.peer===p)onHostConn(c)});
 p.on('error',function(err){
  if(net.peer!==p)return;
  var t=err&&err.type;
  if(t==='unavailable-id'&&n<4){closeNet();tryHost(n+1);return}
  closeNet();showMain();setStatus('Network error ('+(t||'unknown')+'). Try again.');
 });
}
function onHostConn(c){
 c.on('data',function(m){hostData(c,m)});
 c.on('close',function(){hostDrop(c)});
 c.on('error',function(){hostDrop(c)});
}
function refuse(c,t){netSend(c,{t:t});setTimeout(function(){try{c.close()}catch(e){}},400)}
function hostData(c,m){
 if(!m||typeof m!=='object'||net.role!=='host')return;
 if(m.t==='join'){
  if(c.meta)return;
  if(!net.inLobby){refuse(c,'busy');return}
  if(net.conns.length>=2*TEAMSZ-1){refuse(c,'full');return}
  c.meta={name:String(m.name||'Player').slice(0,14),team:pickTeam()};
  net.conns.push(c);refreshLobby();return;
 }
 var a=c.actor;if(!a||!a.alive||(state!=='playing'&&state!=='countdown'))return;
 if(m.t==='pos'){
  var nx=clamp(+m.x||0,-HALF,HALF),nz=clamp(+m.z||0,-HALF,HALF);
  a.walk+=Math.hypot(nx-a.x,nz-a.z)*1.7;a.x=nx;a.z=nz;a.y=clamp(+m.y||0,0,20);a.yaw=+m.yaw||0;a.pitch=clamp(+m.pitch||0,-1.5,1.5);if(m.w>=0&&m.w<GUNS.length)a.wi=m.w|0;
 }else if(m.t==='shot'&&state==='playing'){
  var wi=(m.w|0);if(wi<0||wi>=GUNS.length)wi=0;a.wi=wi;var gq=GUNS[wi];
  if(time-a.lastShot<gq.rof*0.8)return;a.lastShot=time;
  var ss=m.s;if(!Array.isArray(ss))return;
  for(var si=0;si<Math.min(ss.length,gq.pel);si++){muteShot=si>0;castShot(a,+ss[si][0]||0,+ss[si][1]||0,0.0005,gq.dmg,false)}
  muteShot=false;
 }
}
function hostDrop(c){
 var i=net.conns.indexOf(c);if(i<0)return;
 net.conns.splice(i,1);
 if(c.actor){c.actor.human=false;c.actor.conn=null;c.actor.target=null;showMsg(c.actor.name+' left - a bot took over','#9bb4ca')}
 else if(net.inLobby)refreshLobby();
}
function buildOnlineTeams(){
 for(var i=0;i<actors.length;i++){if(actors[i].mesh)scene.remove(actors[i].mesh.group)}
 actors=[];var id=0,names=BOTN.slice().sort(function(){return Math.random()-0.5}),counts=[1,0],a,t;
 me=newActor(id++,0,true,getName());actors.push(me);
 net.conns.forEach(function(c){
  a=newActor(id++,c.meta.team,false,c.meta.name);a.human=true;a.conn=c;a.mesh=makeBotMesh(a.team);scene.add(a.mesh.group);attachTag(a);c.actor=a;actors.push(a);counts[a.team]++});
 for(t=0;t<2;t++)while(counts[t]<TEAMSZ){
  a=newActor(id++,t,false,names.pop()||('Bot'+id));a.mesh=makeBotMesh(t);scene.add(a.mesh.group);attachTag(a);actors.push(a);counts[t]++}
}
function startOnline(){
 if(net.role!=='host')return;
 prepDevice();net.inLobby=false;
 buildOnlineTeams();resetMatch();
 var list=[],i;
 for(i=0;i<actors.length;i++){var a=actors[i];list.push({id:a.id,team:a.team,name:a.name,x:r2(a.x),y:0,z:r2(a.z),yaw:r2(a.yaw)})}
 for(i=0;i<net.conns.length;i++){var c=net.conns[i];if(c.actor)netSend(c,{t:'start',you:c.actor.id,l:list,cd:3.5,sz:TEAMSZ})}
 closeOverlays();net.snapT=0;
 if(!IS_TOUCH&&canvas.requestPointerLock)canvas.requestPointerLock();
}
function sendSnap(){
 var arr=[];
 for(var i=0;i<actors.length;i++){var a=actors[i];arr.push([a.id,r2(a.x),r2(a.y),r2(a.z),r2(a.yaw),r2(a.pitch),Math.round(a.hp),a.alive?1:0,a.kills,a.deaths,a.wi|0])}
 netAll({t:'snap',bs:blueScore,rs:redScore,ml:Math.ceil(matchLeft),a:arr});
}

function joinRoom(){
 if(typeof Peer==='undefined'){setStatus('Online play could not load. Check your internet and reload.');return}
 var code=($('roomIn').value||'').trim().toUpperCase();
 if(code.length<4){setStatus('Type the room code first.');return}
 prepDevice();closeNet();setStatus('Joining room '+code+'...');
 var p;try{p=new Peer()}catch(e){setStatus('Could not start online play.');return}
 net.peer=p;net.role='client';net.code=code;
 var failTimer=setTimeout(function(){
  if(net.peer===p&&!(net.hostConn&&net.hostConn.open)){closeNet();showMain();setStatus('Could not reach that room. Check the code and try again.')}
 },12000);
 p.on('open',function(){
  if(net.peer!==p)return;
  var c=p.connect('cs3d-'+code,{reliable:true});net.hostConn=c;
  c.on('open',function(){if(net.peer!==p)return;clearTimeout(failTimer);netSend(c,{t:'join',name:getName()});showLobby(code,false);renderLobby([],false)});
  c.on('data',function(m){if(net.peer===p)clientData(m)});
  c.on('close',function(){if(net.peer===p)hostLost()});
  c.on('error',function(){if(net.peer===p)hostLost()});
 });
 p.on('error',function(err){
  if(net.peer!==p)return;clearTimeout(failTimer);
  var t=err&&err.type;closeNet();showMain();
  setStatus(t==='peer-unavailable'?'Room not found. Check the code.':'Network error ('+(t||'unknown')+'). Try again.');
 });
}
function hostLost(){
 if(net.role!=='client')return;
 closeNet();toMenu();setStatus('Disconnected from the host.');
}
function onStart(m){
 for(var i=0;i<actors.length;i++){if(actors[i].mesh)scene.remove(actors[i].mesh.group)}
 actors=[];
 for(var k=0;k<m.l.length;k++){
  var e=m.l[k],isMe=e.id===m.you,a=newActor(e.id,e.team,isMe,e.name);
  a.x=e.x;a.y=e.y;a.z=e.z;a.yaw=e.yaw;a.tx=e.x;a.ty=e.y;a.tz=e.z;a.tyaw=e.yaw;a.tpitch=0;a.alive=true;
  if(isMe)me=a;else{a.mesh=makeBotMesh(a.team);scene.add(a.mesh.group);attachTag(a)}
  actors.push(a);
 }
 blueScore=0;redScore=0;matchLeft=MATCH_TIME;paused=false;net.uiOpen=false;lastShooter=null;kick=0;adsT=0;dmgA=0;hdA=0;
 me.wi=startWi;me.mags=GUNS.map(function(q){return q.mag});me.ammo=GUNS[me.wi].mag;vmSwap(me.wi);if(m.sz)setMode(m.sz);
 state='countdown';countdown=m.cd||3.5;lastCd=0;
 closeOverlays();$('feed').innerHTML='';$('spawn').style.opacity=0;
 showMsg(IS_TOUCH?'GET READY':'CLICK THE SCREEN TO AIM','#7be8ff');
}
function applySnap(m){
 blueScore=m.bs;redScore=m.rs;matchLeft=m.ml;
 for(var i=0;i<m.a.length;i++){
  var s=m.a[i],a=byId(s[0]);if(!a)continue;
  a.kills=s[8];a.deaths=s[9];a.hp=s[6];
  if(a===me){if(!s[7]&&a.alive){a.alive=false;a.respawnAt=Math.max(a.respawnAt,time+3)}continue}
  a.tx=s[1];a.ty=s[2];a.tz=s[3];a.tyaw=s[4];a.tpitch=s[5];a.wi=s[10]|0;
  var al=!!s[7];
  if(al&&!a.alive){a.x=a.tx;a.y=a.ty;a.z=a.tz;a.yaw=a.tyaw}
  a.alive=al;if(a.mesh)a.mesh.group.visible=al;
 }
}
function clientData(m){
 if(!m||typeof m!=='object')return;
 var a,v,att;
 switch(m.t){
 case 'lobby':renderLobby(m.p||[],false);break;
 case 'full':closeNet();toMenu();setStatus('That room is full.');break;
 case 'busy':closeNet();toMenu();setStatus('That match already started. Ask the host to open a new room.');break;
 case 'start':onStart(m);break;
 case 'snap':if(state==='countdown'||state==='playing')applySnap(m);break;
 case 'fx':
  a=byId(m.i);if(!a||!me)break;
  addTracer(m.m[0],m.m[1],m.m[2],m.h[0],m.h[1],m.h[2],a.team===0?0x7be8ff:0xff7a8b);
  if(m.w)addImpact(m.h[0],m.h[1],m.h[2]);
  sfxShot(clamp(0.35*(1-Math.hypot(me.x-a.x,me.z-a.z)/110),0,0.35));
  if(a.mesh){a.mesh.flash.visible=true;a.flashT=0.05}
  a.spotT=time+2;break;
 case 'kill':
  att=byId(m.a);v=byId(m.v);if(!att||!v)break;
  v.alive=false;v.hp=0;if(v.mesh)v.mesh.group.visible=false;
  if(v===me){lastShooter=att;me.respawnAt=Math.max(me.respawnAt,time+3.5)}
  onKillFeed(att,v,!!m.h);break;
 case 'died':me.alive=false;me.hp=0;me.respawnAt=time+(m.rt||3.5);break;
 case 'spawn':
  me.x=m.x;me.y=m.y;me.z=m.z;me.yaw=m.yaw;me.pitch=0;me.vy=0;me.alive=true;me.hp=100;me.ammo=GUNS[me.wi].mag;for(var gi=0;gi<GUNS.length;gi++)me.mags[gi]=GUNS[gi].mag;me.reloadT=0;me.onGround=true;
  showMsg('GO!','#7be8ff');break;
 case 'hurt':showHurt(m.ax,m.az,m.d);break;
 case 'hit':hitMarker(!!m.h);sfxTone(m.h?1700:1200,m.h?1400:1000,0.05,0.25,'square');break;
 case 'end':showEnd(m.bs,m.rs,m.r);break;
 }
}

/* ---------- camera, gun, HUD, minimap ---------- */
function renderView(dt){
 var p=me,alive=p.alive,a1=adsT;
 var gn=GUNS[p.wi],tf=75-(alive?a1*(75-gn.fov):0);if(Math.abs(tf-camFov)>0.05){camFov=tf;camera.fov=tf;camera.updateProjectionMatrix()}
 var by=alive?Math.sin(bob)*0.035:0,bx=alive?Math.cos(bob*0.5)*0.025:0;
 shake=Math.max(0,shake-dt*0.1);
 var sh=(Math.random()-0.5)*shake;
 if(!alive&&lastShooter&&lastShooter.alive){var wy=Math.atan2(-(lastShooter.x-p.x),-(lastShooter.z-p.z));p.yaw+=angDiff(wy,p.yaw)*Math.min(1,dt*3)}
 camera.position.set(p.x,p.y+(alive?EYE:0.55)+by,p.z);
 camera.rotation.set(p.pitch+sh,p.yaw+sh*0.6,alive?0:0.5);
 var sco=(alive&&gn.id===3)?clamp((a1-0.6)/0.3,0,1):0;vm.visible=alive&&sco<0.9;
 var sv=sco.toFixed(2);if(hudCache.sc!==sv){hudCache.sc=sv;$('scope').style.opacity=sv;$('cross').style.opacity=sco>0.3?0:''}
 kick=Math.max(0,kick-dt*10);
 vm.position.set(0.17*(1-a1)+bx*(1-a1*0.8),-0.2*(1-a1)-gn.ads*a1+by*0.6,-0.38+kick*0.06+0.06*a1);
 vm.rotation.set(kick*0.07,0,0);
 if(p.reloadT>0){vm.position.y-=0.1;vm.rotation.x=-0.5}
 if(flashT>0){flashT-=dt;vmFlash.visible=flashT>0}else vmFlash.visible=false;
}
function updateHud(dt){
 setText('sBlue',blueScore);setText('sRed',redScore);
 var ml=Math.max(0,Math.ceil(matchLeft));setText('timer',Math.floor(ml/60)+':'+('0'+(ml%60)).slice(-2));
 var hp=Math.max(0,Math.ceil(me.hp));setText('hptxt',hp);
 if(hudCache.hpw!==hp){hudCache.hpw=hp;var f=$('hpfill');f.style.width=hp+'%';f.style.background=hp<30?'linear-gradient(90deg,#d62a3d,#ff7a8b)':''}
 var ak=(me.reloadT>0?'R':me.ammo)+'_'+me.wi;
 if(hudCache.ammo!==ak){hudCache.ammo=ak;$('ammo').innerHTML=me.reloadT>0?'RELOAD':me.ammo+'<small> / '+GUNS[me.wi].mag+'</small>'}
 if(hudCache.wi!==me.wi){hudCache.wi=me.wi;var wbs=$('wbar').children;for(var wq=0;wq<wbs.length;wq++)wbs[wq].classList.toggle('on',wq===me.wi)}
 if(msgT>0){msgT-=dt;if(msgT<=0)$('msg').style.opacity=0}
 if(bigT>0){bigT-=dt;if(bigT<=0)$('big').style.opacity=0}
 if(hitT>0){hitT-=dt;if(hitT<=0)$('hit').style.opacity=0}
 dmgA=Math.max(0,dmgA-dt*1.1);hdA=Math.max(0,hdA-dt*1.5);
 var low=me.alive&&me.hp<30?0.25+0.12*Math.sin(time*6):0,dv=Math.max(dmgA,low).toFixed(2);
 if(hudCache.dmg!==dv){hudCache.dmg=dv;$('dmg').style.opacity=dv}
 var hv=hdA.toFixed(2);if(hudCache.hd!==hv){hudCache.hd=hv;$('hd').style.opacity=hv}
}
function mmx(v){return (v+MAPH)/(2*MAPH)*MS}
function drawMini(){
 mctx.drawImage(mapBase,0,0);
 for(var i=0;i<actors.length;i++){
  var a=actors[i];if(a===me||!a.alive)continue;
  if(a.team!==me.team&&!(a.spotT>time))continue;
  mctx.fillStyle=a.team===0?'#4fb3ff':'#ff5d73';mctx.beginPath();mctx.arc(mmx(a.x),mmx(a.z),3,0,6.283);mctx.fill();
 }
 if(me.alive){
  var x=mmx(me.x),y=mmx(me.z),fx=-Math.sin(me.yaw),fz=-Math.cos(me.yaw);
  mctx.fillStyle='#ffffff';mctx.beginPath();mctx.moveTo(x+fx*7,y+fz*7);mctx.lineTo(x-fz*4-fx*3,y+fx*4-fz*3);mctx.lineTo(x+fz*4-fx*3,y-fx*4-fz*3);mctx.closePath();mctx.fill();
 }
}

/* ---------- main loop ---------- */
var lastT=0;
function step(dt){
 time+=dt;
 var host=net.role==='host',client=net.role==='client',i,a;
 if(state==='countdown'){
  countdown-=dt;var cd=Math.ceil(countdown);
  if(cd>=1&&cd<=3&&cd!==lastCd){lastCd=cd;showBig(String(cd));sfxTone(520,520,0.1,0.2,'sine')}
  if(me.alive&&!net.uiOpen){var sn=IS_TOUCH?0.0045:0.0022;me.yaw-=look.dx*sn;me.pitch=clamp(me.pitch-look.dy*sn,-1.45,1.45)}
  look.dx=look.dy=0;
  if(countdown<=0){state='playing';showBig('GO');showMsg('Team Deathmatch - first to '+SCORE_LIMIT,'#9bd8ff');sfxTone(400,900,0.25,0.3,'triangle')}
 }else if(state==='playing'){
  if(client)matchLeft=Math.max(0,matchLeft-dt);
  else{matchLeft-=dt;if(matchLeft<=0){matchLeft=0;endMatch();return}}
  updatePlayer(dt);
  if(!client){
   for(i=0;i<actors.length;i++){
    a=actors[i];if(a===me)continue;
    if(a.human){
     if(a.alive){if(a.hp<100&&time-a.lastHurt>6)a.hp=Math.min(100,a.hp+15*dt)}
     else if(time>=a.respawnAt){spawnActor(a);netSend(a.conn,{t:'spawn',x:r2(a.x),y:0,z:r2(a.z),yaw:r2(a.yaw)})}
    }else if(a.alive)botThink(a,dt);
    else if(time>=a.respawnAt)spawnActor(a);
   }
  }
 }
 if(state==='countdown'||state==='playing'){
  if(host){net.snapT-=dt;if(net.snapT<=0){net.snapT=0.066;sendSnap()}}
  if(client&&me.alive){net.posT-=dt;if(net.posT<=0){net.posT=0.05;netSend(net.hostConn,{t:'pos',w:me.wi,x:r2(me.x),y:r2(me.y),z:r2(me.z),yaw:r2(me.yaw),pitch:r2(me.pitch)})}}
 }
 stepEffects(dt);
 for(i=0;i<actors.length;i++){a=actors[i];if(a===me)continue;if(client)interp(a,dt);updateBotMesh(a,dt)}
}
function loop(now){
 requestAnimationFrame(loop);
 var dt=Math.min(0.05,Math.max(0.001,((now-lastT)/1000)||0.016));lastT=now;
 if(state==='menu'||!me){
  time+=dt;var an=time*0.06;
  if(camFov!==75){camFov=75;camera.fov=75;camera.updateProjectionMatrix()}
  camera.position.set(Math.sin(an)*95,42,Math.cos(an)*95);camera.lookAt(0,12,0);vm.visible=false;
  renderer.render(scene,camera);return;
 }
 if(paused&&net.role==='off'){renderView(0);renderer.render(scene,camera);return}
 step(dt);
 if(state==='menu'||!me){return}
 renderView(dt);updateHud(dt);drawMini();
 renderer.render(scene,camera);
}

/* ---------- menu wiring ---------- */
/* ---------- icons (no text on buttons), loadout, modes ---------- */
var SV=function(b,v){return '<svg viewBox="'+(v||'0 0 24 24')+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+b+'</svg>'};
var IC={
 play:SV('<path d="M7 4l13 8-13 8z" fill="currentColor"/>'),
 globe:SV('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18"/>'),
 join:SV('<path d="M10 17l5-5-5-5M15 12H3M14 4h6v16h-6"/>'),
 leave:SV('<path d="M14 7l-5 5 5 5M9 12h12M10 4H4v16h6"/>'),
 home:SV('<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>'),
 replay:SV('<path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/>'),
 pause:SV('<path d="M8 5v14M16 5v14" stroke-width="4"/>'),
 fire:SV('<circle cx="12" cy="12" r="7"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>'),
 aim:SV('<circle cx="12" cy="12" r="9"/><path d="M12 6v12M6 12h12"/>'),
 jump:SV('<path d="M6 12l6-6 6 6M6 19l6-6 6 6"/>'),
 reload:SV('<path d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"/>'),
 swap:SV('<path d="M4 8h14l-4-4M20 16H6l4 4"/>'),
 smooth:SV('<path d="M13 2L5 14h6l-1 8 9-13h-6z"/>'),
 sharp:SV('<path d="M12 1l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>')
};
function setIcon(id,svg,label){var e=$(id);e.innerHTML=svg;e.setAttribute('aria-label',label);e.setAttribute('title',label)}
function gunIcon(id){
 var s='<svg viewBox="0 0 64 28" fill="currentColor">';
 if(id===0)s+='<rect x="1" y="10" width="13" height="8" rx="1"/><rect x="14" y="9" width="24" height="8"/><rect x="38" y="10" width="13" height="6"/><rect x="51" y="11" width="12" height="3"/><rect x="24" y="17" width="6" height="10" rx="1"/><rect x="16" y="17" width="5" height="8"/><rect x="28" y="6" width="9" height="3"/>';
 else if(id===1)s+='<rect x="2" y="11" width="9" height="5"/><rect x="11" y="9" width="23" height="8"/><rect x="34" y="10" width="19" height="6" rx="2"/><rect x="53" y="11" width="9" height="3"/><rect x="19" y="17" width="5" height="11" rx="1"/><rect x="12" y="17" width="5" height="7"/><rect x="20" y="6" width="7" height="3"/>';
 else if(id===2)s+='<rect x="1" y="9" width="14" height="9" rx="1"/><rect x="15" y="10" width="20" height="7"/><rect x="35" y="10" width="28" height="4"/><rect x="35" y="15" width="24" height="4"/><rect x="37" y="13" width="11" height="5" rx="1"/><rect x="18" y="17" width="5" height="7"/>';
 else if(id===3)s+='<rect x="1" y="10" width="14" height="8" rx="1"/><rect x="15" y="11" width="20" height="6"/><rect x="35" y="12" width="28" height="3"/><rect x="19" y="3" width="17" height="6" rx="3"/><rect x="24" y="8" width="3" height="3"/><rect x="25" y="17" width="5" height="7"/><rect x="17" y="17" width="4" height="7"/>';
 else s+='<rect x="12" y="7" width="30" height="8" rx="1"/><rect x="12" y="14" width="24" height="4"/><path d="M14 17h9l-3 11h-8z"/><rect x="41" y="8" width="5" height="2"/>';
 return s+'</svg>';
}
function modeIcon(n){
 var tot=(n-1)*9+7,x0=(50-tot)/2+3.5,s='<svg viewBox="0 0 50 26">';
 for(var i=0;i<n;i++){s+='<circle cx="'+(x0+i*9)+'" cy="7" r="3.5" fill="#4fb3ff"/><circle cx="'+(x0+i*9)+'" cy="19" r="3.5" fill="#ff5d73"/>'}
 return s+'</svg>';
}
function barsIcon(n){var s='<svg viewBox="0 0 30 24" fill="currentColor">';for(var i=0;i<3;i++)s+='<rect x="'+(3+i*9)+'" y="'+(16-i*6)+'" width="6" height="'+(8+i*6)+'" rx="1" '+(i<n?'':'opacity="0.25"')+'/>';return s+'</svg>'}
var SCORES=[10,15,20,25,30],startWi=0;
function setMode(n){n=clamp(parseInt(n)||5,1,5);TEAMSZ=n;SCORE_LIMIT=SCORES[n-1];try{localStorage.setItem('cs_mode',n)}catch(e){}if($('modeRow'))selOpts('modeRow','data-m',String(n))}
function doSwitch(p,n){
 p.mags[p.wi]=p.ammo;p.wi=n;p.ammo=p.mags[n];p.reloadT=0;p.fireT=Math.max(p.fireT,0.35);
 if(p===me)vmSwap(n);sfxClick();
}
function selOpts(rowId,attr,val){var bs=$(rowId).querySelectorAll('.opt');for(var i=0;i<bs.length;i++)bs[i].classList.toggle('sel',bs[i].getAttribute(attr)===val)}
function rowFill(rowId,attr,items){var h='';for(var i=0;i<items.length;i++)h+='<button class="opt" '+attr+'="'+items[i][0]+'" aria-label="'+items[i][2]+'" title="'+items[i][2]+'">'+items[i][1]+'</button>';$(rowId).innerHTML=h}
function rowOn(rowId,attr,fn){$(rowId).addEventListener('click',function(e){var t=e.target.closest&&e.target.closest('['+attr+']');if(!t)return;fn(t.getAttribute(attr))})}
rowFill('diffRow','data-d',[['easy',barsIcon(1),'Easy'],['normal',barsIcon(2),'Normal'],['hard',barsIcon(3),'Hard']]);
rowFill('qualRow','data-q',[['low',IC.smooth,'Smooth'],['high',IC.sharp,'Sharp']]);
var mi=[],gi0;for(gi0=1;gi0<=5;gi0++)mi.push([String(gi0),modeIcon(gi0),gi0+' vs '+gi0]);rowFill('modeRow','data-m',mi);
var gl=[],gnames=['Rifle','SMG','Shotgun','Sniper','Pistol'];for(gi0=0;gi0<GUNS.length;gi0++)gl.push([String(gi0),gunIcon(gi0),gnames[gi0]]);rowFill('gunRow','data-g',gl);
try{startWi=clamp(parseInt(localStorage.getItem('cs_gun'))||0,0,GUNS.length-1);var savedName=localStorage.getItem('cs_name');if(savedName)$('name').value=savedName}catch(e){}
try{setMode(parseInt(localStorage.getItem('cs_mode'))||5)}catch(e){setMode(5)}
selOpts('diffRow','data-d',diff);selOpts('qualRow','data-q',qual);selOpts('gunRow','data-g',String(startWi));
rowOn('diffRow','data-d',function(d){if(!DIFF[d])return;diff=d;try{localStorage.setItem('cs_diff',d)}catch(x){}selOpts('diffRow','data-d',d)});
rowOn('qualRow','data-q',function(q){qual=q;try{localStorage.setItem('cs_q',q)}catch(x){}selOpts('qualRow','data-q',q);resize()});
rowOn('modeRow','data-m',function(n){setMode(n)});
rowOn('gunRow','data-g',function(g){startWi=clamp(parseInt(g)||0,0,GUNS.length-1);try{localStorage.setItem('cs_gun',startWi)}catch(x){}selOpts('gunRow','data-g',String(startWi))});
setIcon('startBtn',IC.play,'Play offline vs bots');setIcon('hostBtn',IC.globe,'Create online room');setIcon('joinBtn',IC.join,'Join room');
setIcon('goBtn',IC.play,'Start match');setIcon('leaveBtn',IC.leave,'Leave room');setIcon('resumeBtn',IC.play,'Resume');setIcon('quitBtn',IC.home,'Quit to menu');setIcon('againBtn',IC.replay,'Play again');
setIcon('bFire',IC.fire,'Fire');setIcon('bAim',IC.aim,'Aim');setIcon('bJump',IC.jump,'Jump');setIcon('bReload',IC.reload,'Reload');setIcon('bSwap',IC.swap,'Switch gun');setIcon('pauseBtn',IC.pause,'Pause');
var wpnReq=-1,wpnDir=0,wb=$('wbar'),wbh='';
for(gi0=0;gi0<GUNS.length;gi0++)wbh+='<div class="wb" data-w="'+gi0+'" aria-label="'+gnames[gi0]+'">'+gunIcon(gi0)+'</div>';
wb.innerHTML=wbh;
wb.addEventListener('pointerdown',function(e){var t=e.target.closest&&e.target.closest('[data-w]');if(!t)return;wpnReq=parseInt(t.getAttribute('data-w'));e.preventDefault();e.stopPropagation()});
$('bSwap').addEventListener('pointerdown',function(e){wpnDir=1;e.preventDefault()});
addEventListener('keydown',function(e){var k=e.code||'';if(k.indexOf('Digit')===0){var n=parseInt(k.charAt(5))-1;if(n>=0&&n<GUNS.length)wpnReq=n}else if(k==='KeyQ')wpnDir=-1;else if(k==='KeyE')wpnDir=1});
addEventListener('wheel',function(e){if(state==='playing'&&locked)wpnDir=e.deltaY>0?1:-1},{passive:true});
if(location.hash==='#debug')window.__cs={camera:camera,actors:function(){return actors},me:function(){return me},vm:vm};
$('startBtn').addEventListener('click',startOffline);
$('hostBtn').addEventListener('click',hostRoom);
$('joinBtn').addEventListener('click',joinRoom);
$('goBtn').addEventListener('click',startOnline);
$('leaveBtn').addEventListener('click',function(){closeNet();showMain();setStatus('')});
$('resumeBtn').addEventListener('click',resumeGame);
$('quitBtn').addEventListener('click',function(){closeNet();toMenu()});
$('againBtn').addEventListener('click',function(){
 if(net.role==='client'){closeNet();toMenu()}
 else if(net.role==='host')startOnline();
 else startOffline();
});
document.addEventListener('visibilitychange',function(){if(document.hidden&&state==='playing')pauseGame()});
if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0){navigator.serviceWorker.register('sw.js').catch(function(){})}
loadGunModels();planSnow();loadSnow();
state='menu';
requestAnimationFrame(loop);
})();
