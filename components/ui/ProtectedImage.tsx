'use client';
import {useEffect,useState, type ImgHTMLAttributes} from 'react';
import {apiFetch,getCurrentInstance,resolveMediaUrl} from '@/lib/api';

/** Bearer credentials only go to selected API media, never an external image host. */
export default function ProtectedImage({src,alt='',onError,...props}: Omit<ImgHTMLAttributes<HTMLImageElement>,'src'> & {src?:string}) {
 const [blobUrl,setBlobUrl]=useState<string | null>(null);
 const [failed,setFailed]=useState(false);
 const imageSrc=src && /^(?:\/?api\/v1\/|\/uploads\/|\/media\/)/.test(src) ? resolveMediaUrl(src) : src;
 let protectedMedia=false;
 try {const url=new URL(imageSrc || '',typeof location==='undefined'?'http://localhost':location.href);protectedMedia=url.origin===new URL(getCurrentInstance().url).origin && (/\/api\/v1\/media\//.test(url.pathname)||/^\/api\/v1\/stories\/[^/]+\/media$/.test(url.pathname)||/^\/uploads\/(posts|stories)\//.test(url.pathname));}catch{}
 useEffect(()=>{
  setBlobUrl(null);setFailed(false);
  if(!protectedMedia || !imageSrc)return;
  const controller=new AbortController();let objectUrl:string | null=null;
  const release=()=>{controller.abort();if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}setBlobUrl(null);};
  window.addEventListener('splitter:logout',release);
  const token=localStorage.getItem('jwt_token');
  apiFetch(imageSrc,{signal:controller.signal,headers:token?{Authorization:`Bearer ${token}`}:{}}).then(async response=>{
   if(!response.ok)throw new Error('Image unavailable');
   const blob=await response.blob();if(controller.signal.aborted)return;
   objectUrl=URL.createObjectURL(blob);setBlobUrl(objectUrl);
  }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
  return ()=>{window.removeEventListener('splitter:logout',release);release();};
 },[imageSrc,protectedMedia]);
 if(failed || (protectedMedia&&!blobUrl))return <span role="img" aria-label={alt || 'Image unavailable'} className={props.className} style={props.style}>{failed?'Image unavailable':'Loading image…'}</span>;
 return <img {...props} src={protectedMedia?(blobUrl || undefined):imageSrc} alt={alt} onError={event=>{if(onError)onError(event);else setFailed(true);}}/>;
}
