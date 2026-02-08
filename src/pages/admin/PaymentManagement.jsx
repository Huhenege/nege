import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, getDocs, limit, where } from 'firebase/firestore';
import {
    DollarSign,
    CreditCard,
    Calendar,
    CheckCircle2,
    XCircle,
    Clock,
    Search,
    Filter,
    ArrowUpRight,
    SearchX
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, color, subtext }) => (
    <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid var(--ink-100)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
                <p style={{ color: 'var(--ink-500)', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: '500' }}>{title}</p>
                <h3 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--ink-900)', lineHeight: 1 }}>{value}</h3>
            </div>
            <div style={{ padding: '12px', backgroundColor: color + '15', borderRadius: '12px', color: color }}>
                <Icon size={24} />
            </div>
        </div>
        {subtext && (
            <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--ink-400)' }}>
                {subtext}
            </div>
        )}
    </div>
);

const PaymentManagement = () => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('ALL');
    const [stats, setStats] = useState({
        totalRevenue: 0,
        successCount: 0,
        pendingCount: 0,
        todayRevenue: 0
    });

    useEffect(() => {
        const fetchPayments = async () => {
            try {
                const q = query(collection(db, "qpayInvoices"), orderBy("createdAt", "desc"));
                const querySnapshot = await getDocs(q);

                const paymentList = [];
                let total = 0;
                let success = 0;
                let pending = 0;
                let today = 0;
                const todayStr = new Date().toISOString().split('T')[0];

                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    paymentList.push({ id: doc.id, ...data });

                    if (data.status === 'PAID') {
                        total += (data.amount || 0);
                        success++;
                        if (data.createdAt && data.createdAt.startsWith(todayStr)) {
                            today += (data.amount || 0);
                        }
                    } else if (data.status === 'CREATED') {
                        pending++;
                    }
                });

                setPayments(paymentList);
                setStats({
                    totalRevenue: total,
                    successCount: success,
                    pendingCount: pending,
                    todayRevenue: today
                });
            } catch (error) {
                console.error("Error fetching payments:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPayments();
    }, []);

    const filteredPayments = payments.filter(p => {
        const matchesSearch = p.invoice_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.sender_invoice_no?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'ALL' || p.status === filterStatus;
        return matchesSearch && matchesFilter;
    });

    const getStatusStyle = (status) => {
        switch (status) {
            case 'PAID':
                return { bg: '#ecfdf5', color: '#059669', icon: CheckCircle2, text: 'Амжилттай' };
            case 'CREATED':
                return { bg: '#fff7ed', color: '#d97706', icon: Clock, text: 'Хүлээгдэж буй' };
            case 'FAILED':
                return { bg: '#fef2f2', color: '#dc2626', icon: XCircle, text: 'Амжилтгүй' };
            default:
                return { bg: '#f8fafc', color: 'var(--ink-500)', icon: Clock, text: status };
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid var(--ink-200)', borderTopColor: '#e11d48', borderRadius: '50%' }}></div>
        </div>
    );

    return (
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: 'var(--ink-900)', marginBottom: '0.5rem' }}>
                    Төлбөрийн удирдлага
                </h1>
                <p style={{ color: 'var(--ink-500)' }}>QPay гүйлгээний түүх болон орлогын хяналт</p>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <StatCard
                    title="Нийт Орлого"
                    value={`₮${stats.totalRevenue.toLocaleString()}`}
                    icon={DollarSign}
                    color="#e11d48"
                    subtext="Бүх цаг үеийн нийт"
                />
                <StatCard
                    title="Өнөөдрийн Орлого"
                    value={`₮${stats.todayRevenue.toLocaleString()}`}
                    icon={ArrowUpRight}
                    color="#16a34a"
                    subtext="Өнөөдрийн амжилттай гүйлгээ"
                />
                <StatCard
                    title="Амжилттай гүйлгээ"
                    value={stats.successCount}
                    icon={CheckCircle2}
                    color="#16a34a"
                    subtext="Төлөгдсөн нэхэмжлэл"
                />
                <StatCard
                    title="Хүлээгдэж буй"
                    value={stats.pendingCount}
                    icon={Clock}
                    color="#f59e0b"
                    subtext="Үүсгэсэн боловч төлөөгүй"
                />
            </div>

            {/* Filters & Actions */}
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
                        placeholder="Нэхэмжлэлийн ID эсвэл дугаар..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.625rem 1rem 0.625rem 2.5rem',
                            borderRadius: '10px',
                            border: '1px solid var(--ink-200)',
                            fontSize: '0.9rem',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#e11d48'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--ink-200)'}
                    />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ink-500)', fontSize: '0.875rem' }}>
                        <Filter size={16} /> Төлөв:
                    </div>
                    {['ALL', 'PAID', 'CREATED', 'FAILED'].map(status => (
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
                                transition: 'all 0.2s',
                                backgroundColor: filterStatus === status ? '#e11d48' : 'white',
                                color: filterStatus === status ? 'white' : 'var(--ink-500)',
                                borderColor: filterStatus === status ? '#e11d48' : 'var(--ink-200)',
                            }}
                        >
                            {status === 'ALL' ? 'Бүгд' : status === 'PAID' ? 'Төлөгдсөн' : status === 'CREATED' ? 'Хүлээгдэж буй' : 'Алдаатай'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--ink-100)', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--ink-100)' }}>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Нэхэмжлэх ID</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Огноо</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Дүн</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Төлөв</th>
                                <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--ink-500)', textTransform: 'uppercase' }}>Гүйлгээний №</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPayments.length > 0 ? (
                                filteredPayments.map((payment) => {
                                    const status = getStatusStyle(payment.status);
                                    return (
                                        <tr key={payment.id} style={{ borderBottom: '1px solid var(--ink-100)', transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fcfdfe'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                    <div style={{ padding: '8px', backgroundColor: 'var(--ink-100)', borderRadius: '8px', color: 'var(--ink-500)' }}>
                                                        <CreditCard size={16} />
                                                    </div>
                                                    <span style={{ fontWeight: '600', color: 'var(--ink-900)', fontSize: '0.9rem' }}>{payment.invoice_id}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ink-500)', fontSize: '0.85rem' }}>
                                                    <Calendar size={14} />
                                                    {payment.createdAt ? new Date(payment.createdAt).toLocaleString('mn-MN') : 'N/A'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '1rem 1.5rem' }}>
                                                <span style={{ fontWeight: '700', color: 'var(--ink-900)' }}>₮{(payment.amount || 0).toLocaleString()}</span>
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
                                            <td style={{ padding: '1rem 1.5rem', color: 'var(--ink-500)', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                                {payment.sender_invoice_no || '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="5" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'var(--ink-400)' }}>
                                            <SearchX size={48} strokeWidth={1} />
                                            <p>Гүйлгээ олдсонгүй</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PaymentManagement;
