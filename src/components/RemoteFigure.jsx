import React, { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const isValidImageUrl = (value) => /^https?:\/\/\S+$/i.test(String(value || '').trim());

export default function RemoteFigure({ url, label = 'Figure' }) {
  const imageUrl = String(url || '').trim();
  const validUrl = isValidImageUrl(imageUrl);
  const [state, setState] = useState(validUrl ? 'loading' : 'invalid');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    if (!validUrl) { setState('invalid'); return undefined; }
    console.info('[Question Figure] Image URL:', imageUrl);
    console.info('[Question Figure] Loading image...');
    setState('loading');
    const timeout = window.setTimeout(() => {
      setState((current) => {
        if (current === 'loading') {
          console.warn('[Question Figure] Image failed. Timed out after 8 seconds.', { url: imageUrl });
          return 'failed';
        }
        return current;
      });
    }, 8000);
    return () => window.clearTimeout(timeout);
  }, [imageUrl, validUrl]);

  const loaded = () => {
    console.info('[Question Figure] Image loaded successfully.', { url: imageUrl });
    setState((current) => current === 'loading' ? 'loaded' : current);
  };
  const failed = (event) => {
    // Browsers do not expose an HTTP status for <img> failures. The event is
    // still logged so broken URLs/CORS failures are visible during debugging.
    console.error('[Question Figure] Image failed.', { url: imageUrl, httpStatus: event?.target?.status ?? 'unavailable' });
    setState('failed');
  };
  const openOriginal = () => window.open(imageUrl, '_blank', 'noopener,noreferrer');

  if (!validUrl) return <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No valid figure URL is available.</div>;

  return <><div className="relative rounded-lg border bg-muted/30 overflow-hidden"><div className="min-h-24 flex items-center justify-center">{state === 'loading' && <Loader2 className="absolute w-5 h-5 animate-spin text-muted-foreground" />}<img src={imageUrl} alt={label} loading="eager" onLoad={loaded} onError={failed} className={state === 'loaded' ? 'max-h-96 w-full object-contain' : 'hidden'} style={{ touchAction: 'pinch-zoom' }} />{(state === 'failed' || state === 'invalid') && <div className="p-5 text-center text-sm text-muted-foreground"><AlertTriangle className="w-5 h-5 mx-auto mb-1" /><p>{state === 'failed' ? 'Unable to load image.' : 'Unable to load figure.'}</p><p className="mt-2 break-all text-xs">{imageUrl}</p><Button type="button" variant="outline" size="sm" className="mt-3" onClick={openOriginal}><ExternalLink className="w-3.5 h-3.5 mr-1" /> Open Image</Button></div>}</div>{state === 'loaded' && <button type="button" aria-label={`Enlarge ${label}`} onClick={() => setOpen(true)} className="absolute right-2 top-2 rounded bg-background/90 p-1.5 shadow"><Maximize2 className="w-4 h-4" /></button>}</div><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader><div className="overflow-auto"><img src={imageUrl} alt={label} className="max-h-[75vh] w-full object-contain" style={{ touchAction: 'pinch-zoom' }} /></div></DialogContent></Dialog></>;
}
