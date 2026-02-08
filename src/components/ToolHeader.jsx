import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './ToolHeader.css';

const ToolHeader = ({
  title,
  subtitle,
  backTo = '/',
  backLabel = 'Буцах',
  eyebrow = 'AI TOOL',
  actions,
  summary,
}) => {
  return (
    <div className="tool-header">
      <div className="tool-header__inner container">
        <div>
          {eyebrow && <span className="tool-header__eyebrow">{eyebrow}</span>}
          <h1 className="tool-header__title">{title}</h1>
          {subtitle && <p className="tool-header__subtitle">{subtitle}</p>}
        </div>
        <div className="tool-header__actions">
          {actions}
          <Link to={backTo} className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} /> {backLabel}
          </Link>
        </div>
      </div>
      {summary && (
        <div className="tool-header__summary container">
          {summary}
        </div>
      )}
    </div>
  );
};

export default ToolHeader;
