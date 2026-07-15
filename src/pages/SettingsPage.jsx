import React, { useState, useEffect } from 'react';
import { firebaseApi } from '@/api/firebaseClient';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useTheme } from '@/components/ThemeProvider';
import { motion } from 'framer-motion';
import { Moon, Sun, Wifi, Bell, Volume2, Vibrate, Download, Upload, LogOut, Shield, User, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';

export default function SettingsPage() {
  const { darkMode, setDarkMode } = useTheme();
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backing, setBacking] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      const u = await firebaseApi.auth.me();
      setUser(u);
      const items = await firebaseApi.entities.UserSettings.filter({ user_id: u.id });
      if (items.length > 0) {
        setSettings(items[0]);
        setDarkMode(items[0].dark_mode !== false);
      } else {
        const s = await firebaseApi.entities.UserSettings.create({ user_id: u.id, dark_mode: true });
        setSettings(s);
      }
      setLoading(false);
    }
    load();
  }, []);

  const updateSetting = async (key, value) => {
    if (!settings) return;
    const updated = await firebaseApi.entities.UserSettings.update(settings.id, { [key]: value });
    setSettings(updated);
    if (key === 'dark_mode') setDarkMode(value);
  };

  const handleBackup = async () => {
    setBacking(true);
    const [profiles, tasks, notes, cards, files, achievements, timer, history] = await Promise.all([
      firebaseApi.entities.SurveyProfile.filter({ user_id: user.id }),
      firebaseApi.entities.StudyTask.filter({ user_id: user.id }),
      firebaseApi.entities.StudyNote.filter({ user_id: user.id }),
      firebaseApi.entities.Flashcard.filter({ user_id: user.id }),
      firebaseApi.entities.UserFile.filter({ user_id: user.id }),
      firebaseApi.entities.Achievement.filter({ user_id: user.id }),
      firebaseApi.entities.TimerState.filter({ user_id: user.id }),
      firebaseApi.entities.TimerHistory.filter({ user_id: user.id }),
    ]);

    const backup = {
      version: 1,
      date: new Date().toISOString(),
      data: { profiles, tasks, notes, cards, files, achievements, timer, history, settings: [settings] },
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cele-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBacking(false);
    toast({ title: 'Backup downloaded!' });
  };

  const handleRestore = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const backup = JSON.parse(text);

    if (!backup.data) {
      toast({ title: 'Invalid backup file', variant: 'destructive' });
      return;
    }

    const entityMap = {
      profiles: firebaseApi.entities.SurveyProfile,
      tasks: firebaseApi.entities.StudyTask,
      notes: firebaseApi.entities.StudyNote,
      cards: firebaseApi.entities.Flashcard,
      achievements: firebaseApi.entities.Achievement,
      history: firebaseApi.entities.TimerHistory,
    };

    for (const [key, entity] of Object.entries(entityMap)) {
      const items = backup.data[key] || [];
      if (items.length > 0) {
        const cleaned = items.map(({ id, created_date, updated_date, ...rest }) => ({ ...rest, user_id: user.id }));
        await entity.bulkCreate(cleaned);
      }
    }

    toast({ title: 'Restore complete! Refresh to see changes.' });
    e.target.value = '';
  };

  const handleLogout = () => {
    firebaseApi.auth.logout('/login');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
            {user?.full_name?.[0] || 'U'}
          </div>
          <div>
            <p className="font-semibold">{user?.full_name || 'User'}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Survey link */}
      <Link to="/survey" className="glass-card p-4 flex items-center justify-between group hover:shadow-lg transition-all block">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-primary" />
          <span className="font-medium">Edit Study Profile</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
      </Link>

      {/* Appearance */}
      <div className="glass-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Appearance</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {darkMode ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-primary" />}
            <Label>Dark Mode</Label>
          </div>
          <Switch checked={darkMode} onCheckedChange={v => updateSetting('dark_mode', v)} />
        </div>
      </div>

      {/* Preferences */}
      <div className="glass-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Preferences</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><Wifi className="w-5 h-5 text-primary" /><Label>Data Saver</Label></div>
          <Switch checked={settings?.data_saver || false} onCheckedChange={v => updateSetting('data_saver', v)} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><Bell className="w-5 h-5 text-primary" /><Label>Notifications</Label></div>
          <Switch checked={settings?.notifications_enabled !== false} onCheckedChange={v => updateSetting('notifications_enabled', v)} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><Volume2 className="w-5 h-5 text-primary" /><Label>Sound</Label></div>
          <Switch checked={settings?.sound_enabled !== false} onCheckedChange={v => updateSetting('sound_enabled', v)} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><Vibrate className="w-5 h-5 text-primary" /><Label>Vibration</Label></div>
          <Switch checked={settings?.vibration_enabled !== false} onCheckedChange={v => updateSetting('vibration_enabled', v)} />
        </div>
      </div>

      {/* Backup & Restore */}
      <div className="glass-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Backup & Restore</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={handleBackup} disabled={backing}>
            <Download className="w-4 h-4 mr-2" />{backing ? 'Backing up...' : 'Backup'}
          </Button>
          <label>
            <Button variant="outline" className="w-full" asChild>
              <span><Upload className="w-4 h-4 mr-2" />Restore</span>
            </Button>
            <input type="file" accept=".json" className="hidden" onChange={handleRestore} />
          </label>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3"><Shield className="w-5 h-5 text-primary" /><Label>Auto Backup</Label></div>
          <Switch checked={settings?.auto_backup || false} onCheckedChange={v => updateSetting('auto_backup', v)} />
        </div>
      </div>

      {/* Logout */}
      <Button variant="destructive" onClick={handleLogout} className="w-full">
        <LogOut className="w-4 h-4 mr-2" />Log Out
      </Button>
    </div>
  );
}