import React from 'react';

const Badge = ({ tone = 'brand', className = '', children, ...props }) => (
  <span className={`badge badge-${tone} ${className}`.trim()} {...props}>
    {children}
  </span>
);

export default Badge;
