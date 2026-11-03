'use client';
import {useState} from 'react';
/** User-triggered, one-page-at-a-time navigation for bounded API lists. */
export default function PageMore({items,loadPage,onPage,limit=20,label='Load more'}) {
 const [loading,setLoading]=useState(false);const [done,setDone]=useState(false);const [error,setError]=useState('');
 if(done || items.length<limit)return null;
 return <div style={{padding:'12px'}}>{error&&<p role="alert">{error}</p>}<button disabled={loading} onClick={async()=>{if(loading)return;setLoading(true);setError('');try{const rows=await loadPage(limit,items.length);onPage(rows);setDone(rows.length<limit);}catch(e){setError(e.message||'Could not load the next page.');}finally{setLoading(false);}}}>{loading?'Loading…':label}</button></div>;
}
