import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children }) => {
    const { currentUser, loading, openAuthModal } = useAuth();
    const location = useLocation();

    useEffect(() => {
        if (!loading && !currentUser) {
            openAuthModal();
        }
    }, [loading, currentUser, openAuthModal]);

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid var(--ink-100)', borderTopColor: '#e11d48', borderRadius: '50%' }}></div>
            </div>
        );
    }

    if (!currentUser) {
        return <Navigate to="/" replace state={{ from: location }} />;
    }

    if (currentUser.role !== 'admin') {
        return <Navigate to="/" />;
    }

    return children;
};

export default AdminRoute;
