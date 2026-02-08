import React from 'react';

const Alert = ({ tone = 'success', className = '', children, ...props }) => (
  <div className={`alert alert-${tone} ${className}`.trim()} {...props}>
    {children}
  </div>
);

export default Alert;
