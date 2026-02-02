import React from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import WhoWeAre from './components/WhoWeAre';
import WhatWeDo from './components/WhatWeDo';
import Process from './components/Process';
import WhyNege from './components/WhyNege';
import Philosophy from './components/Philosophy';
import CTA from './components/CTA';

function App() {
  return (
    <div className="app-wrapper">
      <Header />
      <main>
        <Hero />
        <WhoWeAre />
        <WhatWeDo />
        <Process />
        <WhyNege />
        <Philosophy />
        <CTA />
      </main>
    </div>
  )
}

export default App
