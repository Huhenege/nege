import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Download,
    Image as ImageIcon,
    Building2,
    FileText,
    Sparkles,
    Layout,
    Loader2,
    CheckCircle2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';
import useAccess from '../hooks/useAccess';
import { apiFetch } from '../lib/apiClient';
import { getGuestSessionId } from '../lib/guest';
import './OfficialLetterheadGenerator.css';
import ToolHeader from '../components/ToolHeader';
import ToolPaymentDialog from '../components/ToolPaymentDialog';
import ToolPaymentStatusCard from '../components/ToolPaymentStatusCard';

const PAYMENT_STORAGE_KEY = 'letterhead-payment-grant';

const normalizeContentParagraphs = (content) => {
    const lines = String(content || '').replace(/\r/g, '').split('\n');
    const normalized = [];
    let previousWasEmpty = false;

    lines.forEach((line) => {
        const cleaned = line.replace(/\s+$/g, '');
        const isEmpty = cleaned.trim() === '';
        if (isEmpty) {
            if (!previousWasEmpty && normalized.length > 0) {
                normalized.push('');
            }
            previousWasEmpty = true;
            return;
        }
        normalized.push(cleaned);
        previousWasEmpty = false;
    });

    while (normalized.length > 0 && normalized[normalized.length - 1] === '') {
        normalized.pop();
    }

    return normalized.length > 0 ? normalized : [''];
};

const waitForImagesReady = async (root) => {
    if (!root) return;
    const images = Array.from(root.querySelectorAll('img'));
    if (!images.length) return;

    await Promise.all(images.map(async (img) => {
        if (img.complete && img.naturalWidth > 0) return;
        if (typeof img.decode === 'function') {
            try {
                await img.decode();
                return;
            } catch (error) {
                // Fallback to load/error listeners
            }
        }
        await new Promise((resolve) => {
            const done = () => {
                img.removeEventListener('load', done);
                img.removeEventListener('error', done);
                resolve();
            };
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
        });
    }));
};

