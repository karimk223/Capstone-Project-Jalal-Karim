/**
 * App.jsx — updated: adds /admin/lookups route (B07 — FR-21).
 * All previous routes and structure unchanged.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import AppToaster from './components/AppToaster';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ComplaintList from './pages/ComplaintList';
import ComplaintDetail from './pages/ComplaintDetail';
import NewComplaintForm from './pages/NewComplaintForm';
import Approvals from './pages/Approvals';
import UserManagement from './pages/UserManagement';
import Profile from './pages/Profile';
import Register from './pages/admin/Register';
import LookupManagement from './pages/admin/LookupManagement'; // B07
import Reports from './pages/Reports';

export default function App() {
  return (
    <ErrorBoundary>
      <AppToaster />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard"      element={<Dashboard />} />
                <Route path="/complaints"     element={<ComplaintList />} />
                <Route path="/complaints/new" element={<NewComplaintForm />} />
                <Route path="/complaints/:id" element={<ComplaintDetail />} />
                <Route path="/approvals"      element={<Approvals />} />
                <Route path="/profile"        element={<Profile />} />
                <Route path="/reports"        element={<Reports />} />

                <Route element={<ProtectedRoute allowedRoles={['Admin']} />}>
                  <Route path="/users"           element={<UserManagement />} />
                  <Route path="/admin/register"  element={<Register />} />
                  <Route path="/admin/lookups"   element={<LookupManagement />} /> {/* B07 */}
                </Route>
              </Route>
            </Route>

            <Route path="/"  element={<Navigate to="/dashboard" replace />} />
            <Route path="*"  element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
