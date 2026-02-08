import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, addDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, Save, ChevronLeft, ChevronRight, CalendarPlus, Mail } from 'lucide-react';
import './TrainingEditor.css';

const monthNames = ['1-р сар', '2-р сар', '3-р сар', '4-р сар', '5-р сар', '6-р сар', '7-р сар', '8-р сар', '9-р сар', '10-р сар', '11-р сар', '12-р сар'];

const emptyForm = () => ({
    title: '',
    description: '',
    teacherName: '',
    teacherBio: '',
    teacherImageUrl: '',
    teacherEmail: '',
    isFree: false,
    price: '',
    advanceAmount: '',
    duration: '',
    active: true,
    imageUrl: '',
    availableSlots: []
});

const TrainingEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = Boolean(id);

    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [imageUploadError, setImageUploadError] = useState('');
    const [teacherImageError, setTeacherImageError] = useState('');
    const [formData, setFormData] = useState(emptyForm());
    const [slotDraft, setSlotDraft] = useState({ date: '', time: '', capacity: 1 });
    const [bookings, setBookings] = useState([]);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('details');
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    });
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });

    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(file);
    });

    const loadImageFromUrl = (src) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('image_failed'));
        img.src = src;
    });

    const compressImageToDataUrl = async (file, maxBytes = 400 * 1024, maxDimension = 800) => {
        const dataUrl = await readFileAsDataUrl(file);
        const img = await loadImageFromUrl(dataUrl);

        let scale = 1;
        const longestSide = Math.max(img.width, img.height);
        if (longestSide > maxDimension) {
            scale = maxDimension / longestSide;
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        const renderBlob = (nextScale, quality) => new Promise((resolve) => {
            const width = Math.max(1, Math.round(img.width * nextScale));
            const height = Math.max(1, Math.round(img.height * nextScale));
            canvas.width = width;
            canvas.height = height;
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
        });

        let quality = 0.9;
        let attempts = 0;
        let blob = await renderBlob(scale, quality);

        while (blob && blob.size > maxBytes && attempts < 12) {
            if (quality > 0.6) {
                quality -= 0.1;
            } else {
                scale *= 0.85;
                quality = 0.85;
            }
            blob = await renderBlob(scale, quality);
            attempts += 1;
        }

        if (!blob) {
            throw new Error('compress_failed');
        }

        if (blob.size > maxBytes) {
            throw new Error('too_large');
        }

        return await readFileAsDataUrl(blob);
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

    const parseDurationMinutes = (value) => {
        if (!value) return 60;
        const text = String(value).toLowerCase();
        const numMatch = text.match(/(\d+([.,]\d+)?)/);
        const numeric = numMatch ? Number(numMatch[1].replace(',', '.')) : NaN;
        if (!Number.isFinite(numeric)) return 60;
        if (text.includes('мин') || text.includes('minute')) return Math.max(5, Math.round(numeric));
        if (text.includes('өдөр') || text.includes('day')) return Math.max(30, Math.round(numeric * 24 * 60));
        return Math.max(30, Math.round(numeric * 60));
    };

    const formatUtcDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    };

    const formatLocalDate = (date) => {
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
    };

    const buildCalendarEvent = (booking) => {
        const start = new Date(`${booking.selectedDate}T${booking.selectedTime}`);
        const durationMinutes = parseDurationMinutes(formData.duration);
        const end = new Date(start.getTime() + durationMinutes * 60000);
        const summary = `Сургалт: ${formData.title || booking.trainingTitle || 'Сургалт'}`;
        const description = `Сургалтын захиалга\nСургалт: ${formData.title || booking.trainingTitle || ''}\nБагш: ${formData.teacherName || ''}\nИмэйл: ${formData.teacherEmail || ''}`;
        const teacherEmail = formData.teacherEmail || '';
        return { start, end, summary, description, teacherEmail };
    };

    const downloadIcs = (booking) => {
        const { start, end, summary, description, teacherEmail } = buildCalendarEvent(booking);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ulaanbaatar';
        const dtStamp = formatUtcDate(new Date());
        const dtStart = `DTSTART;TZID=${timeZone}:${formatLocalDate(start)}`;
        const dtEnd = `DTEND;TZID=${timeZone}:${formatLocalDate(end)}`;
        const uid = `nege-${booking.id || Date.now()}@nege.mn`;
        const lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//NEGE//Training//MN',
            'CALSCALE:GREGORIAN',
            'METHOD:REQUEST',
            'BEGIN:VEVENT',
            `UID:${uid}`,
            `DTSTAMP:${dtStamp}`,
            dtStart,
            dtEnd,
            `SUMMARY:${summary}`,
            `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
        ];
        if (teacherEmail) {
            lines.push(`ATTENDEE;ROLE=REQ-PARTICIPANT;RSVP=TRUE:MAILTO:${teacherEmail}`);
        }
        lines.push('END:VEVENT', 'END:VCALENDAR');
        const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `training-${booking.selectedDate}-${booking.selectedTime}.ics`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    const openGoogleCalendar = (booking) => {
        const { start, end, summary, description, teacherEmail } = buildCalendarEvent(booking);
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ulaanbaatar';
        const params = new URLSearchParams({
            action: 'TEMPLATE',
            text: summary,
            details: description,
            dates: `${formatLocalDate(start)}/${formatLocalDate(end)}`,
            ctz: timeZone,
        });
        if (teacherEmail) {
            params.append('add', teacherEmail);
        }
        window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener,noreferrer');
    };

    const emailIcsToTeacher = (booking) => {
        const { start, summary, teacherEmail } = buildCalendarEvent(booking);
        if (!teacherEmail) {
            alert('Багшийн имэйл бүртгэлтэй байх шаардлагатай.');
            return;
        }
        downloadIcs(booking);
        const subject = encodeURIComponent(`Сургалтын цагийн календар - ${summary}`);
        const dateText = `${booking.selectedDate} ${booking.selectedTime}`;
        const body = encodeURIComponent(
            `Сайн байна уу,\n\nСургалтын цагийн календар (.ics) файл үүсгэгдлээ.\nОгноо/цаг: ${dateText}\nТа энэ имэйлдээ татагдсан .ics файлыг хавсаргаад Apple Calendar/iOS дээр нээгээрэй.\n\nБаярлалаа.`
        );
        window.location.href = `mailto:${teacherEmail}?subject=${subject}&body=${body}`;
    };

    useEffect(() => {
        if (!isEditing) return;
        const fetchTraining = async () => {
            setLoading(true);
            try {
                const snap = await getDoc(doc(db, 'trainings', id));
                if (snap.exists()) {
                    const data = snap.data();
                    setFormData({
                        title: data.title || '',
                        description: data.description || '',
                        teacherName: data.teacherName || '',
                        teacherBio: data.teacherBio || '',
                        teacherImageUrl: data.teacherImageUrl || '',
                        teacherEmail: data.teacherEmail || '',
                        isFree: data.isFree ?? Number(data.price || 0) === 0,
                        price: data.price ?? '',
                        advanceAmount: data.advanceAmount ?? '',
                        duration: data.duration || '',
                        active: data.active ?? true,
                        imageUrl: data.imageUrl || '',
                        availableSlots: Array.isArray(data.availableSlots) ? data.availableSlots : []
                    });
                }
            } catch (error) {
                console.error('Error loading training:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchTraining();
    }, [id, isEditing]);

    useEffect(() => {
        if (!selectedDate) return;
        setSlotDraft((prev) => ({ ...prev, date: selectedDate }));
    }, [selectedDate]);

    useEffect(() => {
        const year = calendarMonth.getFullYear();
        const month = calendarMonth.getMonth();
        const selected = selectedDate ? new Date(`${selectedDate}T00:00:00`) : null;
        if (!selected || selected.getFullYear() !== year || selected.getMonth() !== month) {
            setSelectedDate(formatDateKey(new Date(year, month, 1)));
        }
    }, [calendarMonth]);

    useEffect(() => {
        if (!isEditing) return;
        setBookingLoading(true);
        const bookingsQuery = query(collection(db, 'bookings'), where('trainingId', '==', id));
        const unsubscribe = onSnapshot(
            bookingsQuery,
            (snapshot) => {
                const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
                data.sort((a, b) => {
                    const aTime = a?.createdAt?.toMillis?.() || new Date(a?.createdAt || 0).getTime() || 0;
                    const bTime = b?.createdAt?.toMillis?.() || new Date(b?.createdAt || 0).getTime() || 0;
                    return bTime - aTime;
                });
                setBookings(data);
                setBookingLoading(false);
            },
            (error) => {
                console.error('Error loading bookings:', error);
                setBookingLoading(false);
            }
        );

        return () => unsubscribe();
    }, [id, isEditing]);

    const getAdvanceAmount = () => {
        if (formData.isFree) {
            return { price: 0, advance: 0, remaining: 0 };
        }
        const price = Number(formData.price || 0);
        const rawAdvance = formData.advanceAmount === '' ? price : Number(formData.advanceAmount || 0);
        const safeAdvance = Math.min(Math.max(rawAdvance, 0), price);
        return { price, advance: safeAdvance, remaining: Math.max(price - safeAdvance, 0) };
    };

    const breakdown = useMemo(() => getAdvanceAmount(), [formData.price, formData.advanceAmount]);

    const slotsByDate = useMemo(() => {
        const map = {};
        (formData.availableSlots || []).forEach((slot) => {
            if (!slot?.date) return;
            if (!map[slot.date]) map[slot.date] = [];
            map[slot.date].push(slot);
        });
        Object.keys(map).forEach((key) => {
            map[key] = map[key].slice().sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        });
        return map;
    }, [formData.availableSlots]);

    const calendarCells = useMemo(() => {
        const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
        const end = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
        const startWeekday = (start.getDay() + 6) % 7;
        const totalCells = Math.ceil((startWeekday + end.getDate()) / 7) * 7;
        const cells = [];
        for (let i = 0; i < totalCells; i += 1) {
            const date = new Date(start);
            date.setDate(start.getDate() - startWeekday + i);
            const key = formatDateKey(date);
            const slots = slotsByDate[key] || [];
            const activeSlots = slots.filter((slot) => slot.active !== false);
            const remaining = activeSlots.reduce((sum, slot) => sum + Number(slot.remaining ?? slot.capacity ?? 0), 0);
            cells.push({
                key,
                date,
                inMonth: date.getMonth() === calendarMonth.getMonth(),
                slotsCount: activeSlots.length,
                remaining,
            });
        }
        return cells;
    }, [calendarMonth, slotsByDate]);

    const monthLabel = useMemo(() => {
        return `${calendarMonth.getFullYear()} ${monthNames[calendarMonth.getMonth()]}`;
    }, [calendarMonth]);

    const todayKey = useMemo(() => formatDateKey(new Date()), []);

    const selectedSlots = useMemo(() => slotsByDate[selectedDate] || [], [slotsByDate, selectedDate]);

    const selectedRemaining = useMemo(() => {
        return selectedSlots.reduce((sum, slot) => {
            if (slot.active === false) return sum;
            return sum + Number(slot.remaining ?? slot.capacity ?? 0);
        }, 0);
    }, [selectedSlots]);

    const tabs = [
        { id: 'details', label: 'Үндсэн мэдээлэл' },
        { id: 'schedule', label: 'Цаг тохиргоо' },
        { id: 'bookings', label: 'Захиалга' },
    ];

    const handleSubmit = async (e) => {
        if (e?.preventDefault) {
            e.preventDefault();
        }
        setSaving(true);
        try {
            const data = {
                ...formData,
                price: breakdown.price,
                advanceAmount: breakdown.advance,
                remainingAmount: breakdown.remaining,
                updatedAt: serverTimestamp(),
            };

            if (isEditing) {
                await updateDoc(doc(db, 'trainings', id), data);
            } else {
                await addDoc(collection(db, 'trainings'), {
                    ...data,
                    createdAt: serverTimestamp(),
                });
            }

            navigate('/admin/trainings');
        } catch (error) {
            console.error('Error saving training:', error);
            alert('Хадгалахад алдаа гарлаа.');
        } finally {
            setSaving(false);
        }
    };

    const sortSlots = (slots) => {
        return [...slots].sort((a, b) => {
            const aTime = new Date(`${a.date}T${a.time}`).getTime();
            const bTime = new Date(`${b.date}T${b.time}`).getTime();
            return aTime - bTime;
        });
    };

    const handleAddSlot = () => {
        const slotDate = slotDraft.date || selectedDate;
        if (!slotDate || !slotDraft.time) return;
        const capacity = Math.max(Number(slotDraft.capacity || 1), 1);
        const id = `slot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const newSlot = {
            id,
            date: slotDate,
            time: slotDraft.time,
            capacity,
            remaining: capacity,
            active: true,
        };
        setFormData(prev => ({
            ...prev,
            availableSlots: sortSlots([...(prev.availableSlots || []), newSlot]),
        }));
        setSlotDraft({ date: slotDate, time: '', capacity: 1 });
    };

    const updateSlot = (slotId, updates) => {
        setFormData(prev => ({
            ...prev,
            availableSlots: (prev.availableSlots || []).map((slot) => {
                if (slot.id !== slotId) return slot;
                const next = { ...slot, ...updates };
                const capacity = Math.max(Number(next.capacity || 0), 0);
                let remaining = Number(next.remaining ?? capacity);
                if (Number.isNaN(remaining)) remaining = capacity;
                next.capacity = capacity;
                next.remaining = Math.min(Math.max(remaining, 0), capacity);
                return next;
            }),
        }));
    };

    const removeSlot = (slotId) => {
        setFormData(prev => ({
            ...prev,
            availableSlots: (prev.availableSlots || []).filter((slot) => slot.id !== slotId),
        }));
    };

    const updateBookingStatus = async (bookingId, newStatus) => {
        if (!window.confirm(`${newStatus} төлөвт шилжүүлэхдээ итгэлтэй байна уу?`)) return;
        try {
            await updateDoc(doc(db, 'bookings', bookingId), {
                status: newStatus,
                updatedAt: serverTimestamp(),
            });
        setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: newStatus } : b));
    } catch (error) {
        console.error('Error updating booking:', error);
    }
};

    const handleCalendarAction = (booking, action) => {
        if (action === 'google') {
            openGoogleCalendar(booking);
        } else if (action === 'ics') {
            emailIcsToTeacher(booking);
        }
    };

    const handleImageUpload = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const maxSizeBytes = 600 * 1024;
        if (file.size > maxSizeBytes) {
            setImageUploadError('Ковер зураг 600KB-аас бага байх шаардлагатай.');
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setFormData(prev => ({ ...prev, imageUrl: reader.result }));
            setImageUploadError('');
        };
        reader.readAsDataURL(file);
    };

    const handleTeacherImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await compressImageToDataUrl(file, 400 * 1024, 800);
            setFormData(prev => ({ ...prev, teacherImageUrl: dataUrl }));
            setTeacherImageError('');
        } catch (error) {
            setTeacherImageError('Зургийг 400KB хүргэж багасгах боломжгүй байна.');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid var(--ink-200)', borderTopColor: '#e11d48', borderRadius: '50%' }}></div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', gap: '1rem' }}>
                <div>
                    <Link to="/admin/trainings" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--ink-500)', textDecoration: 'none', marginBottom: '0.5rem' }}>
                        <ArrowLeft size={16} /> Сургалтын жагсаалт
                    </Link>
                    <h1 style={{ fontSize: '1.9rem', fontWeight: '800', color: 'var(--ink-900)' }}>
                        {isEditing ? 'Сургалтын дэлэнгүй' : 'Шинэ сургалт нэмэх'}
                    </h1>
                    <p style={{ color: 'var(--ink-500)' }}>Сургалтын мэдээлэл, цаг болон захиалгыг энд удирдана.</p>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="btn btn-primary"
                >
                    <Save size={18} />
                    {saving ? 'Хадгалж байна...' : (isEditing ? 'Шинэчлэх' : 'Хадгалах')}
                </button>
            </div>

            <div className="editor-tabs" role="tablist" aria-label="Сургалтын мэдээлэл">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.id}
                        className={`editor-tab ${activeTab === tab.id ? 'editor-tab--active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit}>
                {activeTab === 'details' && (
                    <div className="editor-section">
                        <div className="editor-column">
                            <div className="card">
                                <div className="card-header">
                                    <div className="card-title">Үндсэн мэдээлэл</div>
                                </div>
                                <div className="card-body">
                                    <div className="editor-field">
                                        <label>Гарчиг</label>
                                        <input
                                            required
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="input"
                                        />
                                    </div>
                                    <div className="editor-field">
                                        <label>Тайлбар</label>
                                        <textarea
                                            required
                                            rows={6}
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            className="textarea"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <div className="card-title">Багшийн мэдээлэл</div>
                                </div>
                                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--ink-500)' }}>Багшийн нэр</label>
                                    <input
                                        required
                                        value={formData.teacherName}
                                        onChange={(e) => setFormData({ ...formData, teacherName: e.target.value })}
                                        className="input"
                                    />
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--ink-500)' }}>Багшийн имэйл</label>
                                    <input
                                        type="email"
                                        placeholder="teacher@example.com"
                                        value={formData.teacherEmail}
                                        onChange={(e) => setFormData({ ...formData, teacherEmail: e.target.value })}
                                        className="input"
                                    />
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--ink-500)' }}>Багшийн танилцуулга</label>
                                    <textarea
                                        rows={3}
                                        value={formData.teacherBio}
                                        onChange={(e) => setFormData({ ...formData, teacherBio: e.target.value })}
                                        className="textarea"
                                    />
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--ink-500)' }}>Багшийн зураг</label>
                                    <input type="file" accept="image/*" onChange={handleTeacherImageUpload} />
                                    {formData.teacherImageUrl ? (
                                        <div className="teacher-avatar">
                                            <img src={formData.teacherImageUrl} alt="Teacher" />
                                        </div>
                                    ) : (
                                        <div className="teacher-avatar teacher-avatar--empty">
                                            Багшийн зураг сонгоогүй байна
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-400)' }}>JPG/PNG · Автоматаар 400KB хүртэл багасгана</div>
                                    {teacherImageError && <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>{teacherImageError}</div>}
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-header">
                                    <div className="card-title">Төлбөр ба хугацаа</div>
                                </div>
                                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div className="payment-toggle-row">
                                        <div>
                                            <div className="payment-toggle-title">Үнэгүй сургалт</div>
                                            <div className="payment-toggle-sub">Идэвхжүүлбэл төлбөрийн талбарууд нууж, үнэ 0 болно.</div>
                                        </div>
                                        <label className="switch">
                                            <input
                                                type="checkbox"
                                                checked={formData.isFree}
                                                onChange={(e) => {
                                                    const isFree = e.target.checked;
                                                    setFormData((prev) => ({
                                                        ...prev,
                                                        isFree,
                                                        price: isFree ? 0 : (Number(prev.price || 0) === 0 ? '' : prev.price),
                                                        advanceAmount: isFree ? 0 : (Number(prev.advanceAmount || 0) === 0 ? '' : prev.advanceAmount),
                                                    }));
                                                }}
                                            />
                                            <span className="slider" />
                                        </label>
                                    </div>
                                    {!formData.isFree && (
                                        <>
                                            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--ink-500)' }}>Үнэ (₮)</label>
                                            <input
                                                required={!formData.isFree}
                                                type="number"
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                                className="input"
                                            />
                                            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--ink-500)' }}>Урьдчилгаа төлбөр (₮)</label>
                                            <input
                                                type="number"
                                                placeholder="Хоосон бол нийт төлбөртэй тэнцүү"
                                                value={formData.advanceAmount}
                                                onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })}
                                                className="input"
                                            />
                                            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--ink-500)' }}>Үлдэгдэл (автоматаар)</label>
                                            <input
                                                disabled
                                                value={breakdown.remaining.toLocaleString()}
                                                className="input"
                                                style={{ backgroundColor: 'var(--ink-50)' }}
                                            />
                                        </>
                                    )}
                                    <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--ink-500)' }}>Хугацаа</label>
                                    <input
                                        required
                                        placeholder="жнь: 2 цаг, 3 өдөр"
                                        value={formData.duration}
                                        onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                        className="input"
                                    />
                                </div>
                            </div>
                            <div className="card">
                                <div className="card-header">
                                    <div className="card-title">Ковер зураг</div>
                                </div>
                                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <input type="file" accept="image/*" onChange={handleImageUpload} />
                                    {formData.imageUrl ? (
                                        <div style={{ border: '1px solid var(--ink-200)', borderRadius: '12px', overflow: 'hidden', height: '200px' }}>
                                            <img src={formData.imageUrl} alt="Training cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        </div>
                                    ) : (
                                        <div style={{ border: '1px dashed var(--ink-200)', borderRadius: '12px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-400)', fontSize: '0.85rem' }}>
                                            Ковер зураг сонгоогүй байна
                                        </div>
                                    )}
                                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-400)' }}>JPG/PNG · 600KB хүртэл</div>
                                    {imageUploadError && <div style={{ fontSize: '0.75rem', color: '#dc2626' }}>{imageUploadError}</div>}
                                </div>
                            </div>

                            <div className="card">
                                <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        id="active"
                                        checked={formData.active}
                                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                    />
                                    <label htmlFor="active" style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--ink-700)', cursor: 'pointer' }}>Идэвхтэй (Хэрэглэгчдэд харагдана)</label>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'schedule' && (
                    <div className="editor-section">
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">Нээлттэй цагууд</div>
                            </div>
                            <div className="card-body">
                                <div className="training-calendar">
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
                                                    ].join(' ').trim()}
                                                    onClick={() => {
                                                        setSelectedDate(cell.key);
                                                        if (!cell.inMonth) {
                                                            setCalendarMonth(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
                                                        }
                                                    }}
                                            >
                                                <div className="calendar-cell-date">{cell.date.getDate()}</div>
                                                {cell.slotsCount > 0 && <span className="calendar-dot" aria-hidden="true"></span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                    <div className="calendar-side">
                                        <div className="calendar-side-header">
                                            <div>
                                                <div className="calendar-side-title">{formatDateLabel(selectedDate)}</div>
                                                <div className="calendar-side-sub">Нээлттэй цаг нэмэх, засах</div>
                                            </div>
                                            <div className="calendar-side-badges">
                                                <span className="badge badge-muted">{selectedSlots.length} цаг</span>
                                                <span className="badge badge-brand">Сул {selectedRemaining}</span>
                                            </div>
                                        </div>

                                        <div className="calendar-slot-form">
                                            <div className="calendar-slot-date">
                                                <span>Сонгосон өдөр</span>
                                                <strong>{selectedDate}</strong>
                                            </div>
                                            <div className="calendar-slot-fields">
                                                <div className="calendar-field">
                                                    <label>Цаг</label>
                                                    <input
                                                        type="time"
                                                        value={slotDraft.time}
                                                        onChange={(e) => setSlotDraft({ ...slotDraft, time: e.target.value })}
                                                        className="input"
                                                    />
                                                </div>
                                                <div className="calendar-field">
                                                    <label>Суудал</label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={slotDraft.capacity}
                                                        onChange={(e) => setSlotDraft({ ...slotDraft, capacity: e.target.value })}
                                                        className="input"
                                                        placeholder="Суудлын тоо"
                                                    />
                                                </div>
                                            </div>
                                            <button type="button" className="btn btn-outline" onClick={handleAddSlot}>
                                                Нээлттэй цаг нэмэх
                                            </button>
                                        </div>

                                        {selectedSlots.length ? (
                                            <div className="calendar-slot-list">
                                                <div className="calendar-slot-header">
                                                    <span>Цаг</span>
                                                    <span>Суудал</span>
                                                    <span>Үлдсэн</span>
                                                    <span>Идэвхтэй</span>
                                                    <span></span>
                                                </div>
                                                {selectedSlots.map((slot) => (
                                                    <div key={slot.id} className="calendar-slot-row">
                                                        <div className="calendar-slot-time">{slot.time}</div>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={slot.capacity ?? 0}
                                                            onChange={(e) => updateSlot(slot.id, { capacity: e.target.value })}
                                                            className="input calendar-slot-input"
                                                        />
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={slot.remaining ?? 0}
                                                            onChange={(e) => updateSlot(slot.id, { remaining: e.target.value })}
                                                            className="input calendar-slot-input"
                                                        />
                                                        <label className="calendar-slot-toggle">
                                                            <input
                                                                type="checkbox"
                                                                checked={slot.active !== false}
                                                                onChange={(e) => updateSlot(slot.id, { active: e.target.checked })}
                                                            />
                                                            Идэвхтэй
                                                        </label>
                                                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeSlot(slot.id)}>
                                                            Устгах
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="calendar-empty">Энэ өдөр нээлттэй цаг нэмээгүй байна.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'bookings' && (
                    <div className="editor-section">
                        {isEditing ? (
                            <div className="card">
                                <div className="card-header">
                                    <div className="card-title">Захиалгууд</div>
                                </div>
                                <div className="card-body">
                                    {bookingLoading ? (
                                        <div style={{ padding: '1rem 0', color: 'var(--ink-400)' }}>Уншиж байна...</div>
                                    ) : bookings.length === 0 ? (
                                        <div style={{ padding: '1rem 0', color: 'var(--ink-400)' }}>Одоогоор захиалга байхгүй.</div>
                                    ) : (
                                        <div className="table-wrap">
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>Хэрэглэгч</th>
                                                        <th>Цаг</th>
                                                        <th>Төлбөр</th>
                                                        <th>Төлөв</th>
                                                        <th>Үйлдэл</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bookings.map((booking) => (
                                                        <tr key={booking.id}>
                                                            <td>
                                                                <div style={{ fontWeight: 600 }}>{booking.userName || 'Зочин'}</div>
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--ink-500)' }}>{booking.userEmail}</div>
                                                            </td>
                                                            <td>
                                                                <div>{booking.selectedDate}</div>
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--ink-500)' }}>{booking.selectedTime}</div>
                                                            </td>
                                                            <td>
                                                                <div>₮{Number(booking.amount).toLocaleString()}</div>
                                                                {Number(booking.remainingAmount || 0) > 0 && (
                                                                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-500)' }}>
                                                                        Үлдэгдэл: ₮{Number(booking.remainingAmount).toLocaleString()}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td>{booking.status}</td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        {booking.status === 'PENDING' && (
                                                            <button type="button" className="btn btn-sm btn-outline" onClick={() => updateBookingStatus(booking.id, 'PAID')}>
                                                                Төлөвлөх
                                                            </button>
                                                        )}
                                                        {booking.status !== 'CANCELLED' && (
                                                            <button type="button" className="btn btn-sm btn-danger" onClick={() => updateBookingStatus(booking.id, 'CANCELLED')}>
                                                                Цуцлах
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline"
                                                            onClick={() => handleCalendarAction(booking, 'google')}
                                                        >
                                                            <CalendarPlus size={16} />
                                                            Google Calendar
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-sm btn-outline"
                                                            onClick={() => handleCalendarAction(booking, 'ics')}
                                                        >
                                                            <Mail size={16} />
                                                            Apple (.ics) илгээх
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="card">
                                <div className="card-body" style={{ color: 'var(--ink-500)' }}>
                                    Сургалт хадгалагдсаны дараа захиалгууд энд харагдана.
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </form>
        </div>
    );
};

export default TrainingEditor;
