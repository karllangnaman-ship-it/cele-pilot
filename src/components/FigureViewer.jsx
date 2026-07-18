import React, { useEffect, useId, useState } from 'react';
import { Expand, ImageOff, Loader2, Maximize2, Minus, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LatexText } from '@/components/LatexFormula';

export const getFigureUrl = (...urls) => urls
  .map((url) => typeof url === 'string' ? url.trim().replace(/^<|>$/g, '') : '')
  .find(Boolean) || '';
export const hasFigureUrl = (...urls) => Boolean(getFigureUrl(...urls));

// `resolvedImageUrl` is deliberately preferred. It is the URL that was already
// proven usable by the source view, so consumers must not attempt to resolve
// the original URL again when displaying the same figure elsewhere.
export default function FigureViewer({ imageUrl = '', resolvedImageUrl = '', url = '', label = 'Figure', className = '' }) {
  const normalizedUrl = getFigureUrl(resolvedImageUrl, imageUrl, url);
  const id = `figure-${useId().replace(/:/g, '')}`; const [src, setSrc] = useState(''); const [state, setState] = useState('loading'); const [open, setOpen] = useState(false); const [zoom, setZoom] = useState(1);
  // Let the browser load the supplied URL directly. This supports absolute
  // storage/blob URLs and same-origin relative URLs without requiring the
  // optional resolver API to be running in the current environment.
  useEffect(() => { setSrc(normalizedUrl); setState(normalizedUrl ? 'loading' : 'error'); setOpen(false); setZoom(1); }, [normalizedUrl]);
  if (!normalizedUrl) return null;
  const fullscreen = () => document.fullscreenElement ? document.exitFullscreen() : document.getElementById(id)?.requestFullscreen?.();
  return <><figure className={`figure-frame relative overflow-hidden rounded-[10px] border border-border/70 bg-muted/30 ${className}`}><div className="relative flex min-h-28 items-center justify-center">{state === 'loading' && <><div className="absolute inset-0 animate-pulse bg-muted/50" /><Loader2 className="relative h-5 w-5 animate-spin text-muted-foreground" /></>}{state === 'error' ? <div className="flex min-h-28 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground"><ImageOff className="h-5 w-5" /><span>Unable to load image.</span></div> : <img key={src} src={src} alt={label} loading="lazy" decoding="async" onLoad={() => setState('loaded')} onError={() => setState('error')} onClick={() => setOpen(true)} className={`figure-image cursor-zoom-in object-contain ${state === 'loading' ? 'invisible' : ''}`} />}{state === 'loaded' && <button type="button" aria-label={`Enlarge ${label}`} onClick={() => setOpen(true)} className="absolute right-2 top-2 rounded bg-background/90 p-1.5 shadow"><Maximize2 className="h-4 w-4" /></button>}</div></figure><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle><LatexText value={label} /></DialogTitle></DialogHeader><div id={id} className="relative max-h-[78vh] overflow-auto bg-muted/30"><div className="sticky top-2 z-10 flex justify-end gap-1 p-2"><button type="button" onClick={() => setZoom((v) => Math.max(.5, v - .25))} className="rounded bg-background p-2"><Minus className="h-4 w-4" /></button><button type="button" onClick={() => setZoom((v) => Math.min(3, v + .25))} className="rounded bg-background p-2"><Plus className="h-4 w-4" /></button><button type="button" onClick={fullscreen} className="rounded bg-background p-2"><Expand className="h-4 w-4" /></button></div><img src={src} alt={label} style={{ transform: `scale(${zoom})` }} className="mx-auto max-h-[75vh] w-full object-contain" /></div></DialogContent></Dialog></>;
}
