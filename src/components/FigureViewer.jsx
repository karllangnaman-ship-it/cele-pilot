import React, { useEffect, useId, useState } from "react";
import { Expand, ImageOff, Loader2, Maximize2, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LatexText } from "@/components/LatexFormula";

const isHttpUrl = (value) => {
  try { const parsed = new URL(value); return parsed.protocol === "http:" || parsed.protocol === "https:"; } catch { return false; }
};

// HTML pages (including ImgBB pages) sometimes expose their image through Open Graph.
// This is deliberately provider-agnostic and only runs when the host permits CORS.
const discoverImageUrl = async (url) => {
  try {
    const response = await fetch(url, { method: "GET", mode: "cors", signal: AbortSignal.timeout(5000) });
    const type = response.headers.get("content-type") || "";
    if (type.startsWith("image/")) return url;
    if (!type.includes("text/html")) return null;
    const html = await response.text();
    const match = html.match(/<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|twitter:image)["']/i);
    return match ? new URL(match[1], url).href : null;
  } catch { return null; }
};

/** A shared, host-agnostic remote image viewer. */
export default function FigureViewer({ url, label = "Figure", className = "" }) {
  const viewerId = `figure-viewer-${useId().replace(/:/g, "")}`;
  const [state, setState] = useState("loading");
  const [src, setSrc] = useState("");
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let active = true;
    setOpen(false); setZoom(1);
    if (!isHttpUrl(url)) { setSrc(""); setState("error"); return () => { active = false; }; }
    setSrc(url); setState("loading");
    // Direct images render immediately. For page URLs, try generic metadata discovery
    // in the background without blocking the browser's normal image request.
    discoverImageUrl(url).then((discovered) => {
      if (active && discovered && discovered !== url) { setSrc(discovered); setState("loading"); }
    });
    return () => { active = false; };
  }, [url]);

  const fullscreen = () => document.fullscreenElement
    ? document.exitFullscreen()
    : document.getElementById(viewerId)?.requestFullscreen?.();
  if (!url) return null;
  return <>
    <figure className={`figure-frame relative overflow-hidden rounded-[10px] border border-border/70 bg-muted/30 ${className}`}>
      <div className="relative flex min-h-28 items-center justify-center">
        {state === "loading" && <><div className="absolute inset-0 animate-pulse bg-muted/50" /><Loader2 className="relative h-5 w-5 animate-spin text-muted-foreground" /></>}
        {state === "error" ? <div className="flex min-h-28 flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground"><ImageOff className="h-5 w-5" /><span>This URL does not point to a supported image.</span></div> : <img src={src} alt={label} loading="lazy" decoding="async" onLoad={() => setState("loaded")} onError={() => setState("error")} onClick={() => setOpen(true)} className={`figure-image cursor-zoom-in object-contain ${state === "loading" ? "invisible" : ""}`} />}
        {state === "loaded" && <button type="button" aria-label={`Enlarge ${label}`} onClick={() => setOpen(true)} className="absolute right-2 top-2 rounded bg-background/90 p-1.5 shadow"><Maximize2 className="h-4 w-4" /></button>}
      </div>
    </figure>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-5xl"><DialogHeader><DialogTitle><LatexText value={label} /></DialogTitle></DialogHeader><div id={viewerId} className="relative max-h-[78vh] overflow-auto bg-muted/30"><div className="sticky top-2 z-10 flex justify-end gap-1 p-2"><button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(.5, value - .25))} className="rounded bg-background p-2 shadow"><Minus className="h-4 w-4" /></button><button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(3, value + .25))} className="rounded bg-background p-2 shadow"><Plus className="h-4 w-4" /></button><button type="button" aria-label="Fullscreen" onClick={fullscreen} className="rounded bg-background p-2 shadow"><Expand className="h-4 w-4" /></button></div><img src={src} alt={label} style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }} className="mx-auto max-h-[75vh] w-full object-contain transition-transform" /></div></DialogContent></Dialog>
  </>;
}
