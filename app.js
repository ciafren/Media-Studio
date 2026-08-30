const $ = (s)=>document.querySelector(s);
const $$ = (s)=>[...document.querySelectorAll(s)];
const DB_NAME='MediaStudioDB', DB_VERSION=1;
let db, projects=[], currentProject=null, media=[], currentMedia=null, currentBitmap=null;
let renderTimer=null;

const defaults={preset:'auto',strength:70,exposure:0,contrast:0,highlights:0,shadows:0,temperature:0,tint:0,saturation:0,vibrance:0,clarity:0,sharpness:0,vignette:0};
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
async function openProject(id){currentProject=projects.find(p=>p.id===id)||null;if(!currentProject)return;showScreen('#studioScreen');$('#projectTitle').value=currentProject.name;media=(await getProjectMedia(id)).sort((a,b)=>b.createdAt-a.createdAt);renderMedia();updateProjectMeta();if(media[0])selectMedia(media[0].id);else clearViewer()}
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
   const m={id:uid(),projectId:currentProject.id,name:file.name,type,mime:file.type,blob:file,thumb,createdAt:Date.now(),selected:true,settings:{...defaults}};
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
async function selectMedia(id){currentMedia=media.find(m=>m.id===id);renderMedia();if(!currentMedia)return;if(currentMedia.type==='image')await showImage(currentMedia);else showVideo(currentMedia);loadSettingsUI(currentMedia.settings||defaults)}
function clearViewer(){currentMedia=null;currentBitmap=null;$('#imageViewer').classList.add('hidden');$('#videoViewer').classList.add('hidden');$('#viewerEmpty').classList.remove('hidden');$('#exportBtn').disabled=true}
async function showImage(m){$('#viewerEmpty').classList.add('hidden');$('#videoViewer').classList.add('hidden');$('#imageViewer').classList.remove('hidden');$('#exportBtn').disabled=false;currentBitmap=await createImageBitmap(m.blob);drawOriginalPreview();scheduleRender()}
function showVideo(m){$('#viewerEmpty').classList.add('hidden');$('#imageViewer').classList.add('hidden');$('#videoViewer').classList.remove('hidden');$('#exportBtn').disabled=true;const v=$('#videoPlayer');if(v._url)URL.revokeObjectURL(v._url);v._url=URL.createObjectURL(m.blob);v.src=v._url;applyVideoFilter();}
function previewSize(w,h){const maxW=1400,maxH=1100,s=Math.min(1,maxW/w,maxH/h);return [Math.max(1,Math.round(w*s)),Math.max(1,Math.round(h*s))]}
function drawOriginalPreview(){if(!currentBitmap)return;const [w,h]=previewSize(currentBitmap.width,currentBitmap.height);for(const id of ['#originalCanvas','#editedCanvas']){const c=$(id);c.width=w;c.height=h;c.style.aspectRatio=`${w}/${h}`}const c=$('#originalCanvas');c.getContext('2d').drawImage(currentBitmap,0,0,w,h);syncCanvasLayout()}
function syncCanvasLayout(){requestAnimationFrame(()=>{const stage=$('#imageViewer'),o=$('#originalCanvas'),e=$('#editedCanvas');if(!stage||stage.classList.contains('hidden')||!o.width||!o.height)return;const ratio=o.width/o.height;const pad=12,sw=Math.max(1,stage.clientWidth-pad*2),sh=Math.max(1,stage.clientHeight-pad*2);let w=sw,h=w/ratio;if(h>sh){h=sh;w=h*ratio}const left=(stage.clientWidth-w)/2,top=(stage.clientHeight-h)/2;o.style.width=w+'px';o.style.height=h+'px';o.style.left=left+'px';o.style.top=top+'px';e.style.width=w+'px';e.style.height=h+'px';e.style.left='0px';e.style.top='0px';const clip=$('#editedClip'),pct=Number($('#compareRange').value)/100;clip.style.left=left+'px';clip.style.top=top+'px';clip.style.height=h+'px';clip.style.width=(w*pct)+'px';const line=$('#compareLine');line.style.left=(left+w*pct)+'px';line.style.top=top+'px';line.style.height=h+'px'})}
window.addEventListener('resize',syncCanvasLayout);

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
function applyVideoFilter(){if(!currentMedia||currentMedia.type!=='video')return;const s=effectiveSettings(currentMedia.settings||defaults);const brightness=1+(s.exposure||0)/120;const contrast=1+(s.contrast||0)/100;const saturation=1+((s.saturation||0)+(s.vibrance||0)*.5)/100;const sepia=Math.max(0,s.temperature||0)/500;$('#videoPlayer').style.filter=`brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) sepia(${sepia})`}

