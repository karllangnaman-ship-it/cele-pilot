import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function SearchBar({ value, onChange, placeholder }) {
  return <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} className="pl-9" /></div>;
}
