import React, { useState } from 'react';
import { CELE_TEMPLATES, downloadTemplate } from '@/lib/contentTemplates';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Eye, FileText } from 'lucide-react';

export default function TemplateGuide({ type }) {
  const [open, setOpen] = useState(false); const template = CELE_TEMPLATES[type];
  return <><div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3"><div className="flex gap-3"><FileText className="w-5 h-5 text-primary shrink-0"/><p className="text-sm">For best extraction accuracy, please follow the official CELE Pilot template. If your file has a different format, the AI will automatically try to map it to the correct template, but some fields may require manual confirmation.</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setOpen(true)}><Eye className="w-4 h-4 mr-1"/>View Official Template</Button><Button size="sm" onClick={() => downloadTemplate(type, 'csv')}><Download className="w-4 h-4 mr-1"/>Download Template</Button></div></div><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>{template.title}</DialogTitle></DialogHeader><div className="max-h-[55vh] overflow-y-auto rounded-lg bg-muted/50 p-4 space-y-2">{template.fields.map(field => <p key={field} className="text-sm font-medium">{field}:</p>)}</div><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => downloadTemplate(type, 'xlsx')}>Excel (.xlsx)</Button><Button size="sm" variant="outline" onClick={() => downloadTemplate(type, 'csv')}>CSV</Button><Button size="sm" variant="outline" onClick={() => downloadTemplate(type, 'docx')}>Word (.docx)</Button><Button size="sm" variant="outline" onClick={() => downloadTemplate(type, 'pdf')}>PDF reference</Button></div></DialogContent></Dialog></>;
}
