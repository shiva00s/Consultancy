import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './components/MainLayout'; 
import ActivationPrompt from './pages/ActivationPrompt';
// === 1. PAGE IMPORTS (From pages/ folder) ===
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
// ============================================

// === 2. COMPONENT IMPORTS (From components/ folder) ===
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import ModuleVisibilityControl from './components/settings/ModuleVisibilityControl'; // Import the Settings component
// ========================================================

// --- ZUSTAND IMPORTS ---
import { useToasterStore } from 'react-hot-toast'; 
import useAuthStore from './store/useAuthStore';
import useDataStore from './store/dataStore'; 
import { useShallow } from 'zustand/react/shallow';


function App() {
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
      reset: state.reset
    }))
  );
const [isActivated, setIsActivated] = useState(true); 
  const [activationLoading, setActivationLoading] = useState(true);
// --- NEW: Activation Status Check ---
  useEffect(() => {
    window.electronAPI.getActivationStatus().then(res => {
        if (res.success) {
            setIsActivated(res.status.activated);
        }
        setActivationLoading(false);
    }).catch(() => {
        // If IPC fails (e.g., initial load before DB is fully ready), assume not activated
        setIsActivated(false); 
        setActivationLoading(false);
    });
  }, []);
  // ------------------------------------

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

  // Ensure Toaster is satisfied
  const { toasts } = useToasterStore();
  useEffect(() => {}, [toasts]); 


if (activationLoading) {
      return <div className="login-wrapper"><p>Checking application license...</p></div>;
  }
  
  // --- License Gate ---
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
          element={ isAuthenticated ? (<Navigate to="/" replace />) : (<LoginPage onLogin={handleLogin} />) }
        />
        
        <Route
          path="/*"
          element={ isAuthenticated && featureFlags ? (
              <MainLayout onLogout={handleLogout} user={user} flags={featureFlags}> 
                <Routes>
                  {/* --- ALWAYS ALLOWED ROUTES --- */}
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/search" element={<CandidateListPage />} />
                  <Route path="/add" element={<AddCandidatePage />} />
                  <Route path="/candidate/:id" element={<CandidateDetailPage user={user} flags={featureFlags} />} />

                  {/* --- PROTECTED SYSTEM ROUTES (Admin or Super Admin) --- */}
                  <Route element={<ProtectedRoute user={user} allowedRoles={['admin', 'super_admin']} />}>
                      <Route path="/reports" element={<ReportsPage />} />
                      
                      {/* FIX: Settings Page and Modules now correctly receive the 'user' prop */}
                      <Route path="/settings" element={<SettingsPage user={user} />} />
                      <Route path="/system-modules" element={<ModuleVisibilityControl user={user} />} />
                      
                      <Route path="/recycle-bin" element={<RecycleBinPage user={user} />} />
                      <Route path="/employers" element={<EmployerListPage />} />
                      <Route path="/jobs" element={<JobOrderListPage />} />
                      <Route path="/system-audit" element={<SystemAuditLogPage />} />
                      <Route path="/visa-board" element={<VisaKanbanPage/>} />
                  </Route>
                        
                  {/* --- PROTECTED HIGH-RISK ROUTES (Super Admin ONLY) --- */}
                  <Route element={<ProtectedRoute user={user} allowedRoles={['super_admin']} />}>
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