function loadSettingsUI(s){s={...defaults,...s};keys.forEach(k=>{const el=$('#'+k);if(el)el.value=s[k]??defaults[k];const out=$('#'+k+'Out');if(out)out.value=k==='strength'?`${s[k]}%`:(s[k]>0?`+${s[k]}`:`${s[k]}`)});$$('.preset').forEach(b=>b.classList.toggle('active',b.dataset.preset===s.preset));renderQuickAdjustments();syncQuickSlider()}
async function updateSetting(key,val){if(!currentMedia)return;currentMedia.settings={...defaults,...currentMedia.settings,[key]:Number(val)};const out=$('#'+key+'Out');if(out)out.value=key==='strength'?`${val}%`:(Number(val)>0?`+${val}`:`${val}`);if(key===quickKey)syncQuickSlider();scheduleRender();put('media',currentMedia).catch(()=>{})}
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

async function setPreset(name){if(!currentMedia)return;currentMedia.settings={...defaults,...currentMedia.settings,preset:name};await put('media',currentMedia);$$('.preset').forEach(b=>b.classList.toggle('active',b.dataset.preset===name));renderMedia();scheduleRender()}
async function resetSettings(){if(!currentMedia)return;currentMedia.settings={...defaults};await put('media',currentMedia);loadSettingsUI(currentMedia.settings);renderMedia();scheduleRender();toast('Edits reset')}

function analyzeImage(canvas){const c=document.createElement('canvas');c.width=100;c.height=Math.max(40,Math.round(100*canvas.height/canvas.width));const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height).data;let lum=0,sat=0,blue=0,green=0;for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];lum+=(r+g+b)/3;sat+=Math.max(r,g,b)-Math.min(r,g,b);blue+=b-r;green+=g-r}const n=d.length/4;return{lum:lum/n,sat:sat/n,blue:blue/n,green:green/n}}
async function autoEnhance(){if(!currentMedia)return;if(currentMedia.type==='video'){setPreset('cinematic');toast('Cinematic preview applied');return}const a=analyzeImage($('#originalCanvas'));let preset='auto';if(a.green>12||a.blue>18)preset='exterior';else if(a.lum<95)preset='bright';else if(a.sat<28)preset='stone';currentMedia.settings={...defaults,preset,strength:72};if(a.lum<110)currentMedia.settings.exposure=8;if(a.lum>180)currentMedia.settings.highlights=-15;await put('media',currentMedia);loadSettingsUI(currentMedia.settings);renderMedia();scheduleRender();toast(`Auto Enhance: ${preset.replace(/\b\w/g,c=>c.toUpperCase())}`)}

async function exportCurrent(){if(!currentMedia||currentMedia.type!=='image')return;toast('Rendering full-resolution export…');await new Promise(r=>setTimeout(r,30));const bmp=await createImageBitmap(currentMedia.blob);const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;renderToCanvas(bmp,c,currentMedia.settings||defaults);c.toBlob(blob=>{const a=document.createElement('a');const base=currentMedia.name.replace(/\.[^.]+$/,'');a.download=`${base}_MediaStudio.jpg`;a.href=URL.createObjectURL(blob);a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000);toast('Full-resolution JPG exported')},'image/jpeg',.94)}
async function applyToSelected(){if(!currentMedia)return;const selected=media.filter(m=>m.selected&&m.type==='image');if(!selected.length){toast('Select at least one photo');return}for(const m of selected){m.settings={...currentMedia.settings};await put('media',m)}renderMedia();toast(`Applied to ${selected.length} selected photo${selected.length===1?'':'s'}`)}

let viewMode='compare';
function setView(mode){viewMode=mode;['compare','edited','original'].forEach(m=>$('#'+m+'Btn').classList.toggle('active',m===mode));const clip=$('#editedClip'),line=$('#compareLine'),range=$('#compareRange');if(mode==='compare'){clip.style.display='block';line.style.display='block';range.style.display='block';$('#originalCanvas').style.display='block'}else if(mode==='edited'){clip.style.display='block';line.style.display='none';range.style.display='none';$('#originalCanvas').style.display='none'}else{clip.style.display='none';line.style.display='none';range.style.display='none';$('#originalCanvas').style.display='block'}syncCanvasLayout();if(mode==='edited')requestAnimationFrame(()=>{const stage=$('#imageViewer'),o=$('#originalCanvas'),clip=$('#editedClip');const w=parseFloat(o.style.width)||0;clip.style.width=w+'px'})}

function wire(){
 $('#newProjectBtn').onclick=$('#emptyNewProjectBtn').onclick=()=>{$('#newProjectName').value='';$('#newProjectLocation').value='';$('#projectDialog').showModal();setTimeout(()=>$('#newProjectName').focus(),50)};
 $('#createProjectConfirm').onclick=async e=>{e.preventDefault();const name=$('#newProjectName').value.trim();if(!name)return;const p=await createProject(name,$('#newProjectLocation').value.trim());$('#projectDialog').close();await openProject(p.id)};
 $('#backBtn').onclick=async()=>{await saveProject();showScreen('#projectScreen')};$('#projectTitle').onchange=saveProject;
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
 renderQuickAdjustments();syncQuickSlider();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&currentProject)saveProject()});
}

(async function init(){await openDB();wire();await loadProjects();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});})();
