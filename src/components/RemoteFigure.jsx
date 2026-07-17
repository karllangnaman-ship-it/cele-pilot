import React, { useEffect, useState } from "react";
import { Expand, Loader2, Maximize2, Minus, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LatexText } from "@/components/LatexFormula";

// The one shared figure viewer. Never replaces an image with an error placeholder:
// a remote image can still load after a transient network/CORS/cache failure.
export default function RemoteFigure({ url, label = "Figure" }) {
  const [state, setState] = useState("loading");
  const [src, setSrc] = useState(url);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    console.info("[Figure] image URL used", { url, label });
    setSrc(url);
    setState("loading");
    setOpen(false);
    setZoom(1);
  }, [url, label]);
  if (!url) return null;
  const onLoad = async (event) => {
    console.info("[Figure] image load success", { url, event });
    setState("loaded");
    try {
      const response = await fetch(url, { mode: "cors" });
      console.info("[Figure] HTTP response", {
        url,
        status: response.status,
        ok: response.ok,
        type: response.type,
      });
      if (response.ok) {
        const cache = await caches.open("cele-pilot-figures");
        await cache.put(url, response.clone());
      }
    } catch (error) {
      console.error("[Figure] HTTP response unavailable", { url, error });
    }
  };
  const onError = (event) => {
    console.error("[Figure] image error", {
      url,
      event,
      httpStatus: event?.currentTarget?.status ?? "unavailable",
      cors: "Browser image events do not expose CORS details.",
    });
    setState("error");
  };
  const fullscreen = () =>
    document.fullscreenElement
      ? document.exitFullscreen()
      : document.getElementById("remote-figure-viewer")?.requestFullscreen?.();
  if (state === "error") return null;
  return (
    <>
      <div className="figure-frame relative overflow-hidden rounded-[10px] border border-border/70 bg-muted/30">
        <div className="relative flex min-h-24 items-center justify-center">
          {state === "loading" && (
            <Loader2 className="absolute h-5 w-5 animate-spin text-muted-foreground" />
          )}
          <img
            src={src}
            alt=""
            aria-label={label}
            loading="lazy"
            decoding="async"
            onLoad={onLoad}
            onError={onError}
            onClick={() => setOpen(true)}
            className="figure-image cursor-zoom-in object-contain"
          />
          {state === "loaded" && (
            <button
              type="button"
              aria-label={`Enlarge ${label}`}
              onClick={() => setOpen(true)}
              className="absolute right-2 top-2 rounded bg-background/90 p-1.5 shadow"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle><LatexText value={label} /></DialogTitle>
          </DialogHeader>
          <div
            id="remote-figure-viewer"
            className="relative max-h-[78vh] overflow-auto bg-muted/30"
          >
            <div className="sticky top-2 z-10 flex justify-end gap-1 p-2">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))}
                className="rounded bg-background p-2 shadow"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
                className="rounded bg-background p-2 shadow"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Fullscreen"
                onClick={fullscreen}
                className="rounded bg-background p-2 shadow"
              >
                <Expand className="h-4 w-4" />
              </button>
            </div>
            <img
              src={src}
              alt=""
              aria-label={label}
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
              }}
              className="mx-auto max-h-[75vh] w-full object-contain transition-transform"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
