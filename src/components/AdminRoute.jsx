import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminRoute = ({ children }) => {
    const { currentUser } = useAuth();

    if (!currentUser) {
        return <Navigate to="/login" />;
    }

    if (currentUser.role !== 'admin') {
        return <Navigate to="/ai-assistant" />; // Or a "Not Authorized" page
    }

    return children;
};

export default AdminRoute;
