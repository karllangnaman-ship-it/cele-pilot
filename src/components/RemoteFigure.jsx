import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Images stay remote. Cache Storage is only a best-effort local browser cache
// for offline viewing; it never sends the image to our server or Firebase.
export default function RemoteFigure({ url, label = 'Figure' }) {
  const [state, setState] = useState('loading'); const [src, setSrc] = useState(url); const [open, setOpen] = useState(false);
  useEffect(() => { let active = true; let objectUrl = null; setState('loading'); setSrc(url);
    const loadCached = async () => { try { const cache = await caches.open('cele-pilot-figures'); const cached = await cache.match(url); if (cached && !navigator.onLine) { objectUrl = URL.createObjectURL(await cached.blob()); if (active) setSrc(objectUrl); } } catch { /* Cache Storage is optional. */ } };
    loadCached(); return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  const cacheImage = async () => { try { const response = await fetch(url, { mode: 'cors' }); if (response.ok) { const cache = await caches.open('cele-pilot-figures'); await cache.put(url, response.clone()); } } catch { /* Remote hosts without CORS still render normally but cannot be cached. */ } };
  if (!url) return null;
  return <><div className="relative rounded-lg border bg-muted/30 overflow-hidden"><div className="min-h-24 flex items-center justify-center">{state === 'loading' && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}<img src={src} alt={label} loading="lazy" onLoad={() => { setState('loaded'); cacheImage(); }} onError={() => setState('error')} className={`max-h-96 w-full object-contain ${state === 'loaded' ? '' : 'hidden'}`} style={{ touchAction: 'pinch-zoom' }} />{state === 'error' && <div className="text-center text-sm text-muted-foreground p-5"><AlertTriangle className="w-5 h-5 mx-auto mb-1" />Figure unavailable</div>}</div>{state === 'loaded' && <button type="button" aria-label={`Enlarge ${label}`} onClick={() => setOpen(true)} className="absolute right-2 top-2 rounded bg-background/90 p-1.5 shadow"><Maximize2 className="w-4 h-4" /></button>}</div><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader><img src={src} alt={label} className="max-h-[75vh] w-full object-contain" style={{ touchAction: 'pinch-zoom' }} /></DialogContent></Dialog></>;
}
