import React from 'react';

const Section = ({ className = '', children, ...props }) => (
  <section className={`section ${className}`.trim()} {...props}>
    {children}
  </section>
);

export default Section;
