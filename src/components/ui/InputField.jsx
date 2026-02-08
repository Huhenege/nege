import React from 'react';

const InputField = ({ label, error, help, className = '', ...props }) => (
  <label className={`form-field ${className}`.trim()}>
    {label && <span className="form-label">{label}</span>}
    <input className="input" {...props} />
    {help && <span className="form-help">{help}</span>}
    {error && <span className="form-error">{error}</span>}
  </label>
);

export default InputField;
