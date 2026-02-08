import React from 'react';

const Select = ({ label, error, help, className = '', children, ...props }) => (
  <label className={`form-field ${className}`.trim()}>
    {label && <span className="form-label">{label}</span>}
    <select className="select" {...props}>
      {children}
    </select>
    {help && <span className="form-help">{help}</span>}
    {error && <span className="form-error">{error}</span>}
  </label>
);

export default Select;
