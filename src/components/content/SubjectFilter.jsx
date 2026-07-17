import React from 'react';
import { Button } from '@/components/ui/button';

export const SUBJECT_FILTERS = ['all', 'MSTE', 'HGE', 'PSAD'];

export default function SubjectFilter({ value, onChange }) {
  return <div className="flex gap-1">{SUBJECT_FILTERS.map((subject) => <Button key={subject} variant={value === subject ? 'default' : 'outline'} size="sm" onClick={() => onChange(subject)}>{subject === 'all' ? 'All' : subject}</Button>)}</div>;
}
