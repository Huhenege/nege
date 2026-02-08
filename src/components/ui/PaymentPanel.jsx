import React from 'react';

const PaymentPanel = ({ title = 'Төлбөр', badge, children }) => (
  <div className="card">
    <div className="card-header">
      <div className="card-title">{title}</div>
      {badge}
    </div>
    <div className="card-body">
      {children}
    </div>
  </div>
);

export default PaymentPanel;
