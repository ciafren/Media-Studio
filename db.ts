import type { Asset } from './types';
const DB='media-studio-db'; const STORE='assets';
function openDB():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function putAsset(a:Asset){const db=await openDB();await new Promise<void>((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({...a,url:''});tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error);});db.close();}
export async function getAsset(id:string):Promise<Asset|undefined>{const db=await openDB();const raw=await new Promise<any>((res,rej)=>{const r=db.transaction(STORE).objectStore(STORE).get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});db.close();if(!raw)return;return {...raw,url:URL.createObjectURL(raw.blob)};}
