import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import ActivationPrompt from './pages/ActivationPrompt';
import AdvancedAnalyticsPage from './pages/AdvancedAnalyticsPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import AddCandidatePage from './pages/AddCandidatePage';
import CandidateListPage from './pages/CandidateListPage';
import CandidateDetailPage from './pages/CandidateDetailPage';
import EmployerListPage from './pages/EmployerListPage';
import JobOrderListPage from './pages/JobOrderListPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import RecycleBinPage from './pages/RecycleBinPage';
import BulkImportPage from './pages/BulkImportPage';
import SystemAuditLogPage from './pages/SystemAuditLogPage';
import VisaKanbanPage from './pages/VisaKanbanPage';
import WhatsAppBulkPage from './pages/WhatsAppBulkPage.jsx';
import useThemeStore from './store/useThemeStore';

// === NEW/MISSING COMPONENT IMPORTS ===
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
// ========================================================

// --- ZUSTAND IMPORTS ---
import { useToasterStore } from 'react-hot-toast';
import toast from 'react-hot-toast';
import useAuthStore from './store/useAuthStore';
import useDataStore from './store/dataStore';
import useNotificationStore from './store/useNotificationStore';
import { useShallow } from 'zustand/react/shallow';

function App() {
  const initializeNotifications = useNotificationStore((s) => s.initialize);
  const createNotification = useNotificationStore((s) => s.createNotification);
  const navigate = useNavigate();

  // init notification service + sync store
  useEffect(() => {
    initializeNotifications();
  }, [initializeNotifications]);

  useEffect(() => {
    const theme = useThemeStore.getState().theme;
    document.body.dataset.theme = theme;
  }, []);

  const { user, featureFlags, isAuthenticated } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
      featureFlags: state.featureFlags,
      isAuthenticated: state.isAuthenticated,
    }))
  );

  const { fetchInitialData, reset: resetDataStore } = useDataStore(
    useShallow((state) => ({
      fetchInitialData: state.fetchInitialData,
      reset: state.reset,
    }))
  );

  const [isActivated, setIsActivated] = useState(true);
  const [activationLoading, setActivationLoading] = useState(true);

  useEffect(() => {
    const checkLicense = async () => {
      try {
        const res = await window.electronAPI.getActivationStatus();
        if (res.success && res.data) {
          setIsActivated(!!res.data.activated);
        } else {
          setIsActivated(false);
        }
      } catch {
        setIsActivated(false);
      } finally {
        setActivationLoading(false);
      }
    };
    checkLicense();
  }, []);

  const handleLogin = (userData) => {
    useAuthStore.getState().login(userData, fetchInitialData);
  };

  const handleLogout = () => {
    useAuthStore.getState().logout();
    resetDataStore();
  };

  useEffect(() => {
    if (isAuthenticated && featureFlags) {
      fetchInitialData();
    }
  }, [isAuthenticated, featureFlags, fetchInitialData]);

  const { toasts } = useToasterStore();
  useEffect(() => {}, [toasts]);

  // listen for reminder-due from Electron
  useEffect(() => {
    if (!window.electronAPI?.onReminderDue) return;

    const off = window.electronAPI.onReminderDue((rem) => {
      // 1) push into notification store (for bell + panel)
      createNotification({
        title: rem.title,
        message: rem.message,
        type: 'info',
        priority: 'normal',
        createdAt: new Date().toISOString(),
        link: rem.candidateId
          ? `/candidate/${rem.candidateId}?tab=${rem.module || 'profile'}`
          : null,
        actionRequired: true,
      });

      // 2) show clickable toast
      toast((t) => (
        <span
          onClick={() => {
            if (rem.candidateId) {
              navigate(`/candidate/${rem.candidateId}?tab=${rem.module || 'profile'}`);
            }
            toast.dismiss(t.id);
          }}
          style={{ cursor: 'pointer' }}
        >
          <b>{rem.title}</b>
          <br />
          {rem.message}
        </span>
      ));
    });

    return () => {
      if (off) off();
    };
  }, [navigate, createNotification]);

  if (activationLoading) {
    return (
      <div className="login-wrapper">
        <p>Checking application license...</p>
      </div>
    );
  }

  if (!isActivated) {
    return (
      <Routes>
        <Route path="*" element={<ActivationPrompt />} />
      </Routes>
    );
  }

  return (
    <ErrorBoundary>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage onLogin={handleLogin} />
            )
          }
        />

        <Route
          path="/*"
          element={
            isAuthenticated && featureFlags ? (
              <MainLayout onLogout={handleLogout} user={user} flags={featureFlags}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/search" element={<CandidateListPage />} />
                  <Route path="/add" element={<AddCandidatePage />} />
                  <Route
                    path="/candidate/:id"
                    element={<CandidateDetailPage user={user} flags={featureFlags} />}
                  />

                  <Route
                    element={
                      <ProtectedRoute user={user} allowedRoles={['admin', 'super_admin']} />
                    }
                  >
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/whatsapp-bulk" element={<WhatsAppBulkPage />} />
                    <Route path="/settings" element={<SettingsPage user={user} />} />
                    <Route path="/recycle-bin" element={<RecycleBinPage user={user} />} />
                    <Route path="/employers" element={<EmployerListPage />} />
                    <Route path="/jobs" element={<JobOrderListPage />} />
                    <Route path="/system-audit" element={<SystemAuditLogPage />} />
                    <Route path="/visa-board" element={<VisaKanbanPage />} />
                    <Route
                      path="/advanced-analytics"
                      element={<AdvancedAnalyticsPage />}
                    />
                  </Route>

                  <Route
                    element={
                      <ProtectedRoute user={user} allowedRoles={['super_admin']} />
                    }
                  >
                    <Route path="/import" element={<BulkImportPage />} />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </MainLayout>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
