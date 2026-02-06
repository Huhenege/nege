import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Header from './components/Header';
import Hero from './components/Hero';
import WhoWeAre from './components/WhoWeAre';
import WhatWeDo from './components/WhatWeDo';
import Process from './components/Process';
import WhyNege from './components/WhyNege';
import Philosophy from './components/Philosophy';
import CTA from './components/CTA';
import AIAssistant from './pages/AIAssistant';
import AccountStatementOrganizer from './pages/AccountStatementOrganizer';
import SocialInsuranceHoliday from './pages/SocialInsuranceHoliday';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './layout/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import AuditLogs from './pages/admin/AuditLogs';
import AdminSettings from './pages/admin/AdminSettings';
import PaymentManagement from './pages/admin/PaymentManagement';
import OfficialLetterheadGenerator from './pages/OfficialLetterheadGenerator';
import './pages/Home.css';

function Home() {
  return (
    <main className="home">
      <Hero />
      <WhoWeAre />
      <WhatWeDo />
      <Process />
      <WhyNege />
      <Philosophy />
      <CTA />
    </main>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-wrapper">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/ai-assistant" element={
              <ProtectedRoute>
                <AIAssistant />
              </ProtectedRoute>
            } />
            <Route path="/ai-assistant/account-statement-organizer" element={
              <ProtectedRoute>
                <AccountStatementOrganizer />
              </ProtectedRoute>
            } />
            <Route path="/ai-assistant/social-insurance-holiday" element={
              <ProtectedRoute>
                <SocialInsuranceHoliday />
              </ProtectedRoute>
            } />
            <Route path="/ai-assistant/official-letterhead" element={
              <ProtectedRoute>
                <OfficialLetterheadGenerator />
              </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin" element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="logs" element={<AuditLogs />} />
              <Route path="payments" element={<PaymentManagement />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App
