import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Activity, Settings, LogOut, Menu, X, CreditCard, GraduationCap, CalendarCheck, DollarSign, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './AdminLayout.css';

const AdminLayout = () => {
    const { currentUser, logout } = useAuth();
    const location = useLocation();
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    if (currentUser?.role !== 'admin') {
        window.location.href = '/';
        return null;
    }

    const menuItems = [
        { path: '/admin', icon: LayoutDashboard, label: 'Хяналтын самбар' },
        { path: '/admin/users', icon: Users, label: 'Хэрэглэгчид' },
        { path: '/admin/business-cards', icon: CreditCard, label: 'Нэрийн хуудас' },
        { path: '/admin/payments', icon: DollarSign, label: 'Төлбөр' },
        { path: '/admin/pricing', icon: DollarSign, label: 'Үнийн тохиргоо' },
        { path: '/admin/trainings', icon: GraduationCap, label: 'Сургалт' },
        { path: '/admin/bookings', icon: CalendarCheck, label: 'Захиалга' },
        { path: '/admin/logs', icon: Activity, label: 'Лог' },
        { path: '/admin/settings', icon: Settings, label: 'Тохиргоо' },
        { path: '/admin/contracts', icon: FileText, label: 'Гэрээний загвар' },
    ];

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);
    const closeSidebar = () => setSidebarOpen(false);

    return (
        <div className="admin-container">
            {/* Mobile Header */}
            <div className="admin-mobile-header">
                <button onClick={toggleSidebar} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                    <Menu size={24} />
                </button>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginLeft: '1rem' }}>SaaS Admin</h2>
            </div>

            {/* Sidebar Overlay */}
            {isSidebarOpen && (
                <div onClick={closeSidebar} className="admin-overlay" />
            )}

            {/* Sidebar */}
            <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="admin-sidebar-header">
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', paddingLeft: '0.75rem' }}>
                        SaaS Admin
                    </h2>
                    <button onClick={closeSidebar} className="admin-sidebar-close">
                        <X size={20} />
                    </button>
                </div>

                <nav style={{ flex: 1 }}>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {menuItems.map((item) => {
                            const isActive = item.path === '/admin'
                                ? location.pathname === '/admin'
                                : location.pathname.startsWith(item.path);
                            return (
                                <li key={item.path} style={{ marginBottom: '0.5rem' }}>
                                    <Link
                                        to={item.path}
                                        onClick={closeSidebar}
                                        className={`admin-nav-link ${isActive ? 'active' : ''}`}
                                    >
                                        <item.icon size={20} style={{ marginRight: '0.75rem' }} />
                                        {item.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                <button onClick={logout} className="admin-logout-btn">
                    <LogOut size={20} style={{ marginRight: '0.75rem' }} />
                    Гарах
                </button>
            </aside>

            {/* Main Content */}
            <div className="admin-main">
                <Outlet />
            </div>
        </div>
    );
};

export default AdminLayout;
