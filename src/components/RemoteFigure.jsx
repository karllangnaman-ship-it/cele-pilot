import React, { useEffect, useState } from 'react';
import { Loader2, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// The one shared figure viewer. Never replaces an image with an error placeholder:
// a remote image can still load after a transient network/CORS/cache failure.
export default function RemoteFigure({ url, label = 'Figure' }) {
  const [state, setState] = useState('loading');
  const [src, setSrc] = useState(url);
  const [open, setOpen] = useState(false);
  useEffect(() => { setSrc(url); setState('loading'); setOpen(false); }, [url]);
  if (!url) return null;
  const onLoad = async (event) => {
    console.info('[Figure] image load', { url, event }); setState('loaded');
    try { const response = await fetch(url, { mode: 'cors' }); if (response.ok) { const cache = await caches.open('cele-pilot-figures'); await cache.put(url, response.clone()); } } catch (error) { console.info('[Figure] cache skipped (likely CORS)', { url, error }); }
  };
  const onError = (event) => { console.error('[Figure] image error', { url, event, httpStatus: event?.currentTarget?.status ?? 'unavailable', cors: 'Browser image events do not expose CORS details.' }); setState('error'); };
  return <><div className="relative mx-auto w-full max-w-[700px] overflow-hidden rounded-lg border bg-muted/30"><div className="relative flex min-h-24 items-center justify-center">{state === 'loading' && <Loader2 className="absolute h-5 w-5 animate-spin text-muted-foreground" />}<img src={src} alt={label} loading="lazy" decoding="async" onLoad={onLoad} onError={onError} onClick={() => setOpen(true)} className="max-h-[350px] w-full cursor-zoom-in object-contain" />{state === 'loaded' && <button type="button" aria-label={`Enlarge ${label}`} onClick={() => setOpen(true)} className="absolute right-2 top-2 rounded bg-background/90 p-1.5 shadow"><Maximize2 className="h-4 w-4" /></button>}</div></div><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader><div className="max-h-[78vh] overflow-auto"><img src={src} alt={label} className="mx-auto max-h-[75vh] w-full object-contain" /></div></DialogContent></Dialog></>;
}
