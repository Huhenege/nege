import React from 'react';

const PageHeader = ({ title, subtitle, children, panel }) => (
  <div className="page-header">
    <div>
      {children}
      {title && <h1 className="page-header__title">{title}</h1>}
      {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
    </div>
    {panel && <div className="page-header__panel">{panel}</div>}
  </div>
);

export default PageHeader;
