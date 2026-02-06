import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
    GraduationCap,
    Calendar,
    Clock,
    User,
    ArrowLeft,
    CheckCircle2,
    DollarSign,
    ArrowRight,
    Sparkles,
    Loader2,
    CalendarCheck
} from 'lucide-react';

const BusinessTraining = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const [trainings, setTrainings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTraining, setSelectedTraining] = useState(null);
    const [bookingData, setBookingData] = useState({
        date: '',
        time: ''
    });
    const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, creating, pending, success
    const [paymentInvoice, setPaymentInvoice] = useState(null);

    const qpayApiBase = (import.meta.env.VITE_QPAY_API_BASE || '/api').replace(/\/$/, '');

    useEffect(() => {
        const fetchTrainings = async () => {
            try {
                const q = query(collection(db, "trainings"), where("active", "==", true));
                const querySnapshot = await getDocs(q);
                const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTrainings(data);
                if (data.length > 0) setSelectedTraining(data[0]);
            } catch (error) {
                console.error("Error fetching trainings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTrainings();
    }, []);

    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        if (!bookingData.date || !bookingData.time) {
            alert('Огноо болон цагаа сонгоно уу.');
            return;
        }

        setPaymentStatus('creating');
        try {
            const response = await fetch(`${qpayApiBase}/qpay/invoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: selectedTraining.price,
                    description: `Сургалтын захиалга: ${selectedTraining.title}`,
                }),
            });
            const data = await response.json();
            if (data.invoice_id) {
                setPaymentInvoice(data);
                setPaymentStatus('pending');
            }
        } catch (error) {
            console.error('Invoice creation error:', error);
            setPaymentStatus('idle');
        }
    };

    const confirmBooking = async () => {
        try {
            await addDoc(collection(db, "bookings"), {
                trainingId: selectedTraining.id,
                trainingTitle: selectedTraining.title,
                userId: currentUser.uid,
                userName: currentUser.displayName || currentUser.email.split('@')[0],
                userEmail: currentUser.email,
                selectedDate: bookingData.date,
                selectedTime: bookingData.time,
                amount: selectedTraining.price,
                status: 'PAID',
                paymentId: paymentInvoice.invoice_id,
                createdAt: serverTimestamp()
            });
            setPaymentStatus('success');
        } catch (error) {
            console.error("Error saving booking:", error);
            alert("Захиалга хадгалахад алдаа гарлаа.");
        }
    };

    const checkPayment = async () => {
        if (!paymentInvoice) return;
        try {
            const response = await fetch(`${qpayApiBase}/qpay/check/${paymentInvoice.invoice_id}`);
            const data = await response.json();
            if (data.paid) {
                await confirmBooking();
            } else {
                alert('Төлбөр хараахан төлөгдөөгүй байна.');
            }
        } catch (error) {
            console.error('Payment check error:', error);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
            <Loader2 className="animate-spin" size={40} color="#4f46e5" />
        </div>
    );

    if (paymentStatus === 'success') {
        return (
            <div style={{ maxWidth: '600px', margin: '100px auto', padding: '2rem', textAlign: 'center', backgroundColor: 'white', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
                <div style={{ marginBottom: '2rem', display: 'inline-flex', padding: '1.5rem', backgroundColor: '#ecfdf5', borderRadius: '50%', color: '#10b981' }}>
                    <CheckCircle2 size={64} />
                </div>
                <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#1e293b', marginBottom: '1rem' }}>Амжилттай баталгаажлаа!</h1>
                <p style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '2rem' }}>
                    Таны сургалтын захиалга амжилттай бүртгэгдлээ. Бид таны бүртгэлтэй имэйл хаягаар холбогдох мэдээллийг илгээх болно.
                </p>
                <Link to="/ai-assistant" style={{
                    display: 'inline-block',
                    padding: '0.75rem 2rem',
                    backgroundColor: '#4f46e5',
                    color: 'white',
                    borderRadius: '12px',
                    textDecoration: 'none',
                    fontWeight: '600'
                }}>
                    Үндсэн хуудас руу буцах
                </Link>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '100px 1.5rem 3rem' }}>
            <Link to="/ai-assistant" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', textDecoration: 'none', marginBottom: '2rem', fontWeight: '500' }}>
                <ArrowLeft size={20} /> Буцах
            </Link>

            {selectedTraining ? (
                <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth > 992 ? '1.5fr 1fr' : '1fr', gap: '3rem' }}>
                    <div className="training-info">
                        <div style={{ position: 'relative', marginBottom: '2rem', borderRadius: '24px', overflow: 'hidden', height: '400px', backgroundColor: '#f1f5f9' }}>
                            {selectedTraining.imageUrl ? (
                                <img src={selectedTraining.imageUrl} alt={selectedTraining.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                                    <GraduationCap size={120} />
                                </div>
                            )}
                            <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem', padding: '0.5rem 1rem', background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Sparkles size={16} color="#4f46e5" />
                                <span style={{ fontWeight: '700', fontSize: '0.875rem' }}>Premium Training</span>
                            </div>
                        </div>

                        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#1e293b', marginBottom: '1.5rem', lineHeight: 1.1 }}>
                            {selectedTraining.title}
                        </h1>

                        <div style={{ display: 'flex', gap: '2rem', marginBottom: '2.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ padding: '10px', backgroundColor: '#f1f5f9', borderRadius: '12px', color: '#64748b' }}>
                                    <Clock size={20} />
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Хугацаа</p>
                                    <p style={{ fontWeight: '600' }}>{selectedTraining.duration}</p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ padding: '10px', backgroundColor: '#f0fdf4', borderRadius: '12px', color: '#10b981' }}>
                                    <DollarSign size={20} />
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>Төлбөр</p>
                                    <p style={{ fontWeight: '700', fontSize: '1.1rem' }}>{Number(selectedTraining.price).toLocaleString()}₮</p>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginBottom: '3rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Сургалтын тухай</h3>
                            <p style={{ color: '#475569', lineHeight: 1.7, fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}>
                                {selectedTraining.description}
                            </p>
                        </div>

                        <div style={{ padding: '2rem', backgroundColor: '#f8fafc', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1.5rem' }}>Багшийн мэдээлэл</h3>
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <User size={40} color="#94a3b8" />
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b' }}>{selectedTraining.teacherName}</h4>
                                    <p style={{ color: '#64748b', fontSize: '0.95rem' }}>{selectedTraining.teacherBio}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="booking-sidebar">
                        <div style={{ position: 'sticky', top: '100px', backgroundColor: 'white', padding: '2rem', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)', border: '1px solid #f1f5f9' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '2rem' }}>Цаг захиалах</h2>

                            {paymentStatus === 'idle' || paymentStatus === 'creating' ? (
                                <form onSubmit={handleBookingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', color: '#64748b', marginBottom: '0.75rem' }}>Огноо сонгох</label>
                                        <div style={{ position: 'relative' }}>
                                            <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                            <input
                                                type="date"
                                                required
                                                min={new Date().toISOString().split('T')[0]}
                                                value={bookingData.date}
                                                onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                                                style={{ width: '100%', padding: '0.875rem 0.875rem 0.875rem 2.5rem', borderRadius: '16px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.95rem' }}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '700', color: '#64748b', marginBottom: '0.75rem' }}>Цаг сонгох</label>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                                            {['10:00', '13:00', '16:00', '19:00'].map(t => (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => setBookingData({ ...bookingData, time: t })}
                                                    style={{
                                                        padding: '0.75rem',
                                                        borderRadius: '12px',
                                                        border: '1px solid',
                                                        borderColor: bookingData.time === t ? '#4f46e5' : '#e2e8f0',
                                                        backgroundColor: bookingData.time === t ? '#f5f3ff' : 'white',
                                                        color: bookingData.time === t ? '#4f46e5' : '#64748b',
                                                        fontWeight: '600',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '1rem', padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '20px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ color: '#64748b' }}>Нийт төлбөр:</span>
                                            <span style={{ fontWeight: '800', color: '#1e293b' }}>₮{Number(selectedTraining.price).toLocaleString()}</span>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={paymentStatus === 'creating'}
                                        style={{
                                            width: '100%',
                                            padding: '1.25rem',
                                            backgroundColor: '#4f46e5',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '16px',
                                            fontWeight: '700',
                                            fontSize: '1rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.75rem'
                                        }}
                                    >
                                        {paymentStatus === 'creating' ? <Loader2 className="animate-spin" /> : <CalendarCheck size={20} />}
                                        {paymentStatus === 'creating' ? 'Төлбөр үүсгэж байна...' : 'Захиалга баталгаажуулах'}
                                    </button>
                                </form>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <h3 style={{ marginBottom: '1.5rem' }}>Төлбөр төлөх</h3>
                                    {paymentInvoice?.qr_image && (
                                        <img src={`data:image/png;base64,${paymentInvoice.qr_image}`} alt="QPay QR" style={{ width: '200px', height: '200px', marginBottom: '1.5rem' }} />
                                    )}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        <button
                                            onClick={checkPayment}
                                            style={{ width: '100%', padding: '1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '700', cursor: 'pointer' }}
                                        >
                                            Төлбөр шалгах
                                        </button>
                                        <button
                                            onClick={() => setPaymentStatus('idle')}
                                            style={{ width: '100%', padding: '1rem', backgroundColor: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}
                                        >
                                            Болих
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '5rem' }}>
                    <p>Сургалт олдсонгүй.</p>
                </div>
            )}
        </div>
    );
};

export default BusinessTraining;
