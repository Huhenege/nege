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
            case 'UNBAN_USER': return <CheckCircle size={18} color="#16a34a" />;
            case 'CHANGE_USER_ROLE': return <Shield size={18} color="#e11d48" />;
            default: return <Info size={18} color="var(--ink-500)" />;
        }
    };

    const formatActionName = (action) => {
        return action.replace(/_/g, ' ');
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid var(--ink-200)', borderTopColor: '#e11d48', borderRadius: '50%' }}></div>
        </div>
    );

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: 'var(--ink-900)', marginBottom: '0.5rem' }}>
                    Системийн лог
                </h1>
                <p style={{ color: 'var(--ink-500)' }}>Админуудын хийсэн үйлдлийн түүх</p>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--ink-200)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--ink-200)' }}>
                                <th style={{ padding: '1rem', color: 'var(--ink-500)', fontWeight: '600', fontSize: '0.875rem' }}>Үйлдэл</th>
                                <th style={{ padding: '1rem', color: 'var(--ink-500)', fontWeight: '600', fontSize: '0.875rem' }}>Админ</th>
                                <th style={{ padding: '1rem', color: 'var(--ink-500)', fontWeight: '600', fontSize: '0.875rem' }}>Дэлгэрэнгүй</th>
                                <th style={{ padding: '1rem', color: 'var(--ink-500)', fontWeight: '600', fontSize: '0.875rem' }}>Хэзээ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log) => (
                                <tr key={log.id} style={{ borderBottom: '1px solid var(--ink-100)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            {getActionIcon(log.action)}
                                            <span style={{ fontWeight: '600', color: 'var(--ink-900)', fontSize: '0.9rem' }}>
                                                {formatActionName(log.action)}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <User size={16} color="var(--ink-400)" />
                                            <span style={{ color: '#475569', fontSize: '0.875rem' }}>{log.adminEmail}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontSize: '0.85rem', color: 'var(--ink-500)' }}>
                                            {log.details?.targetEmail && (
                                                <div style={{ marginBottom: '2px' }}>
                                                    Target: <span style={{ color: 'var(--ink-900)', fontWeight: '500' }}>{log.details.targetEmail}</span>
                                                </div>
                                            )}
                                            {log.details?.newRole && (
                                                <div>
                                                    New Role: <span style={{ color: '#e11d48', fontWeight: '600' }}>{log.details.newRole}</span>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem', color: 'var(--ink-400)', fontSize: '0.85rem' }}>
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
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--ink-400)' }}>
                        Одоогоор бүртгэгдсэн лог байхгүй байна.
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditLogs;
