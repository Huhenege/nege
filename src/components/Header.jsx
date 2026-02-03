import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Logo from './Logo';

const Header = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    async function handleLogout() {
        setError('');
        try {
            await logout();
            navigate('/login');
        } catch {
            setError('Гарахад алдаа гарлаа');
        }
    }

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
                <Link to="/">
                    <Logo style={{ height: '36px', width: 'auto' }} />
                </Link>
            </div>
            <nav style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                {currentUser && (
                    <Link to="/ai-assistant" className="btn-nav" style={{
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        color: 'var(--text-secondary)',
                        textDecoration: 'none'
                    }}>
                        AI Туслах
                    </Link>
                )}

                {currentUser ? (
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: '#666' }}>{currentUser.email}</span>
                        <button onClick={handleLogout} className="btn-nav" style={{
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            color: 'var(--text-secondary)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer'
                        }}>
                            Гарах
                        </button>
                    </div>
                ) : (
                    <Link to="/login" className="btn-nav" style={{
                        fontSize: '0.9rem',
                        fontWeight: '500',
                        color: 'var(--text-secondary)',
                        textDecoration: 'none'
                    }}>
                        Нэвтрэх
                    </Link>
                )}

                <a href="#contact" className="btn-nav" style={{
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    color: 'var(--text-secondary)'
                }}>
                    Холбогдох
                </a>
            </nav>
        </header>
    );
};

export default Header;
