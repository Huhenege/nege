import React from 'react';
import Logo from './Logo';

const Header = () => {
    return (
        <header className="header" style={{
            height: 'var(--header-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 var(--spacing-lg)',
            position: 'fixed',
            width: '100%',
            top: 0,
            left: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            borderBottom: '1px solid var(--border-light)'
        }}>
            <div className="logo" style={{ display: 'flex', alignItems: 'center' }}>
                <Logo style={{ height: '36px', width: 'auto' }} />
            </div>
            <a href="#contact" className="btn-nav" style={{
                fontSize: '0.9rem',
                fontWeight: '500',
                color: 'var(--text-secondary)'
            }}>
                Холбогдох
            </a>
        </header>
    );
};

export default Header;
