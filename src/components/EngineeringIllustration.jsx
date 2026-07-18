import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import FigureViewer, { hasFigureUrl } from '@/components/FigureViewer';
import { Button } from '@/components/ui/button';

export default function EngineeringIllustration({ imageUrl, resolvedImageUrl, caption, onRegenerate, generating = false }) {
  if (!hasFigureUrl(resolvedImageUrl, imageUrl) && !generating) return null;
  return <section className="mt-3 rounded-lg border bg-muted/20 p-3"><div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Engineering Illustration</h3><Button type="button" variant="ghost" size="icon" aria-label="Regenerate illustration" onClick={onRegenerate} disabled={generating}><RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} /></Button></div>{generating ? <div className="flex h-44 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> : <><FigureViewer imageUrl={imageUrl} resolvedImageUrl={resolvedImageUrl} label="Engineering Illustration" /><p className="mt-2 text-xs text-muted-foreground">{caption}</p></>}</section>;
}
