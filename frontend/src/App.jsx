import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import PublicLayout from './components/layout/PublicLayout';
import AdminLayout from './components/layout/AdminLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { PageLoader } from './components/ui/States';
import Home from './pages/Home';
import EventDetails from './pages/EventDetails';
import Confirmation from './pages/Confirmation';
import NotFound from './pages/NotFound';

// Admin pages are loaded on demand so public visitors download less JavaScript.
const Login = lazy(() => import('./pages/admin/Login'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminEvents = lazy(() => import('./pages/admin/AdminEvents'));
const EventEditor = lazy(() => import('./pages/admin/EventEditor'));
const Registrations = lazy(() => import('./pages/admin/Registrations'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="events/:id" element={<EventDetails />} />
            <Route path="events/:id/registered" element={<Confirmation />} />
          </Route>

          <Route path="admin/login" element={<Login />} />
          <Route path="admin" element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="events/new" element={<EventEditor />} />
              <Route path="events/:id/edit" element={<EventEditor />} />
              <Route path="registrations" element={<Registrations />} />
            </Route>
          </Route>

          <Route element={<PublicLayout />}>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster
        position="bottom-right"
        closeButton
        toastOptions={{
          classNames: {
            toast: '!rounded-2xl !bg-ink !text-white !border-ink !shadow-modal !font-sans',
            description: '!text-mist',
            closeButton: '!bg-ink !text-mist !border-white/20',
          },
        }}
      />
    </AuthProvider>
  );
}
