import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { LogOut, User, Calendar, CreditCard, Clock } from 'lucide-react';
import './UserProfile.css';

const UserProfile = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userInfo, setUserInfo] = useState(null);

    useEffect(() => {
        fetchUserData();
    }, [currentUser]);

    async function fetchUserData() {
        if (!currentUser) return;

        try {
            // Fetch user info
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                setUserInfo(userDoc.data());
            }

            // Fetch payment history
            const invoicesRef = collection(db, 'qpayInvoices');
            const q = query(
                invoicesRef,
                where('userId', '==', currentUser.uid),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(q);
            const paymentsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setPayments(paymentsData);
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            setLoading(false);
        }
    }

    async function handleLogout() {
        try {
            await logout();
            navigate('/');
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const formatAmount = (amount) => {
        return new Intl.NumberFormat('mn-MN').format(amount) + '₮';
    };

    const getStatusBadge = (status) => {
        const statusMap = {
            'PAID': { label: 'Төлсөн', color: '#10b981' },
            'PENDING': { label: 'Хүлээгдэж буй', color: '#f59e0b' },
            'CANCELLED': { label: 'Цуцлагдсан', color: '#ef4444' },
            'EXPIRED': { label: 'Хугацаа дууссан', color: '#6b7280' }
        };
        const statusInfo = statusMap[status] || { label: status, color: '#6b7280' };
        return (
            <span className="status-badge" style={{ backgroundColor: statusInfo.color }}>
                {statusInfo.label}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="profile-loading">
                <div className="spinner"></div>
                <p>Уншиж байна...</p>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="profile-container">
                <div className="profile-header">
                    <h1>Миний профайл</h1>
                </div>

                {/* User Info Card */}
                <div className="profile-card">
                    <div className="profile-info">
                        <div className="profile-avatar">
                            <User size={40} />
                        </div>
                        <div className="profile-details">
                            <h2>{currentUser?.email}</h2>
                            <div className="profile-meta">
                                <span className="profile-meta-item">
                                    <Calendar size={16} />
                                    Бүртгүүлсэн: {userInfo?.createdAt ? formatDate(userInfo.createdAt) : '-'}
                                </span>
                                <span className="profile-meta-item">
                                    <User size={16} />
                                    Эрх: {userInfo?.role === 'admin' ? 'Администратор' : 'Хэрэглэгч'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleLogout} className="logout-btn">
                        <LogOut size={18} />
                        Гарах
                    </button>
                </div>

                {/* Payment History */}
                <div className="profile-section">
                    <h3 className="section-title">
                        <CreditCard size={20} />
                        Төлбөрийн түүх
                    </h3>

                    {payments.length === 0 ? (
                        <div className="empty-state">
                            <Clock size={48} />
                            <p>Төлбөрийн түүх байхгүй байна</p>
                        </div>
                    ) : (
                        <div className="payments-table-wrapper">
                            <table className="payments-table">
                                <thead>
                                    <tr>
                                        <th>Нэхэмжлэх №</th>
                                        <th>Үйлчилгээ</th>
                                        <th>Дүн</th>
                                        <th>Төлөв</th>
                                        <th>Огноо</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((payment) => (
                                        <tr key={payment.id}>
                                            <td className="invoice-id">#{payment.invoice_id || payment.id.slice(-6)}</td>
                                            <td>{payment.description || 'AI үйлчилгээ'}</td>
                                            <td className="amount">{formatAmount(payment.amount)}</td>
                                            <td>{getStatusBadge(payment.status)}</td>
                                            <td>{formatDate(payment.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
