import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, LogOut, ChevronDown, ShieldCheck } from 'lucide-react';
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
        <header className="site-header">
            <div className="container site-header__inner">
                <Link to="/" className="site-header__logo">
                    <Logo style={{ height: '34px', width: 'auto' }} />
                </Link>

                <nav className="site-header__nav">
                    <Link to="/nege-ai" className="header-nav-link">
                        Nege AI
                    </Link>
                    {currentUser ? (
                        <div className="header-user-container" ref={dropdownRef}>
                            <button
                                className={`user-dropdown-trigger ${isMenuOpen ? 'active' : ''}`}
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                aria-expanded={isMenuOpen}
                            >
                                <div className="user-avatar">{initial}</div>
                                <span className="user-name">
                                    {userEmail.split('@')[0]}
                                </span>
                                <ChevronDown size={16} className="user-chevron" />
                            </button>

                            {isMenuOpen && (
                                <div className="user-dropdown-menu">
                                    <div className="dropdown-header">
                                        <span className="dropdown-user-email">{userEmail}</span>
                                        <span className="dropdown-user-role">
                                            {currentUser.role === 'admin' ? 'Администратор' : 'Хэрэглэгч'}
                                        </span>
                                    </div>

                                    <Link to="/profile" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                                        <User size={18} />
                                        Миний профайл
                                    </Link>

                                    {currentUser.role === 'admin' && (
                                        <Link to="/admin" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                                            <ShieldCheck size={18} />
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
                            className="btn btn-primary btn-sm"
                        >
                            Нэвтрэх
                        </button>
                    )}
                </nav>
            </div>
        </header>
    );
};

export default Header;
