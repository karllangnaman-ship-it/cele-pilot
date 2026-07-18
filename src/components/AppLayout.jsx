import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Calendar, Cloud, BarChart3, Settings, Clock, Brain, FileText, User, Menu, X, Plus, Upload, Bell, History, Sigma, CircleHelp, Dumbbell, ClipboardCheck, ChevronDown, LayoutDashboard, FolderOpen, BookOpen, ChartNoAxesCombined } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const bottomNav = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/schedule', icon: Calendar, label: 'Schedule' },
  { path: '/storage', icon: Cloud, label: 'Cloud' },
  { path: '/stats', icon: BarChart3, label: 'Stats' },
  { path: '/settings', icon: Settings, label: 'Profile' },
];

const navigationSections = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, items: [bottomNav[0], bottomNav[1], bottomNav[3]] },
  { id: 'storage', label: 'Storage', icon: FolderOpen, items: [bottomNav[2]] },
  { id: 'account', label: 'Account', icon: User, items: [bottomNav[4], { path: '/survey', icon: User, label: 'Edit Profile' }, { path: '/notifications', icon: Bell, label: 'Notifications' }] },
  { id: 'study', label: 'Study', icon: BookOpen, items: [{ path: '/timer', icon: Clock, label: 'Study Timer' }, { path: '/study-history', icon: History, label: 'Study History' }, { path: '/flashcards', icon: Brain, label: 'Flashcards' }, { path: '/notes', icon: FileText, label: 'Notes' }] },
  { id: 'learning', label: 'Learning', icon: Brain, items: [{ path: '/formula-sheet', icon: Sigma, label: 'Formula Sheet' }, { path: '/question-bank', icon: CircleHelp, label: 'Question Bank' }, { path: '/practice', icon: Dumbbell, label: 'Practice Mode' }, { path: '/mock-board-exam', icon: ClipboardCheck, label: 'Mock Board Exam' }, { path: '/exam-history', icon: History, label: 'Exam History' }, { path: '/mistake-notebook', icon: BookOpen, label: 'Mistake Notebook' }] },
  { id: 'analytics', label: 'Analytics', icon: ChartNoAxesCombined, items: [{ path: '/stats?view=reports', icon: FileText, label: 'Reports' }, { path: '/stats?view=performance', icon: BarChart3, label: 'Performance' }, { path: '/study-history?view=progress', icon: History, label: 'Progress' }] },
];

const quickActions = [
  { icon: Plus, label: 'Add Task', path: '/schedule', color: 'from-purple-500 to-blue-500' },
  { icon: Upload, label: 'Upload File', path: '/storage', color: 'from-cyan-500 to-blue-500' },
  { icon: FileText, label: 'New Note', path: '/notes', color: 'from-green-500 to-emerald-500' },
  { icon: Brain, label: 'Flashcards', path: '/flashcards', color: 'from-pink-500 to-rose-500' },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  const [expandedSections, setExpandedSections] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cele-navigation-sections') || '["dashboard"]'); } catch { return ['dashboard']; }
  });

  useEffect(() => {
    setFabOpen(false);
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('cele-navigation-sections', JSON.stringify(expandedSections)); } catch { /* storage unavailable */ }
  }, [expandedSections]);

  useEffect(() => {
    const activeSection = navigationSections.find((section) => section.items.some((item) => item.path.split('?')[0] === location.pathname));
    if (activeSection && !expandedSections.includes(activeSection.id)) {
      setExpandedSections(isMobile ? [activeSection.id] : (current) => [...current, activeSection.id]);
    }
  }, [location.pathname, isMobile]);

  const toggleSection = (sectionId) => {
    setExpandedSections((current) => {
      const isExpanded = current.includes(sectionId);
      if (isExpanded) return current.filter((id) => id !== sectionId);
      return isMobile ? [sectionId] : [...current, sectionId];
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 glass-card-strong border-b border-border/50 rounded-none px-4 py-3 flex items-center justify-between">
        <button onClick={() => setDrawerOpen(true)} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
          CELE Pilot
        </h1>
        <div className="w-9" />
      </header>

      {/* Slide-out drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.1}
              onDragEnd={(e, info) => { if (info.offset.x < -80) setDrawerOpen(false); }}
              className="fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] glass-card-strong border-r border-border/50 rounded-none p-4 flex flex-col cursor-grab active:cursor-grabbing"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">CELE Review Pilot</h2>
                <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-xl hover:bg-muted transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex flex-col gap-1 flex-1 overflow-y-auto pr-1" aria-label="Main navigation">
                {navigationSections.map((section) => {
                  const expanded = expandedSections.includes(section.id);
                  const containsActive = section.items.some((item) => item.path.split('?')[0] === location.pathname);
                  return (
                    <section key={section.id} className="rounded-2xl">
                      <button
                        type="button"
                        onClick={() => toggleSection(section.id)}
                        aria-expanded={expanded}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${containsActive ? 'text-primary bg-primary/10' : 'hover:bg-muted text-foreground'}`}
                      >
                        <section.icon className="w-5 h-5" />
                        <span className="flex-1 text-left font-semibold text-sm">{section.label}</span>
                        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown className="w-4 h-4" /></motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: 'easeInOut' }} className="overflow-hidden"
                          >
                            <div className="pt-1 pb-2 pl-3 space-y-1 border-l border-border/70 ml-5">
                              {section.items.map((item) => {
                                const active = location.pathname === item.path.split('?')[0];
                                return <Link key={item.label} to={item.path} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${active ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}><item.icon className="w-4 h-4" /><span className="font-medium text-sm">{item.label}</span></Link>;
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </section>
                  );
                })}
              </nav>
              <p className="text-xs text-muted-foreground text-center pt-4 border-t border-border/50">Swipe left to close</p>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="p-4 pb-28 max-w-5xl mx-auto w-full">
        <Outlet />
      </main>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end">
        <AnimatePresence>
          {fabOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setFabOpen(false)}
                className="fixed inset-0 -z-10 bg-black/20 backdrop-blur-[2px]"
              />
              <div className="flex flex-col gap-2 mb-3">
                {quickActions.map((action, i) => (
                  <motion.button
                    key={action.label}
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => { navigate(action.path); setFabOpen(false); }}
                    className="flex items-center gap-3 glass-card-strong pl-2 pr-4 py-2 rounded-full shadow-lg hover:shadow-xl transition-all"
                  >
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${action.color} flex items-center justify-center`}>
                      <action.icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-medium">{action.label}</span>
                  </motion.button>
                ))}
              </div>
            </>
          )}
        </AnimatePresence>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setFabOpen(!fabOpen)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 shadow-xl flex items-center justify-center text-white"
          aria-label="Quick actions"
        >
          <motion.div animate={{ rotate: fabOpen ? 135 : 0 }} transition={{ type: 'spring', stiffness: 300 }}>
            <Plus className="w-6 h-6" />
          </motion.div>
        </motion.button>
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 glass-card-strong border-t border-border/50 rounded-none">
        <div className="flex justify-around items-center py-2 max-w-md mx-auto">
          {bottomNav.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 relative"
              >
                {active && (
                  <motion.div
                    layoutId="bottomNavActive"
                    className="absolute -top-2 w-8 h-1 rounded-full bg-primary"
                  />
                )}
                <item.icon className={`w-5 h-5 transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className={`text-[10px] font-medium transition-colors ${active ? 'text-primary' : 'text-muted-foreground'}`}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
