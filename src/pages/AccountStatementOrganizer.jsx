import React, { useEffect, useState } from 'react';
import FileUpload from '../components/FileUpload';
import ToolHeader from '../components/ToolHeader';
import { processStatement, exportToAndDownloadExcel } from '../lib/standardizer';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';
import useAccess from '../hooks/useAccess';
import { apiFetch } from '../lib/apiClient';
import { getGuestSessionId } from '../lib/guest';
import './AccountStatementOrganizer.css';

const PAYMENT_STORAGE_KEY = 'account-statement-grant';

const AccountStatementOrganizer = () => {
    const { currentUser, refreshUserProfile } = useAuth();
    const { config: billingConfig } = useBilling();
    const { discountPercent } = useAccess();
    const [files, setFiles] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState('idle');
    const [paymentInvoice, setPaymentInvoice] = useState(null);
    const [paymentGrant, setPaymentGrant] = useState(null);
    const [paymentError, setPaymentError] = useState(null);
    const [isCheckingPayment, setIsCheckingPayment] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('pay');

    const toolPricing = billingConfig?.tools?.account_statement || { payPerUsePrice: 1000, creditCost: 1 };
    const basePrice = Number(toolPricing.payPerUsePrice || 0);
    const discountedPrice = Math.max(0, Math.round(basePrice * (1 - (discountPercent || 0) / 100)));
    const creditCost = Number(toolPricing.creditCost || 1);

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
        try {
            setPaymentStatus('creating');
            setPaymentError(null);
            let response = await apiFetch('/billing/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({ type: 'tool', toolKey: 'account_statement' })
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
                        description: 'Дансны хуулга (QPay)'
                    })
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
                body: JSON.stringify({ invoice_id: paymentInvoice.invoice_id })
            });
            let data = await response.json();
            if (!response.ok) {
                if (response.status !== 404) {
                    throw new Error(data?.error || 'Төлбөр шалгахад алдаа гарлаа');
                }
                response = await apiFetch('/qpay/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoice_id: paymentInvoice.invoice_id })
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
        if (!currentUser) {
            alert('Credits ашиглахын тулд нэвтэрнэ үү.');
            return;
        }
        try {
            setPaymentStatus('creating');
            setPaymentError(null);
            const response = await apiFetch('/credits/consume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({ toolKey: 'account_statement' })
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
            const message = error instanceof Error ? error.message : 'Credits ашиглахад алдаа гарлаа';
            setPaymentError(message);
            setPaymentStatus('error');
        }
    };

    const handleGenerate = async () => {
        if (!paymentGrant || paymentGrant.used) {
            alert('Файлыг боловсруулахын өмнө төлбөр төлнө үү.');
            return;
        }
        if (files.length === 0) return;

        setIsProcessing(true);
        try {
            let allTransactions = [];
            for (const file of files) {
                const transactions = await processStatement(file);
                allTransactions = [...allTransactions, ...transactions];
            }

            allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            exportToAndDownloadExcel(allTransactions);
            setIsDone(true);
            markGrantUsed();
            try {
                await apiFetch('/usage/log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    auth: !!currentUser,
                    body: JSON.stringify({
                        toolKey: 'account_statement',
                        paymentMethod: paymentGrant?.creditsUsed ? 'credits' : 'pay_per_use',
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
            console.error(error);
            alert('Файлыг боловсруулахад алдаа гарлаа. Console шалгана уу.');
        } finally {
            setIsProcessing(false);
        }
    };

    const reset = () => {
        setIsDone(false);
        setFiles([]);
    };

    const paymentReady = paymentGrant?.grantToken && !paymentGrant.used;
    const paymentUsed = paymentGrant?.used;
    const paymentBadge = paymentReady
        ? { label: 'Идэвхтэй', tone: 'badge-success' }
        : paymentUsed
            ? { label: 'Ашигласан', tone: 'badge-muted' }
            : { label: 'Төлбөр хүлээгдэж байна', tone: 'badge-warning' };

    let activeStep = 0;
    if (paymentReady) {
        activeStep = 1;
    }
    if (isProcessing) {
        activeStep = 2;
    }
    if (isDone) {
        activeStep = 3;
    }

    const steps = ['Төлбөр', 'Файл', 'Боловсруулалт', 'Амжилт'];

    return (
        <div className="tool-page">
            <ToolHeader
                title="Санхүүгийн тайлангаа нэг товшилтоор цэгцэл"
                subtitle="Банкны хуулгаа оруулаад AI-аар автоматаар нэгтгэж, Excel болгон татаж ав."
            />
            <div className="container tool-container tool-content">
                <div className="tool-intro card card--glass">
                    <div>
                        <p className="tool-intro-copy">
                            Автомат ангилалт, нэгтгэл, тайлан бэлэн болгох AI процесс.
                        </p>
                        <div className="stepper tool-stepper">
                            {steps.map((step, index) => (
                                <div
                                    key={step}
                                    className={`stepper-step ${index < activeStep ? 'is-complete' : ''} ${index === activeStep ? 'is-active' : ''}`}
                                >
                                    {step}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="tool-panel">
                        <p className="tool-panel-label">Нэг удаагийн үйлчилгээ</p>
                        <div className="tool-panel-price">{discountedPrice.toLocaleString()}₮</div>
                        <p className="tool-panel-sub">эсвэл {creditCost} credit ашиглана</p>
                    </div>
                </div>

                <div className="tool-grid">
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">Төлбөрийн эрх</div>
                            <span className={`badge ${paymentBadge.tone}`}>{paymentBadge.label}</span>
                        </div>
                        <div className="card-body tool-pay">
                            {paymentReady ? (
                                <div className="alert alert-success tool-pay-success">
                                    1 удаагийн эрх идэвхтэй байна.
                                    <button onClick={resetPayment} className="btn btn-ghost btn-sm">
                                        Дахин төлөх
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="segmented" role="tablist" aria-label="Төлбөрийн сонголт">
                                        <button
                                            type="button"
                                            className={paymentMethod === 'pay' ? 'active' : ''}
                                            onClick={() => setPaymentMethod('pay')}
                                        >
                                            QPay төлбөр
                                        </button>
                                        <button
                                            type="button"
                                            className={paymentMethod === 'credits' ? 'active' : ''}
                                            onClick={() => setPaymentMethod('credits')}
                                        >
                                            Credits
                                        </button>
                                    </div>
                                    <div className="tool-pay-actions">
                                        <button
                                            onClick={paymentMethod === 'credits' ? consumeCredits : createPaymentInvoice}
                                            disabled={paymentStatus === 'creating'}
                                            className="btn btn-primary"
                                        >
                                            {paymentMethod === 'credits' ? 'Credits ашиглах' : 'QPay QR үүсгэх'}
                                        </button>
                                        {paymentMethod === 'pay' && (
                                            <button
                                                onClick={checkPaymentStatus}
                                                disabled={!paymentInvoice || isCheckingPayment}
                                                className="btn btn-outline"
                                            >
                                                {isCheckingPayment ? 'Шалгаж байна...' : 'Төлбөр шалгах'}
                                            </button>
                                        )}
                                    </div>
                                    {paymentMethod === 'pay' && (
                                        <div className="tool-pay-qr">
                                            {paymentInvoice?.qr_image ? (
                                                <img src={`data:image/png;base64,${paymentInvoice.qr_image}`} alt="QPay QR" />
                                            ) : (
                                                <div className="tool-pay-placeholder">QR код энд гарна</div>
                                            )}
                                        </div>
                                    )}
                                    {paymentError && <p className="tool-pay-error">{paymentError}</p>}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">Файл оруулах</div>
                            <span className="badge badge-muted">Excel / CSV</span>
                        </div>
                        <div className="card-body">
                            {isDone ? (
                                <div className="tool-success">
                                    <div className="tool-success__icon">✓</div>
                                    <h2>Амжилттай!</h2>
                                    <p>Таны файлыг Excel хэлбэрээр татаж авлаа.</p>
                                    <button onClick={reset} className="btn btn-primary">Дахин эхлүүлэх</button>
                                </div>
                            ) : (
                                <>
                                    <FileUpload files={files} setFiles={setFiles} />
                                    <div className="tool-action">
                                        <button
                                            onClick={handleGenerate}
                                            disabled={files.length === 0 || isProcessing}
                                            className="btn btn-primary btn-lg"
                                        >
                                            {isProcessing ? 'Боловсруулж байна...' : `Цэгцлэх (${files.length} файл)`}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AccountStatementOrganizer;
