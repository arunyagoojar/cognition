import { resolveMediaUrl } from '../media.js';
const MAX_BYTES=5*1024*1024;
export async function loadWritingVisual(task,provider) {
 if(provider!=='gemini' || !task?.image?.file || task.table?.rows?.length)return null;
 try {
  const url=new URL(task.image.file), approved=new URL(resolveMediaUrl('/')).origin;
  if(url.protocol!=='https:' || url.origin!==approved)return null;
  const response=await fetch(url,{signal:AbortSignal.timeout(12000),redirect:'error'});
  const mimeType=response.headers.get('content-type')?.split(';')[0];
  if(!response.ok || !['image/png','image/jpeg','image/webp'].includes(mimeType) || Number(response.headers.get('content-length'))>MAX_BYTES)return null;
  const reader=response.body?.getReader();if(!reader)return null;
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES){await reader.cancel();return null;}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return {inlineData:{mimeType,data:btoa(binary)}};
 }catch{return null;}
}
