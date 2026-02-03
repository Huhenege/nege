import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, LogOut, Activity, Menu, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const AdminLayout = () => {
    const { logout } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    const menuItems = [
        { path: '/admin', icon: LayoutDashboard, label: 'Хяналтын самбар' },
        { path: '/admin/users', icon: Users, label: 'Хэрэглэгчид' },
        { path: '/admin/logs', icon: Activity, label: 'Лог' },
        { path: '/admin/settings', icon: Settings, label: 'Тохиргоо' },
    ];

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f1f5f9' }}>
            {/* Mobile Header */}
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '60px',
                backgroundColor: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                padding: '0 1rem',
                color: 'white',
                zIndex: 100,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: window.innerWidth <= 768 ? 'flex' : 'none'
            }}>
                <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                    <Menu size={24} />
                </button>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginLeft: '1rem' }}>SaaS Admin</h2>
            </div>

            {/* Sidebar Overlay */}
            {isSidebarOpen && window.innerWidth <= 768 && (
                <div onClick={toggleSidebar} style={{
                    position: 'fixed',
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    zIndex: 101
                }} />
            )}

            {/* Sidebar */}
            <aside style={{
                width: '250px',
                backgroundColor: '#1e293b',
                color: 'white',
                padding: '2rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                position: window.innerWidth <= 768 ? 'fixed' : 'relative',
                left: window.innerWidth <= 768 ? (isSidebarOpen ? 0 : '-250px') : 0,
                top: 0,
                bottom: 0,
                zIndex: 102,
                transition: 'left 0.3s ease'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', paddingLeft: '0.75rem' }}>
                        SaaS Admin
                    </h2>
                    {window.innerWidth <= 768 && (
                        <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    )}
                </div>

                <nav style={{ flex: 1 }}>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {menuItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <li key={item.path} style={{ marginBottom: '0.5rem' }}>
                                    <Link
                                        to={item.path}
                                        onClick={() => window.innerWidth <= 768 && setSidebarOpen(false)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0.75rem',
                                            borderRadius: '8px',
                                            backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                                            color: isActive ? 'white' : '#94a3b8',
                                            textDecoration: 'none',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <item.icon size={20} style={{ marginRight: '0.75rem' }} />
                                        {item.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <button
                    onClick={logout}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0.75rem',
                        color: '#ef4444',
                        cursor: 'pointer',
                        marginTop: 'auto',
                        background: 'none',
                        border: 'none',
                        fontSize: '1rem'
                    }}
                >
                    <LogOut size={20} style={{ marginRight: '0.75rem' }} />
                    Гарах
                </button>
            </aside>

            {/* Main Content */}
            <main style={{
                flex: 1,
                padding: window.innerWidth <= 768 ? '5rem 1rem 2rem' : '2rem',
                minWidth: 0 // Prevent content from expanding sidebar
            }}>
                <Outlet />
            </main>
        </div>
    );
};

export default AdminLayout;
