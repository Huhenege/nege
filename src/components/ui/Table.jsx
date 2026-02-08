import React from 'react';

const Table = ({ className = '', children }) => (
  <div className={`table-wrap ${className}`.trim()}>
    <table className="table">{children}</table>
  </div>
);

export default Table;
