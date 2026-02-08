import React from 'react';

const EmptyState = ({ title, description, action }) => (
  <div className="empty-state">
    {title && <h3>{title}</h3>}
    {description && <p>{description}</p>}
    {action}
  </div>
);

export default EmptyState;
