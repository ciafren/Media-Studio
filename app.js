const $ = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const DB_NAME='MediaStudioDB', DB_VERSION=1;
let db, projects=[], currentProject=null, media=[], currentMedia=null, currentBitmap=null;
let renderTimer=null, editedSnapshotTimer=null;
let libraryFilter='all', libraryProject='all';
let videoTool='adjust';
let videoExporting=false;

const defaults={preset:'auto',strength:70,exposure:0,contrast:0,highlights:0,shadows:0,temperature:0,tint:0,saturation:0,vibrance:0,clarity:0,sharpness:0,vignette:0};
const videoDefaults={trimStart:0,trimEnd:null,speed:1,volume:1,aspect:'source',resolution:'source',fps:30,text:'',textSize:42,transition:'none',timelineOrder:null};
const presets={
 auto:{exposure:8,contrast:8,highlights:-18,shadows:20,temperature:2,saturation:3,vibrance:12,clarity:8,sharpness:12,vignette:0},
 luxury:{exposure:5,contrast:14,highlights:-25,shadows:12,temperature:8,saturation:-2,vibrance:10,clarity:10,sharpness:14,vignette:8},
 bright:{exposure:18,contrast:4,highlights:-30,shadows:30,temperature:4,saturation:1,vibrance:8,clarity:4,sharpness:10,vignette:0},
 stone:{exposure:7,contrast:12,highlights:-20,shadows:12,temperature:0,saturation:-4,vibrance:7,clarity:20,sharpness:22,vignette:2},
 exterior:{exposure:8,contrast:12,highlights:-32,shadows:22,temperature:1,saturation:6,vibrance:18,clarity:15,sharpness:16,vignette:4},
 cinematic:{exposure:-2,contrast:22,highlights:-25,shadows:5,temperature:5,saturation:-4,vibrance:14,clarity:14,sharpness:14,vignette:18}
};
const keys=['strength','exposure','contrast','highlights','shadows','temperature','tint','saturation','vibrance','clarity','sharpness','vignette'];
const quickGroups={
 light:[['exposure','Brightness'],['contrast','Contrast'],['highlights','Highlights'],['shadows','Shadows']],
 color:[['temperature','Temperature'],['tint','Tint / Balance'],['saturation','Saturation'],['vibrance','Vibrance']],
 detail:[['clarity','Clarity'],['sharpness','Sharpness'],['vignette','Vignette']]
};
let quickCategory='light', quickKey='exposure';

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VERSION);r.onupgradeneeded=e=>{const d=e.target.result;if(!d.objectStoreNames.contains('projects'))d.createObjectStore('projects',{keyPath:'id'});if(!d.objectStoreNames.contains('media')){const s=d.createObjectStore('media',{keyPath:'id'});s.createIndex('projectId','projectId');}};r.onsuccess=()=>{db=r.result;resolve(db)};r.onerror=()=>reject(r.error);});}
function store(name,mode='readonly'){return db.transaction(name,mode).objectStore(name)}
function getAll(name){return new Promise((res,rej)=>{const r=store(name).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(name,val){return new Promise((res,rej)=>{const r=store(name,'readwrite').put(val);r.onsuccess=()=>res(val);r.onerror=()=>rej(r.error)})}
function del(name,id){return new Promise((res,rej)=>{const r=store(name,'readwrite').delete(id);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}
function getProjectMedia(pid){return new Promise((res,rej)=>{const r=store('media').index('projectId').getAll(pid);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
const uid=()=>crypto.randomUUID();
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),1800)}
function fmtDate(ts){return new Date(ts).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}

async function loadProjects(){projects=(await getAll('projects')).sort((a,b)=>b.updatedAt-a.updatedAt);renderProjects()}
function renderProjects(){
 $('#projectCount').textContent=`${projects.length} project${projects.length===1?'':'s'}`;
 $('#emptyProjects').style.display=projects.length?'none':'block';
 $('#projectGrid').innerHTML='';
 projects.forEach(p=>{const c=document.createElement('article');c.className='project-card';c.innerHTML=`<div class="project-thumb">${p.coverUrl?`<img alt="" src="${p.coverUrl}" style="width:100%;height:100%;object-fit:cover">`:'▣'}</div><div class="project-info"><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.location||'No client/location')} • ${p.mediaCount||0} media</span><span>Updated ${fmtDate(p.updatedAt)}</span></div>`;c.onclick=()=>openProject(p.id);$('#projectGrid').appendChild(c)})
}
function escapeHtml(s=''){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function showScreen(id){$$('.screen').forEach(s=>s.classList.remove('active'));$(id).classList.add('active');window.scrollTo(0,0)}

async function createProject(name,location=''){const p={id:uid(),name:name||'Untitled Project',location,createdAt:Date.now(),updatedAt:Date.now(),mediaCount:0,coverUrl:''};await put('projects',p);projects.unshift(p);renderProjects();return p}
async function openProject(id){currentProject=projects.find(p=>p.id===id)||null;if(!currentProject)return;showScreen('#studioScreen');setMobileNav('projects');$('#projectTitle').value=currentProject.name;media=(await getProjectMedia(id)).sort((a,b)=>b.createdAt-a.createdAt);renderMedia();updateProjectMeta();if(media[0])selectMedia(media[0].id);else clearViewer()}
function updateProjectMeta(){$('#projectMeta').textContent=`${currentProject.location||'No client/location'} • ${media.length} media item${media.length===1?'':'s'}`}
async function saveProject(){if(!currentProject)return;currentProject.name=$('#projectTitle').value.trim()||'Untitled Project';currentProject.updatedAt=Date.now();currentProject.mediaCount=media.length;await put('projects',currentProject);await loadProjects()}

async function addFiles(files){
 if(!currentProject){currentProject=await createProject('New Media Project');await openProject(currentProject.id)}
 const arr=[...files]; if(!arr.length)return;
 toast(`Importing ${arr.length} file${arr.length===1?'':'s'}…`);
 for(const file of arr){
   const type=file.type.startsWith('video/')?'video':'image';
   let thumb='';
   if(type==='image') thumb=await makeThumb(file);
   else thumb=await makeVideoThumb(file).catch(()=> '');
   const order=type==='video'?media.filter(x=>x.type==='video').length:null;
   const m={id:uid(),projectId:currentProject.id,name:file.name,type,mime:file.type,blob:file,thumb,createdAt:Date.now(),selected:true,settings:{...defaults},video:{...videoDefaults,timelineOrder:order},hasEdit:false,editedThumb:'',editedBlob:null,editedAt:null};
   await put('media',m);media.unshift(m);
 }
 currentProject.mediaCount=media.length;currentProject.updatedAt=Date.now();if(!currentProject.coverUrl){const firstImg=media.find(m=>m.type==='image'&&m.thumb);if(firstImg)currentProject.coverUrl=firstImg.thumb}await put('projects',currentProject);renderMedia();updateProjectMeta();await loadProjects();if(media[0])selectMedia(media[0].id);toast('Media added');
}
function makeThumb(file){return new Promise((res,rej)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const c=document.createElement('canvas'),max=360,s=Math.min(1,max/Math.max(img.width,img.height));c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',.75))};img.onerror=rej;img.src=url})}
function makeVideoThumb(file){return new Promise((res,rej)=>{const v=document.createElement('video');const url=URL.createObjectURL(file);v.muted=true;v.playsInline=true;v.preload='metadata';v.onloadeddata=()=>{v.currentTime=Math.min(.2,v.duration||.2)};v.onseeked=()=>{const c=document.createElement('canvas'),max=360,s=Math.min(1,max/Math.max(v.videoWidth,v.videoHeight));c.width=Math.round(v.videoWidth*s);c.height=Math.round(v.videoHeight*s);c.getContext('2d').drawImage(v,0,0,c.width,c.height);URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',.65))};v.onerror=rej;v.src=url})}
function renderMedia(){
 $('#mediaEmpty').style.display=media.length?'none':'block';$('#mediaList').innerHTML='';
 media.forEach(m=>{const el=document.createElement('div');el.className='media-item'+(currentMedia?.id===m.id?' active':'');el.dataset.id=m.id;el.innerHTML=`${m.thumb?`<img class="media-thumb" src="${m.thumb}">`:`<div class="media-thumb" style="display:grid;place-items:center">▶</div>`}<div><div class="media-name">${escapeHtml(m.name)}</div><div class="media-kind">${m.type==='image'?'PHOTO':'VIDEO'} • ${m.settings?.preset||'auto'}</div></div><input class="media-check" type="checkbox" ${m.selected?'checked':''}>`;el.onclick=e=>{if(e.target.matches('.media-check'))return;selectMedia(m.id)};el.querySelector('.media-check').onchange=async e=>{m.selected=e.target.checked;await put('media',m)};$('#mediaList').appendChild(el)})
}
async function selectMedia(id){currentMedia=media.find(m=>m.id===id);renderMedia();if(!currentMedia)return;if(currentMedia.type==='image')await showImage(currentMedia);else showVideo(currentMedia);loadSettingsUI(currentMedia.settings||defaults);renderVideoTimeline()}
function clearViewer(){currentMedia=null;currentBitmap=null;$('#imageViewer').classList.add('hidden');$('#videoViewer').classList.add('hidden');$('#videoWorkbench')?.classList.add('hidden');$('#quickEdit')?.classList.remove('hidden');$('#viewerEmpty').classList.remove('hidden');$('#exportBtn').disabled=true}
async function showImage(m){$('#viewerEmpty').classList.add('hidden');$('#videoViewer').classList.add('hidden');$('#videoWorkbench')?.classList.add('hidden');$('#quickEdit')?.classList.remove('hidden');$('#imageViewer').classList.remove('hidden');$('#exportBtn').disabled=false;$('#exportBtn').textContent='Export';currentBitmap=await createImageBitmap(m.blob);drawOriginalPreview();scheduleRender()}
function showVideo(m){
 $('#viewerEmpty').classList.add('hidden');$('#imageViewer').classList.add('hidden');$('#quickEdit')?.classList.add('hidden');$('#videoViewer').classList.remove('hidden');$('#videoWorkbench')?.classList.remove('hidden');$('#exportBtn').disabled=false;$('#exportBtn').textContent='Export Video';
 m.video={...videoDefaults,...(m.video||{})};
 const v=$('#videoPlayer');if(v._url)URL.revokeObjectURL(v._url);v._url=URL.createObjectURL(m.blob);v.src=v._url;v.playbackRate=m.video.speed||1;v.volume=Math.max(0,Math.min(1,m.video.volume??1));
 v.onloadedmetadata=()=>{if(m.video.trimEnd==null||m.video.trimEnd>v.duration)m.video.trimEnd=v.duration;applyVideoFormat();renderVideoToolPanel();renderVideoTimeline();};
 v.ontimeupdate=()=>{const cfg=m.video||videoDefaults;if(cfg.trimEnd!=null&&v.currentTime>=cfg.trimEnd){v.currentTime=Math.min(cfg.trimStart||0,v.duration||0);if(!v.paused)v.play().catch(()=>{})}};
 applyVideoFilter();applyVideoFormat();renderVideoToolPanel();renderVideoTimeline();
}
function previewSize(w,h){const maxW=1400,maxH=1100,s=Math.min(1,maxW/w,maxH/h);return [Math.max(1,Math.round(w*s)),Math.max(1,Math.round(h*s))]}
function drawOriginalPreview(){if(!currentBitmap)return;const [w,h]=previewSize(currentBitmap.width,currentBitmap.height);for(const id of ['#originalCanvas','#editedCanvas']){const c=$(id);c.width=w;c.height=h;c.style.aspectRatio=`${w}/${h}`}const c=$('#originalCanvas');c.getContext('2d').drawImage(currentBitmap,0,0,w,h);syncCanvasLayout()}
function syncCanvasLayout(){requestAnimationFrame(()=>{const stage=$('#imageViewer'),o=$('#originalCanvas'),e=$('#editedCanvas');if(!stage||stage.classList.contains('hidden')||!o.width||!o.height)return;const ratio=o.width/o.height;const pad=12,sw=Math.max(1,stage.clientWidth-pad*2),sh=Math.max(1,stage.clientHeight-pad*2);let w=sw,h=w/ratio;if(h>sh){h=sh;w=h*ratio}const left=(stage.clientWidth-w)/2,top=(stage.clientHeight-h)/2;o.style.width=w+'px';o.style.height=h+'px';o.style.left=left+'px';o.style.top=top+'px';e.style.width=w+'px';e.style.height=h+'px';e.style.left='0px';e.style.top='0px';const clip=$('#editedClip'),rawPct=Number($('#compareRange').value)/100;const pct=viewMode==='edited'?1:(viewMode==='original'?0:rawPct);clip.style.left=left+'px';clip.style.top=top+'px';clip.style.height=h+'px';clip.style.width=(w*pct)+'px';const line=$('#compareLine');line.style.left=(left+w*rawPct)+'px';line.style.top=top+'px';line.style.height=h+'px'})}
window.addEventListener('resize',syncCanvasLayout);
window.addEventListener('orientationchange',()=>setTimeout(syncCanvasLayout,120));
if('ResizeObserver'in window){const viewerResizeObserver=new ResizeObserver(()=>syncCanvasLayout());requestAnimationFrame(()=>{const stage=$('#imageViewer');if(stage)viewerResizeObserver.observe(stage)})}

function effectiveSettings(s){const p=presets[s.preset]||presets.auto,k=(s.strength??70)/100,out={...s};for(const key of Object.keys(p)){out[key]=(s[key]||0)+p[key]*k}return out}
function clamp(v){return Math.max(0,Math.min(255,v))}
function renderToCanvas(source,canvas,settings){
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);
 const s=effectiveSettings(settings);let img=ctx.getImageData(0,0,canvas.width,canvas.height),d=img.data;
 const exp=Math.pow(2,(s.exposure||0)/100*1.5);const con=(s.contrast||0)/100;const sat=(s.saturation||0)/100;const vib=(s.vibrance||0)/100;const temp=(s.temperature||0)/100;const tint=(s.tint||0)/100;const hi=(s.highlights||0)/100;const sh=(s.shadows||0)/100;const clarity=(s.clarity||0)/100;
 for(let i=0;i<d.length;i+=4){let r=d[i]*exp,g=d[i+1]*exp,b=d[i+2]*exp;const lum=.2126*r+.7152*g+.0722*b;const ln=lum/255;
   const shadowW=Math.pow(1-ln,2),highW=Math.pow(ln,2);const delta=(sh*65*shadowW)+(hi*65*highW);r+=delta;g+=delta;b+=delta;
   r+=(temp*22);b-=(temp*22);g+=(tint*18);r-=(tint*7);b-=(tint*7);
   const factor=(259*(con*255+255))/(255*(259-con*255));r=factor*(r-128)+128;g=factor*(g-128)+128;b=factor*(b-128)+128;
   const gray=.299*r+.587*g+.114*b;const sf=1+sat; r=gray+(r-gray)*sf;g=gray+(g-gray)*sf;b=gray+(b-gray)*sf;
   const max=Math.max(r,g,b),min=Math.min(r,g,b),chroma=(max-min)/255;const vf=1+vib*(1-chroma);r=gray+(r-gray)*vf;g=gray+(g-gray)*vf;b=gray+(b-gray)*vf;
   if(clarity){const mid=1-Math.min(1,Math.abs(ln-.5)*2);const cfac=1+clarity*.5*mid;r=128+(r-128)*cfac;g=128+(g-128)*cfac;b=128+(b-128)*cfac}
   d[i]=clamp(r);d[i+1]=clamp(g);d[i+2]=clamp(b)
 }
 ctx.putImageData(img,0,0);
 if((s.sharpness||0)>2)sharpen(ctx,canvas.width,canvas.height,(s.sharpness||0)/100*.65);
 if((s.vignette||0)>0){const grd=ctx.createRadialGradient(canvas.width/2,canvas.height/2,Math.min(canvas.width,canvas.height)*.25,canvas.width/2,canvas.height/2,Math.max(canvas.width,canvas.height)*.75);grd.addColorStop(0,'rgba(0,0,0,0)');grd.addColorStop(1,`rgba(0,0,0,${(s.vignette||0)/100*.5})`);ctx.fillStyle=grd;ctx.fillRect(0,0,canvas.width,canvas.height)}
}
function sharpen(ctx,w,h,amount){const src=ctx.getImageData(0,0,w,h),out=ctx.createImageData(w,h),s=src.data,d=out.data;d.set(s);const row=w*4;for(let y=1;y<h-1;y++){for(let x=1;x<w-1;x++){const i=(y*w+x)*4;for(let c=0;c<3;c++){const center=s[i+c]*5-s[i-row+c]-s[i+row+c]-s[i-4+c]-s[i+4+c];d[i+c]=clamp(s[i+c]*(1-amount)+center*amount)}d[i+3]=s[i+3]}}ctx.putImageData(out,0,0)}
function scheduleRender(){clearTimeout(renderTimer);renderTimer=setTimeout(()=>{if(!currentMedia)return;if(currentMedia.type==='image'&&currentBitmap){renderToCanvas(currentBitmap,$('#editedCanvas'),currentMedia.settings||defaults);syncCanvasLayout()}else if(currentMedia.type==='video')applyVideoFilter()},50)}
function videoFilterString(settings){const s=effectiveSettings(settings||defaults);const brightness=Math.max(.15,1+(s.exposure||0)/120+((s.shadows||0)*.0015)+((s.highlights||0)*.0008));const contrast=Math.max(.15,1+(s.contrast||0)/100+(s.clarity||0)/500);const saturation=Math.max(0,1+((s.saturation||0)+(s.vibrance||0)*.55)/100);const sepia=Math.max(0,s.temperature||0)/420;const hue=(s.tint||0)*.16;return `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) sepia(${sepia}) hue-rotate(${hue}deg)`}
function applyVideoFilter(){if(!currentMedia||currentMedia.type!=='video')return;$('#videoPlayer').style.filter=videoFilterString(currentMedia.settings||defaults)}

function loadSettingsUI(s){s={...defaults,...s};keys.forEach(k=>{const el=$('#'+k);if(el)el.value=s[k]??defaults[k];const out=$('#'+k+'Out');if(out)out.value=k==='strength'?`${s[k]}%`:(s[k]>0?`+${s[k]}`:`${s[k]}`)});$$('.preset').forEach(b=>b.classList.toggle('active',b.dataset.preset===s.preset));renderQuickAdjustments();syncQuickSlider()}
async function updateSetting(key,val){if(!currentMedia)return;currentMedia.settings={...defaults,...currentMedia.settings,[key]:Number(val)};currentMedia.hasEdit=true;currentMedia.editedAt=Date.now();const out=$('#'+key+'Out');if(out)out.value=key==='strength'?`${val}%`:(Number(val)>0?`+${val}`:`${val}`);if(key===quickKey)syncQuickSlider();scheduleRender();put('media',currentMedia).catch(()=>{});scheduleEditedSnapshot()}
function renderQuickAdjustments(){
 const wrap=$('#quickAdjustments');if(!wrap)return;wrap.innerHTML='';
 (quickGroups[quickCategory]||[]).forEach(([key,label])=>{const b=document.createElement('button');b.className='adjustment-chip'+(key===quickKey?' active':'');b.textContent=label;b.dataset.key=key;b.onclick=()=>{quickKey=key;renderQuickAdjustments();syncQuickSlider()};wrap.appendChild(b)});
}
function syncQuickSlider(){
 const slider=$('#liveSlider'),name=$('#liveSliderName'),out=$('#liveSliderValue');if(!slider||!name||!out)return;
 const label=(Object.values(quickGroups).flat().find(x=>x[0]===quickKey)||[quickKey,quickKey])[1];
 const val=Number(currentMedia?.settings?.[quickKey]??defaults[quickKey]??0);name.textContent=label;out.value=val>0?`+${val}`:`${val}`;slider.min=(quickKey==='sharpness'||quickKey==='vignette')?'0':'-100';slider.max='100';slider.value=val;
}
function setQuickCategory(category){quickCategory=category;const first=quickGroups[category]?.[0]?.[0];if(first&&!quickGroups[category].some(x=>x[0]===quickKey))quickKey=first;$$('.edit-category').forEach(b=>b.classList.toggle('active',b.dataset.category===category));renderQuickAdjustments();syncQuickSlider()}

async function setPreset(name){if(!currentMedia)return;currentMedia.settings={...defaults,...currentMedia.settings,preset:name};currentMedia.hasEdit=true;currentMedia.editedAt=Date.now();await put('media',currentMedia);$$('.preset').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));renderMedia();scheduleRender();scheduleEditedSnapshot()}
async function resetSettings(){if(!currentMedia)return;currentMedia.settings={...defaults};currentMedia.hasEdit=false;currentMedia.editedThumb='';currentMedia.editedBlob=null;currentMedia.editedAt=null;await put('media',currentMedia);loadSettingsUI(currentMedia.settings);renderMedia();scheduleRender();toast('Edits reset')}

function analyzeImage(canvas){const c=document.createElement('canvas');c.width=100;c.height=Math.max(40,Math.round(100*canvas.height/canvas.width));const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height).data;let lum=0,sat=0,blue=0,green=0;for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];lum+=(r+g+b)/3;sat+=Math.max(r,g,b)-Math.min(r,g,b);blue+=b-r;green+=g-r}const n=d.length/4;return{lum:lum/n,sat:sat/n,blue:blue/n,green:green/n}}
async function autoEnhance(){if(!currentMedia)return;if(currentMedia.type==='video'){await autoEnhanceVideo();return;}const a=analyzeImage($('#originalCanvas'));let preset='auto';if(a.green>12||a.blue>18)preset='exterior';else if(a.lum<95)preset='bright';else if(a.sat<28)preset='stone';currentMedia.settings={...defaults,preset,strength:72};currentMedia.hasEdit=true;currentMedia.editedAt=Date.now();if(a.lum<110)currentMedia.settings.exposure=8;if(a.lum>180)currentMedia.settings.highlights=-15;await put('media',currentMedia);loadSettingsUI(currentMedia.settings);renderMedia();scheduleRender();scheduleEditedSnapshot();toast(`Auto Enhance: ${preset.replace(/\b\w/g,c=>c.toUpperCase())}`)}

async function exportCurrent(){if(!currentMedia)return;if(currentMedia.type==='video'){return exportVideoCurrent()}toast('Rendering full-resolution export…');const blob=await saveEditedVersion(currentMedia,true);if(!blob)return;const a=document.createElement('a');const base=currentMedia.name.replace(/\.[^.]+$/,'');a.download=`${base}_MediaStudio.jpg`;a.href=URL.createObjectURL(blob);a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('Edited version saved + exported')}
async function applyToSelected(){if(!currentMedia)return;const selected=media.filter(m=>m.selected);if(!selected.length){toast('Select at least one media item');return}for(const m of selected){m.settings={...currentMedia.settings};m.hasEdit=true;m.editedAt=Date.now();await put('media',m);scheduleEditedSnapshot(m)}renderMedia();renderVideoTimeline();toast(`Applied look to ${selected.length} selected item${selected.length===1?'':'s'}`)}


function canvasToBlob(canvas,type='image/jpeg',quality=.9){return new Promise(res=>canvas.toBlob(res,type,quality))}
async function makeEditedThumb(m){
 if(!m||m.type!=='image')return m?.thumb||'';
 const bmp=await createImageBitmap(m.blob);const max=460,s=Math.min(1,max/Math.max(bmp.width,bmp.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(bmp.width*s));c.height=Math.max(1,Math.round(bmp.height*s));renderToCanvas(bmp,c,m.settings||defaults);if(bmp.close)bmp.close();return c.toDataURL('image/jpeg',.8)
}
function scheduleEditedSnapshot(m=currentMedia){
 if(!m)return;clearTimeout(editedSnapshotTimer);editedSnapshotTimer=setTimeout(async()=>{try{if(m.type==='image')m.editedThumb=await makeEditedThumb(m);else m.editedThumb=m.thumb||'';m.hasEdit=true;m.editedAt=Date.now();await put('media',m)}catch(e){console.warn('Edited preview save failed',e)}},300)
}
async function saveEditedVersion(m=currentMedia,full=true){
 if(!m||m.type!=='image')return null;
 const bmp=await createImageBitmap(m.blob);const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;renderToCanvas(bmp,c,m.settings||defaults);if(bmp.close)bmp.close();const blob=await canvasToBlob(c,'image/jpeg',.94);m.editedBlob=full?blob:m.editedBlob;m.editedThumb=await makeEditedThumb(m);m.hasEdit=true;m.editedAt=Date.now();await put('media',m);return blob
}
async function saveCurrentEdit(){if(!currentMedia)return;if(currentMedia.type==='video'){currentMedia.hasEdit=true;currentMedia.editedThumb=currentMedia.thumb||'';currentMedia.editedAt=Date.now();await put('media',currentMedia);toast('Video edit preview saved to Media');return}toast('Saving edited version…');await saveEditedVersion(currentMedia,true);toast('Edited version saved to Media')}

async function openLibrary(){
 currentProject&&saveProject().catch(()=>{});showScreen('#libraryScreen');await renderLibrary();setMobileNav('media')
}
function projectNameFor(id){return projects.find(p=>p.id===id)?.name||'Project'}
async function renderLibrary(){
 const all=(await getAll('media')).sort((a,b)=>(b.editedAt||b.createdAt)-(a.editedAt||a.createdAt));
 const projectSelect=$('#libraryProjectFilter');if(projectSelect){const val=libraryProject;projectSelect.innerHTML='<option value="all">All projects</option>'+projects.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');projectSelect.value=projects.some(p=>p.id===val)?val:'all';libraryProject=projectSelect.value}
 const originals=all.length, edited=all.filter(m=>m.hasEdit).length;$('#libraryOriginalCount').textContent=originals;$('#libraryEditedCount').textContent=edited;
 const entries=[];for(const m of all){if(libraryProject!=='all'&&m.projectId!==libraryProject)continue;if(libraryFilter==='all'||libraryFilter==='original')entries.push({kind:'original',m});if(m.hasEdit&&(libraryFilter==='all'||libraryFilter==='edited'))entries.push({kind:'edited',m})}
 const grid=$('#libraryGrid');grid.innerHTML='';$('#libraryEmpty').style.display=entries.length?'none':'block';
 for(const entry of entries){const {m,kind}=entry;const edited=kind==='edited';const card=document.createElement('article');card.className='library-card';const src=edited?(m.editedThumb||m.thumb):m.thumb;const typeLabel=m.type==='video'?'VIDEO':'PHOTO';card.innerHTML=`<div class="library-thumb-wrap">${src?`<img class="library-thumb" src="${src}" alt="">`:'<div class="library-no-thumb">▶</div>'}<span class="version-badge ${edited?'edited':''}">${edited?'EDITED':'ORIGINAL'}</span></div><div class="library-card-info"><strong>${escapeHtml(m.name)}</strong><span>${escapeHtml(projectNameFor(m.projectId))} • ${typeLabel}</span><span>${edited&&m.editedAt?'Edited '+fmtDate(m.editedAt):'Imported '+fmtDate(m.createdAt)}</span></div><div class="library-card-actions"><button class="ghost open-media">Open</button><button class="primary download-media">${edited?'Export Edit':'Download'}</button></div>`;
 card.querySelector('.open-media').onclick=async()=>{await openProject(m.projectId);await selectMedia(m.id);setMobileNav('projects')};
 card.querySelector('.download-media').onclick=()=>downloadLibraryEntry(m,kind);grid.appendChild(card)
 }
}
async function downloadLibraryEntry(m,kind){
 if(kind==='original'){const a=document.createElement('a');a.href=URL.createObjectURL(m.blob);a.download=m.name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);return}
 if(m.type==='video'){if(m.editedBlob){downloadBlob(m.editedBlob,editedVideoFilename(m));return}toast('Open this video and use Export Video to render the current edit');return}
 let blob=m.editedBlob;if(!blob)blob=await saveEditedVersion(m,true);const a=document.createElement('a');const base=m.name.replace(/\.[^.]+$/,'');a.href=URL.createObjectURL(blob);a.download=`${base}_MediaStudio_Edit.jpg`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)
}
function setMobileNav(which){const p=$('#mobileProjectsBtn'),l=$('#mobileLibraryBtn');if(p)p.classList.toggle('active',which==='projects');if(l)l.classList.toggle('active',which==='media')}


function vcfg(m=currentMedia){if(!m)return {...videoDefaults};m.video={...videoDefaults,...(m.video||{})};return m.video}
function fmtTime(sec){if(!Number.isFinite(sec))return '0:00';sec=Math.max(0,sec);const m=Math.floor(sec/60),s=Math.floor(sec%60);return `${m}:${String(s).padStart(2,'0')}`}
function videoClips(){return media.filter(m=>m.type==='video').sort((a,b)=>{const ao=vcfg(a).timelineOrder,bo=vcfg(b).timelineOrder;if(ao==null&&bo==null)return a.createdAt-b.createdAt;if(ao==null)return 1;if(bo==null)return-1;return ao-bo})}
function renderVideoTimeline(){const wrap=$('#videoTimeline');if(!wrap)return;const clips=videoClips();$('#timelineSummary').textContent=`${clips.length} clip${clips.length===1?'':'s'}`;wrap.innerHTML='';clips.forEach((m,i)=>{const c=document.createElement('button');c.className='timeline-clip'+(currentMedia?.id===m.id?' active':'');c.innerHTML=`<span class="timeline-order">${i+1}</span>${m.thumb?`<img src="${m.thumb}" alt="">`:'<div style="height:68px;display:grid;place-items:center">▶</div>'}<div class="timeline-clip-name">${escapeHtml(m.name)}</div><div class="timeline-clip-meta">${fmtTime(vcfg(m).trimStart)}–${vcfg(m).trimEnd==null?'end':fmtTime(vcfg(m).trimEnd)} • ${vcfg(m).speed}×</div>`;c.onclick=()=>selectMedia(m.id);wrap.appendChild(c)})}
function applyVideoFormat(){if(!currentMedia||currentMedia.type!=='video')return;const cfg=vcfg(),frame=$('#videoFrame'),v=$('#videoPlayer');if(!frame||!v)return;const map={'9:16':'9/16','16:9':'16/9','1:1':'1/1','4:5':'4/5'};frame.style.aspectRatio=map[cfg.aspect]||'';frame.style.width=cfg.aspect==='source'?'100%':'min(100%, 720px)';frame.style.maxHeight='100%';v.style.objectFit='contain';v.playbackRate=cfg.speed||1;v.volume=Math.max(0,Math.min(1,cfg.volume??1));const overlay=$('#videoTextOverlay');if(overlay){overlay.textContent=cfg.text||'';overlay.style.fontSize=`${Math.max(18,cfg.textSize||42)}px`;overlay.classList.toggle('hidden',!cfg.text)}}
async function saveVideoCfg(patch){if(!currentMedia||currentMedia.type!=='video')return;currentMedia.video={...vcfg(),...patch};currentMedia.hasEdit=true;currentMedia.editedAt=Date.now();await put('media',currentMedia);applyVideoFormat();renderVideoTimeline();renderVideoToolPanel();scheduleEditedSnapshot()}
function renderVideoToolPanel(){const panel=$('#videoToolPanel');if(!panel||!currentMedia||currentMedia.type!=='video'){if(panel)panel.innerHTML='';return}const cfg=vcfg(),v=$('#videoPlayer'),dur=Number.isFinite(v?.duration)?v.duration:(cfg.trimEnd||0);if(cfg.trimEnd==null&&dur)cfg.trimEnd=dur;
 const saveInput=(sel,key,parse=v=>v)=>{const el=panel.querySelector(sel);if(el)el.oninput=e=>saveVideoCfg({[key]:parse(e.target.value)})};
 if(videoTool==='adjust'){panel.innerHTML=`<div class="video-tool-grid"><div class="video-field"><span>Auto / Manual</span><button id="videoAutoTool" class="primary">✨ Auto Enhance Clip</button></div><div class="video-field"><span>Look</span><select id="videoPresetTool"><option value="auto">Auto</option><option value="luxury">Luxury Interior</option><option value="bright">Bright Interior</option><option value="stone">Natural Stone</option><option value="exterior">Exterior</option><option value="cinematic">Cinematic</option></select></div></div><div class="video-warning">Manual Light, Color and Detail sliders remain available in the Looks panel. Auto Enhance is non-destructive and can be overridden at any time.</div>`;panel.querySelector('#videoAutoTool').onclick=autoEnhanceVideo;const ps=panel.querySelector('#videoPresetTool');ps.value=currentMedia.settings?.preset||'auto';ps.onchange=e=>setPreset(e.target.value)}
 else if(videoTool==='trim'){panel.innerHTML=`<div class="video-tool-grid"><label class="video-field"><span>Trim start <b class="trim-time">${fmtTime(cfg.trimStart||0)}</b></span><input id="trimStartTool" type="range" min="0" max="${Math.max(.1,dur)}" step="0.05" value="${cfg.trimStart||0}"></label><label class="video-field"><span>Trim end <b class="trim-time">${fmtTime(cfg.trimEnd??dur)}</b></span><input id="trimEndTool" type="range" min="0" max="${Math.max(.1,dur)}" step="0.05" value="${cfg.trimEnd??dur}"></label></div><div class="video-tool-row"><button id="setInBtn" class="ghost">Set In at Playhead</button><button id="splitBtn" class="ghost">Split at Playhead</button><button id="setOutBtn" class="ghost">Set Out at Playhead</button></div><div class="clip-move-row"><button id="moveClipLeft" class="secondary">← Move clip</button><button id="moveClipRight" class="secondary">Move clip →</button></div>`;saveInput('#trimStartTool','trimStart',Number);saveInput('#trimEndTool','trimEnd',Number);panel.querySelector('#setInBtn').onclick=()=>saveVideoCfg({trimStart:Math.min(v.currentTime,cfg.trimEnd??dur)});panel.querySelector('#setOutBtn').onclick=()=>saveVideoCfg({trimEnd:Math.max(v.currentTime,cfg.trimStart||0)});panel.querySelector('#splitBtn').onclick=splitCurrentVideo;panel.querySelector('#moveClipLeft').onclick=()=>moveCurrentClip(-1);panel.querySelector('#moveClipRight').onclick=()=>moveCurrentClip(1)}
 else if(videoTool==='speed'){panel.innerHTML=`<div class="video-tool-grid"><label class="video-field"><span>Playback speed</span><select id="speedTool"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><label class="video-field"><span>Transition to next</span><select id="transitionTool"><option value="none">None</option><option value="fade">Fade</option><option value="dissolve">Dissolve</option><option value="dip-black">Dip to black</option></select></label></div>`;const sp=panel.querySelector('#speedTool');sp.value=String(cfg.speed||1);sp.onchange=e=>saveVideoCfg({speed:Number(e.target.value)});const tr=panel.querySelector('#transitionTool');tr.value=cfg.transition||'none';tr.onchange=e=>saveVideoCfg({transition:e.target.value})}
 else if(videoTool==='audio'){panel.innerHTML=`<div class="video-tool-grid"><label class="video-field"><span>Clip volume ${Math.round((cfg.volume??1)*100)}%</span><input id="volumeTool" type="range" min="0" max="1" step="0.01" value="${cfg.volume??1}"></label><div class="video-field"><span>Quick controls</span><button id="muteTool" class="ghost">${(cfg.volume??1)>0?'Mute clip':'Restore audio'}</button></div></div><div class="video-warning">Music tracks, voiceover recording and advanced audio mixing are prepared for a later backend-enabled revision.</div>`;saveInput('#volumeTool','volume',Number);panel.querySelector('#muteTool').onclick=()=>saveVideoCfg({volume:(cfg.volume??1)>0?0:1})}
 else if(videoTool==='format'){panel.innerHTML=`<div class="video-field"><span>Aspect ratio</span><div class="format-pills">${['source','9:16','16:9','1:1','4:5'].map(x=>`<button class="format-pill ${cfg.aspect===x?'active':''}" data-aspect="${x}">${x==='source'?'Original':x}</button>`).join('')}</div></div><div class="video-tool-grid" style="margin-top:9px"><label class="video-field"><span>Export resolution</span><select id="resolutionTool"><option value="source">Source</option><option value="1080">1080p</option><option value="4k">4K</option></select></label><label class="video-field"><span>Frame rate</span><select id="fpsTool"><option value="24">24 fps</option><option value="30">30 fps</option><option value="60">60 fps</option></select></label></div><div class="video-warning">4K processing is demanding on mobile Safari. Media Studio will attempt the requested resolution when the browser supports canvas video recording.</div>`;panel.querySelectorAll('[data-aspect]').forEach(b=>b.onclick=()=>saveVideoCfg({aspect:b.dataset.aspect}));const rs=panel.querySelector('#resolutionTool');rs.value=cfg.resolution||'source';rs.onchange=e=>saveVideoCfg({resolution:e.target.value});const fp=panel.querySelector('#fpsTool');fp.value=String(cfg.fps||30);fp.onchange=e=>saveVideoCfg({fps:Number(e.target.value)})}
 else if(videoTool==='text'){panel.innerHTML=`<div class="video-tool-grid"><label class="video-field"><span>Text overlay</span><input id="videoTextTool" value="${escapeHtml(cfg.text||'')}" placeholder="Project title, material, location…"></label><label class="video-field"><span>Text size</span><input id="videoTextSizeTool" type="range" min="18" max="80" value="${cfg.textSize||42}"></label></div><div class="video-warning">The text is shown live in preview and included in browser-rendered exports.</div>`;saveInput('#videoTextTool','text',String);saveInput('#videoTextSizeTool','textSize',Number)}
}
async function autoEnhanceVideo(){if(!currentMedia||currentMedia.type!=='video')return;const v=$('#videoPlayer');let preset='stone';try{if(v.readyState>=2){const c=document.createElement('canvas');c.width=120;c.height=Math.max(60,Math.round(120*(v.videoHeight||9)/(v.videoWidth||16)));c.getContext('2d').drawImage(v,0,0,c.width,c.height);const a=analyzeImage(c);if(a.blue>20||a.green>14)preset='exterior';else if(a.lum<92)preset='bright';else if(a.sat<34)preset='stone';else preset='luxury'}}catch(e){}currentMedia.settings={...defaults,preset,strength:68};currentMedia.hasEdit=true;currentMedia.editedAt=Date.now();await put('media',currentMedia);loadSettingsUI(currentMedia.settings);applyVideoFilter();renderMedia();renderVideoTimeline();scheduleEditedSnapshot();toast(`Video Auto Enhance: ${preset.replace(/\b\w/g,c=>c.toUpperCase())}`)}
async function autoMatchClips(){if(!currentMedia||currentMedia.type!=='video')return;const vids=videoClips().filter(m=>m.selected!==false);if(!vids.length)return toast('Select video clips first');for(const m of vids){m.settings={...currentMedia.settings};m.hasEdit=true;m.editedAt=Date.now();await put('media',m);scheduleEditedSnapshot(m)}renderMedia();renderVideoTimeline();toast(`Matched ${vids.length} clip${vids.length===1?'':'s'} to the current look`)}
async function splitCurrentVideo(){if(!currentMedia||currentMedia.type!=='video')return;const v=$('#videoPlayer'),cfg=vcfg(),at=v.currentTime,end=cfg.trimEnd??v.duration;if(!(at>cfg.trimStart+.08&&at<end-.08))return toast('Move the playhead inside the trimmed clip');const clips=videoClips(),idx=clips.findIndex(x=>x.id===currentMedia.id);const clone={...currentMedia,id:uid(),name:currentMedia.name.replace(/(\.[^.]+)$/,'_B$1'),createdAt:Date.now(),editedBlob:null,video:{...cfg,trimStart:at,trimEnd:end,timelineOrder:(cfg.timelineOrder??idx)+.5}};currentMedia.video={...cfg,trimEnd:at};await put('media',currentMedia);await put('media',clone);media.push(clone);await normalizeTimelineOrder();currentProject.mediaCount=media.length;await put('projects',currentProject);renderMedia();renderVideoTimeline();renderVideoToolPanel();toast('Clip split at playhead')}
async function normalizeTimelineOrder(){const clips=videoClips();for(let i=0;i<clips.length;i++){clips[i].video={...vcfg(clips[i]),timelineOrder:i};await put('media',clips[i])}}
async function moveCurrentClip(dir){if(!currentMedia||currentMedia.type!=='video')return;const clips=videoClips(),i=clips.findIndex(x=>x.id===currentMedia.id),j=i+dir;if(i<0||j<0||j>=clips.length)return;const a=clips[i],b=clips[j],ao=vcfg(a).timelineOrder,bo=vcfg(b).timelineOrder;a.video.timelineOrder=bo;b.video.timelineOrder=ao;await put('media',a);await put('media',b);renderVideoTimeline()}
function exportDimensions(v,cfg){const sw=v.videoWidth||1920,sh=v.videoHeight||1080;let ratio=sw/sh;if(cfg.aspect&&cfg.aspect!=='source'){const [a,b]=cfg.aspect.split(':').map(Number);ratio=a/b}let h,w;if(cfg.resolution==='4k'){if(ratio>=1){w=3840;h=Math.round(w/ratio)}else{h=3840;w=Math.round(h*ratio)}}else if(cfg.resolution==='1080'){if(ratio>=1){w=1920;h=Math.round(w/ratio)}else{h=1920;w=Math.round(h*ratio)}}else{w=sw;h=sh;if(cfg.aspect!=='source'){if(ratio>=1){w=Math.min(1920,sw);h=Math.round(w/ratio)}else{h=Math.min(1920,sh);w=Math.round(h*ratio)}}}return [Math.max(2,w),Math.max(2,h)]}
function editedVideoFilename(m){const base=m.name.replace(/\.[^.]+$/,'');const type=m.editedMime?.includes('mp4')?'mp4':'webm';return `${base}_MediaStudio_Edit.${type}`}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2500)}
async function exportVideoCurrent(){if(videoExporting||!currentMedia||currentMedia.type!=='video')return;const v=$('#videoPlayer'),cfg=vcfg();if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){toast('This browser cannot render edited video yet. Edit settings are still saved.');return}videoExporting=true;const btn=$('#videoExportBtn');if(btn)btn.disabled=true;$('#exportBtn').disabled=true;toast('Preparing video render…');try{const [w,h]=exportDimensions(v,cfg),c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');const fps=cfg.fps||30,stream=c.captureStream(fps);let sourceStream=null;try{sourceStream=v.captureStream?.()||v.mozCaptureStream?.();if(sourceStream){sourceStream.getAudioTracks().forEach(t=>stream.addTrack(t))}}catch(e){}const candidates=['video/mp4;codecs=h264','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'];const mime=candidates.find(x=>MediaRecorder.isTypeSupported?.(x))||'';const recorder=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:cfg.resolution==='4k'?22000000:9000000}:undefined),chunks=[];recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};const done=new Promise((res,rej)=>{recorder.onstop=res;recorder.onerror=e=>rej(e.error||e)});const originalTime=v.currentTime,originalRate=v.playbackRate,originalMuted=v.muted;v.pause();v.currentTime=Math.max(0,cfg.trimStart||0);await new Promise(r=>{const f=()=>{v.removeEventListener('seeked',f);r()};v.addEventListener('seeked',f,{once:true});setTimeout(f,500)});v.playbackRate=cfg.speed||1;v.muted=false;recorder.start(500);await v.play();const filter=videoFilterString(currentMedia.settings||defaults);let raf;const draw=()=>{ctx.save();ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.filter=filter;const srcR=(v.videoWidth||16)/(v.videoHeight||9),dstR=w/h;let dw=w,dh=h,dx=0,dy=0;if(srcR>dstR){dh=w/srcR;dy=(h-dh)/2}else{dw=h*srcR;dx=(w-dw)/2}ctx.drawImage(v,dx,dy,dw,dh);ctx.filter='none';if(cfg.text){ctx.font=`800 ${Math.round((cfg.textSize||42)*(w/1080))}px -apple-system,Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=Math.max(2,w/500);ctx.strokeStyle='rgba(0,0,0,.72)';ctx.fillStyle='#fff';ctx.strokeText(cfg.text,w/2,h*.86,w*.88);ctx.fillText(cfg.text,w/2,h*.86,w*.88)}ctx.restore();if(!v.paused&&v.currentTime<(cfg.trimEnd??v.duration))raf=requestAnimationFrame(draw);else{try{recorder.stop()}catch(e){}}};draw();const stopAt=cfg.trimEnd??v.duration;const watcher=setInterval(()=>{if(v.currentTime>=stopAt||v.ended){clearInterval(watcher);v.pause();cancelAnimationFrame(raf);try{recorder.stop()}catch(e){}}},50);await done;clearInterval(watcher);cancelAnimationFrame(raf);v.pause();v.currentTime=originalTime;v.playbackRate=originalRate;v.muted=originalMuted;const blob=new Blob(chunks,{type:recorder.mimeType||mime||'video/webm'});currentMedia.editedBlob=blob;currentMedia.editedMime=blob.type;currentMedia.editedThumb=currentMedia.thumb||'';currentMedia.hasEdit=true;currentMedia.editedAt=Date.now();await put('media',currentMedia);downloadBlob(blob,editedVideoFilename(currentMedia));toast('Edited video rendered + saved to Media')}catch(e){console.error(e);toast('Video render was not supported by this browser. Your edit settings are saved.')}finally{videoExporting=false;if(btn)btn.disabled=false;$('#exportBtn').disabled=false}}

let viewMode='compare';
function setView(mode){viewMode=mode;['compare','edited','original'].forEach(m=>$('#'+m+'Btn').classList.toggle('active',m===mode));const clip=$('#editedClip'),line=$('#compareLine'),range=$('#compareRange');if(mode==='compare'){clip.style.display='block';line.style.display='block';range.style.display='block';$('#originalCanvas').style.display='block'}else if(mode==='edited'){clip.style.display='block';line.style.display='none';range.style.display='none';$('#originalCanvas').style.display='none'}else{clip.style.display='none';line.style.display='none';range.style.display='none';$('#originalCanvas').style.display='block'}syncCanvasLayout()}

function wire(){
 $('#newProjectBtn').onclick=$('#emptyNewProjectBtn').onclick=()=>{$('#newProjectName').value='';$('#newProjectLocation').value='';$('#projectDialog').showModal();setTimeout(()=>$('#newProjectName').focus(),50)};
 $('#createProjectConfirm').onclick=async e=>{e.preventDefault();const name=$('#newProjectName').value.trim();if(!name)return;const p=await createProject(name,$('#newProjectLocation').value.trim());$('#projectDialog').close();await openProject(p.id)};
 $('#backBtn').onclick=async()=>{await saveProject();showScreen('#projectScreen');setMobileNav('projects')};$('#projectTitle').onchange=saveProject;
 $('#heroUpload').onchange=async e=>{const p=await createProject(`Project ${new Date().toLocaleDateString()}`);await openProject(p.id);await addFiles(e.target.files);e.target.value=''};
 $('#mediaUpload').onchange=async e=>{await addFiles(e.target.files);e.target.value=''};
 $('#compareRange').oninput=e=>syncCanvasLayout();
 $('#compareBtn').onclick=()=>setView('compare');$('#editedBtn').onclick=()=>setView('edited');$('#originalBtn').onclick=()=>setView('original');
 $('#autoBtn').onclick=autoEnhance;$('#resetBtn').onclick=resetSettings;$('#exportBtn').onclick=exportCurrent;$('#applySelectedBtn').onclick=applyToSelected;
 $('#selectAllBtn').onclick=async()=>{const all=media.every(m=>m.selected);for(const m of media){m.selected=!all;await put('media',m)}renderMedia();$('#selectAllBtn').textContent=all?'Select all':'Clear all'};
 $$('.preset').forEach(b=>b.onclick=()=>setPreset(b.dataset.preset));
 $$('.edit-category').forEach(b=>b.onclick=()=>setQuickCategory(b.dataset.category));
 $('#liveSlider').oninput=e=>updateSetting(quickKey,e.target.value);
 keys.forEach(k=>{const el=$('#'+k);if(el)el.oninput=e=>updateSetting(k,e.target.value)});
 $('#saveEditBtn').onclick=saveCurrentEdit;
 $('#libraryBtn').onclick=openLibrary;$('#mobileLibraryBtn').onclick=openLibrary;$('#mobileProjectsBtn').onclick=()=>{showScreen('#projectScreen');setMobileNav('projects')};
 $$('.library-tabs [data-library-filter]').forEach(b=>b.onclick=()=>{libraryFilter=b.dataset.libraryFilter;$$('.library-tabs .segment').forEach(x=>x.classList.toggle('active',x===b));renderLibrary()});
 $('#libraryProjectFilter').onchange=e=>{libraryProject=e.target.value;renderLibrary()};
 $$('.video-tool-tab').forEach(b=>b.onclick=()=>{videoTool=b.dataset.videoTool;$$('.video-tool-tab').forEach(x=>x.classList.toggle('active',x===b));renderVideoToolPanel()});
 $('#autoMatchBtn').onclick=autoMatchClips;$('#videoExportBtn').onclick=exportVideoCurrent;
 renderQuickAdjustments();syncQuickSlider();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&currentProject)saveProject()});
}

(async function init(){await openDB();wire();await loadProjects();setMobileNav('projects');if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});})();
