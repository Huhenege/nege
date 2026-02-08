import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { LogOut, User, Calendar, CreditCard, Clock, FileText } from 'lucide-react';
import { useBilling } from '../contexts/BillingContext';
import { apiFetch } from '../lib/apiClient';
import './UserProfile.css';

const UserProfile = () => {
    const { currentUser, logout, refreshUserProfile } = useAuth();
    const { config: billingConfig } = useBilling();
    const navigate = useNavigate();
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userInfo, setUserInfo] = useState(null);
    const [creditInvoice, setCreditInvoice] = useState(null);
    const [creditStatus, setCreditStatus] = useState('idle'); // idle, creating, pending, success, error
    const [creditError, setCreditError] = useState(null);
    const [isCheckingCredit, setIsCheckingCredit] = useState(false);

    useEffect(() => {
        fetchUserData();
    }, [currentUser]);

    async function fetchUserData() {
        if (!currentUser) return;

        try {
            // Fetch user info
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserInfo(data);
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

    const subscriptionEndAt = userInfo?.subscription?.endAt
        ? (userInfo.subscription.endAt.toDate ? userInfo.subscription.endAt.toDate() : new Date(userInfo.subscription.endAt))
        : null;
    const subscriptionActive = userInfo?.subscription?.status === 'active' && subscriptionEndAt && subscriptionEndAt.getTime() > Date.now();
    const creditsBalance = userInfo?.credits?.balance || 0;
    const creditBundles = (billingConfig?.credits?.bundles || []).filter(b => b?.active !== false);

    const createCreditInvoice = async (bundle) => {
        if (!bundle) return;
        setCreditStatus('creating');
        setCreditError(null);
        try {
            const response = await apiFetch('/billing/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({
                    type: 'credits',
                    bundleId: bundle.id
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'Нэхэмжлэл үүсгэхэд алдаа гарлаа');
            }
            setCreditInvoice(data);
            setCreditStatus('pending');
        } catch (error) {
            setCreditStatus('error');
            setCreditError(error instanceof Error ? error.message : 'Алдаа гарлаа');
        }
    };

    const checkCreditPayment = async () => {
        if (!creditInvoice?.invoice_id) return;
        setIsCheckingCredit(true);
        try {
            const response = await apiFetch('/billing/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({ invoice_id: creditInvoice.invoice_id }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'Төлбөр шалгахад алдаа гарлаа');
            }
            if (data.paid) {
                setCreditStatus('success');
                setCreditInvoice(null);
                await refreshUserProfile();
                await fetchUserData();
            }
        } catch (error) {
            setCreditStatus('error');
            setCreditError(error instanceof Error ? error.message : 'Төлбөр шалгахад алдаа гарлаа');
        } finally {
            setIsCheckingCredit(false);
        }
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

                {/* Subscription & Credits */}
                <div className="profile-section">
                    <h3 className="section-title">
                        <CreditCard size={20} />
                        Эрх ба Credits
                    </h3>
                    <div className="profile-card" style={{ padding: '1.5rem' }}>
                        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                            <div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.4rem' }}>Subscription төлөв</div>
                                <div style={{ fontWeight: '700', color: subscriptionActive ? '#10b981' : '#ef4444' }}>
                                    {subscriptionActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                                    Дуусах огноо: {subscriptionEndAt ? formatDate(subscriptionEndAt) : '-'}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.4rem' }}>Credits үлдэгдэл</div>
                                <div style={{ fontWeight: '700', color: '#1e293b' }}>
                                    {creditsBalance} credit
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="profile-card" style={{ padding: '1.5rem', marginTop: '1rem' }}>
                        <h4 style={{ fontWeight: '700', marginBottom: '0.75rem' }}>Credits багц</h4>
                        {creditBundles.length === 0 ? (
                            <div style={{ color: '#94a3b8' }}>Одоогоор багц тохируулаагүй байна.</div>
                        ) : (
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {creditBundles.map((bundle) => (
                                    <div key={bundle.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.75rem 1rem' }}>
                                        <div>
                                            <div style={{ fontWeight: '600' }}>{bundle.name || `${bundle.credits} credit`}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{bundle.credits} credit · {formatAmount(bundle.price)}</div>
                                        </div>
                                        <button
                                            className="logout-btn"
                                            style={{ backgroundColor: 'var(--brand-600)', color: 'white', border: 'none' }}
                                            onClick={() => createCreditInvoice(bundle)}
                                            disabled={creditStatus === 'creating'}
                                        >
                                            Худалдаж авах
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {creditStatus === 'pending' && creditInvoice && (
                            <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>QPay төлбөр</p>
                                {creditInvoice.qr_image ? (
                                    <img src={`data:image/png;base64,${creditInvoice.qr_image}`} alt="QPay QR" style={{ width: '180px', marginBottom: '0.75rem' }} />
                                ) : null}
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <button className="logout-btn" style={{ backgroundColor: 'var(--brand-600)', color: 'white', border: 'none' }} onClick={checkCreditPayment} disabled={isCheckingCredit}>
                                        {isCheckingCredit ? 'Шалгаж байна...' : 'Төлбөр шалгах'}
                                    </button>
                                    <button className="logout-btn" onClick={() => { setCreditInvoice(null); setCreditStatus('idle'); }}>
                                        Болих
                                    </button>
                                </div>
                                {creditError && <p style={{ color: '#dc2626', marginTop: '0.75rem' }}>{creditError}</p>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Links */}
                <div className="profile-section">
                    <h3 className="section-title">
                        <FileText size={20} />
                        Миний өгөгдөл
                    </h3>
                    <div className="profile-links">
                        <Link to="/profile/letterhead-templates" className="profile-link-card">
                            <div className="profile-link-title">Миний хадгалсан албан бичгийн загварууд</div>
                            <div className="profile-link-desc">Өөрийн загваруудыг хадгалах, сонгох, засах</div>
                        </Link>
                    </div>
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
