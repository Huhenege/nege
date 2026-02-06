import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft,
    Download,
    Save,
    Image as ImageIcon,
    Type,
    Building2,
    MapPin,
    Phone,
    Mail,
    Globe,
    FileText,
    Sparkles,
    Layout,
    Maximize2,
    CheckCircle2,
    Loader2
} from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import './OfficialLetterheadGenerator.css';

const OfficialLetterheadGenerator = () => {
    // --- State ---
    const [config, setConfig] = useState({
        orgName: 'БАЙГУУЛЛАГЫН НЭР',
        orgLogo: null,
        address: 'Улаанбаатар хот, Сүхбаатар дүүрэг, 1-р хороо, Чингисийн талбай-1',
        phone: '7700-0000',
        email: 'info@organization.mn',
        web: 'www.organization.mn',

        docIndex: '24/01',
        docDate: new Date().toISOString().split('T')[0],
        docCity: 'Улаанбаатар хот',

        addresseeName: 'ГҮЙЦЭТГЭХ ЗАХИРАЛ Б.БАТ-ЭРДЭНЭ ТАНАА',
        addresseeOrg: 'МОНГОЛЫН ҮНДЭСНИЙ ХУДАЛДАА АЖ ҮЙЛДВЭРИЙН ТАНХИМ-Д',

        subject: 'Хамтран ажиллах тухай',
        content: 'Монголын Үндэсний Худалдаа Аж Үйлдвэрийн Танхим нь улс орны эдийн засаг, бизнесийн орчныг сайжруулах, дотоодын үйлдвэрлэгчдийг дэмжих чиглэлээр олон талт үйл ажиллагаа явуулдаг билээ.\n\nМанай байгууллага нь 2024 оны үйл ажиллагааны хүрээнд танай байгууллагатай хамтран ажиллах хүсэлтэй байна.',

        signPosition: 'Захирал',
        signName: 'Г.Гэрэлт',

        paperSize: 'A4', // A4, A5
        orientation: 'portrait', // portrait, landscape
    });

    const [logoPreview, setLogoPreview] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [paymentInvoice, setPaymentInvoice] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, creating, pending, success
    const [isPaid, setIsPaid] = useState(false);
    const documentRef = useRef(null);

    const qpayApiBase = (import.meta.env.VITE_QPAY_API_BASE || '/api').replace(/\/$/, '');

    // --- Effects ---
    useEffect(() => {
        // Build document when config changes - just for visual
    }, [config]);

    // --- Handlers ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result);
                setConfig(prev => ({ ...prev, orgLogo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const createPaymentInvoice = async () => {
        setPaymentStatus('creating');
        try {
            const response = await fetch(`${qpayApiBase}/qpay/invoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: 1000,
                    description: 'Албан бланк үүсгэх төлбөр',
                }),
            });
            const data = await response.json();
            if (data.invoice_id) {
                setPaymentInvoice(data);
                setPaymentStatus('pending');
                // Start polling or manual check
            }
        } catch (error) {
            console.error('Invoice creation error:', error);
            setPaymentStatus('idle');
        }
    };

    const checkPaymentStatus = async () => {
        if (!paymentInvoice) return;
        try {
            const response = await fetch(`${qpayApiBase}/qpay/check/${paymentInvoice.invoice_id}`);
            const data = await response.json();
            if (data.paid) {
                setIsPaid(true);
                setPaymentStatus('success');
                generatePDF();
            }
        } catch (error) {
            console.error('Payment check error:', error);
        }
    };

    const generatePDF = () => {
        setIsGenerating(true);
        const element = documentRef.current;
        const opt = {
            margin: 0,
            filename: `official_letter_${config.docIndex.replace(/\//g, '-')}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: config.paperSize.toLowerCase(), orientation: config.orientation }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            setIsGenerating(false);
        });
    };

    const [isAiGenerating, setIsAiGenerating] = useState(false);

    const handleAiGenerateContent = async () => {
        if (!config.subject) {
            alert('AI-аар текст үүсгэхийн тулд эхлээд "Гарчиг" хэсгийг бөглөнө үү.');
            return;
        }

        setIsAiGenerating(true);
        try {
            const response = await fetch(`${qpayApiBase}/ai/generate-letter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orgName: config.orgName,
                    addresseeOrg: config.addresseeOrg,
                    addresseeName: config.addresseeName,
                    subject: config.subject,
                    contentHint: config.content // Use existing content as hint
                }),
            });
            const data = await response.json();
            if (data.success && data.content) {
                setConfig(prev => ({ ...prev, content: data.content }));
            } else {
                alert('AI текст үүсгэхэд алдаа гарлаа. Та дахин оролдоно уу.');
            }
        } catch (error) {
            console.error('AI generation error:', error);
            alert('AI сервертэй холбогдоход алдаа гарлаа.');
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleDownloadClick = () => {
        if (isPaid) {
            generatePDF();
        } else {
            createPaymentInvoice();
        }
    };

    // --- UI Helpers ---
    const paperStyle = {
        width: config.paperSize === 'A4'
            ? (config.orientation === 'portrait' ? '210mm' : '297mm')
            : (config.orientation === 'portrait' ? '148mm' : '210mm'),
        height: config.paperSize === 'A4'
            ? (config.orientation === 'portrait' ? '297mm' : '210mm')
            : (config.orientation === 'portrait' ? '210mm' : '148mm'),
    };

    return (
        <div className="ob-page">
            <div className="ob-header">
                <div className="ob-header-inner">
                    <div>
                        <h1>Албан бичиг үүсгэгч</h1>
                        <p>Стандартын дагуу мэргэжлийн албан бланк бэлтгэх</p>
                    </div>
                    <Link to="/ai-assistant" className="ob-btn ob-btn--ghost">
                        <ArrowLeft size={18} /> Буцах
                    </Link>
                </div>
            </div>

            <div className="ob-container">
                {/* Sidebar: Inputs */}
                <div className="ob-sidebar">
                    <div className="ob-card">
                        <div className="ob-card-header">
                            <Layout size={18} /> Формат ба Загвар
                        </div>
                        <div className="ob-card-body">
                            <div className="ob-input-grid">
                                <div className="ob-input-group">
                                    <label>Цаасны хэмжээ</label>
                                    <div className="ob-toggle-row">
                                        <button
                                            className={`ob-toggle-btn ${config.paperSize === 'A4' ? 'active' : ''}`}
                                            onClick={() => setConfig(p => ({ ...p, paperSize: 'A4' }))}
                                        >A4</button>
                                        <button
                                            className={`ob-toggle-btn ${config.paperSize === 'A5' ? 'active' : ''}`}
                                            onClick={() => setConfig(p => ({ ...p, paperSize: 'A5' }))}
                                        >A5</button>
                                    </div>
                                </div>
                                <div className="ob-input-group">
                                    <label>Зүг чиг</label>
                                    <div className="ob-toggle-row">
                                        <button
                                            className={`ob-toggle-btn ${config.orientation === 'portrait' ? 'active' : ''}`}
                                            onClick={() => setConfig(p => ({ ...p, orientation: 'portrait' }))}
                                        >Босоо</button>
                                        <button
                                            className={`ob-toggle-btn ${config.orientation === 'landscape' ? 'active' : ''}`}
                                            onClick={() => setConfig(p => ({ ...p, orientation: 'landscape' }))}
                                        >Хэвтээ</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ob-card">
                        <div className="ob-card-header">
                            <Building2 size={18} /> Байгууллагын мэдээлэл
                        </div>
                        <div className="ob-card-body ob-stack">
                            <div className="ob-logo-upload" onClick={() => document.getElementById('logo-input').click()}>
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo" />
                                ) : (
                                    <div className="ob-logo-placeholder">
                                        <ImageIcon size={24} />
                                        <span>Лого оруулах</span>
                                    </div>
                                )}
                                <input id="logo-input" type="file" hidden accept="image/*" onChange={handleLogoChange} />
                            </div>
                            <div className="ob-input-group">
                                <label>Нэр</label>
                                <input name="orgName" value={config.orgName} onChange={handleChange} />
                            </div>
                            <div className="ob-input-group">
                                <label>Хаяг</label>
                                <textarea name="address" value={config.address} onChange={handleChange} rows={2} />
                            </div>
                            <div className="ob-input-grid">
                                <div className="ob-input-group">
                                    <label>Утас</label>
                                    <input name="phone" value={config.phone} onChange={handleChange} />
                                </div>
                                <div className="ob-input-group">
                                    <label>И-мэйл</label>
                                    <input name="email" value={config.email} onChange={handleChange} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ob-card">
                        <div className="ob-card-header">
                            <FileText size={18} /> Бичгийн агуулга
                        </div>
                        <div className="ob-card-body ob-stack">
                            <div className="ob-input-grid">
                                <div className="ob-input-group">
                                    <label>Индекст дугаар</label>
                                    <input name="docIndex" value={config.docIndex} onChange={handleChange} />
                                </div>
                                <div className="ob-input-group">
                                    <label>Огноо</label>
                                    <input type="date" name="docDate" value={config.docDate} onChange={handleChange} />
                                </div>
                            </div>
                            <div className="ob-input-group">
                                <label>Хэнд/Хаана</label>
                                <input name="addresseeOrg" value={config.addresseeOrg} onChange={handleChange} placeholder="Байгууллагын нэр" />
                                <input name="addresseeName" value={config.addresseeName} onChange={handleChange} placeholder="Албан тушаал, нэр" style={{ marginTop: '0.5rem' }} />
                            </div>
                            <div className="ob-input-group">
                                <label>Гарчиг</label>
                                <input name="subject" value={config.subject} onChange={handleChange} />
                            </div>
                            <div className="ob-input-group">
                                <div className="ob-input-header">
                                    <label>Агуулга</label>
                                    <button
                                        className="ob-ai-btn"
                                        onClick={handleAiGenerateContent}
                                        disabled={isAiGenerating}
                                    >
                                        {isAiGenerating ? <Loader2 size={14} className="ob-spin" /> : <Sparkles size={14} />}
                                        {isAiGenerating ? 'Үүсгэж байна...' : 'AI-аар үүсгэх'}
                                    </button>
                                </div>
                                <textarea name="content" value={config.content} onChange={handleChange} rows={8} />
                            </div>
                            <div className="ob-input-grid">
                                <div className="ob-input-group">
                                    <label>Гарын үсэг (Албан тушаал)</label>
                                    <input name="signPosition" value={config.signPosition} onChange={handleChange} />
                                </div>
                                <div className="ob-input-group">
                                    <label>Нэр</label>
                                    <input name="signName" value={config.signName} onChange={handleChange} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ob-action-sidebar">
                        <button
                            className={`ob-btn ob-btn--primary ob-btn--full ${isPaid ? 'paid' : ''}`}
                            onClick={handleDownloadClick}
                            disabled={isGenerating || paymentStatus === 'creating'}
                        >
                            {isGenerating ? <Loader2 className="ob-spin" /> : <Download size={20} />}
                            {isPaid ? 'PDF Татах' : 'PDF Татах (1000₮)'}
                        </button>
                    </div>
                </div>

                {/* Main: Preview */}
                <div className="ob-preview-area">
                    {paymentStatus === 'pending' && !isPaid && (
                        <div className="ob-payment-overlay">
                            <div className="ob-payment-card">
                                <h3>Төлбөр төлөх</h3>
                                <p>Бланк үүсгэхэд нэг удаа 1000₮ төлнө.</p>
                                {paymentInvoice?.qr_image && (
                                    <img src={`data:image/png;base64,${paymentInvoice.qr_image}`} alt="QPay QR" />
                                )}
                                <div className="ob-payment-actions">
                                    <button className="ob-btn ob-btn--primary" onClick={checkPaymentStatus}>
                                        Төлбөр шалгах
                                    </button>
                                    <button className="ob-btn ob-btn--ghost" onClick={() => setPaymentStatus('idle')}>
                                        Болих
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="ob-paper-wrapper">
                        <div
                            className={`ob-paper ${config.orientation}`}
                            style={paperStyle}
                            ref={documentRef}
                        >
                            {/* Header Section */}
                            <div className="ob-doc-header">
                                <div className="ob-header-top">
                                    {logoPreview && <img src={logoPreview} alt="Logo" className="ob-doc-logo" />}
                                    <h1 className="ob-doc-org-name">{config.orgName}</h1>
                                </div>
                                <div className="ob-header-contacts">
                                    <span><MapPin size={10} /> {config.address}</span>
                                    <span><Phone size={10} /> {config.phone}</span>
                                    <span><Mail size={10} /> {config.email}</span>
                                    <span><Globe size={10} /> {config.web}</span>
                                </div>
                                <div className="ob-header-divider"></div>
                                <div className="ob-header-divider double"></div>
                            </div>

                            {/* Meta Section */}
                            <div className="ob-doc-meta">
                                <div className="ob-meta-left">
                                    <span>{config.docDate.replace(/-/g, '.')}</span> № <span>{config.docIndex}</span>
                                </div>
                                <div className="ob-meta-right">
                                    {config.docCity}
                                </div>
                            </div>

                            {/* Addressee */}
                            <div className="ob-doc-addressee">
                                <p>{config.addresseeOrg}</p>
                                <p>{config.addresseeName}</p>
                            </div>

                            {/* Subject */}
                            <div className="ob-doc-subject">
                                <strong>Гарчиг: {config.subject}</strong>
                            </div>

                            {/* Content */}
                            <div className="ob-doc-content">
                                {config.content.split('\n').map((para, i) => (
                                    <p key={i}>{para}</p>
                                ))}
                            </div>

                            {/* Signature */}
                            <div className="ob-doc-signature">
                                <div className="ob-sig-row">
                                    <span>{config.signPosition}</span>
                                    <div className="ob-sig-space"></div>
                                    <span>{config.signName}</span>
                                </div>
                            </div>

                            <div className="ob-doc-footer-mark">
                                <div className="ob-footer-line"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OfficialLetterheadGenerator;
