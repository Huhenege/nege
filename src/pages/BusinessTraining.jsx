import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, serverTimestamp, runTransaction, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { apiFetch } from '../lib/apiClient';
import {
    GraduationCap,
    Clock,
    User,
    CheckCircle2,
    DollarSign,
    Sparkles,
    Loader2,
    CalendarCheck,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import './BusinessTraining.css';
import ToolHeader from '../components/ToolHeader';

const BusinessTraining = () => {
    const { currentUser, openAuthModal, isAuthModalOpen } = useAuth();
    const [loading, setLoading] = useState(true);
    const [trainings, setTrainings] = useState([]);
    const [selectedTraining, setSelectedTraining] = useState(null);
    const [bookingData, setBookingData] = useState({
        slotId: '',
        date: '',
        time: ''
    });
    const [paymentStatus, setPaymentStatus] = useState('idle');
    const [paymentInvoice, setPaymentInvoice] = useState(null);
    const [pendingBooking, setPendingBooking] = useState(false);
    const [recentBooking, setRecentBooking] = useState(null);
    const [remainingStatus, setRemainingStatus] = useState('idle');
    const [remainingInvoice, setRemainingInvoice] = useState(null);
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState('');
    const checkInFlightRef = useRef(false);
    const remainingCheckRef = useRef(false);

    const formatDuration = (value) => {
        if (!value) return value;
        return value.replace(/\b(hours|hour|hrs|hr)\b/gi, 'цаг');
    };

    const formatDateKey = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const formatDateLabel = (dateKey) => {
        if (!dateKey) return '';
        const [year, month, day] = dateKey.split('-');
        return `${year} оны ${Number(month)} сарын ${Number(day)}-ны өдөр`;
    };

    const buildBookingKeyId = (trainingId, userId, slotId) => {
        return [trainingId, userId, slotId].map((value) => encodeURIComponent(value || '')).join('__');
    };

    const getPaymentBreakdown = () => {
        const isFree = selectedTraining?.isFree || Number(selectedTraining?.price || 0) === 0;
        const total = isFree ? 0 : Number(selectedTraining?.price || 0);
        const rawAdvance = selectedTraining?.advanceAmount;
        const advance = rawAdvance === null || rawAdvance === undefined || rawAdvance === ''
            ? total
            : Math.min(Math.max(Number(rawAdvance || 0), 0), total);
        const remaining = Math.max(total - advance, 0);
        return { total, advance, remaining };
    };

    const isFreeTraining = useMemo(() => {
        if (!selectedTraining) return false;
        return selectedTraining.isFree || Number(selectedTraining.price || 0) === 0;
    }, [selectedTraining]);

    useEffect(() => {
        const fetchTrainings = async () => {
            try {
                const q = query(collection(db, "trainings"), where("active", "==", true));
                const querySnapshot = await getDocs(q);
                const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTrainings(data);
                if (data.length > 0) {
                    const withSlots = data.find((training) => Array.isArray(training.availableSlots) && training.availableSlots.length > 0);
                    setSelectedTraining((prev) => {
                        if (prev && data.some((item) => item.id === prev.id)) {
                            return data.find((item) => item.id === prev.id);
                        }
                        return withSlots || data[0];
                    });
                } else {
                    setSelectedTraining(null);
                }
            } catch (error) {
                console.error("Error fetching trainings:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchTrainings();
    }, []);

    useEffect(() => {
        setBookingData({ slotId: '', date: '', time: '' });
        setPaymentStatus('idle');
        setPaymentInvoice(null);
        setRecentBooking(null);
        setRemainingStatus('idle');
        setRemainingInvoice(null);
        setSelectedDate('');
    }, [selectedTraining?.id]);

    useEffect(() => {
        if (!selectedDate) return;
        if (bookingData.date && bookingData.date !== selectedDate) {
            setBookingData({ slotId: '', date: '', time: '' });
        }
    }, [selectedDate]);

    useEffect(() => {
        if (!pendingBooking || !currentUser) return;
        setPendingBooking(false);
        submitBooking();
    }, [pendingBooking, currentUser]);

    useEffect(() => {
        if (pendingBooking && !currentUser && !isAuthModalOpen) {
            setPendingBooking(false);
        }
    }, [pendingBooking, currentUser, isAuthModalOpen]);

    const submitBooking = async () => {
        if (!bookingData.slotId) {
            alert('Нээлттэй цаг сонгоно уу.');
            return;
        }
        if (!currentUser) {
            setPendingBooking(true);
            openAuthModal();
            return;
        }

        const breakdown = getPaymentBreakdown();
        if (breakdown.total === 0) {
            setPaymentStatus('creating');
            await confirmBooking(null, 'FREE');
            return;
        }

        setPaymentStatus('creating');
        try {
            let response = await apiFetch('/billing/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({
                    type: 'training',
                    trainingId: selectedTraining.id
                }),
            });
            let data = await response.json();
            if (!response.ok && response.status === 404) {
                response = await apiFetch('/qpay/invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: breakdown.advance,
                        description: `Сургалтын захиалга: ${selectedTraining?.title || selectedTraining.id}`,
                    }),
                });
                data = await response.json();
            }
            if (data.invoice_id) {
                setPaymentInvoice(data);
                setPaymentStatus('pending');
                return;
            }
            setPaymentStatus('idle');
        } catch (error) {
            console.error('Invoice creation error:', error);
            setPaymentStatus('idle');
        }
    };

    const handleBookingSubmit = async (e) => {
        e.preventDefault();
        await submitBooking();
    };

    const confirmBooking = async (paymentId = null, stageOverride = null) => {
        if (!bookingData.slotId) {
            alert('Нээлттэй цаг сонгоно уу.');
            return;
        }
        try {
            const breakdown = getPaymentBreakdown();
            const trainingRef = doc(db, 'trainings', selectedTraining.id);
            const bookingRef = doc(collection(db, 'bookings'));
            await runTransaction(db, async (tx) => {
                const trainingSnap = await tx.get(trainingRef);
                if (!trainingSnap.exists()) {
                    throw new Error('Сургалт олдсонгүй.');
                }
                const trainingData = trainingSnap.data();
                const slots = Array.isArray(trainingData.availableSlots) ? trainingData.availableSlots : [];
                const slotIndex = slots.findIndex((slot) => slot.id === bookingData.slotId);
                if (slotIndex === -1) {
                    throw new Error('Сонгосон цаг олдсонгүй.');
                }
                const slot = slots[slotIndex];
                const remaining = Number(slot.remaining ?? slot.capacity ?? 0);
                if (slot.active === false || remaining <= 0) {
                    throw new Error('Энэ цаг дүүрсэн байна.');
                }

                if (currentUser?.uid) {
                    const bookingKeyId = buildBookingKeyId(selectedTraining.id, currentUser.uid, slot.id);
                    const bookingKeyRef = doc(db, 'bookingKeys', bookingKeyId);
                    const bookingKeySnap = await tx.get(bookingKeyRef);
                    if (bookingKeySnap.exists()) {
                        throw new Error('Та энэ цагийг өмнө нь захиалсан байна.');
                    }

                    tx.set(bookingKeyRef, {
                        trainingId: selectedTraining.id,
                        userId: currentUser.uid,
                        slotId: slot.id,
                        bookingId: bookingRef.id,
                        createdAt: serverTimestamp(),
                    });
                }
                const updatedSlots = [...slots];
                updatedSlots[slotIndex] = { ...slot, remaining: remaining - 1 };
                tx.update(trainingRef, { availableSlots: updatedSlots, updatedAt: serverTimestamp() });

                tx.set(bookingRef, {
                    trainingId: selectedTraining.id,
                    trainingTitle: selectedTraining.title,
                    userId: currentUser.uid,
                    userName: currentUser.displayName || currentUser.email.split('@')[0],
                    userEmail: currentUser.email,
                    selectedDate: slot.date,
                    selectedTime: slot.time,
                    slotId: slot.id,
                    amount: breakdown.advance,
                    totalAmount: breakdown.total,
                    remainingAmount: breakdown.remaining,
                    paymentStage: stageOverride || (breakdown.remaining > 0 ? 'DEPOSIT' : 'FULL'),
                    status: 'PAID',
                    paymentId: paymentId ?? paymentInvoice?.invoice_id ?? null,
                    bookingKeyId: currentUser?.uid ? buildBookingKeyId(selectedTraining.id, currentUser.uid, slot.id) : null,
                    createdAt: serverTimestamp()
                });
            });
            setRecentBooking({
                id: bookingRef.id,
                remainingAmount: breakdown.remaining,
                totalAmount: breakdown.total,
                selectedDate: bookingData.date,
                selectedTime: bookingData.time,
                trainingTitle: selectedTraining.title,
            });
            setPaymentStatus('success');
        } catch (error) {
            console.error("Error saving booking:", error);
            setPaymentStatus('idle');
            setPaymentInvoice(null);
            setPendingBooking(false);
            setBookingData({ slotId: '', date: selectedDate || '', time: '' });
            alert(error?.message || "Захиалга хадгалахад алдаа гарлаа.");
        }
    };

    const checkPayment = async ({ silent = false } = {}) => {
        if (!paymentInvoice) return;
        if (checkInFlightRef.current) return;
        checkInFlightRef.current = true;
        try {
            let response = await apiFetch('/billing/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({ invoice_id: paymentInvoice.invoice_id }),
            });
            let data = await response.json();
            if (!response.ok && response.status === 404) {
                response = await apiFetch('/qpay/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoice_id: paymentInvoice.invoice_id }),
                });
                data = await response.json();
            }
            if (data.paid) {
                await confirmBooking();
            } else if (!silent) {
                alert('Төлбөр хараахан төлөгдөөгүй байна.');
            }
        } catch (error) {
            console.error('Payment check error:', error);
            if (!silent) {
                alert('Төлбөр шалгахад алдаа гарлаа.');
            }
        } finally {
            checkInFlightRef.current = false;
        }
    };

    const createRemainingInvoice = async () => {
        if (!recentBooking || Number(recentBooking.remainingAmount || 0) <= 0) return;
        setRemainingStatus('creating');
        try {
            let response = await apiFetch('/billing/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({
                    type: 'training_remaining',
                    bookingId: recentBooking.id,
                }),
            });
            let data = await response.json();
            if (!response.ok && response.status === 404) {
                response = await apiFetch('/qpay/invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: Number(recentBooking.remainingAmount || 0),
                        description: `Сургалтын үлдэгдэл төлбөр: ${recentBooking.trainingTitle || selectedTraining?.title || ''}`,
                    }),
                });
                data = await response.json();
            }
            if (data.invoice_id) {
                setRemainingInvoice(data);
                setRemainingStatus('pending');
                return;
            }
            setRemainingStatus('idle');
        } catch (error) {
            console.error('Remaining invoice creation error:', error);
            setRemainingStatus('idle');
        }
    };

    const checkRemainingPayment = async ({ silent = false } = {}) => {
        if (!remainingInvoice || !recentBooking) return;
        if (remainingCheckRef.current) return;
        remainingCheckRef.current = true;
        try {
            let response = await apiFetch('/billing/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({ invoice_id: remainingInvoice.invoice_id }),
            });
            let data = await response.json();
            if (!response.ok && response.status === 404) {
                response = await apiFetch('/qpay/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoice_id: remainingInvoice.invoice_id }),
                });
                data = await response.json();
            }
            if (data.paid) {
                await updateDoc(doc(db, 'bookings', recentBooking.id), {
                    remainingAmount: 0,
                    paymentStage: 'FULL',
                    remainingPaymentId: remainingInvoice.invoice_id,
                    remainingPaidAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });
                setRecentBooking(prev => prev ? { ...prev, remainingAmount: 0 } : prev);
                setRemainingStatus('paid');
            } else if (!silent) {
                alert('Үлдэгдэл төлбөр хараахан төлөгдөөгүй байна.');
            }
        } catch (error) {
            console.error('Remaining payment check error:', error);
            if (!silent) {
                alert('Үлдэгдэл төлбөр шалгахад алдаа гарлаа.');
            }
        } finally {
            remainingCheckRef.current = false;
        }
    };

    useEffect(() => {
        if (paymentStatus !== 'pending' || !paymentInvoice) return;
        let cancelled = false;
        const runCheck = async () => {
            if (cancelled) return;
            await checkPayment({ silent: true });
        };
        const firstTimeout = setTimeout(runCheck, 2000);
        const interval = setInterval(runCheck, 5000);
        return () => {
            cancelled = true;
            clearTimeout(firstTimeout);
            clearInterval(interval);
        };
    }, [paymentStatus, paymentInvoice]);

    useEffect(() => {
        if (remainingStatus !== 'pending' || !remainingInvoice) return;
        let cancelled = false;
        const runCheck = async () => {
            if (cancelled) return;
            await checkRemainingPayment({ silent: true });
        };
        const firstTimeout = setTimeout(runCheck, 2000);
        const interval = setInterval(runCheck, 5000);
        return () => {
            cancelled = true;
            clearTimeout(firstTimeout);
            clearInterval(interval);
        };
    }, [remainingStatus, remainingInvoice]);

    const paymentBreakdown = getPaymentBreakdown();

    const availableSlots = useMemo(() => {
        const slots = Array.isArray(selectedTraining?.availableSlots) ? selectedTraining.availableSlots : [];
        const now = new Date();
        return slots
            .map((slot) => {
                const dateTime = slot?.date && slot?.time ? new Date(`${slot.date}T${slot.time}`) : null;
                const isPast = dateTime ? dateTime.getTime() < now.getTime() : false;
                const remaining = Number(slot?.remaining ?? slot?.capacity ?? 0);
                return { ...slot, dateTime, isPast, remaining };
            })
            .filter((slot) => slot?.dateTime)
            .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
    }, [selectedTraining]);

    const availableDates = useMemo(() => {
        const set = new Set();
        availableSlots.forEach((slot) => {
            if (slot.active === false) return;
            if (slot.isPast) return;
            if (slot.remaining <= 0) return;
            set.add(slot.date);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [availableSlots]);

    useEffect(() => {
        if (!availableDates.length) {
            setSelectedDate('');
            return;
        }
        if (!selectedDate || !availableDates.includes(selectedDate)) {
            setSelectedDate(availableDates[0]);
            const [year, month] = availableDates[0].split('-');
            setCalendarMonth(new Date(Number(year), Number(month) - 1, 1));
        }
    }, [availableDates, selectedDate]);

    const selectedSlots = useMemo(() => {
        if (!selectedDate) return [];
        return availableSlots
            .filter((slot) => slot.active !== false && slot.date === selectedDate)
            .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
    }, [availableSlots, selectedDate]);

    const calendarCells = useMemo(() => {
        const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
        const end = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
        const startWeekday = (start.getDay() + 6) % 7;
        const totalCells = Math.ceil((startWeekday + end.getDate()) / 7) * 7;
        const cells = [];
        const availableSet = new Set(availableDates);
        for (let i = 0; i < totalCells; i += 1) {
            const date = new Date(start);
            date.setDate(start.getDate() - startWeekday + i);
            const key = formatDateKey(date);
            cells.push({
                key,
                date,
                inMonth: date.getMonth() === calendarMonth.getMonth(),
                isAvailable: availableSet.has(key),
            });
        }
        return cells;
    }, [calendarMonth, availableDates]);

    const todayKey = useMemo(() => formatDateKey(new Date()), []);

    const monthLabel = useMemo(() => {
        const monthNames = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар'];
        return `${calendarMonth.getFullYear()} ${monthNames[calendarMonth.getMonth()]}`;
    }, [calendarMonth]);

    if (loading) return (
        <div className="training-page">
            <div className="training-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <Loader2 className="animate-spin" size={40} color="var(--brand-600)" />
            </div>
        </div>
    );

    if (paymentStatus === 'success') {
        const remainingAmount = Number(recentBooking?.remainingAmount || 0);
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
                        {remainingAmount > 0 && (
                            <div style={{ marginTop: '2rem', textAlign: 'left' }}>
                                <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Үлдэгдэл төлбөр</div>
                                <div style={{ fontSize: '0.95rem', color: 'var(--ink-600)', marginBottom: '1rem' }}>
                                    Үлдэгдэл төлөх дүн: ₮{remainingAmount.toLocaleString()}
                                </div>
                                {remainingStatus === 'idle' && (
                                    <button className="btn btn-primary" onClick={createRemainingInvoice}>
                                        Үлдэгдэл төлөх
                                    </button>
                                )}
                                {remainingStatus === 'creating' && (
                                    <button className="btn btn-primary" disabled>
                                        <Loader2 className="animate-spin" size={18} />
                                        Нэхэмжлэл үүсгэж байна...
                                    </button>
                                )}
                                {remainingStatus === 'pending' && (
                                    <div className="training-payment" style={{ marginTop: '1rem' }}>
                                        <p style={{ marginBottom: '0.75rem', color: 'var(--ink-500)', fontSize: '0.85rem' }}>
                                            Үлдэгдэл төлбөрийн төлөв автоматаар шалгагдана.
                                        </p>
                                        {remainingInvoice?.qr_image && (
                                            <img src={`data:image/png;base64,${remainingInvoice.qr_image}`} alt="QPay QR" />
                                        )}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                                            <button onClick={() => checkRemainingPayment()} className="btn btn-primary">Төлбөр шалгах</button>
                                            <button onClick={() => setRemainingStatus('idle')} className="btn btn-outline">Болих</button>
                                        </div>
                                    </div>
                                )}
                                {remainingStatus === 'paid' && (
                                    <div style={{ marginTop: '0.75rem', color: 'var(--success-600)', fontWeight: 600 }}>
                                        Үлдэгдэл төлбөр төлөгдлөө.
                                    </div>
                                )}
                            </div>
                        )}
                        <Link to="/" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
                            Үндсэн хуудас руу буцах
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="training-page">
            <ToolHeader
                title="AI Бизнес сургалт"
                subtitle="AI-д тулгуурласан бүтээмжийн сургалтанд бүртгүүлж, цаг товлоорой."
            />
            <div className="training-container">
                {trainings.length > 1 && (
                    <div className="training-picker">
                        <div className="training-picker__label">Сургалтаа сонгох</div>
                        <div className="training-picker__list">
                            {trainings.map((training) => (
                                <button
                                    key={training.id}
                                    type="button"
                                    onClick={() => setSelectedTraining(training)}
                                    className={`training-pill ${selectedTraining?.id === training.id ? 'active' : ''}`}
                                >
                                    {training.title}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
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

                            <div className="training-section">
                                <h3>Сургалтын тухай</h3>
                                <p style={{ whiteSpace: 'pre-wrap' }}>{selectedTraining.description}</p>
                            </div>

                            <div className="training-section">
                                <h3>Багшийн мэдээлэл</h3>
                                <div className="training-instructor">
                                    <div className="training-instructor__avatar">
                                        {selectedTraining.teacherImageUrl ? (
                                            <img src={selectedTraining.teacherImageUrl} alt={selectedTraining.teacherName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                        ) : (
                                            <User size={36} />
                                        )}
                                    </div>
                                    <div>
                                        <h4 style={{ marginBottom: '0.25rem' }}>{selectedTraining.teacherName}</h4>
                                        {selectedTraining.teacherEmail && (
                                            <div className="training-instructor__email">{selectedTraining.teacherEmail}</div>
                                        )}
                                        <p>{selectedTraining.teacherBio}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="training-details-bottom">
                                <div className="training-detail-item">
                                    <span className="training-detail-label">Хугацаа</span>
                                    <span className="training-detail-value">{formatDuration(selectedTraining.duration)}</span>
                                </div>
                                <div className="training-detail-item">
                                    <span className="training-detail-label">Төлбөр</span>
                                    <span className="training-detail-value">{isFreeTraining ? 'Үнэгүй' : `${paymentBreakdown.total.toLocaleString()}₮`}</span>
                                </div>
                            </div>
                        </div>

                        <div className="training-sidebar">
                            <div className="training-sidebar-card">
                                <h2>Цаг захиалах</h2>

                                {paymentStatus === 'idle' || paymentStatus === 'creating' ? (
                                    <form onSubmit={handleBookingSubmit} className="training-form">
                                        <div>
                                            <label className="training-label">Нээлттэй цаг сонгох</label>
                                            {availableDates.length === 0 ? (
                                                <div className="training-slot-empty">
                                                    Одоогоор нээлттэй цаг байхгүй байна.
                                                </div>
                                            ) : (
                                                <div className="training-calendar-view">
                                                    <div className="calendar-panel">
                                                        <div className="calendar-toolbar">
                                                            <div className="calendar-nav">
                                                                <button
                                                                    type="button"
                                                                    className="calendar-nav-btn"
                                                                    onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                                                    aria-label="Өмнөх сар"
                                                                    title="Өмнөх сар"
                                                                >
                                                                    <ChevronLeft size={16} />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="calendar-nav-btn"
                                                                    onClick={() => setCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                                                    aria-label="Дараагийн сар"
                                                                    title="Дараагийн сар"
                                                                >
                                                                    <ChevronRight size={16} />
                                                                </button>
                                                            </div>
                                                            <div className="calendar-month">{monthLabel}</div>
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline btn-sm calendar-today"
                                                                onClick={() => {
                                                                    const now = new Date();
                                                                    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                                                                    setSelectedDate(formatDateKey(now));
                                                                }}
                                                            >
                                                                Өнөөдөр
                                                            </button>
                                                        </div>
                                                        <div className="calendar-weekdays">
                                                            {['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба', 'Ням'].map((day) => (
                                                                <div key={day} className="calendar-weekday">{day}</div>
                                                            ))}
                                                        </div>
                                                        <div className="calendar-grid">
                                                            {calendarCells.map((cell) => (
                                                                <button
                                                                    key={cell.key}
                                                                    type="button"
                                                                    className={[
                                                                        'calendar-cell',
                                                                        !cell.inMonth ? 'calendar-cell--muted' : '',
                                                                        cell.key === selectedDate ? 'calendar-cell--selected' : '',
                                                                        cell.key === todayKey ? 'calendar-cell--today' : '',
                                                                        cell.isAvailable ? '' : 'calendar-cell--disabled',
                                                                    ].join(' ').trim()}
                                                                    disabled={!cell.isAvailable}
                                                                    onClick={() => {
                                                                        setSelectedDate(cell.key);
                                                                        if (!cell.inMonth) {
                                                                            setCalendarMonth(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
                                                                        }
                                                                    }}
                                                                >
                                                                    <div className="calendar-cell-date">{cell.date.getDate()}</div>
                                                                    {cell.isAvailable && <span className="calendar-dot" aria-hidden="true"></span>}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="calendar-side">
                                                        <div className="calendar-side-header">
                                                            <div>
                                                                <div className="calendar-side-title">{formatDateLabel(selectedDate) || 'Өдөр сонгоно уу'}</div>
                                                                <div className="calendar-side-sub">Сонгосон өдрийн боломжит цагууд</div>
                                                            </div>
                                                        </div>
                                                        {selectedSlots.length ? (
                                                            <div className="training-slot-grid calendar-slot-grid">
                                                                {selectedSlots.map((slot) => {
                                                                    const isFull = slot.remaining <= 0;
                                                                    const isPast = slot.isPast;
                                                                    const isDisabled = isFull || isPast;
                                                                    const isSelected = bookingData.slotId === slot.id;
                                                                    return (
                                                                        <button
                                                                            key={slot.id}
                                                                            type="button"
                                                                            disabled={isDisabled}
                                                                            onClick={() => setBookingData({ slotId: slot.id, date: slot.date, time: slot.time })}
                                                                            className={`training-slot-btn ${isSelected ? 'active' : ''} ${isFull ? 'full' : ''} ${isPast ? 'past' : ''}`}
                                                                        >
                                                                            {slot.time}
                                                                            <span>
                                                                                {isPast ? 'Өнгөрсөн' : (isFull ? 'Дууссан' : `${slot.remaining} үлдсэн`)}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="training-slot-empty">
                                                                Энэ өдөр нээлттэй цаг алга байна.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="training-total">
                                            <div className="training-total-row training-total-row--highlight">
                                                <span>Сонгосон цаг:</span>
                                                <span>{bookingData.slotId ? `${bookingData.date} · ${bookingData.time}` : 'Сонгоогүй'}</span>
                                            </div>
                                            {isFreeTraining ? (
                                                <div className="training-total-row">
                                                    <span>Сургалтын төлбөр:</span>
                                                    <span>Үнэгүй</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="training-total-row">
                                                        <span>Нийт төлбөр:</span>
                                                        <span>₮{paymentBreakdown.total.toLocaleString()}</span>
                                                    </div>
                                                    <div className="training-total-row">
                                                        <span>Урьдчилгаа төлөх:</span>
                                                        <span>₮{paymentBreakdown.advance.toLocaleString()}</span>
                                                    </div>
                                                    {paymentBreakdown.remaining > 0 && (
                                                        <div className="training-total-row">
                                                            <span>Үлдэгдэл:</span>
                                                            <span>₮{paymentBreakdown.remaining.toLocaleString()}</span>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={paymentStatus === 'creating' || !bookingData.slotId}
                                            className="btn btn-primary btn-lg"
                                        >
                                            {paymentStatus === 'creating' ? <Loader2 className="animate-spin" size={18} /> : <CalendarCheck size={18} />}
                                            {paymentStatus === 'creating'
                                                ? 'Бүртгэж байна...'
                                                : (isFreeTraining ? 'Захиалга бүртгэх' : 'Захиалга баталгаажуулах')}
                                        </button>
                                    </form>
                                ) : (
                                    <div className="training-payment">
                                        <h3 style={{ marginBottom: '1.5rem' }}>Төлбөр төлөх</h3>
                                        <p style={{ marginBottom: '0.75rem', color: 'var(--ink-600)' }}>
                                            Сонгосон цаг: {bookingData.date} · {bookingData.time}
                                        </p>
                                        <p style={{ marginBottom: '0.75rem', color: 'var(--ink-500)', fontSize: '0.85rem' }}>
                                            Төлбөрийн төлөв автоматаар шалгагдана.
                                        </p>
                                        <p style={{ marginBottom: '1rem', color: 'var(--ink-500)' }}>
                                            Урьдчилгаа төлөх дүн: ₮{paymentBreakdown.advance.toLocaleString()}
                                        </p>
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