const OfficialLetterheadGenerator = () => {
    const { currentUser, refreshUserProfile, userProfile } = useAuth();
    const { config: billingConfig } = useBilling();
    const { discountPercent, canUseTemplates } = useAccess();
    const location = useLocation();
    // --- State ---
    const [config, setConfig] = useState({
        orgName: 'БАЙГУУЛЛАГЫН НЭР',
        orgLogo: null,
        orgTagline: 'БАЙГУУЛЛАГЫН ҮЙЛ АЖИЛЛАГААНЫ ЧИГЛЭЛ',
        address: 'Улаанбаатар хот, Сүхбаатар дүүрэг, 1-р хороо, Чингисийн талбай-1',
        phone: '7700-0000',
        email: 'info@organization.mn',
        web: 'www.organization.mn',

        docIndex: '24/01',
        docDate: new Date().toISOString().split('T')[0],
        docCity: 'Улаанбаатар хот',
        tanaiRef: '',
        tanaiNo: '',

        addresseeName: 'АЛБАН ТУШААЛТАН ТАНАА',
        addresseeOrg: 'ИЛГЭЭН БАЙГУУЛЛАГА',

        subject: 'Гарчиг',
        content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\nUt enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.\n\nExcepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',

        signPosition: 'Захирал',
        signName: 'Г.Гэрэлт',

        paperSize: 'A4', // A4, A5
        orientation: 'portrait', // portrait, landscape
        fontFamily: 'Times New Roman', // 'Arial' | 'Times New Roman'
    });

    const [isGenerating, setIsGenerating] = useState(false);
    const [paymentInvoice, setPaymentInvoice] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, creating, pending, success
    const [paymentGrant, setPaymentGrant] = useState(null);
    const [paymentError, setPaymentError] = useState(null);
    const [isCheckingPayment, setIsCheckingPayment] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('pay'); // pay | credits
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);
    const documentRef = useRef(null);
    const measureRef = useRef(null);
    const measureHeaderRef = useRef(null);
    const measureAddresseeRef = useRef(null);
    const measureSubjectRef = useRef(null);
    const measureContentRef = useRef(null);
    const measureSignatureRef = useRef(null);
    const [pages, setPages] = useState([normalizeContentParagraphs(config.content)]);
    const [templates, setTemplates] = useState([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');

    const toolPricing = billingConfig?.tools?.official_letterhead || { payPerUsePrice: 1000, creditCost: 1, active: true };
    const isToolActive = toolPricing?.active !== false;
    const basePrice = Number(toolPricing.payPerUsePrice || 0);
    const discountedPrice = Math.max(0, Math.round(basePrice * (1 - (discountPercent || 0) / 100)));
    const creditCost = Number(toolPricing.creditCost || 1);

    // --- Effects ---
    useEffect(() => {
        // Build document when config changes - just for visual
    }, [config]);

    useEffect(() => {
        setTemplates([]);
        setSelectedTemplateId('');
    }, [currentUser?.uid]);

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

    useEffect(() => {
        if (paymentGrant?.grantToken && !paymentGrant?.used) {
            setShowPaymentDialog(false);
        }
    }, [paymentGrant]);

    useEffect(() => {
        const loadTemplates = async () => {
            if (!currentUser) return;
            setTemplatesLoading(true);
            try {
                const templatesRef = collection(db, 'letterheadTemplates');
                const q = query(templatesRef, where('userId', '==', currentUser.uid));
                const snapshot = await getDocs(q);
                const list = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data()
                })).sort((a, b) => {
                    const aTime = a.updatedAt?.toDate?.().getTime?.() || a.createdAt?.toDate?.().getTime?.() || 0;
                    const bTime = b.updatedAt?.toDate?.().getTime?.() || b.createdAt?.toDate?.().getTime?.() || 0;
                    return bTime - aTime;
                });
                setTemplates(list);
            } catch (error) {
                console.error('Template list error:', error);
            } finally {
                setTemplatesLoading(false);
            }
        };

        loadTemplates();
    }, [currentUser]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const templateId = params.get('templateId');
        if (templateId) {
            setSelectedTemplateId(templateId);
        }
    }, [location.search]);

    const handleApplyTemplate = () => {
        const selected = templates.find(item => item.id === selectedTemplateId);
        if (selected?.template) {
            setConfig(prev => ({
                ...prev,
                ...selected.template,
                // If template does not have logo, clear previous preview.
                orgLogo: selected.template?.orgLogo || null,
            }));
        }
    };

    useEffect(() => {
        if (selectedTemplateId) {
            handleApplyTemplate();
        }
    }, [selectedTemplateId, templates]);

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
                setConfig(prev => ({ ...prev, orgLogo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const storeGrant = (grant) => {
        localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(grant));
        setPaymentGrant(grant);
        setPaymentStatus('paid');
    };

    const resetPayment = () => {
        setPaymentInvoice(null);
        setPaymentGrant(null);
        setPaymentStatus('idle');
        setPaymentError(null);
        localStorage.removeItem(PAYMENT_STORAGE_KEY);
    };

    const markGrantUsed = (grantOverride = null) => {
        const grant = grantOverride || paymentGrant;
        if (!grant) return;
        const updated = { ...grant, used: true, usedAt: new Date().toISOString() };
        localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(updated));
        setPaymentGrant(updated);
        setPaymentStatus('used');
    };

    const createPaymentInvoice = async () => {
        if (!isToolActive) {
            alert('Энэ үйлчилгээ одоогоор түр хаалттай байна.');
            return;
        }
        setPaymentStatus('creating');
        setPaymentError(null);
        try {
            let response = await apiFetch('/billing/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({
                    type: 'tool',
                    toolKey: 'official_letterhead'
                }),
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
                        description: 'Албан бичиг (QPay)'
                    })
                });
                data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.error || 'Нэхэмжлэл үүсгэхэд алдаа гарлаа');
                }
            }
            if (data.invoice_id) {
                setPaymentInvoice(data);
                setPaymentStatus('pending');
            }
        } catch (error) {
            console.error('Invoice creation error:', error);
            setPaymentStatus('error');
            let message = error instanceof Error ? error.message : 'Төлбөрийн алдаа';
            if (error instanceof TypeError || String(error?.message || '').includes('Failed to fetch')) {
                message = 'QPay сервер асаагүй байна. `npm run qpay:server` ажиллуулна уу.';
            }
            setPaymentError(message);
        }
    };

    const checkPaymentStatus = async () => {
        if (!paymentInvoice) return;
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
            console.error('Payment check error:', error);
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
            alert('Credits ашиглахын тулд нэвтэрнэ үү.');
            return;
        }
        setPaymentStatus('creating');
        setPaymentError(null);
        try {
            const response = await apiFetch('/credits/consume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({
                    toolKey: 'official_letterhead',
                    userId: currentUser?.uid || null,
                    currentBalance: userProfile?.credits?.balance ?? null,
                    creditCost,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'Credits ашиглахад алдаа гарлаа');
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
            console.error('Credits consume error:', error);
            setPaymentStatus('error');
            setPaymentError(error instanceof Error ? error.message : 'Credits ашиглахад алдаа гарлаа');
        }
    };

    const generatePDF = async ({ activeGrant = null, adminBypass = false } = {}) => {
        setIsGenerating(true);
        const element = documentRef.current;
        if (element) {
            element.classList.add('ob-printing');
        }
        const filename = `official_letter_${config.docIndex.replace(/\//g, '-')}.pdf`;

        try {
            // Let layout/styles settle, then ensure all images (logo) are ready before capture.
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            await waitForImagesReady(element);
            const pageNodes = Array.from(element?.querySelectorAll('.ob-paper') || []);
            if (!pageNodes.length) {
                throw new Error('PDF page not found');
            }

            const pdf = new jsPDF({
                unit: 'mm',
                format: config.paperSize.toLowerCase(),
                orientation: config.orientation,
                compress: true,
            });
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            for (let i = 0; i < pageNodes.length; i += 1) {
                const pageNode = pageNodes[i];
                const canvas = await html2canvas(pageNode, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    imageTimeout: 0,
                });
                const imageData = canvas.toDataURL('image/jpeg', 0.98);

                if (i > 0) {
                    pdf.addPage();
                }
                pdf.addImage(imageData, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
            }

            pdf.save(filename);

            if (activeGrant) {
                markGrantUsed(activeGrant);
                try {
                    await apiFetch('/usage/log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        auth: !!currentUser,
                        body: JSON.stringify({
                            toolKey: 'official_letterhead',
                            paymentMethod: activeGrant?.creditsUsed ? 'credits' : 'pay_per_use',
                            amount: activeGrant?.amount || discountedPrice,
                            creditsUsed: activeGrant?.creditsUsed || 0,
                            invoiceId: activeGrant?.invoice_id || null,
                            grantToken: activeGrant?.grantToken || null,
                            guestSessionId: currentUser ? null : getGuestSessionId(),
                        }),
                    });
                } catch (error) {
                    console.error('Usage log error:', error);
                }
            } else if (currentUser?.role === 'admin' && adminBypass) {
                try {
                    await apiFetch('/usage/log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        auth: !!currentUser,
                        body: JSON.stringify({
                            toolKey: 'official_letterhead',
                            paymentMethod: 'admin_free',
                            amount: 0,
                            creditsUsed: 0,
                            invoiceId: null,
                            grantToken: null,
                            guestSessionId: null,
                        }),
                    });
                } catch (error) {
                    console.error('Usage log error:', error);
                }
            }
        } catch (error) {
            console.error('PDF generation failed:', error);
        } finally {
            if (element) {
                element.classList.remove('ob-printing');
            }
            setIsGenerating(false);
        }
    };

    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const blank = '\u00A0';
    const formattedDate = config.docDate ? config.docDate.replace(/-/g, '.') : '';
    const isA5 = config.paperSize === 'A5';

    const handleAiGenerateContent = async () => {
        if (!config.subject) {
            alert('AI-аар текст үүсгэхийн тулд эхлээд "Гарчиг" хэсгийг бөглөнө үү.');
            return;
        }

        setIsAiGenerating(true);
        try {
            const response = await apiFetch('/ai/generate-letter', {
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

    const handleDownloadClick = async ({ adminBypass = false } = {}) => {
        if (!isToolActive) {
            alert('Энэ үйлчилгээ одоогоор түр хаалттай байна.');
            return;
        }
        const activeGrant = paymentGrant?.grantToken && !paymentGrant?.used ? paymentGrant : null;
        if (activeGrant || adminBypass) {
            await generatePDF({ activeGrant, adminBypass });
            return;
        }
        setShowPaymentDialog(true);
    };
    const paymentReady = paymentGrant?.grantToken && !paymentGrant?.used;
    const paymentUsed = paymentGrant?.used;
    const paymentRequiredBeforeDownload = !paymentReady;

    // --- UI Helpers ---
    const getPaperMargins = (paperSize, orientation) => {
        if (paperSize === 'A4') {
            if (orientation === 'landscape') {
                return { top: 30, right: 20, bottom: 15, left: 20 };
            }
            return { top: 20, right: 15, bottom: 20, left: 30 };
        }
        // A5 (standard same for both orientations per provided table)
        return { top: 20, right: 15, bottom: 20, left: 30 };
    };

    const margins = getPaperMargins(config.paperSize, config.orientation);
    const fontFamily = config.fontFamily === 'Arial' ? 'Arial, sans-serif' : '"Times New Roman", serif';
    const bodyFontSize = config.fontFamily === 'Arial' ? '11pt' : '12pt';
    const lineHeight = config.paperSize === 'A5' ? 1.0 : 1.3;

    const paperStyle = {
        width: config.paperSize === 'A4'
            ? (config.orientation === 'portrait' ? '210mm' : '297mm')
            : (config.orientation === 'portrait' ? '148mm' : '210mm'),
        height: config.paperSize === 'A4'
            ? (config.orientation === 'portrait' ? '297mm' : '210mm')
            : (config.orientation === 'portrait' ? '210mm' : '148mm'),
        paddingTop: `${margins.top}mm`,
        paddingRight: `${margins.right}mm`,
        paddingBottom: `${margins.bottom}mm`,
        paddingLeft: `${margins.left}mm`,
        '--ob-font-family': fontFamily,
        '--ob-body-size': bodyFontSize,
        '--ob-line-height': lineHeight,
    };

    useLayoutEffect(() => {
        const measureEl = measureRef.current;
        const headerEl = measureHeaderRef.current;
        const subjectEl = measureSubjectRef.current;
        const contentEl = measureContentRef.current;
        const signatureEl = measureSignatureRef.current;

        if (!measureEl || !headerEl || !subjectEl || !contentEl || !signatureEl) {
            setPages([normalizeContentParagraphs(config.content)]);
            return;
        }

        const paragraphs = normalizeContentParagraphs(config.content);
        const pageHeightMm = config.paperSize === 'A4'
            ? (config.orientation === 'portrait' ? 297 : 210)
            : (config.orientation === 'portrait' ? 210 : 148);
        const computedStyles = window.getComputedStyle(measureEl);
        const paddingTop = parseFloat(computedStyles.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyles.paddingBottom) || 0;
        const pageInnerHeight = Math.max(0, measureEl.clientHeight - paddingTop - paddingBottom);
        const pxPerMm = measureEl.clientHeight / pageHeightMm;
        const pageNumberReserve = 6 * pxPerMm;

        const getOuterHeight = (el) => {
            if (!el) return 0;
            const styles = window.getComputedStyle(el);
            const marginTop = parseFloat(styles.marginTop) || 0;
            const marginBottom = parseFloat(styles.marginBottom) || 0;
            return el.offsetHeight + marginTop + marginBottom;
        };

        const headerHeight = getOuterHeight(headerEl);
        const addresseeHeight = isA5 ? getOuterHeight(measureAddresseeRef.current) : 0;
        const subjectHeight = getOuterHeight(subjectEl);
        const signatureHeight = getOuterHeight(signatureEl);

        const firstAvailable = Math.max(0, pageInnerHeight - headerHeight - addresseeHeight - subjectHeight - pageNumberReserve);
        const middleAvailable = Math.max(0, pageInnerHeight - pageNumberReserve);
        const firstAvailableWithSignature = Math.max(0, firstAvailable - signatureHeight);
        const middleAvailableWithSignature = Math.max(0, middleAvailable - signatureHeight);

        const measureContentHeight = (paras) => {
            contentEl.innerHTML = '';
            paras.forEach((para) => {
                const p = document.createElement('p');
                p.textContent = para || '\u00A0';
                contentEl.appendChild(p);
            });
            return contentEl.offsetHeight;
        };

        const fitFromStart = (paras, available) => {
            if (!paras.length) return 0;
            let count = 0;
            const chunk = [];
            for (let i = 0; i < paras.length; i += 1) {
                chunk.push(paras[i]);
                const height = measureContentHeight(chunk);
                if (height > available) {
                    return count === 0 ? 1 : count;
                }
                count += 1;
            }
            return count;
        };

        const splitTailToFit = (paras, available) => {
            if (!paras.length) return { head: [], tail: [] };
            const tail = [];
            for (let i = paras.length - 1; i >= 0; i -= 1) {
                tail.unshift(paras[i]);
                const height = measureContentHeight(tail);
                if (height > available) {
                    tail.shift();
                    return { head: paras.slice(0, i + 1), tail };
                }
            }
            return { head: [], tail };
        };

        const newPages = [];
        let startIndex = 0;
        let available = firstAvailable;

        while (startIndex < paragraphs.length) {
            const count = fitFromStart(paragraphs.slice(startIndex), available);
            newPages.push(paragraphs.slice(startIndex, startIndex + count));
            startIndex += count;
            available = middleAvailable;
        }

        if (newPages.length) {
            const lastIndex = newPages.length - 1;
            const lastParas = newPages[lastIndex];
            const lastLimit = newPages.length === 1 ? firstAvailableWithSignature : middleAvailableWithSignature;
            if (measureContentHeight(lastParas) > lastLimit) {
                let { head, tail } = splitTailToFit(lastParas, lastLimit);
                // Never append an empty page. If signature reserve cannot fit,
                // force at least one paragraph onto the final page.
                if (!tail.length && head.length > 0) {
                    tail = [head[head.length - 1]];
                    head = head.slice(0, -1);
                }
                newPages.splice(lastIndex, 1);
                if (head.length) newPages.push(head);
                if (tail.length) {
                    newPages.push(tail);
                }
            }
        }

        const compactPages = newPages.filter((pageParas, idx) => {
            if (idx === 0) return true;
            return pageParas.some((para) => String(para || '').trim().length > 0);
        });

        setPages(compactPages.length ? compactPages : [['']]);
    }, [config, isA5]);

    return (
        <div className="ob-page">
            <ToolHeader
                title="Албан бичиг үүсгэгч"
                subtitle="Стандартын дагуу мэргэжлийн албан бланк бэлтгэх"
            />

            {!isToolActive && (
                <div className="ob-alert-wrap">
                    <div className="alert alert-warning">
                        Энэ үйлчилгээ одоогоор түр хаалттай байна. Дараа дахин оролдоно уу.
                    </div>
                </div>
            )}

            <div className="ob-intro-wrap">
                <div className="ndsh2-intro">
                    <div className="ndsh2-intro-header">
                        <div className="ndsh2-intro-icon">
                            <Sparkles className="ndsh2-icon" />
                        </div>
                        <div>
                            <h3>Энэ үйлчилгээ танд юу гаргаж өгөх вэ?</h3>
                            <p>
                                Албан бичгийн мэдээллээ оруулснаар стандартын шаардлага хангасан, хэвлэхэд бэлэн PDF бланк
                                автоматаар гаргана.
                            </p>
                        </div>
                    </div>
                    <div className="ndsh2-intro-grid">
                        <div className="ndsh2-intro-item">
                            <CheckCircle2 className="ndsh2-icon" />
                            <div>
                                <strong>Стандарт бланк</strong>
                                <span>албан бичгийн шаардлагад нийцсэн загвар</span>
                            </div>
                        </div>
                        <div className="ndsh2-intro-item">
                            <CheckCircle2 className="ndsh2-icon" />
                            <div>
                                <strong>PDF шууд татах</strong>
                                <span>хэвлэхэд бэлэн нэг товшилтоор</span>
                            </div>
                        </div>
                        <div className="ndsh2-intro-item">
                            <CheckCircle2 className="ndsh2-icon" />
                            <div>
                                <strong>AI‑гаар текст</strong>
                                <span>гарчиг, агуулгыг хурдан үүсгэх боломж</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="ob-container">
                {/* Sidebar: Inputs */}
                <div className="ob-sidebar">
                    <div className="ob-card">
                        <div className="ob-card-header">
                            <FileText size={18} /> Хадгалсан загварууд
                        </div>
                        <div className="ob-card-body ob-stack">
                            {!canUseTemplates ? (
                                <div className="ob-muted">
                                    Энэ хэсэг зөвхөн subscriber хэрэглэгчдэд нээлттэй.
                                    {' '}
                                    <Link to="/profile">Subscription шалгах</Link>
                                </div>
                            ) : templatesLoading ? (
                                <div className="ob-muted">Уншиж байна...</div>
                            ) : templates.length === 0 ? (
                                <div className="ob-muted">
                                    Хадгалсан загвар алга байна.{' '}
                                    <Link to="/profile/letterhead-templates">Загвар үүсгэх</Link>
                                </div>
                            ) : (
                                <>
                                    <div className="ob-input-group">
                                        <label>Загвар сонгох</label>
                                        <select
                                            value={selectedTemplateId}
                                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                                        >
                                            <option value="">Сонгох...</option>
                                            {templates.map((item) => (
                                                <option key={item.id} value={item.id}>
                                                    {item.title || 'Нэргүй загвар'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        className="ob-btn ob-btn--ghost"
                                        onClick={handleApplyTemplate}
                                        disabled={!selectedTemplateId}
                                    >
                                        Сонгосон загварыг хэрэглэх
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

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
                                    </div>
                                </div>
                                <div className="ob-input-group">
                                    <label>Фонт</label>
                                    <div className="ob-toggle-row">
                                        <button
                                            className={`ob-toggle-btn ${config.fontFamily === 'Arial' ? 'active' : ''}`}
                                            onClick={() => setConfig(p => ({ ...p, fontFamily: 'Arial' }))}
                                        >Arial</button>
                                        <button
                                            className={`ob-toggle-btn ${config.fontFamily === 'Times New Roman' ? 'active' : ''}`}
                                            onClick={() => setConfig(p => ({ ...p, fontFamily: 'Times New Roman' }))}
                                        >Times New Roman</button>
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
                                {config.orgLogo ? (
                                    <img src={config.orgLogo} alt="Logo" loading="eager" decoding="sync" />
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
                                <label>Үйл ажиллагааны чиглэл</label>
                                <input name="orgTagline" value={config.orgTagline} onChange={handleChange} />
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
                            <div className="ob-input-grid">
                                <div className="ob-input-group">
                                    <label>Танай</label>
                                    <input name="tanaiRef" value={config.tanaiRef} onChange={handleChange} placeholder="Огноо/код" />
                                </div>
                                <div className="ob-input-group">
                                    <label>Танай №</label>
                                    <input name="tanaiNo" value={config.tanaiNo} onChange={handleChange} placeholder="Дугаар" />
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
                        <ToolPaymentStatusCard
                            isToolActive={isToolActive}
                            paymentReady={paymentReady}
                            paymentUsed={paymentUsed}
                            discountedPrice={discountedPrice}
                            creditCost={creditCost}
                            onOpenPayment={() => setShowPaymentDialog(true)}
                            onResetPayment={resetPayment}
                            creditBalanceLabel={currentUser ? (userProfile?.credits?.balance ?? 0).toLocaleString() : 'Нэвтэрч харах'}
                        />
                        <button
                            className={`ob-btn ob-btn--primary ob-btn--full ${paymentReady ? 'paid' : ''}`}
                            onClick={handleDownloadClick}
                            disabled={isGenerating || !isToolActive || paymentRequiredBeforeDownload}
                        >
                            {isGenerating ? <Loader2 className="ob-spin" /> : <Download size={20} />}
                            PDF Татах
                        </button>
                    </div>
                </div>

                {/* Main: Preview */}
                <div className="ob-preview-area">
                    <div className="ob-paper-wrapper">
                        <div className="ob-paper-stack" ref={documentRef}>
                            {pages.map((pageParagraphs, pageIndex) => {
                                const isFirst = pageIndex === 0;
                                const isLast = pageIndex === pages.length - 1;
                                return (
                                    <div
                                        key={`page-${pageIndex}`}
                                        className={`ob-paper ${config.orientation} ${isA5 ? 'ob-paper--a5' : ''}`}
                                        style={paperStyle}
                                    >
                                        {isFirst && (
                                            <div className="ob-doc-header">
                                                <div className="ob-header-row">
                                                    <div className="ob-header-left">
                                                        <span className="ob-corner ob-corner--tl" />
                                                        {config.orgLogo && <img src={config.orgLogo} alt="Logo" className="ob-doc-logo" loading="eager" decoding="sync" />}
                                                        <div className="ob-doc-org-name">{config.orgName}</div>
                                                        <div className="ob-header-tagline">{config.orgTagline}</div>
                                                        <div className="ob-header-contacts">
                                                            <div>{config.address}</div>
                                                            <div>Утас: {config.phone}</div>
                                                            <div>И-мэйл: {config.email}</div>
                                                            {config.web && <div>Вэб: {config.web}</div>}
                                                        </div>
                                                    </div>
                                                    {!isA5 && (
                                                        <div className="ob-header-right">
                                                            <span className="ob-corner ob-corner--tl" />
                                                            <span className="ob-corner ob-corner--tr" />
                                                            <div className="ob-header-recipient">{config.addresseeOrg}</div>
                                                            <div className="ob-header-recipient-name">{config.addresseeName}</div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="ob-meta-block">
                                                    <div className="ob-meta-row">
                                                        <span className="ob-meta-label">огноо:</span>
                                                        <span className="ob-meta-fill ob-meta-fill--date">{formattedDate || blank}</span>
                                                        <span className="ob-meta-label">№</span>
                                                        <span className="ob-meta-fill">{config.docIndex || blank}</span>
                                                    </div>
                                                    <div className="ob-meta-row">
                                                        <span className="ob-meta-label">танай</span>
                                                        <span className="ob-meta-fill ob-meta-fill--wide">{config.tanaiRef || blank}</span>
                                                        <span className="ob-meta-label">№</span>
                                                        <span className="ob-meta-fill ob-meta-fill--wide">{config.tanaiNo || blank}</span>
                                                        <span className="ob-meta-label">т</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {isFirst && isA5 && (
                                            <div className="ob-doc-addressee">
                                                <p>{config.addresseeOrg}</p>
                                                <p>{config.addresseeName}</p>
                                            </div>
                                        )}

                                        {isFirst && (
                                            <div className="ob-doc-subject">
                                                <span className="ob-subject-corner ob-subject-corner--left" />
                                                <span className="ob-subject-corner ob-subject-corner--right" />
                                                <span className="ob-doc-subject-text">{config.subject}</span>
                                            </div>
                                        )}

                                        <div className="ob-doc-content">
                                            {pageParagraphs.map((para, i) => (
                                                <p key={`${pageIndex}-${i}`}>{para || blank}</p>
                                            ))}
                                        </div>

                                        {isLast && (
                                            <div className="ob-doc-signature">
                                                <div className="ob-sig-row">
                                                    <span>{config.signPosition}</span>
                                                    <div className="ob-sig-line-wrap">
                                                        <div className="ob-sig-line"></div>
                                                        <div className="ob-sig-label">гарын үсэг</div>
                                                    </div>
                                                    <span>{config.signName}</span>
                                                </div>
                                            </div>
                                        )}

                                        <div className="ob-page-number">
                                            {pageIndex + 1}/{pages.length}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="ob-paper ob-paper--measure" style={paperStyle} aria-hidden="true" ref={measureRef}>
                        <div className="ob-doc-header" ref={measureHeaderRef}>
                            <div className="ob-header-row">
                                <div className="ob-header-left">
                                    <span className="ob-corner ob-corner--tl" />
                                    {config.orgLogo && <img src={config.orgLogo} alt="Logo" className="ob-doc-logo" loading="eager" decoding="sync" />}
                                    <div className="ob-doc-org-name">{config.orgName}</div>
                                    <div className="ob-header-tagline">{config.orgTagline}</div>
                                    <div className="ob-header-contacts">
                                        <div>{config.address}</div>
                                        <div>Утас: {config.phone}</div>
                                        <div>И-мэйл: {config.email}</div>
                                        {config.web && <div>Вэб: {config.web}</div>}
                                    </div>
                                </div>
                                {!isA5 && (
                                    <div className="ob-header-right">
                                        <span className="ob-corner ob-corner--tl" />
                                        <span className="ob-corner ob-corner--tr" />
                                        <div className="ob-header-recipient">{config.addresseeOrg}</div>
                                        <div className="ob-header-recipient-name">{config.addresseeName}</div>
                                    </div>
                                )}
                            </div>
                            <div className="ob-meta-block">
                                <div className="ob-meta-row">
                                    <span className="ob-meta-label">огноо:</span>
                                    <span className="ob-meta-fill ob-meta-fill--date">{formattedDate || blank}</span>
                                    <span className="ob-meta-label">№</span>
                                    <span className="ob-meta-fill">{config.docIndex || blank}</span>
                                </div>
                                <div className="ob-meta-row">
                                    <span className="ob-meta-label">танай</span>
                                    <span className="ob-meta-fill ob-meta-fill--wide">{config.tanaiRef || blank}</span>
                                    <span className="ob-meta-label">№</span>
                                    <span className="ob-meta-fill ob-meta-fill--wide">{config.tanaiNo || blank}</span>
                                    <span className="ob-meta-label">т</span>
                                </div>
                            </div>
                        </div>
                        {isA5 && (
                            <div className="ob-doc-addressee" ref={measureAddresseeRef}>
                                <p>{config.addresseeOrg}</p>
                                <p>{config.addresseeName}</p>
                            </div>
                        )}
                        <div className="ob-doc-subject" ref={measureSubjectRef}>
                            <span className="ob-subject-corner ob-subject-corner--left" />
                            <span className="ob-subject-corner ob-subject-corner--right" />
                            <span className="ob-doc-subject-text">{config.subject}</span>
                        </div>
                        <div className="ob-doc-content" ref={measureContentRef}></div>
                        <div className="ob-doc-signature" ref={measureSignatureRef}>
                            <div className="ob-sig-row">
                                <span>{config.signPosition}</span>
                                <div className="ob-sig-line-wrap">
                                    <div className="ob-sig-line"></div>
                                    <div className="ob-sig-label">гарын үсэг</div>
                                </div>
                                <span>{config.signName}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ToolPaymentDialog
                open={showPaymentDialog && !paymentReady}
                onClose={() => setShowPaymentDialog(false)}
                discountedPrice={discountedPrice}
                creditCost={creditCost}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                onCreateInvoice={createPaymentInvoice}
                onConsumeCredits={consumeCredits}
                onCheckPayment={checkPaymentStatus}
                paymentStatus={paymentStatus}
                paymentInvoice={paymentInvoice}
                isCheckingPayment={isCheckingPayment}
                paymentError={paymentError}
                isToolActive={isToolActive}
                currentUser={currentUser}
                creditBalance={userProfile?.credits?.balance ?? null}
                isAdminFree={currentUser?.role === 'admin'}
                onAdminContinue={async () => {
                    setShowPaymentDialog(false);
                    await handleDownloadClick({ adminBypass: true });
                }}
            />
        </div>
    );
};

export default OfficialLetterheadGenerator;
