 a.x=x;a.z=z;a.y=0;a.vy=0;a.hp=100;a.alive=true;a.invuln=time+2.5;a.ammo=30;a.reloadT=0;a.yaw=side>0?0:Math.PI;a.pitch=0;a.vx=x;a.vz=z;a.vyaw=a.yaw;a.flashT=0;
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
 var md=Math.hypot(me.x-a.x,me.z-a.z);sfxShot(a===me?0.5:clamp(0.35*(1-md/110),0,0.35));
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
var vm=new THREE.Group(),vmGun=lam(0x1b2433,0x0a1018),vmNeon=new THREE.MeshBasicMaterial({color:0x4fe3ff});
(function(){var b=bm(0.07,0.1,0.52,vmGun);b.position.set(0,0,-0.1);vm.add(b);var br=bm(0.035,0.035,0.28,vmGun);br.position.set(0,0.015,-0.48);vm.add(br);
 var mag=bm(0.05,0.14,0.07,vmGun);mag.position.set(0,-0.11,-0.05);mag.rotation.x=0.15;vm.add(mag);var st=bm(0.06,0.09,0.2,vmGun);st.position.set(0,-0.01,0.25);vm.add(st);
 var sight=bm(0.03,0.04,0.08,vmGun);sight.position.set(0,0.075,-0.2);vm.add(sight);var neon=bm(0.075,0.012,0.4,vmNeon);neon.position.set(0,0.052,-0.1);vm.add(neon);
 var arm=bm(0.09,0.09,0.4,lam(0x1d8fff));arm.position.set(0.02,-0.12,0.1);arm.rotation.x=-0.3;vm.add(arm)})();
var vmFlash=bm(0.12,0.12,0.14,new THREE.MeshBasicMaterial({color:0xfff2a0}));vmFlash.position.set(0,0.015,-0.66);vmFlash.visible=false;vm.add(vmFlash);
camera.add(vm);
var kick=0,flashT=0,adsT=0,bob=0,shake=0;

/* ---------- player update ---------- */
function updatePlayer(dt){
 var p=me,isC=net.role==='client',ui=net.uiOpen;
 if(!p.alive){
  if(!isC&&time>=p.respawnAt&&state==='playing'){spawnActor(p);showMsg('GO!','#7be8ff')}
  setText('spawn',p.alive?'':'Respawning in '+Math.max(0,Math.ceil(p.respawnAt-time)));$('spawn').style.opacity=p.alive?0:1;look.dx=look.dy=0;return}
 $('spawn').style.opacity=0;
 var sens=IS_TOUCH?0.0045:0.0022,ads=!ui&&(aimHeld||touchAim);
 if(ads)sens*=0.6;
 if(!ui){p.yaw-=look.dx*sens;p.pitch=clamp(p.pitch-look.dy*sens,-1.45,1.45)}
 look.dx=look.dy=0;
 var uk=ui?0:1,fx=((keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joy.y)*uk,sx=((keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joy.x)*uk,l=Math.hypot(fx,sx);
 if(l>1){fx/=l;sx/=l}
 var sprint=(keys.ShiftLeft||keys.ShiftRight||(IS_TOUCH&&l>0.92))&&fx>0&&!ads,spd=(sprint?6.6:4.6)*(ads?0.65:1);
 moveActor(p,(-Math.sin(p.yaw)*fx+Math.cos(p.yaw)*sx)*spd*dt,(-Math.cos(p.yaw)*fx-Math.sin(p.yaw)*sx)*spd*dt);
 if(jumpReq&&p.onGround&&!ui){p.vy=7.2;p.onGround=false}jumpReq=false;
 p.vy-=22*dt;p.y+=p.vy*dt;var g=groundAt(p.x,p.z,p.y);if(p.y<=g){p.y=g;p.vy=0;p.onGround=true}else p.onGround=false;
 var moving=l>0.1&&p.onGround;bob+=dt*(moving?(sprint?13:9):0);
 if(p.reloadT>0){p.reloadT-=dt;if(p.reloadT<=0){p.ammo=30;p.reloadT=0}}
 else if(!ui&&(reloadReq||p.ammo<=0)&&p.ammo<30){p.reloadT=1.9;sfxClick();setTimeout(sfxClick,900)}
 reloadReq=false;
 p.fireT-=dt;p.spreadAdd=Math.max(0,p.spreadAdd-dt*0.05);
 var wantFire=!ui&&((mdown&&locked)||touchFire);
 if(IS_TOUCH&&wantFire){assist(p,dt)}
 if(wantFire&&p.fireT<=0&&p.reloadT<=0&&p.ammo>0){
  p.fireT=0.1;p.ammo--;var base=0.004+(moving?0.01:0)+(p.onGround?0:0.03)+p.spreadAdd;if(ads)base*=0.4;
  var ang=castShot(p,p.yaw,p.pitch,base,PLAYER_DMG,isC);
  if(isC)netSend(net.hostConn,{t:'shot',yaw:r2(ang[0]),pitch:r2(ang[1])});
  p.spreadAdd=Math.min(0.02,p.spreadAdd+0.003);
  p.pitch+=0.0045;p.yaw+=(Math.random()-0.5)*0.003;kick=1;flashT=0.04;shake=0.02}
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
 var s=Math.sin(b.walk)*0.7;m.legL.rotation.x=s;m.legR.rotation.x=-s;m.armL.rotation.x=-s*0.5;
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
