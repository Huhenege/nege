import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { BillingProvider } from './contexts/BillingContext';
import Header from './components/Header';
import Footer from './components/Footer';
import AIAssistant from './pages/AIAssistant';
import AccountStatementOrganizer from './pages/AccountStatementOrganizer';
import SocialInsuranceHoliday from './pages/SocialInsuranceHoliday';
import UserProfile from './pages/UserProfile';
import LetterheadTemplates from './pages/LetterheadTemplates';
import TransactionHistory from './pages/TransactionHistory';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './layout/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import AuditLogs from './pages/admin/AuditLogs';
import AdminSettings from './pages/admin/AdminSettings';
import BusinessCardTemplates from './pages/admin/BusinessCardTemplates';
import PaymentManagement from './pages/admin/PaymentManagement';
import TrainingManagement from './pages/admin/TrainingManagement';
import TrainingEditor from './pages/admin/TrainingEditor';
import BookingManagement from './pages/admin/BookingManagement';
import PricingManagement from './pages/admin/PricingManagement';
import ContractTemplates from './pages/admin/ContractTemplates';
import ContractTemplateEditor from './pages/admin/ContractTemplateEditor';
import OfficialLetterheadGenerator from './pages/OfficialLetterheadGenerator';
import BusinessCardGenerator from './pages/BusinessCardGenerator';
import BusinessTraining from './pages/BusinessTraining';
import ContractGenerator from './pages/ContractGenerator';
import NegeAI from './pages/NegeAI';
import './pages/Home.css';

import AuthModal from './components/AuthModal';

const AppShell = () => {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isHome = location.pathname === '/';

  return (
    <div className={`app-shell ${isAdminRoute ? 'app-shell--admin' : ''} ${isHome ? 'app-shell--mono' : ''}`}>
      {!isAdminRoute && <Header />}
      <AuthModal />
      <main>
        <Routes>
          <Route path="/" element={<AIAssistant />} />
          <Route path="/ai-assistant" element={<Navigate to="/" replace />} />
          <Route path="/profile" element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          } />
          <Route path="/profile/letterhead-templates" element={
            <ProtectedRoute>
              <LetterheadTemplates />
            </ProtectedRoute>
          } />
          <Route path="/profile/transactions" element={
            <ProtectedRoute>
              <TransactionHistory />
            </ProtectedRoute>
          } />
          <Route path="/ai-assistant/account-statement-organizer" element={<AccountStatementOrganizer />} />
          <Route path="/ai-assistant/social-insurance-holiday" element={<SocialInsuranceHoliday />} />
          <Route path="/nege-ai" element={<NegeAI />} />
          <Route path="/ai-assistant/official-letterhead" element={<OfficialLetterheadGenerator />} />
          <Route path="/ai-assistant/business-card" element={<BusinessCardGenerator />} />
          <Route path="/ai-assistant/business-training" element={<BusinessTraining />} />
          <Route path="/ai-assistant/contract-generator" element={<ContractGenerator />} />
          <Route path="/ai-assistant/contract-generator/:templateId" element={<ContractGenerator />} />

          {/* Admin Routes */}
          <Route path="/admin" element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="business-cards" element={<BusinessCardTemplates />} />
            <Route path="logs" element={<AuditLogs />} />
            <Route path="payments" element={<PaymentManagement />} />
            <Route path="pricing" element={<PricingManagement />} />
            <Route path="trainings" element={<TrainingManagement />} />
            <Route path="trainings/new" element={<TrainingEditor />} />
            <Route path="trainings/:id" element={<TrainingEditor />} />
            <Route path="bookings" element={<BookingManagement />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="contracts" element={<ContractTemplates />} />
            <Route path="contracts/new" element={<ContractTemplateEditor />} />
            <Route path="contracts/:id" element={<ContractTemplateEditor />} />
          </Route>
        </Routes>
      </main>
      {!isAdminRoute && <Footer />}
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <BillingProvider>
          <AppShell />
        </BillingProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
