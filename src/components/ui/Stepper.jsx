import React from 'react';

const Stepper = ({ steps = [], activeIndex = 0, className = '' }) => (
  <div className={`stepper ${className}`.trim()}>
    {steps.map((step, index) => (
      <div
        key={step}
        className={`stepper-step ${index < activeIndex ? 'is-complete' : ''} ${index === activeIndex ? 'is-active' : ''}`}
      >
        {step}
      </div>
    ))}
  </div>
);

export default Stepper;
