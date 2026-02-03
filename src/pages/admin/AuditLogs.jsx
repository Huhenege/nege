import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Activity, User, Clock, Info, Shield, Ban, CheckCircle } from 'lucide-react';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const q = query(
                    collection(db, "audit_logs"),
                    orderBy("timestamp", "desc"),
                    limit(100)
                );
                const querySnapshot = await getDocs(q);
                const logsData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setLogs(logsData);
            } catch (error) {
                console.error("Error fetching logs:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchLogs();
    }, []);

    const getActionIcon = (action) => {
        switch (action) {
            case 'BAN_USER': return <Ban size={18} color="#ef4444" />;
            case 'UNBAN_USER': return <CheckCircle size={18} color="#10b981" />;
            case 'CHANGE_USER_ROLE': return <Shield size={18} color="#4f46e5" />;
            default: return <Info size={18} color="#64748b" />;
        }
    };

    const formatActionName = (action) => {
        return action.replace(/_/g, ' ');
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%' }}></div>
        </div>
    );

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.5rem' }}>
                    Системийн лог
                </h1>
                <p style={{ color: '#64748b' }}>Админуудын хийсэн үйлдлийн түүх</p>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                <th style={{ padding: '1rem', color: '#64748b', fontWeight: '600', fontSize: '0.875rem' }}>Үйлдэл</th>
                                <th style={{ padding: '1rem', color: '#64748b', fontWeight: '600', fontSize: '0.875rem' }}>Админ</th>
                                <th style={{ padding: '1rem', color: '#64748b', fontWeight: '600', fontSize: '0.875rem' }}>Дэлгэрэнгүй</th>
                                <th style={{ padding: '1rem', color: '#64748b', fontWeight: '600', fontSize: '0.875rem' }}>Хэзээ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            {getActionIcon(log.action)}
                                            <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.9rem' }}>
                                                {formatActionName(log.action)}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <User size={16} color="#94a3b8" />
                                            <span style={{ color: '#475569', fontSize: '0.875rem' }}>{log.adminEmail}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                            {log.details?.targetEmail && (
                                                <div style={{ marginBottom: '2px' }}>
                                                    Target: <span style={{ color: '#1e293b', fontWeight: '500' }}>{log.details.targetEmail}</span>
                                                </div>
                                            )}
                                            {log.details?.newRole && (
                                                <div>
                                                    New Role: <span style={{ color: '#4f46e5', fontWeight: '600' }}>{log.details.newRole}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', color: '#94a3b8', fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <Clock size={14} />
                                            {log.timestamp?.toDate().toLocaleString()}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {logs.length === 0 && (
                    <div style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
                        Одоогоор бүртгэгдсэн лог байхгүй байна.
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditLogs;
