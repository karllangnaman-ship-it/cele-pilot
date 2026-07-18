import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AchievementProvider } from '@/components/AchievementProvider';
import { StudyTimerProvider } from '@/lib/StudyTimerContext';

const FirebaseConfigurationError = ({ message }) => (
  <main className="min-h-screen flex items-center justify-center bg-background p-4">
    <section className="w-full max-w-lg rounded-2xl border border-destructive/30 bg-card p-8 shadow-lg">
      <h1 className="text-xl font-bold text-foreground">Firebase configuration required</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        This deployment is missing its VITE_FIREBASE_* environment variables. Add them in Vercel, then redeploy.
      </p>
      <p className="mt-4 break-words text-xs text-destructive">{message}</p>
    </section>
  </main>
);

// Auth pages
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import VerificationPending from '@/pages/VerificationPending';

// App pages
import Home from '@/pages/Home';
import Survey from '@/pages/Survey';
import Schedule from '@/pages/Schedule';
import Timer from '@/pages/Timer';
import StudyHistory from '@/pages/StudyHistory';
import Flashcards from '@/pages/Flashcards';
import Notes from '@/pages/Notes';
import Storage from '@/pages/Storage';
import Stats from '@/pages/Stats';
import SettingsPage from '@/pages/SettingsPage';
import Notifications from '@/pages/Notifications';
import FormulaSheet from '@/pages/FormulaSheet';
import QuestionBank from '@/pages/QuestionBank';
import PracticeMode from '@/pages/PracticeMode';
import MockBoardExam from '@/pages/MockBoardExam';
import ExamHistory from '@/pages/ExamHistory';
import MistakeNotebook from '@/pages/MistakeNotebook';
import AppLayout from '@/components/AppLayout';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading CELE Planner...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'firebase_configuration') {
      return <FirebaseConfigurationError message={authError.message} />;
    }
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return <Navigate to="/login" replace />;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/verification-pending" element={<VerificationPending />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Home />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/schedule" element={<Schedule />} />
          <Route path="/timer" element={<Timer />} />
          <Route path="/study-history" element={<StudyHistory />} />
          <Route path="/flashcards" element={<Flashcards />} />
          <Route path="/notes" element={<Notes />} />
          <Route path="/storage" element={<Storage />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/formula-sheet" element={<FormulaSheet />} />
          <Route path="/question-bank" element={<QuestionBank />} />
          <Route path="/practice" element={<PracticeMode />} />
          <Route path="/mock-board-exam" element={<MockBoardExam />} />
          <Route path="/exam-history" element={<ExamHistory />} />
          <Route path="/mistake-notebook" element={<MistakeNotebook />} />
        </Route>
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AchievementProvider>
              <StudyTimerProvider><AuthenticatedApp /></StudyTimerProvider>
            </AchievementProvider>
          </Router>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App
