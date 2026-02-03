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

function Home() {
  return (
    <main>
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
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  )
}

export default App
