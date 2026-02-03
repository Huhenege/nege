import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Shield, ShieldOff, Ban, CheckCircle, Search, Filter, AlertCircle, RefreshCw, Activity } from 'lucide-react';
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

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%' }}></div>
        </div>
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: '#1e293b' }}>
                    Хэрэглэгчийн удирдлага
                </h1>
                <button
                    onClick={fetchUsers}
                    title="Refresh"
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#64748b', cursor: 'pointer' }}
                >
                    <RefreshCw size={20} />
                </button>
            </div>

            {/* Filters */}
            <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                        type="text"
                        placeholder="Имэйлээр хайх..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ width: '100%', padding: '0.6rem 0.6rem 0.6rem 2.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
                    />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <select
                        value={filterRole}
                        onChange={(e) => setFilterRole(e.target.value)}
                        style={{ padding: '0.5rem 2rem 0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer' }}
                    >
                        <option value="all">Бүх эрх</option>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                    </select>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        style={{ padding: '0.5rem 2rem 0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white', cursor: 'pointer' }}
                    >
                        <option value="all">Бүх төлөв</option>
                        <option value="active">Active</option>
                        <option value="banned">Banned</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ padding: '1rem', fontWeight: '600', color: '#64748b', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Имэйл</th>
                            <th style={{ padding: '1rem', fontWeight: '600', color: '#64748b', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Эрх</th>
                            <th style={{ padding: '1rem', fontWeight: '600', color: '#64748b', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Төлөв</th>
                            <th style={{ padding: '1rem', fontWeight: '600', color: '#64748b', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Үйлдэл</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan="4" style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                                    Хэрэглэгч олдсонгүй.
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map(user => (
                                <tr key={user.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }} className="hover:bg-slate-50">
                                    <td style={{ padding: '1rem', color: '#334155' }}>{user.email}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            backgroundColor: user.role === 'admin' ? '#dbeafe' : '#f1f5f9',
                                            color: user.role === 'admin' ? '#1e40af' : '#64748b'
                                        }}>
                                            {user.role || 'user'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', fontWeight: '500',
                                            color: user.status === 'banned' ? '#ef4444' : '#10b981'
                                        }}>
                                            {user.status === 'banned' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                                            {user.status === 'banned' ? 'Banned' : 'Active'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {user.role !== 'admin' ? (
                                                <button
                                                    onClick={() => handleRoleChange(user.id, 'admin')}
                                                    title="Make Admin"
                                                    style={{ padding: '8px', borderRadius: '6px', backgroundColor: '#eff6ff', color: '#2563eb', border: 'none', cursor: 'pointer' }}
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
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center' }}>
                Showing {filteredUsers.length} of {users.length} users
            </p>
        </div>
    );
};

export default UserManagement;
