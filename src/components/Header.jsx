import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, LogOut, ChevronDown, ShieldCheck, Sparkles } from 'lucide-react';
import Logo from './Logo';
import './Header.css';

const Header = () => {
    const { currentUser, logout, openAuthModal } = useAuth();
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const dropdownRef = useRef(null);

    async function handleLogout() {
        try {
            await logout();
            navigate('/');
            setIsMenuOpen(false);
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const userEmail = currentUser?.email || '';
    const initial = userEmail ? userEmail.charAt(0).toUpperCase() : '?';

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

            <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>


                {currentUser ? (
                    <div className="header-user-container" ref={dropdownRef}>
                        <button
                            className={`user-dropdown-trigger ${isMenuOpen ? 'active' : ''}`}
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                        >
                            <div className="user-avatar">{initial}</div>
                            <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                                {userEmail.split('@')[0]}
                            </span>
                            <ChevronDown size={16} style={{
                                transform: isMenuOpen ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.2s'
                            }} />
                        </button>

                        {isMenuOpen && (
                            <div className="user-dropdown-menu">
                                <div className="dropdown-header">
                                    <span className="dropdown-user-email">{userEmail}</span>
                                    <span className="dropdown-user-role">
                                        {currentUser.role === 'admin' ? 'Администратор' : 'Хэрэглэгч'}
                                    </span>
                                </div>



                                {currentUser.role === 'admin' && (
                                    <Link to="/admin" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                                        <ShieldCheck size={18} color="#059669" />
                                        Админ самбар
                                    </Link>
                                )}

                                <div className="dropdown-divider"></div>

                                <button onClick={handleLogout} className="dropdown-item logout">
                                    <LogOut size={18} />
                                    Гарах
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button
                        onClick={openAuthModal}
                        className="btn-nav"
                        style={{
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            color: '#111827',
                            background: 'white',
                            cursor: 'pointer',
                            padding: '0.5rem 1rem',
                            borderRadius: '6px',
                            border: '1.5px solid #374151',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#111827';
                            e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'white';
                            e.currentTarget.style.color = '#111827';
                        }}
                    >
                        Нэвтрэх
                    </button>
                )}
            </nav>
        </header>
    );
};

export default Header;
