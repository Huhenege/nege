import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children }) => {
    const { currentUser, openAuthModal } = useAuth();
    const location = useLocation();

    useEffect(() => {
        if (!currentUser) {
            openAuthModal();
        }
    }, [currentUser, openAuthModal]);

    if (!currentUser) {
        return <Navigate to="/" replace state={{ from: location }} />;
    }

    return children;
};

export default ProtectedRoute;
