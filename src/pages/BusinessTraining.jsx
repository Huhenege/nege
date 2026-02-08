import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import {
    GraduationCap,
    Calendar,
    Clock,
    User,
    ArrowLeft,
    CheckCircle2,
    DollarSign,
    Sparkles,
    Loader2,
    CalendarCheck
} from 'lucide-react';
import './BusinessTraining.css';

const BusinessTraining = () => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [selectedTraining, setSelectedTraining] = useState(null);
    const [bookingData, setBookingData] = useState({
        date: '',
        time: ''
    });
    const [paymentStatus, setPaymentStatus] = useState('idle');
    const [paymentInvoice, setPaymentInvoice] = useState(null);

    useEffect(() => {
        const fetchTrainings = async () => {
            try {
                const q = query(collection(db, "trainings"), where("active", "==", true));
                const querySnapshot = await getDocs(q);
                const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
            const response = await apiFetch('/billing/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({
                    type: 'training',
                    trainingId: selectedTraining.id
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
            const response = await apiFetch('/billing/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({ invoice_id: paymentInvoice.invoice_id }),
            });
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
        <div className="training-page">
            <div className="training-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 className="animate-spin" size={40} color="var(--brand-600)" />
            </div>
        </div>
    );

    if (paymentStatus === 'success') {
        return (
            <div className="training-page">
                <div className="training-container" style={{ maxWidth: '640px' }}>
                    <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
                        <div style={{ marginBottom: '1.5rem', display: 'inline-flex', padding: '1.2rem', backgroundColor: '#ecfdf5', borderRadius: '50%', color: 'var(--success-500)' }}>
                            <CheckCircle2 size={56} />
                        </div>
                        <h1>Амжилттай баталгаажлаа!</h1>
                        <p>
                            Таны сургалтын захиалга амжилттай бүртгэгдлээ. Бид таны бүртгэлтэй имэйл хаягаар холбогдох мэдээллийг илгээх болно.
                        </p>
                        <Link to="/ai-assistant" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                            Үндсэн хуудас руу буцах
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="training-page">
            <div className="training-container">
                <Link to="/ai-assistant" className="training-back">
                    <ArrowLeft size={20} /> Буцах
                </Link>

                {selectedTraining ? (
                    <div className="training-layout">
                        <div className="training-info">
                            <div className="training-hero">
                                {selectedTraining.imageUrl ? (
                                    <img src={selectedTraining.imageUrl} alt={selectedTraining.title} />
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-300)' }}>
                                        <GraduationCap size={120} />
                                    </div>
                                )}
                                <div className="training-hero__badge">
                                    <Sparkles size={16} color="var(--brand-600)" />
                                    Premium Training
                                </div>
                            </div>

                            <h1 className="training-title">{selectedTraining.title}</h1>

                            <div className="training-meta">
                                <div className="training-meta-card">
                                    <div className="training-meta-icon">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <div className="training-meta-title">Хугацаа</div>
                                        <div className="training-meta-value">{selectedTraining.duration}</div>
                                    </div>
                                </div>
                                <div className="training-meta-card">
                                    <div className="training-meta-icon" style={{ background: 'var(--brand-50)', color: 'var(--brand-600)' }}>
                                        <DollarSign size={20} />
                                    </div>
                                    <div>
                                        <div className="training-meta-title">Төлбөр</div>
                                        <div className="training-meta-value">{Number(selectedTraining.price).toLocaleString()}₮</div>
                                    </div>
                                </div>
                            </div>

                            <div className="training-section">
                                <h3>Сургалтын тухай</h3>
                                <p style={{ whiteSpace: 'pre-wrap' }}>{selectedTraining.description}</p>
                            </div>

                            <div className="training-section">
                                <h3>Багшийн мэдээлэл</h3>
                                <div className="training-instructor">
                                    <div className="training-instructor__avatar">
                                        <User size={36} />
                                    </div>
                                    <div>
                                        <h4 style={{ marginBottom: '0.25rem' }}>{selectedTraining.teacherName}</h4>
                                        <p>{selectedTraining.teacherBio}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="training-sidebar">
                            <div className="training-sidebar-card">
                                <h2>Цаг захиалах</h2>

                                {paymentStatus === 'idle' || paymentStatus === 'creating' ? (
                                    <form onSubmit={handleBookingSubmit} className="training-form">
                                        <div>
                                            <label className="training-label">Огноо сонгох</label>
                                            <div style={{ position: 'relative' }}>
                                                <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-400)' }} />
                                                <input
                                                    type="date"
                                                    required
                                                    min={new Date().toISOString().split('T')[0]}
                                                    value={bookingData.date}
                                                    onChange={(e) => setBookingData({ ...bookingData, date: e.target.value })}
                                                    className="input"
                                                    style={{ paddingLeft: '2.4rem' }}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="training-label">Цаг сонгох</label>
                                            <div className="training-time-grid">
                                                {['10:00', '13:00', '16:00', '19:00'].map(t => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => setBookingData({ ...bookingData, time: t })}
                                                        className={`training-time-btn ${bookingData.time === t ? 'active' : ''}`}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="training-total">
                                            <div className="training-total-row">
                                                <span>Нийт төлбөр:</span>
                                                <span>₮{Number(selectedTraining.price).toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={paymentStatus === 'creating'}
                                            className="btn btn-primary btn-lg"
                                        >
                                            {paymentStatus === 'creating' ? <Loader2 className="animate-spin" size={18} /> : <CalendarCheck size={18} />}
                                            {paymentStatus === 'creating' ? 'Төлбөр үүсгэж байна...' : 'Захиалга баталгаажуулах'}
                                        </button>
                                    </form>
                                ) : (
                                    <div className="training-payment">
                                        <h3 style={{ marginBottom: '1.5rem' }}>Төлбөр төлөх</h3>
                                        {paymentInvoice?.qr_image && (
                                            <img src={`data:image/png;base64,${paymentInvoice.qr_image}`} alt="QPay QR" />
                                        )}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            <button onClick={checkPayment} className="btn btn-primary">Төлбөр шалгах</button>
                                            <button onClick={() => setPaymentStatus('idle')} className="btn btn-outline">Болих</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                        <p>Сургалт олдсонгүй.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusinessTraining;
