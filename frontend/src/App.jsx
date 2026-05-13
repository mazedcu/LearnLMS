import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { lazy, Suspense } from 'react';

const HomePage            = lazy(() => import('./pages/HomePage'));
const LoginPage           = lazy(() => import('./pages/LoginPage'));
const RegisterPage        = lazy(() => import('./pages/RegisterPage'));
const CourseDetail        = lazy(() => import('./pages/CourseDetail'));
const CheckoutPage        = lazy(() => import('./pages/CheckoutPage'));
const LearnPage           = lazy(() => import('./pages/LearnPage'));
const StudentDashboard    = lazy(() => import('./pages/dashboard/StudentDashboard'));
const InstructorDashboard = lazy(() => import('./pages/dashboard/InstructorDashboard'));
const AdminDashboard      = lazy(() => import('./pages/dashboard/AdminDashboard'));
const ManagerDashboard    = lazy(() => import('./pages/dashboard/ManagerDashboard'));
const CertVerify          = lazy(() => import('./pages/CertVerify'));
const Unauthorized        = lazy(() => import('./pages/Unauthorized'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 300000 } },
});

function PageFallback() {
  return <div className="loading-screen"><div className="spinner" /></div>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/courses/:slug" element={<CourseDetail />} />
              <Route path="/certificates/:uuid" element={<CertVerify />} />
              <Route path="/unauthorized" element={<Unauthorized />} />
              <Route path="/checkout/:slug" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
              <Route path="/learn/:slug" element={<ProtectedRoute><LearnPage /></ProtectedRoute>} />
              <Route path="/learn/:slug/:lessonId" element={<ProtectedRoute><LearnPage /></ProtectedRoute>} />
              <Route path="/dashboard/student" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/instructor" element={<ProtectedRoute roles={['instructor','admin']}><InstructorDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/manager" element={<ProtectedRoute roles={['manager','admin']}><ManagerDashboard /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
