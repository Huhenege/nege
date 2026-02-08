import React from 'react';

const Textarea = ({ label, error, help, className = '', ...props }) => (
  <label className={`form-field ${className}`.trim()}>
    {label && <span className="form-label">{label}</span>}
    <textarea className="textarea" {...props} />
    {help && <span className="form-help">{help}</span>}
    {error && <span className="form-error">{error}</span>}
  </label>
);

export default Textarea;
