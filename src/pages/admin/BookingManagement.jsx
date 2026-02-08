import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import { Calendar, User, Mail, DollarSign, Clock, CheckCircle2, XCircle, AlertCircle, Search, Filter } from 'lucide-react';

const BookingManagement = () => {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');

    useEffect(() => {
        setLoading(true);
        const q = query(collection(db, "bookings"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(
            q,
            (querySnapshot) => {
                const data = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setBookings(data);
                setLoading(false);
            },
            (error) => {
                console.error("Error fetching bookings:", error);
                setLoading(false);
            }
        );
        return () => unsubscribe();
    }, []);

    const updateStatus = async (id, newStatus) => {
        if (!window.confirm(`${newStatus} төлөвт шилжүүлэхдээ итгэлтэй байна уу?`)) return;
        try {
            await updateDoc(doc(db, "bookings", id), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
            setBookings(bookings.map(b => b.id === id ? { ...b, status: newStatus } : b));
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    const filteredBookings = bookings.filter(b => {
        const matchesSearch =
            b.userEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            b.trainingTitle?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'ALL' || b.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const getStatusStyle = (booking) => {
        const status = booking.status;
        const hasRemaining = Number(booking.remainingAmount || 0) > 0;
        switch (status) {
            case 'PAID':
            case 'CONFIRMED':
                return hasRemaining
                    ? { bg: 'var(--brand-50)', color: '#e11d48', icon: CheckCircle2, text: 'Урьдчилгаа төлсөн' }
                    : { bg: '#ecfdf5', color: '#059669', icon: CheckCircle2, text: 'Баталгаажсан' };
            case 'PENDING':
                return { bg: '#fff7ed', color: '#d97706', icon: AlertCircle, text: 'Хүлээгдэж буй' };
            case 'CANCELLED':
                return { bg: '#fef2f2', color: '#dc2626', icon: XCircle, text: 'Цуцалсан' };
            default:
                return { bg: 'var(--ink-100)', color: 'var(--ink-500)', icon: AlertCircle, text: status };
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid var(--ink-200)', borderTopColor: '#e11d48', borderRadius: '50%' }}></div>
        </div>
    );

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: 'var(--ink-900)', marginBottom: '0.5rem' }}>
                    Захиалгын удирдлага
                </h1>
                <p style={{ color: 'var(--ink-500)' }}>Сургалтын захиалга болон төлбөрийн хяналт</p>
            </div>

            {/* Filters */}
            <div style={{
                backgroundColor: 'white',
                padding: '1.25rem',
                borderRadius: '16px',
                border: '1px solid var(--ink-100)',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
                    <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)' }} />
                    <input
                        type="text"
                        placeholder="Имэйл эсвэл сургалтаар хайх..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.625rem 1rem 0.625rem 2.5rem',
                            borderRadius: '10px',
                            border: '1px solid var(--ink-200)',
                            fontSize: '0.9rem',
                            outline: 'none'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {['ALL', 'PENDING', 'PAID', 'CANCELLED'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                fontWeight: '600',
                                cursor: 'pointer',
                                border: '1px solid',
                                backgroundColor: filterStatus === status ? '#e11d48' : 'white',
                                color: filterStatus === status ? 'white' : 'var(--ink-500)',
                                borderColor: filterStatus === status ? '#e11d48' : 'var(--ink-200)',
                            }}
                        >
                            {status === 'ALL' ? 'Бүгд' : status === 'PENDING' ? 'Хүлээгдэж буй' : status === 'PAID' ? 'Төлөгдсөн' : 'Цуцалсан'}
                        </button>
                    ))}
                </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--ink-100)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--ink-100)' }}>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Сургалт</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Хэрэглэгч</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Цаг</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Төлбөр</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Төлөв</th>
                            <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Үйлдэл</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBookings.map(b => {
                            const status = getStatusStyle(b);
                            return (
                                <tr key={b.id} style={{ borderBottom: '1px solid var(--ink-100)' }}>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <div style={{ fontWeight: '600', color: 'var(--ink-900)' }}>{b.trainingTitle}</div>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--ink-900)' }}>{b.userName || 'Зочин'}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--ink-500)' }}>{b.userEmail}</div>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', color: '#444' }}>
                                            <Calendar size={14} color="var(--ink-500)" /> {b.selectedDate}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'var(--ink-500)' }}>
                                            <Clock size={14} /> {b.selectedTime}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <div style={{ fontWeight: '700', color: 'var(--ink-900)' }}>₮{Number(b.amount).toLocaleString()}</div>
                                        {Number(b.remainingAmount || 0) > 0 && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--ink-500)' }}>
                                                Үлдэгдэл: ₮{Number(b.remainingAmount).toLocaleString()}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.35rem',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: '99px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700',
                                            backgroundColor: status.bg,
                                            color: status.color
                                        }}>
                                            <status.icon size={12} />
                                            {status.text}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem 1.5rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            {b.status === 'PENDING' && (
                                                <button onClick={() => updateStatus(b.id, 'PAID')} style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #d1fae5', cursor: 'pointer' }}>
                                                    <CheckCircle2 size={16} />
                                                </button>
                                            )}
                                            {b.status !== 'CANCELLED' && (
                                                <button onClick={() => updateStatus(b.id, 'CANCELLED')} style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fee2e2', cursor: 'pointer' }}>
                                                    <XCircle size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredBookings.length === 0 && (
                            <tr>
                                <td colSpan="6" style={{ padding: '4rem', textAlign: 'center', color: 'var(--ink-400)' }}>Захиалга олдсонгүй.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default BookingManagement;
