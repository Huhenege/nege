import React from 'react';

const Button = ({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}) => {
  const sizeClass = size === 'sm' ? 'btn-sm' : size === 'lg' ? 'btn-lg' : '';
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
