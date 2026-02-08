import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getCountFromServer, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { Users, UserPlus, Activity, DollarSign, TrendingUp, BarChart2 } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';

// --- Components ---

const StatCard = ({ title, value, icon: Icon, color, subtext, trend }) => (
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
        {(subtext || trend) && (
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '1rem', fontSize: '0.85rem' }}>
                {trend && (
                    <span style={{ color: trend > 0 ? '#16a34a' : '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', marginRight: '6px' }}>
                        {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
                    </span>
                )}
                <span style={{ color: 'var(--ink-400)' }}>{subtext}</span>
            </div>
        )}
    </div>
);

const ChartCard = ({ title, children }) => (
    <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid var(--ink-100)', height: '100%', minHeight: '350px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1.5rem', color: 'var(--ink-900)' }}>{title}</h3>
        <div style={{ flex: 1 }}>
            {children}
        </div>
    </div>
);

// --- Data Helpers ---
const COLORS = ['#e11d48', '#fb7185', '#f59e0b', '#16a34a'];

const AdminDashboard = () => {
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        newUsersToday: 0
    });
    const [userGrowthData, setUserGrowthData] = useState([]);
    const [usageData, setUsageData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Basic Counts
                const usersColl = collection(db, "users");
                const totalSnap = await getCountFromServer(usersColl);

                // Mock "Active" (e.g., login last 30 days - implementation pending)
                // For now, let's assume 80% are active for the visual
                const total = totalSnap.data().count;
                const active = Math.floor(total * 0.8);

                // 2. Mock Growth Data (Since we don't have historical snapshots yet)
                // In production, you'd aggregate this from `createdAt` timestamps
                const mockGrowth = [
                    { name: 'Mon', users: total - 5 },
                    { name: 'Tue', users: total - 4 },
                    { name: 'Wed', users: total - 3 },
                    { name: 'Thu', users: total - 1 },
                    { name: 'Fri', users: total },
                    { name: 'Sat', users: total + 2 },
                    { name: 'Sun', users: total + 5 },
                ];

                // 3. Mock Usage Data (Which tools are popular)
                const mockUsage = [
                    { name: 'Statement Organizer', value: 65 },
                    { name: 'Social Insurance', value: 35 },
                ];

                // 4. Fetch Real Revenue
                const invoicesColl = collection(db, "qpayInvoices");
                const revenueQuery = query(invoicesColl, where("status", "==", "PAID"));
                const revenueSnap = await getDocs(revenueQuery);
                let totalRevenue = 0;
                revenueSnap.forEach(doc => {
                    totalRevenue += (doc.data().amount || 0);
                });

                setStats({
                    totalUsers: total,
                    activeUsers: active,
                    newUsersToday: 2, // Mock for now
                    totalRevenue
                });
                setUserGrowthData(mockGrowth);
                setUsageData(mockUsage);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid var(--ink-200)', borderTopColor: '#e11d48', borderRadius: '50%' }}></div>
        </div>
    );

    return (
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{
                marginBottom: '2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                gap: '1rem'
            }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: 'var(--ink-900)', marginBottom: '0.5rem' }}>
                        Хяналтын самбар
                    </h1>
                    <p style={{ color: 'var(--ink-500)' }}>Системийн ерөнхий төлөв байдал</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button style={{ backgroundColor: 'white', border: '1px solid var(--ink-200)', padding: '0.5rem 1rem', borderRadius: '8px', color: 'var(--ink-500)', fontWeight: '500' }}>
                        Last 7 Days
                    </button>
                    <button style={{ backgroundColor: '#e11d48', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingUp size={16} /> Report
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <StatCard
                    title="Нийт хэрэглэгч"
                    value={stats.totalUsers}
                    icon={Users}
                    color="#e11d48"
                    trend={12}
                    subtext="user growth"
                />
                <StatCard
                    title="Идэвхтэй (DAU)"
                    value={stats.activeUsers}
                    icon={Activity}
                    color="#16a34a"
                    subtext="Currently active"
                />
                <StatCard
                    title="Шинэ (Өнөөдөр)"
                    value={`+${stats.newUsersToday}`}
                    icon={UserPlus}
                    color="#f59e0b"
                    subtext="Signups today"
                />
                <StatCard
                    title="Нийт Орлого"
                    value={`₮${(stats.totalRevenue || 0).toLocaleString()}`}
                    icon={DollarSign}
                    color="#fb7185"
                    subtext="MRR (Monthly)"
                />
            </div>

            {/* Charts Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* User Growth Chart */}
                <ChartCard title="Хэрэглэгчийн өсөлт (7 хоног)">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={userGrowthData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--ink-200)" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-400)', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--ink-400)', fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--ink-900)', border: 'none', borderRadius: '8px', color: 'white' }}
                                itemStyle={{ color: 'white' }}
                                cursor={{ stroke: '#e11d48', strokeWidth: 2 }}
                            />
                            <Area type="monotone" dataKey="users" stroke="#e11d48" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* Tool Usage Chart */}
                <ChartCard title="Хэрэгслийн ашиглалт">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={usageData}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={110}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {usageData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ borderRadius: '8px' }} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

        </div>
    );
};

export default AdminDashboard;
