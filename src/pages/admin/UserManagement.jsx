import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, orderBy, increment, addDoc } from 'firebase/firestore';
import { Shield, ShieldOff, Ban, CheckCircle, Search, AlertCircle, RefreshCw, Calendar, DollarSign, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { logAdminAction } from '../../lib/logger';

const UserManagement = () => {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('all'); // all, admin, user
    const [filterStatus, setFilterStatus] = useState('all'); // all, active, banned
    const [creditTopupUser, setCreditTopupUser] = useState(null);
    const [topupAmount, setTopupAmount] = useState('');
    const [topupNote, setTopupNote] = useState('');
    const [topupLoading, setTopupLoading] = useState(false);
    const [topupError, setTopupError] = useState('');

    const parseDateValue = (value) => {
        if (!value) return null;
        if (value?.toDate) return value.toDate();
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatDate = (value) => {
        if (!value) return '-';
        return value.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const getSubscriptionMeta = (user) => {
        const endAt = parseDateValue(user?.subscription?.endAt);
        const isActive = user?.subscription?.status === 'active' && endAt && endAt.getTime() > Date.now();
        let daysLeft = null;
        if (endAt) {
            const diff = endAt.getTime() - Date.now();
            daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
        }
        return { endAt, isActive, daysLeft };
    };

    const fetchUsers = async () => {
        setLoading(true);
        try {
            // Fetch all users (for now - optimized pagination would use startAfter)
            const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const usersData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersData);
            setFilteredUsers(usersData);
        } catch (error) {
            console.error("Error fetching users:", error);
            alert("Хэрэглэгчдийг татахад алдаа гарлаа.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter Logic
    useEffect(() => {
        let result = users;

        if (searchTerm) {
            result = result.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        if (filterRole !== 'all') {
            result = result.filter(u => (u.role || 'user') === filterRole);
        }

        if (filterStatus !== 'all') {
            result = result.filter(u => (u.status || 'active') === filterStatus);
        }

        setFilteredUsers(result);
    }, [users, searchTerm, filterRole, filterStatus]);

    const handleRoleChange = async (userId, newRole) => {
        if (!window.confirm(`Энэ хэрэглэгчийн эрхийг ${newRole} болгохдоо итгэлтэй байна уу?`)) return;

        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                role: newRole,
                updatedAt: serverTimestamp()
            });

            // Log action
            await logAdminAction('CHANGE_USER_ROLE', {
                targetUid: userId,
                targetEmail: users.find(u => u.id === userId)?.email,
                newRole
            }, currentUser);

            // Optimistic update
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (error) {
            console.error("Error updating role:", error);
            alert("Эрх өөрчлөхөд алдаа гарлаа.");
        }
    };

    const handleStatusChange = async (userId, newStatus) => {
        const action = newStatus === 'banned' ? 'хориглох' : 'идэвхжүүлэх';
        if (!window.confirm(`Энэ хэрэглэгчийг ${action} үйлдэлдээ итгэлтэй байна уу?`)) return;

        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                status: newStatus,
                updatedAt: serverTimestamp()
            });

            // Log action
            await logAdminAction(newStatus === 'banned' ? 'BAN_USER' : 'UNBAN_USER', {
                targetUid: userId,
                targetEmail: users.find(u => u.id === userId)?.email
            }, currentUser);

            // Optimistic update
            setUsers(users.map(u => u.id === userId ? { ...u, status: newStatus } : u));
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Төлөв өөрчлөхөд алдаа гарлаа.");
        }
    }

    const handleSubscriptionUpdate = async (userId) => {
        const target = users.find(u => u.id === userId);
        const currentEnd = target?.subscription?.endAt?.toDate ? target.subscription.endAt.toDate() : target?.subscription?.endAt;
        const defaultValue = currentEnd ? new Date(currentEnd).toISOString().split('T')[0] : '';
        const endDateInput = window.prompt('Subscription дуусах огноо (YYYY-MM-DD):', defaultValue);
        if (!endDateInput) return;

        const endDate = new Date(endDateInput);
        if (Number.isNaN(endDate.getTime())) {
            alert('Огнооны формат буруу байна.');
            return;
        }

        const status = endDate.getTime() > Date.now() ? 'active' : 'inactive';
        const startAt = target?.subscription?.startAt || new Date().toISOString();

        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                subscription: {
                    status,
                    startAt,
                    endAt: endDate.toISOString(),
                    updatedAt: serverTimestamp(),
                    updatedBy: currentUser?.email || 'admin'
                },
                updatedAt: serverTimestamp()
            });

            await logAdminAction('UPDATE_SUBSCRIPTION', {
                targetUid: userId,
                targetEmail: target?.email,
                status,
                endAt: endDate.toISOString()
            }, currentUser);

            setUsers(users.map(u => u.id === userId ? {
                ...u,
                subscription: {
                    status,
                    startAt,
                    endAt: endDate.toISOString()
                }
            } : u));
        } catch (error) {
            console.error("Error updating subscription:", error);
            alert("Subscription шинэчлэхэд алдаа гарлаа.");
        }
    };

    const openCreditsTopup = async (userId) => {
        const target = users.find(u => u.id === userId);
        if (!target) return;
        setCreditTopupUser(target);
        setTopupAmount('');
        setTopupNote('');
        setTopupError('');
    };

    const closeTopupModal = (force = false) => {
        if (topupLoading && !force) return;
        setCreditTopupUser(null);
        setTopupAmount('');
        setTopupNote('');
        setTopupError('');
    };

    const handleCreditsTopup = async () => {
        if (!creditTopupUser) return;
        const amount = Number(topupAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setTopupError('Цэнэглэх хэмжээ буруу байна.');
            return;
        }

        setTopupLoading(true);
        setTopupError('');
        try {
            const userRef = doc(db, "users", creditTopupUser.id);
            await updateDoc(userRef, {
                'credits.balance': increment(amount),
                'credits.updatedAt': serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            try {
                await addDoc(collection(db, "creditTransactions"), {
                    userId: creditTopupUser.id,
                    credits: amount,
                    amount: 0,
                    type: 'admin_topup',
                    note: topupNote?.trim() || null,
                    adminId: currentUser?.uid || null,
                    adminEmail: currentUser?.email || null,
                    createdAt: serverTimestamp()
                });
            } catch (error) {
                console.error("Error logging credit transaction:", error);
            }

            await logAdminAction('TOPUP_CREDITS', {
                targetUid: creditTopupUser.id,
                targetEmail: creditTopupUser?.email,
                credits: amount,
                note: topupNote?.trim() || null
            }, currentUser);

            setUsers(prev => prev.map(u => u.id === creditTopupUser.id ? {
                ...u,
                credits: {
                    ...u.credits,
                    balance: (u.credits?.balance || 0) + amount,
                    updatedAt: new Date().toISOString()
                }
            } : u));

            closeTopupModal(true);
        } catch (error) {
            console.error("Error topping up credits:", error);
            setTopupError('Credits цэнэглэхэд алдаа гарлаа.');
        } finally {
            setTopupLoading(false);
        }
    };

    const currentTopupBalance = creditTopupUser?.credits?.balance || 0;
    const parsedTopupAmount = Number(topupAmount);
    const topupPreviewBalance = creditTopupUser && Number.isFinite(parsedTopupAmount) && parsedTopupAmount > 0
        ? currentTopupBalance + parsedTopupAmount
        : currentTopupBalance;

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid var(--ink-200)', borderTopColor: '#e11d48', borderRadius: '50%' }}></div>
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: 'var(--ink-900)' }}>
                    Хэрэглэгчийн удирдлага
                </h1>
                <button
                    onClick={fetchUsers}
                    title="Refresh"
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--ink-200)', backgroundColor: 'white', color: 'var(--ink-500)', cursor: 'pointer' }}
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Filters */}
            <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)' }} />
                    <input
                        type="text"
                        placeholder="Имэйлээр хайх..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.5rem', borderRadius: '8px', border: '1px solid var(--ink-200)', outline: 'none' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        style={{ padding: '0.5rem 2rem 0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--ink-200)', backgroundColor: 'white', cursor: 'pointer' }}
                    >
                        <option value="all">Бүх эрх</option>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={{ padding: '0.5rem 2rem 0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--ink-200)', backgroundColor: 'white', cursor: 'pointer' }}
                    >
                        <option value="all">Бүх төлөв</option>
                        <option value="active">Active</option>
                        <option value="banned">Banned</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflowX: 'auto', border: '1px solid var(--ink-100)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--ink-200)' }}>
                        <tr>
                            <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--ink-500)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Имэйл</th>
                            <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--ink-500)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Эрх</th>
                            <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--ink-500)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Төлөв</th>
                            <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--ink-500)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Сарын subscription</th>
                            <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--ink-500)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Credits үлдэгдэл</th>
                            <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--ink-500)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Үйлдэл</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-400)' }}>
                                    Хэрэглэгч олдсонгүй.
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map(user => (
                                <tr key={user.id} style={{ borderBottom: '1px solid var(--ink-100)', transition: 'background 0.1s' }} className="hover:bg-slate-50">
                                    <td style={{ padding: '1rem', color: '#334155' }}>{user.email}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            backgroundColor: user.role === 'admin' ? '#dbeafe' : 'var(--ink-100)',
                                            color: user.role === 'admin' ? '#1e40af' : 'var(--ink-500)'
                                        }}>
                                            {user.role || 'user'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: '500',
                                            color: user.status === 'banned' ? '#ef4444' : '#16a34a'
                                        }}>
                                            {user.status === 'banned' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                                            {user.status === 'banned' ? 'Banned' : 'Active'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        {(() => {
                                            const { endAt, isActive, daysLeft } = getSubscriptionMeta(user);
                                            const remainingLabel = endAt
                                                ? (daysLeft >= 0 ? `${daysLeft} өдөр үлдсэн` : 'Хугацаа дууссан')
                                                : '-';
                                            return (
                                                <div>
                                                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: isActive ? '#16a34a' : 'var(--ink-500)' }}>
                                                        {isActive ? 'Идэвхтэй' : 'Идэвхгүй'}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-400)' }}>
                                                        Дуусах: {endAt ? formatDate(endAt) : '-'}{endAt ? ` · ${remainingLabel}` : ''}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: '700', color: 'var(--ink-900)' }}>
                                            {(user?.credits?.balance || 0).toLocaleString('mn-MN')}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--ink-400)' }}>credit</div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {user.role !== 'admin' ? (
                                                <button
                                                    onClick={() => handleRoleChange(user.id, 'admin')}
                                                    title="Make Admin"
                                                    style={{ padding: '8px', borderRadius: '6px', backgroundColor: 'var(--brand-50)', color: '#e11d48', border: 'none', cursor: 'pointer' }}
                                                >
                                                    <Shield size={18} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleRoleChange(user.id, 'user')}
                                                    title="Remove Admin"
                                                    style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#ef4444', border: 'none', cursor: 'pointer' }}
                                                >
                                                    <ShieldOff size={18} />
                                                </button>
                                            )}

                                            {user.status !== 'banned' ? (
                                                <button
                                                    onClick={() => handleStatusChange(user.id, 'banned')}
                                                    title="Ban User"
                                                    style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#fff1f2', color: '#be123c', border: 'none', cursor: 'pointer' }}
                                                >
                                                    <Ban size={18} />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleStatusChange(user.id, 'active')}
                                                    title="Unban User"
                                                    style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#f0fdf4', color: '#15803d', border: 'none', cursor: 'pointer' }}
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                            )}

                                            <button
                                                onClick={() => handleSubscriptionUpdate(user.id)}
                                                title="Subscription"
                                                style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#ecfeff', color: '#0891b2', border: 'none', cursor: 'pointer' }}
                                            >
                                                <Calendar size={18} />
                                            </button>

                                            <button
                                                onClick={() => openCreditsTopup(user.id)}
                                                title="Credits цэнэглэх"
                                                style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#fef9c3', color: '#ca8a04', border: 'none', cursor: 'pointer' }}
                                            >
                                                <DollarSign size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <p style={{ marginTop: '1rem', color: 'var(--ink-400)', fontSize: '0.875rem', textAlign: 'center' }}>
                Showing {filteredUsers.length} of {users.length} users
            </p>

            {creditTopupUser && (
                <div
                    onClick={closeTopupModal}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50,
                        padding: '1.5rem'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: 'white',
                            width: '100%',
                            maxWidth: '520px',
                            borderRadius: '16px',
                            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
                            border: '1px solid var(--ink-100)',
                            padding: '1.5rem'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--ink-900)', marginBottom: '0.25rem' }}>
                                    Credits цэнэглэх
                                </h3>
                                <p style={{ fontSize: '0.875rem', color: 'var(--ink-500)' }}>{creditTopupUser.email}</p>
                            </div>
                            <button
                                onClick={closeTopupModal}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--ink-400)' }}
                                aria-label="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--ink-50)', borderRadius: '10px', border: '1px solid var(--ink-100)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--ink-500)' }}>Одоогийн үлдэгдэл</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--ink-900)' }}>
                                    {currentTopupBalance.toLocaleString('mn-MN')} credit
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--ink-600)', marginBottom: '0.5rem' }}>
                                    Цэнэглэх хэмжээ (credit)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={topupAmount}
                                    onChange={(e) => setTopupAmount(e.target.value)}
                                    placeholder="Жишээ: 10"
                                    style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid var(--ink-200)', outline: 'none' }}
                                />
                            </div>

                            <div style={{ fontSize: '0.85rem', color: 'var(--ink-500)' }}>
                                Шинэ үлдэгдэл: <strong style={{ color: 'var(--ink-900)' }}>{topupPreviewBalance.toLocaleString('mn-MN')}</strong> credit
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: 'var(--ink-600)', marginBottom: '0.5rem' }}>
                                    Тэмдэглэл (заавал биш)
                                </label>
                                <textarea
                                    rows="3"
                                    value={topupNote}
                                    onChange={(e) => setTopupNote(e.target.value)}
                                    placeholder="Тайлбар бичих боломжтой"
                                    style={{ width: '100%', padding: '0.7rem 0.9rem', borderRadius: '10px', border: '1px solid var(--ink-200)', outline: 'none', resize: 'vertical' }}
                                />
                            </div>

                            {topupError && (
                                <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>
                                    {topupError}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    onClick={closeTopupModal}
                                    disabled={topupLoading}
                                    style={{ padding: '0.6rem 1.2rem', borderRadius: '10px', border: '1px solid var(--ink-200)', backgroundColor: 'white', color: 'var(--ink-600)', cursor: 'pointer' }}
                                >
                                    Болих
                                </button>
                                <button
                                    onClick={handleCreditsTopup}
                                    disabled={topupLoading}
                                    style={{ padding: '0.6rem 1.4rem', borderRadius: '10px', border: 'none', backgroundColor: '#e11d48', color: 'white', cursor: 'pointer' }}
                                >
                                    {topupLoading ? 'Цэнэглэж байна...' : 'Цэнэглэх'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
