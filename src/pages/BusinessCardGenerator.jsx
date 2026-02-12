import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import QRCode from 'qrcode';
import ToolHeader from '../components/ToolHeader';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';
import useAccess from '../hooks/useAccess';
import { apiFetch } from '../lib/apiClient';
import { getGuestSessionId } from '../lib/guest';
import './BusinessCardGenerator.css';

const PAYMENT_STORAGE_KEY = 'business-card-grant';

const safeValue = (value, fallback) => {
    if (value === null || value === undefined) return fallback;
    const trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : fallback;
};

const slugify = (value) => {
    const slug = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    return slug || 'business-card';
};

const buildVCard = (data) => {
    const notes = [];
    if (data.tagline) notes.push(data.tagline);
    if (data.socials?.length) {
        notes.push(data.socials.map((s) => `${s.label}: ${s.value}`).join(' | '));
    }
    const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${data.fullName}`,
        ...(data.organization ? [`ORG:${data.organization}`] : []),
        `TITLE:${data.position}`,
        `TEL;TYPE=CELL:${data.phone}`,
        `EMAIL:${data.email}`,
        `URL:${data.web}`,
        `ADR;TYPE=WORK:;;${data.address}`,
        ...(notes.length ? [`NOTE:${notes.join(' / ')}`] : []),
        'END:VCARD'
    ];
    return lines.join('\n');
};

const layoutOptions = [
    {
        id: 'classic',
        tag: 'Classic',
        label: 'Лого зүүн, мэдээлэл баруун',
        hint: 'Хамгийн тэнцвэртэй'
    },
    {
        id: 'name-dominant',
        tag: 'Name',
        label: 'Нэрийг гол болгосон',
        hint: 'Хувь хүн төвтэй'
    },
    {
        id: 'logo-top',
        tag: 'Stacked',
        label: 'Лого дээр, мэдээлэл доор',
        hint: 'Брэнд тод'
    },
    {
        id: 'split',
        tag: 'Split',
        label: '2 талт хуваалт',
        hint: 'Дэгжин бүтэц'
    },
    {
        id: 'qr',
        tag: 'QR',
        label: 'QR бүхий загвар',
        hint: 'Хурдан скан'
    },
    {
        id: 'centered',
        tag: 'Centered',
        label: 'Төвлөрсөн зохиомж',
        hint: 'Зөөлөн баланс'
    },
    {
        id: 'icon',
        tag: 'Icon',
        label: 'Икон дээр суурилсан',
        hint: 'Холбоо төвтэй'
    },
    {
        id: 'brand-strip',
        tag: 'Strip',
        label: 'Брэнд туузтай',
        hint: 'Онцгой өнгө'
    },
];

const fontOptions = [
    { id: 'inter', label: 'Inter', stack: "'Inter', 'Segoe UI', sans-serif" },
    { id: 'roboto', label: 'Roboto', stack: "'Roboto', 'Segoe UI', sans-serif" },
    { id: 'noto-sans', label: 'Noto Sans', stack: "'Noto Sans', 'Segoe UI', sans-serif" },
    { id: 'open-sans', label: 'Open Sans', stack: "'Open Sans', 'Segoe UI', sans-serif" },
    { id: 'noto-serif', label: 'Noto Serif', stack: "'Noto Serif', 'Times New Roman', serif" },
];

const CardFront = ({ data, layout, logo, fontStack }) => (
    <div
        className={`business-card-surface business-card-front layout-${layout} ${logo ? 'has-logo' : ''}`}
        style={{ '--card-font': fontStack }}
    >
        <div className="business-card-brand-strip" />
        <div className="business-card-front-inner">
            {logo && (
                <div className="business-card-logo-block">
                    <img src={logo} alt={`${data.fullName} logo`} />
                </div>
            )}
            <div className="business-card-front-body">
                <div className="business-card-name">{data.fullName}</div>
                <div className="business-card-position">{data.position}</div>
                {data.tagline && <div className="business-card-tagline">{data.tagline}</div>}
            </div>
        </div>
    </div>
);

const CardBack = ({ data, layout, logo, qrDataUrl, fontStack }) => (
    <div
        className={`business-card-surface business-card-back layout-${layout} ${logo ? 'has-logo' : ''}`}
        style={{ '--card-font': fontStack }}
    >
        <div className="business-card-brand-strip" />
        {logo && (
            <div className="business-card-back-logo">
                <img src={logo} alt={`${data.fullName} logo`} />
            </div>
        )}
        <div className="business-card-back-header">
            <div className="business-card-back-org">{data.fullName}</div>
            <div className="business-card-back-web">{data.web}</div>
        </div>
        <div className="business-card-back-body">
            <div className="business-card-back-identity">
                <div className="business-card-name">{data.fullName}</div>
                <div className="business-card-position">{data.position}</div>
            </div>
            <div className="business-card-back-list">
                <div className="business-card-back-item">
                    <span className="business-card-contact-icon" data-icon="P" />
                    <span className="business-card-back-label">Утас</span>
                    <span className="business-card-back-value">{data.phone}</span>
                </div>
                <div className="business-card-back-item">
                    <span className="business-card-contact-icon" data-icon="E" />
                    <span className="business-card-back-label">И-мэйл</span>
                    <span className="business-card-back-value">{data.email}</span>
                </div>
                <div className="business-card-back-item">
                    <span className="business-card-contact-icon" data-icon="W" />
                    <span className="business-card-back-label">Вэб</span>
                    <span className="business-card-back-value">{data.web}</span>
                </div>
                <div className="business-card-back-item">
                    <span className="business-card-contact-icon" data-icon="A" />
                    <span className="business-card-back-label">Хаяг</span>
                    <span className="business-card-back-value business-card-back-value--address">{data.address}</span>
                </div>
                {data.socials?.length ? (
                    <div className="business-card-socials">
                        {data.socials.map((social) => (
                            <span
                                key={social.id}
                                className={`business-card-social-icon social-${social.id}`}
                                title={`${social.label}: ${social.value}`}
                            >
                                {social.label.slice(0, 2).toUpperCase()}
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>
            {layout === 'qr' && (
                <div className="business-card-qr">
                    {qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR код" />
                    ) : (
                        <div className="business-card-qr-placeholder">QR</div>
                    )}
                </div>
            )}
        </div>
    </div>
);

const BusinessCardGenerator = () => {
    const { currentUser, refreshUserProfile, userProfile } = useAuth();
    const { config: billingConfig } = useBilling();
    const { discountPercent } = useAccess();

    const [form, setForm] = useState({
        fullName: 'Г.Бат',
        position: 'Борлуулалтын менежер',
        phone: '9911-2233',
        email: 'hello@nege.mn',
        address: 'Улаанбаатар хот, Сүхбаатар дүүрэг, 1-р хороо',
        web: 'www.nege.mn',
        tagline: 'Таны брэндийн үнэ цэнийг нэг мөрөөр илэрхийлнэ.',
        socialFacebook: '',
        socialInstagram: '',
        socialLinkedin: '',
        socialX: '',
    });
    const [layout, setLayout] = useState('classic');
    const [logo, setLogo] = useState(null);
    const [logoName, setLogoName] = useState('');
    const [fontId, setFontId] = useState('inter');
    const [previewMode, setPreviewMode] = useState('actual');
    const [previewScale, setPreviewScale] = useState(1);
    const [showGuides, setShowGuides] = useState(false);
    const [isFlipped, setIsFlipped] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState('');

    const [isGenerating, setIsGenerating] = useState(false);
    const [paymentInvoice, setPaymentInvoice] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState('idle');
    const [paymentGrant, setPaymentGrant] = useState(null);
    const [paymentError, setPaymentError] = useState(null);
    const [isCheckingPayment, setIsCheckingPayment] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('pay');

    const exportRef = useRef(null);
    const frontRef = useRef(null);
    const backRef = useRef(null);
    const logoInputRef = useRef(null);

    const toolPricing = billingConfig?.tools?.business_card || { payPerUsePrice: 1000, creditCost: 1, active: true };
    const isToolActive = toolPricing?.active !== false;
    const basePrice = Number(toolPricing.payPerUsePrice || 0);
    const discountedPrice = Math.max(0, Math.round(basePrice * (1 - (discountPercent || 0) / 100)));
    const creditCost = Number(toolPricing.creditCost || 0);
    const isFree = discountedPrice <= 0 && creditCost <= 0;

    const displayData = useMemo(() => ({
        fullName: safeValue(form.fullName, 'Нэр Овог'),
        position: safeValue(form.position, 'Албан тушаал'),
        phone: safeValue(form.phone, '9911-2233'),
        email: safeValue(form.email, 'hello@company.mn'),
        address: safeValue(form.address, 'Улаанбаатар хот, Сүхбаатар дүүрэг'),
        web: safeValue(form.web, 'www.company.mn'),
        tagline: safeValue(form.tagline, ''),
        socials: [
            { id: 'facebook', label: 'Facebook', value: safeValue(form.socialFacebook, '') },
            { id: 'instagram', label: 'Instagram', value: safeValue(form.socialInstagram, '') },
            { id: 'linkedin', label: 'LinkedIn', value: safeValue(form.socialLinkedin, '') },
            { id: 'x', label: 'X', value: safeValue(form.socialX, '') },
        ].filter((item) => item.value),
    }), [form]);

    const activeFont = useMemo(() => {
        return fontOptions.find((option) => option.id === fontId) || fontOptions[0];
    }, [fontId]);

    useEffect(() => {
        let cancelled = false;
        if (layout !== 'qr') {
            setQrDataUrl('');
            return () => {
                cancelled = true;
            };
        }

        const vcard = buildVCard(displayData);
        QRCode.toDataURL(vcard, {
            margin: 0,
            width: 220,
            color: {
                dark: '#111111',
                light: '#ffffff'
            }
        }).then((url) => {
            if (!cancelled) {
                setQrDataUrl(url);
            }
        }).catch(() => {
            if (!cancelled) {
                setQrDataUrl('');
            }
        });

        return () => {
            cancelled = true;
        };
    }, [layout, displayData]);

    const fileBase = useMemo(() => slugify(form.fullName), [form.fullName]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(PAYMENT_STORAGE_KEY);
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (parsed?.grantToken && !parsed?.used) {
                setPaymentGrant(parsed);
                setPaymentStatus('paid');
            }
        } catch (error) {
            console.error('Failed to restore payment grant', error);
        }
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleFlip = () => {
        setIsFlipped((prev) => !prev);
    };

    const handleFlipKey = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleFlip();
        }
    };

    const handleLogoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => {
            setLogo(reader.result);
            setLogoName(file.name || 'logo');
        };
        reader.readAsDataURL(file);
    };

    const clearLogo = () => {
        setLogo(null);
        setLogoName('');
        if (logoInputRef.current) {
            logoInputRef.current.value = '';
        }
    };

    const storeGrant = (grant) => {
        localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(grant));
        setPaymentGrant(grant);
        setPaymentStatus('paid');
    };

    const markGrantUsed = () => {
        if (!paymentGrant) return;
        const updated = { ...paymentGrant, used: true, usedAt: new Date().toISOString() };
        localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(updated));
        setPaymentGrant(updated);
    };

    const resetPayment = () => {
        setPaymentInvoice(null);
        setPaymentGrant(null);
        setPaymentStatus('idle');
        setPaymentError(null);
        localStorage.removeItem(PAYMENT_STORAGE_KEY);
    };

    const createPaymentInvoice = async () => {
        if (!isToolActive) {
            alert('Энэ үйлчилгээ одоогоор түр хаалттай байна.');
            return;
        }
        try {
            setPaymentStatus('creating');
            setPaymentError(null);
            let response = await apiFetch('/billing/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({ type: 'tool', toolKey: 'business_card' }),
            });
            let data = await response.json();
            if (!response.ok) {
                if (response.status !== 404) {
                    throw new Error(data?.error || 'Нэхэмжлэл үүсгэхэд алдаа гарлаа');
                }
                response = await apiFetch('/qpay/invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: discountedPrice,
                        description: 'Нэрийн хуудас (QPay)',
                    }),
                });
                data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.error || 'Нэхэмжлэл үүсгэхэд алдаа гарлаа');
                }
            }
            setPaymentInvoice(data);
            setPaymentStatus('pending');
        } catch (error) {
            let message = error instanceof Error ? error.message : 'Төлбөрийн системд алдаа гарлаа';
            if (error instanceof TypeError || String(error?.message || '').includes('Failed to fetch')) {
                message = 'QPay сервер асаагүй байна. `npm run qpay:server` ажиллуулна уу.';
            }
            setPaymentStatus('error');
            setPaymentError(message);
        }
    };

    const checkPaymentStatus = async () => {
        if (!paymentInvoice?.invoice_id) return;
        setIsCheckingPayment(true);
        try {
            let response = await apiFetch('/billing/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({ invoice_id: paymentInvoice.invoice_id }),
            });
            let data = await response.json();
            if (!response.ok) {
                if (response.status !== 404) {
                    throw new Error(data?.error || 'Төлбөр шалгахад алдаа гарлаа');
                }
                response = await apiFetch('/qpay/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoice_id: paymentInvoice.invoice_id }),
                });
                data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.error || 'Төлбөр шалгахад алдаа гарлаа');
                }
            }
            if (data.paid) {
                storeGrant({
                    invoice_id: paymentInvoice.invoice_id,
                    paidAt: new Date().toISOString(),
                    amount: data.amount || discountedPrice,
                    grantToken: data.grantToken,
                    used: false,
                    creditsUsed: 0,
                });
                await refreshUserProfile();
            }
        } catch (error) {
            let message = error instanceof Error ? error.message : 'Төлбөр шалгахад алдаа гарлаа';
            if (error instanceof TypeError || String(error?.message || '').includes('Failed to fetch')) {
                message = 'QPay сервер асаагүй байна. `npm run qpay:server` ажиллуулна уу.';
            }
            setPaymentError(message);
        } finally {
            setIsCheckingPayment(false);
        }
    };

    const consumeCredits = async () => {
        if (!isToolActive) {
            alert('Энэ үйлчилгээ одоогоор түр хаалттай байна.');
            return;
        }
        if (!currentUser) {
            alert('Кредит ашиглахын тулд нэвтэрнэ үү.');
            return;
        }
        try {
            setPaymentStatus('creating');
            setPaymentError(null);
            const response = await apiFetch('/credits/consume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({
                    toolKey: 'business_card',
                    userId: currentUser?.uid || null,
                    currentBalance: userProfile?.credits?.balance ?? null,
                    creditCost,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'Кредит ашиглахад алдаа гарлаа');
            }
            storeGrant({
                invoice_id: null,
                paidAt: new Date().toISOString(),
                amount: 0,
                grantToken: data.grantToken,
                used: false,
                creditsUsed: data.creditsUsed || creditCost,
            });
            await refreshUserProfile();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Кредит ашиглахад алдаа гарлаа';
            setPaymentError(message);
            setPaymentStatus('error');
        }
    };

    const downloadPdf = async () => {
        const element = exportRef.current;
        if (!element) return;
        const opt = {
            margin: 0,
            filename: `${fileBase}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 3, useCORS: true, backgroundColor: '#ffffff' },
            pagebreak: { mode: ['css', 'legacy'] },
            jsPDF: { unit: 'mm', format: [90, 50], orientation: 'landscape' },
        };
        await html2pdf().set(opt).from(element).save();
    };

    const downloadPng = async (element, filename) => {
        if (!element) return;
        const worker = html2pdf()
            .set({ html2canvas: { scale: 3, useCORS: true, backgroundColor: '#ffffff' } })
            .from(element)
            .toCanvas();
        const canvas = await worker.get('canvas');
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    const handleDownload = async () => {
        if (!isToolActive) {
            alert('Энэ үйлчилгээ одоогоор түр хаалттай байна.');
            return;
        }
        const paymentReady = !!paymentGrant && !paymentGrant.used;
        if (!isFree && !paymentReady) {
            alert('Татаж авахын өмнө төлбөрөө баталгаажуулна уу.');
            return;
        }
        if (layout === 'qr' && !qrDataUrl) {
            alert('QR бэлдэж байна. Түр хүлээгээд дахин оролдоно уу.');
            return;
        }
        if (!exportRef.current || !frontRef.current || !backRef.current) return;

        setIsGenerating(true);
        try {
            await downloadPdf();
            await downloadPng(frontRef.current, `${fileBase}-front.png`);
            await downloadPng(backRef.current, `${fileBase}-back.png`);

            if (!isFree) {
                markGrantUsed();
            }

            try {
                await apiFetch('/usage/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    auth: !!currentUser,
                    body: JSON.stringify({
                        toolKey: 'business_card',
                        paymentMethod: isFree
                            ? 'free'
                            : paymentGrant?.creditsUsed
                                ? 'credits'
                                : 'pay_per_use',
                        amount: paymentGrant?.amount || discountedPrice,
                        creditsUsed: paymentGrant?.creditsUsed || 0,
                        invoiceId: paymentGrant?.invoice_id || null,
                        grantToken: paymentGrant?.grantToken || null,
                        guestSessionId: currentUser ? null : getGuestSessionId(),
                    }),
                });
            } catch (error) {
                console.error('Usage log error:', error);
            }
        } catch (error) {
            console.error('Download error:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const paymentReady = isFree || (paymentGrant && !paymentGrant.used);
    const paymentUsed = paymentGrant && paymentGrant.used;
    const qrReady = layout !== 'qr' || !!qrDataUrl;
    const paymentBadge = !isToolActive
        ? { label: 'Түр хаалттай', tone: 'badge-warning' }
        : isFree
            ? { label: 'Үнэгүй', tone: 'badge-success' }
            : paymentReady
                ? { label: 'Идэвхтэй', tone: 'badge-success' }
                : paymentUsed
                    ? { label: 'Ашигласан', tone: 'badge-muted' }
                    : { label: 'Төлбөр хүлээгдэж байна', tone: 'badge-warning' };

    return (
        <div className="business-card-page">
            <ToolHeader
                title="Нэрийн хуудас бүтээгч"
                subtitle="Минимал загвартай нэрийн хуудсаа хялбархан бүтээж, PDF хэлбэрээр татаж аваарай."
            />

            <div className="container business-card-split-layout">
                {/* Left Sidebar: Controls */}
                <div className="business-card-sidebar">
                    {!isToolActive && (
                        <div className="alert alert-warning">
                            Энэ үйлчилгээ одоогоор түр хаалттай байна.
                        </div>
                    )}

                    {/* Section: Identity */}
                    <div className="business-card-section">
                        <div className="business-card-section-header">Хувийн мэдээлэл</div>
                        <div className="business-card-section-body">
                            <div className="business-card-logo-upload">
                                <label className="form-label">Лого</label>
                                <div className="flex gap-3 items-center">
                                    <input
                                        ref={logoInputRef}
                                        className="input"
                                        type="file"
                                        accept="image/png,image/jpeg,image/svg+xml"
                                        onChange={handleLogoChange}
                                        style={{ fontSize: '0.85rem' }}
                                    />
                                    {logo && (
                                        <button type="button" className="btn btn-ghost btn-danger btn-sm" onClick={clearLogo}>
                                            Устгах
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <label className="form-field">
                                    <span className="form-label">Нэр</span>
                                    <input
                                        className="input"
                                        name="fullName"
                                        value={form.fullName}
                                        onChange={handleChange}
                                        placeholder="Нэр Овог"
                                    />
                                </label>
                                <label className="form-field">
                                    <span className="form-label">Албан тушаал</span>
                                    <input
                                        className="input"
                                        name="position"
                                        value={form.position}
                                        onChange={handleChange}
                                        placeholder="Албан тушаал"
                                    />
                                </label>
                            </div>
                            <label className="form-field">
                                <span className="form-label">Товч уриа</span>
                                <input
                                    className="input"
                                    name="tagline"
                                    value={form.tagline}
                                    onChange={handleChange}
                                    placeholder="Брэндийн уриа үг"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Section: Contact */}
                    <div className="business-card-section">
                        <div className="business-card-section-header">Холбоо барих</div>
                        <div className="business-card-section-body">
                            <div className="grid grid-cols-2 gap-4">
                                <label className="form-field">
                                    <span className="form-label">Утас</span>
                                    <input
                                        className="input"
                                        name="phone"
                                        value={form.phone}
                                        onChange={handleChange}
                                    />
                                </label>
                                <label className="form-field">
                                    <span className="form-label">И-мэйл</span>
                                    <input
                                        className="input"
                                        name="email"
                                        type="email"
                                        value={form.email}
                                        onChange={handleChange}
                                    />
                                </label>
                            </div>
                            <label className="form-field">
                                <span className="form-label">Вэб сайт</span>
                                <input
                                    className="input"
                                    name="web"
                                    value={form.web}
                                    onChange={handleChange}
                                />
                            </label>
                            <label className="form-field">
                                <span className="form-label">Хаяг</span>
                                <input
                                    className="input"
                                    name="address"
                                    value={form.address}
                                    onChange={handleChange}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Section: Social */}
                    <div className="business-card-section">
                        <div className="business-card-section-header">Нийгмийн сүлжээ</div>
                        <div className="business-card-section-body">
                            <div className="grid grid-cols-2 gap-4">
                                <label className="form-field">
                                    <span className="form-label">Facebook</span>
                                    <input className="input" name="socialFacebook" value={form.socialFacebook} onChange={handleChange} placeholder="username" />
                                </label>
                                <label className="form-field">
                                    <span className="form-label">Instagram</span>
                                    <input className="input" name="socialInstagram" value={form.socialInstagram} onChange={handleChange} placeholder="username" />
                                </label>
                                <label className="form-field">
                                    <span className="form-label">LinkedIn</span>
                                    <input className="input" name="socialLinkedin" value={form.socialLinkedin} onChange={handleChange} placeholder="username" />
                                </label>
                                <label className="form-field">
                                    <span className="form-label">X / Twitter</span>
                                    <input className="input" name="socialX" value={form.socialX} onChange={handleChange} placeholder="username" />
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Section: Payment */}
                    <div className="business-card-section">
                        <div className="business-card-section-header">Үнэ, төлбөр</div>
                        <div className="business-card-section-body">
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-slate-500">Үнэ</span>
                                    <div className="text-xl font-bold text-slate-900">
                                        {isFree ? 'Үнэгүй' : `${discountedPrice.toLocaleString()}₮`}
                                    </div>
                                </div>

                                {paymentReady ? (
                                    <div className="flex flex-col gap-3">
                                        <div className="alert alert-success text-center py-2 text-sm">
                                            Төлбөр төлөгдсөн. Татах боломжтой.
                                        </div>
                                        <button
                                            onClick={handleDownload}
                                            disabled={isGenerating || !qrReady}
                                            className="btn btn-primary w-full"
                                        >
                                            {isGenerating ? 'Бэлтгэж байна...' : 'PDF + PNG Татах'}
                                            <Download size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex gap-2">
                                            <button
                                                className={`flex-1 btn btn-sm ${paymentMethod === 'pay' ? 'btn-secondary' : 'btn-outline'}`}
                                                onClick={() => setPaymentMethod('pay')}
                                            >
                                                QPay
                                            </button>
                                            <button
                                                className={`flex-1 btn btn-sm ${paymentMethod === 'credits' ? 'btn-secondary' : 'btn-outline'}`}
                                                onClick={() => setPaymentMethod('credits')}
                                            >
                                                Кредит ({creditCost})
                                            </button>
                                        </div>

                                        <button
                                            onClick={paymentMethod === 'credits' ? consumeCredits : createPaymentInvoice}
                                            disabled={paymentStatus === 'creating' || !isToolActive}
                                            className="btn btn-primary w-full"
                                        >
                                            {paymentMethod === 'credits' ? 'Кредит ашиглах' : 'Төлбөр төлөх (QPay)'}
                                        </button>

                                        {paymentMethod === 'pay' && paymentInvoice && (
                                            <div className="mt-2 text-center">
                                                {paymentInvoice?.qr_image && (
                                                    <img
                                                        src={`data:image/png;base64,${paymentInvoice.qr_image}`}
                                                        alt="QPay QR код"
                                                        className="mx-auto w-48 rounded border border-slate-200 p-2"
                                                    />
                                                )}
                                                <button
                                                    onClick={checkPaymentStatus}
                                                    disabled={isCheckingPayment}
                                                    className="btn btn-ghost btn-sm mt-2"
                                                >
                                                    {isCheckingPayment ? 'Шалгаж байна...' : 'Төлбөр шалгах'}
                                                </button>
                                            </div>
                                        )}
                                        {paymentError && <div className="text-red-500 text-sm text-center">{paymentError}</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right Main: Preview */}
                <div className="business-card-main">
                    <div className="business-card-section">
                        <div className="business-card-section-header">Загвар & Тохиргоо</div>
                        <div className="business-card-section-body">
                            <div className="grid grid-cols-2 gap-4">
                                <label className="form-field">
                                    <span className="form-label">Байршил (Layout)</span>
                                    <select
                                        className="select"
                                        value={layout}
                                        onChange={(e) => setLayout(e.target.value)}
                                    >
                                        {layoutOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.tag} - {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="form-field">
                                    <span className="form-label">Үсгийн фонт</span>
                                    <select
                                        className="select"
                                        value={fontId}
                                        onChange={(e) => setFontId(e.target.value)}
                                    >
                                        {fontOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>
                    <div className="business-card-preview-container">
                        <div className="business-card-preview-toolbar">
                            <div className="segmented" role="tablist">
                                <button
                                    type="button"
                                    className={!isFlipped ? 'active' : ''}
                                    onClick={() => setIsFlipped(false)}
                                >
                                    Нүүр
                                </button>
                                <button
                                    type="button"
                                    className={isFlipped ? 'active' : ''}
                                    onClick={() => setIsFlipped(true)}
                                >
                                    Ар
                                </button>
                            </div>
                            <div className="w-px h-4 bg-gray-300 mx-2"></div>
                            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showGuides}
                                    onChange={(e) => setShowGuides(e.target.checked)}
                                />
                                Хэвлэх заавар
                            </label>
                        </div>

                        <div className="business-card-preview-stage" style={{ background: 'transparent', border: 'none', padding: 0 }}>
                            <div
                                className={`business-card-flip ${previewMode === 'fit' ? 'is-fit' : 'is-actual'} ${showGuides ? 'show-guides' : ''} ${isFlipped ? 'is-flipped' : ''}`}
                                style={{ '--preview-scale': previewScale }}
                                onClick={handleFlip}
                            >
                                <div className="business-card-flip-inner">
                                    <div className="business-card-face business-card-face--front">
                                        <div className="business-card-guides">
                                            <span className="business-card-guide business-card-guide--bleed" />
                                            <span className="business-card-guide business-card-guide--safe" />
                                        </div>
                                        <CardFront data={displayData} layout={layout} logo={logo} fontStack={activeFont.stack} />
                                    </div>
                                    <div className="business-card-face business-card-face--back">
                                        <div className="business-card-guides">
                                            <span className="business-card-guide business-card-guide--bleed" />
                                            <span className="business-card-guide business-card-guide--safe" />
                                        </div>
                                        <CardBack
                                            data={displayData}
                                            layout={layout}
                                            logo={logo}
                                            qrDataUrl={qrDataUrl}
                                            fontStack={activeFont.stack}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>

            <div className="business-card-export" ref={exportRef} aria-hidden>
                <div className="business-card-export-page" ref={frontRef}>
                    <div className="business-card-viewport">
                        <CardFront data={displayData} layout={layout} logo={logo} fontStack={activeFont.stack} />
                    </div>
                </div>
                <div className="business-card-export-page" ref={backRef}>
                    <div className="business-card-viewport">
                        <CardBack
                            data={displayData}
                            layout={layout}
                            logo={logo}
                            qrDataUrl={qrDataUrl}
                            fontStack={activeFont.stack}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BusinessCardGenerator;
