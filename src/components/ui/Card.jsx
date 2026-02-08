import React from 'react';

const Card = ({ className = '', children, ...props }) => (
  <div className={`card ${className}`.trim()} {...props}>
    {children}
  </div>
);

const CardHeader = ({ className = '', children, ...props }) => (
  <div className={`card-header ${className}`.trim()} {...props}>
    {children}
  </div>
);

const CardBody = ({ className = '', children, ...props }) => (
  <div className={`card-body ${className}`.trim()} {...props}>
    {children}
  </div>
);

export { CardHeader, CardBody };
export default Card;
