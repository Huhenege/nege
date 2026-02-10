import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { ArrowLeft, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import './TransactionHistory.css';

const TransactionHistory = () => {
    const { currentUser } = useAuth();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPayments();
    }, [currentUser]);

    async function fetchPayments() {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        try {
            const invoicesRef = collection(db, 'qpayInvoices');
            let paymentsData = [];
            try {
                const q = query(
                    invoicesRef,
                    where('userId', '==', currentUser.uid),
                    orderBy('createdAt', 'desc')
                );
                const snapshot = await getDocs(q);
                paymentsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            } catch (error) {
                if (error?.code !== 'failed-precondition') {
                    throw error;
                }
                const q = query(invoicesRef, where('userId', '==', currentUser.uid));
                const snapshot = await getDocs(q);
                paymentsData = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                paymentsData.sort((a, b) => {
                    const aTime = a?.createdAt?.toMillis?.() || new Date(a?.createdAt || 0).getTime() || 0;
                    const bTime = b?.createdAt?.toMillis?.() || new Date(b?.createdAt || 0).getTime() || 0;
                    return bTime - aTime;
                });
            }
            setPayments(paymentsData);
        } catch (error) {
            console.error('Error fetching payment history:', error);
        } finally {
            setLoading(false);
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
            <div className="transactions-loading">
                <div className="spinner"></div>
                <p>Уншиж байна...</p>
            </div>
        );
    }

    return (
        <div className="transactions-page">
            <div className="transactions-container">
                <div className="transactions-header">
                    <Link to="/profile" className="transactions-back">
                        <ArrowLeft size={18} />
                        Профайл руу буцах
                    </Link>
                    <div className="transactions-title">Гүйлгээний түүх</div>
                </div>

                <div className="transactions-card">
                    {payments.length === 0 ? (
                        <div className="transactions-empty">
                            <Clock size={40} />
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

export default TransactionHistory;
