import React, { useState, useEffect } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { CELE_SUBJECTS } from '@/lib/cele-subjects';

const STEPS = ['personal', 'routine', 'learning', 'subjects', 'weak_topics', 'strong_topics', 'goals', 'dates'];

export default function Survey() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState(null);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customDuration, setCustomDuration] = useState(60);
  const [form, setForm] = useState({
    name: '', nickname: '', age: '',
    wake_up_time: '06:00', bed_time: '22:00', available_hours: 6, break_duration: 15, meal_schedule: 'regular',
    learning_style: 'visual', study_preference: 'morning',
    mste_confidence: 5, hge_confidence: 5, psad_confidence: 5,
    weak_topics_mste: [], weak_topics_hge: [], weak_topics_psad: [],
    strong_topics_mste: [], strong_topics_hge: [], strong_topics_psad: [],
    target_score: 75, review_intensity: 'moderate', focus_ability: 'average', session_duration: 50,
    review_start_date: '', exam_date: '',
  });

  useEffect(() => {
    async function load() {
      const u = await firebaseApi.auth.me();
      const profiles = await firebaseApi.entities.SurveyProfile.filter({ user_id: u.id });
      if (profiles.length > 0) {
        const p = profiles[0];
        setExistingId(p.id);
        setForm(prev => ({
          ...prev,
          name: p.name || '', nickname: p.nickname || '', age: p.age || '',
          wake_up_time: p.wake_up_time || '06:00', bed_time: p.bed_time || '22:00',
          available_hours: p.available_hours || 6, break_duration: p.break_duration || 15,
          meal_schedule: p.meal_schedule || 'regular',
          learning_style: p.learning_style || 'visual', study_preference: p.study_preference || 'morning',
          mste_confidence: p.mste_confidence || 5, hge_confidence: p.hge_confidence || 5, psad_confidence: p.psad_confidence || 5,
          weak_topics_mste: p.weak_topics_mste || [], weak_topics_hge: p.weak_topics_hge || [], weak_topics_psad: p.weak_topics_psad || [],
          strong_topics_mste: p.strong_topics_mste || [], strong_topics_hge: p.strong_topics_hge || [], strong_topics_psad: p.strong_topics_psad || [],
          target_score: p.target_score || 75, review_intensity: p.review_intensity || 'moderate',
          focus_ability: p.focus_ability || 'average', session_duration: p.session_duration || 50,
          review_start_date: p.review_start_date || '', exam_date: p.exam_date || '',
        }));
        if (p.session_duration && ![25, 50, 90].includes(p.session_duration)) {
          setIsCustomDuration(true);
          setCustomDuration(p.session_duration);
        }
      }
    }
    load();
  }, []);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const toggleTopic = (key, topic) => {
    setForm(prev => {
      const arr = prev[key] || [];
      return { ...prev, [key]: arr.includes(topic) ? arr.filter(t => t !== topic) : [...arr, topic] };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const u = await firebaseApi.auth.me();
    const data = { ...form, user_id: u.id, completed: true, age: Number(form.age) || 0 };
    if (existingId) {
      await firebaseApi.entities.SurveyProfile.update(existingId, data);
    } else {
      await firebaseApi.entities.SurveyProfile.create(data);
    }
    setSaving(false);
    navigate('/schedule');
  };

  const canNext = () => {
    if (step === 0) return form.name;
    if (step === 7) return form.review_start_date && form.exam_date;
    if (step === 1 && isCustomDuration) return customDuration >= 15 && customDuration <= 240;
    return true;
  };

  const renderTopics = (topicKey, label) => {
    const subjectKey = topicKey.replace('weak_', 'weak_').replace('strong_', 'strong_');
    return (
      <div className="glass-card p-4">
        <h3 className="font-semibold mb-3">{label}</h3>
        <div className="space-y-3">
          {Object.entries(CELE_SUBJECTS[label]).map(([category, topics]) => (
            <div key={category}>
              <p className="text-xs font-medium text-muted-foreground mb-2">{category}</p>
              <div className="flex flex-wrap gap-2">
                {topics.map(topic => {
                  const selected = (form[topicKey] || []).includes(topic);
                  return (
                    <button
                      key={topic}
                      onClick={() => toggleTopic(topicKey, topic)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >{topic}</button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (STEPS[step]) {
      case 'personal':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Personal Information</h2>
            <p className="text-sm text-muted-foreground">Tell us about yourself</p>
            <div className="space-y-3">
              <div><Label>Full Name *</Label><Input value={form.name} onChange={e => update('name', e.target.value)} placeholder="Juan Dela Cruz" /></div>
              <div><Label>Nickname</Label><Input value={form.nickname} onChange={e => update('nickname', e.target.value)} placeholder="Juan" /></div>
              <div><Label>Age</Label><Input type="number" value={form.age} onChange={e => update('age', e.target.value)} placeholder="22" /></div>
            </div>
          </div>
        );
      case 'routine':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Daily Routine</h2>
            <p className="text-sm text-muted-foreground">Help us understand your schedule</p>
            <div className="space-y-3">
              <div><Label>Wake-up Time</Label><Input type="time" value={form.wake_up_time} onChange={e => update('wake_up_time', e.target.value)} /></div>
              <div><Label>Bedtime</Label><Input type="time" value={form.bed_time} onChange={e => update('bed_time', e.target.value)} /></div>
              <div>
                <Label>Available Study Hours: {form.available_hours}h</Label>
                <Slider value={[form.available_hours]} onValueChange={([v]) => update('available_hours', v)} min={1} max={16} step={1} className="mt-2" />
              </div>
              <div>
                <Label>Break Duration: {form.break_duration} min</Label>
                <Slider value={[form.break_duration]} onValueChange={([v]) => update('break_duration', v)} min={5} max={30} step={5} className="mt-2" />
              </div>
              <div>
                <Label>Preferred Session Duration</Label>
                <RadioGroup
                  value={isCustomDuration ? 'custom' : String(form.session_duration)}
                  onValueChange={v => {
                    if (v === 'custom') {
                      setIsCustomDuration(true);
                      update('session_duration', customDuration);
                    } else {
                      setIsCustomDuration(false);
                      update('session_duration', Number(v));
                    }
                  }}
                  className="mt-2"
                >
                  {[25, 50, 90].map(d => (
                    <div key={d} className="flex items-center gap-2 glass-card p-3">
                      <RadioGroupItem value={String(d)} id={`dur-${d}`} />
                      <Label htmlFor={`dur-${d}`} className="flex-1 cursor-pointer">{d} minutes</Label>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 glass-card p-3">
                    <RadioGroupItem value="custom" id="dur-custom" />
                    <Label htmlFor="dur-custom" className="flex-1 cursor-pointer">Custom</Label>
                  </div>
                </RadioGroup>
                {isCustomDuration && (
                  <div className="mt-3 glass-card p-3">
                    <Label>Custom Duration (15–240 minutes)</Label>
                    <div className="flex items-center gap-3 mt-2">
                      <Input
                        type="number"
                        min={15}
                        max={240}
                        value={customDuration}
                        onChange={e => {
                          const val = Number(e.target.value);
                          setCustomDuration(val);
                          if (val >= 15 && val <= 240) update('session_duration', val);
                        }}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">minutes</span>
                      {customDuration < 15 && <span className="text-xs text-destructive">Min 15</span>}
                      {customDuration > 240 && <span className="text-xs text-destructive">Max 240</span>}
                    </div>
                    <Slider
                      value={[customDuration]}
                      onValueChange={([v]) => { setCustomDuration(v); update('session_duration', v); }}
                      min={15} max={240} step={5} className="mt-3"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case 'learning':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Learning Style</h2>
            <p className="text-sm text-muted-foreground">How do you learn best?</p>
            <div className="space-y-4">
              <div>
                <Label>Learning Style</Label>
                <RadioGroup value={form.learning_style} onValueChange={v => update('learning_style', v)} className="mt-2">
                  {[
                    { value: 'visual', label: '👁️ Visual — diagrams, charts, videos' },
                    { value: 'reading_writing', label: '📖 Reading/Writing — notes, textbooks' },
                    { value: 'auditory', label: '🎧 Auditory — lectures, discussions' },
                    { value: 'kinesthetic', label: '✋ Kinesthetic — hands-on, practice' },
                  ].map(o => (
                    <div key={o.value} className="flex items-center gap-2 glass-card p-3">
                      <RadioGroupItem value={o.value} id={`ls-${o.value}`} />
                      <Label htmlFor={`ls-${o.value}`} className="flex-1 cursor-pointer">{o.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <Label>Study Preference</Label>
                <RadioGroup value={form.study_preference} onValueChange={v => update('study_preference', v)} className="mt-2">
                  {[
                    { value: 'morning', label: '🌅 Morning Learner' },
                    { value: 'afternoon', label: '☀️ Afternoon Learner' },
                    { value: 'evening', label: '🌆 Evening Learner' },
                    { value: 'night', label: '🌙 Night Learner' },
                  ].map(o => (
                    <div key={o.value} className="flex items-center gap-2 glass-card p-3">
                      <RadioGroupItem value={o.value} id={`sp-${o.value}`} />
                      <Label htmlFor={`sp-${o.value}`} className="flex-1 cursor-pointer">{o.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div>
                <Label>Focus Ability</Label>
                <RadioGroup value={form.focus_ability} onValueChange={v => update('focus_ability', v)} className="mt-2">
                  {[
                    { value: 'easily_distracted', label: 'Easily Distracted' },
                    { value: 'average', label: 'Average Focus' },
                    { value: 'highly_focused', label: 'Highly Focused' },
                  ].map(o => (
                    <div key={o.value} className="flex items-center gap-2 glass-card p-3">
                      <RadioGroupItem value={o.value} id={`fa-${o.value}`} />
                      <Label htmlFor={`fa-${o.value}`} className="flex-1 cursor-pointer">{o.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          </div>
        );
      case 'subjects':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Subject Confidence</h2>
            <p className="text-sm text-muted-foreground">Rate your confidence (1 = weak, 10 = strong)</p>
            {[
              { key: 'mste_confidence', label: 'MSTE — Math, Surveying & Transportation', color: 'from-blue-500 to-cyan-500' },
              { key: 'hge_confidence', label: 'HGE — Hydraulics & Geotechnical', color: 'from-green-500 to-emerald-500' },
              { key: 'psad_confidence', label: 'PSAD — Professional Subjects, Assessment & Development', color: 'from-purple-500 to-pink-500' },
            ].map(subj => (
              <div key={subj.key} className="glass-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm">{subj.label}</span>
                  <span className={`text-2xl font-bold bg-gradient-to-r ${subj.color} bg-clip-text text-transparent`}>{form[subj.key]}</span>
                </div>
                <Slider value={[form[subj.key]]} onValueChange={([v]) => update(subj.key, v)} min={1} max={10} step={1} />
              </div>
            ))}
          </div>
        );
      case 'weak_topics':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Weak Topics</h2>
            <p className="text-sm text-muted-foreground">Select topics you need to focus on most</p>
            {renderTopics('weak_topics_mste', 'MSTE')}
            {renderTopics('weak_topics_hge', 'HGE')}
            {renderTopics('weak_topics_psad', 'PSAD')}
          </div>
        );
      case 'strong_topics':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Strong Topics</h2>
            <p className="text-sm text-muted-foreground">Select topics you're already confident with</p>
            {renderTopics('strong_topics_mste', 'MSTE')}
            {renderTopics('strong_topics_hge', 'HGE')}
            {renderTopics('strong_topics_psad', 'PSAD')}
          </div>
        );
      case 'goals':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Goals & Intensity</h2>
            <p className="text-sm text-muted-foreground">Set your targets</p>
            <div className="glass-card p-4">
              <Label>Target Passing Score: {form.target_score}%</Label>
              <Slider value={[form.target_score]} onValueChange={([v]) => update('target_score', v)} min={50} max={100} step={1} className="mt-2" />
            </div>
            <div>
              <Label>Review Intensity</Label>
              <RadioGroup value={form.review_intensity} onValueChange={v => update('review_intensity', v)} className="mt-2">
                {[
                  { value: 'light', label: '🌱 Light — Relaxed pace, longer timeline' },
                  { value: 'moderate', label: '⚡ Moderate — Balanced workload' },
                  { value: 'intensive', label: '🔥 Intensive — Maximum effort' },
                ].map(o => (
                  <div key={o.value} className="flex items-center gap-2 glass-card p-3">
                    <RadioGroupItem value={o.value} id={`ri-${o.value}`} />
                    <Label htmlFor={`ri-${o.value}`} className="flex-1 cursor-pointer">{o.label}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
        );
      case 'dates':
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Review Timeline</h2>
            <p className="text-sm text-muted-foreground">When does your review start and when is the exam?</p>
            <div className="space-y-3">
              <div className="glass-card p-4">
                <Label>Review Start Date *</Label>
                <Input type="date" value={form.review_start_date} onChange={e => update('review_start_date', e.target.value)} className="mt-2" />
              </div>
              <div className="glass-card p-4">
                <Label>CELE Exam Date *</Label>
                <Input type="date" value={form.exam_date} onChange={e => update('exam_date', e.target.value)} className="mt-2" />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-1 mb-6">
        {STEPS.map((s, i) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground mb-4">Step {step + 1} of {STEPS.length}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-3 mt-8">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={() => setStep(s => s + 1)} disabled={!canNext()} className="flex-1">
            Next <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={!canNext() || saving} className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700">
            {saving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Generate My Plan</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}