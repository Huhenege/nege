import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    CalendarCheck2,
    CheckCircle2,
    Loader2,
    Sparkles,
    Trash2,
    UserRoundCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';
import useAccess from '../hooks/useAccess';
import ToolHeader from '../components/ToolHeader';
import ToolPaymentDialog from '../components/ToolPaymentDialog';
import ToolPaymentStatusCard from '../components/ToolPaymentStatusCard';
import { apiFetch } from '../lib/apiClient';
import { getGuestSessionId } from '../lib/guest';
import './EisenhowerPlanner.css';

const MAX_TASKS = 80;
const PAYMENT_STORAGE_KEY = 'eisenhower-planner-grant';
const TOOL_KEY = 'eisenhower_analyzer';

const QUADRANT_META = {
    do_now: {
        title: 'Q1: Do Now',
        subtitle: 'Яаралтай + Чухал',
        icon: AlertTriangle,
        tone: 'do-now',
    },
    schedule: {
        title: 'Q2: Schedule',
        subtitle: 'Чухал + Яарал багатай',
        icon: CalendarCheck2,
        tone: 'schedule',
    },
    delegate: {
        title: 'Q3: Delegate',
        subtitle: 'Яаралтай + Чухал биш',
        icon: UserRoundCheck,
        tone: 'delegate',
    },
    eliminate: {
        title: 'Q4: Eliminate',
        subtitle: 'Яарал багатай + Чухал биш',
        icon: Trash2,
        tone: 'eliminate',
    },
};

const ACTION_PLAN_META = [
    { key: 'today', title: 'Өнөөдөр', tone: 'do-now' },
    { key: 'thisWeek', title: 'Энэ 7 хоног', tone: 'schedule' },
    { key: 'delegate', title: 'Даатгах', tone: 'delegate' },
    { key: 'eliminate', title: 'Хасах/Багасгах', tone: 'eliminate' },
];

const SAMPLE_TASKS = [
    'Маргаашийн захирлын хуралд орлогын тайлан бэлдэх',
    'Шинэ ажилтны onboarding checklist батлах',
    'И-мэйл inbox цэгцлэх',
    'Клиент А-тай гэрээний нөхцөл финалчлах',
    'Нийгмийн сүлжээний постын санаа цуглуулах',
];

function parseTaskInput(raw) {
    const seen = new Set();
    return String(raw || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => {
            if (seen.has(line)) return false;
            seen.add(line);
            return true;
        })
        .slice(0, MAX_TASKS);
}

const EisenhowerPlanner = () => {
    const { currentUser, refreshUserProfile, userProfile } = useAuth();
    const { config: billingConfig } = useBilling();
    const { discountPercent } = useAccess();
    const [taskInput, setTaskInput] = useState('');
    const [context, setContext] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [paymentStatus, setPaymentStatus] = useState('idle');
    const [paymentInvoice, setPaymentInvoice] = useState(null);
    const [paymentGrant, setPaymentGrant] = useState(null);
    const [paymentError, setPaymentError] = useState(null);
    const [isCheckingPayment, setIsCheckingPayment] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('pay');
    const [showPaymentDialog, setShowPaymentDialog] = useState(false);

    const toolPricing = billingConfig?.tools?.[TOOL_KEY] || { payPerUsePrice: 1000, creditCost: 1, active: true };
    const isToolActive = toolPricing?.active !== false;
    const basePrice = Number(toolPricing.payPerUsePrice || 0);
    const discountedPrice = Math.max(0, Math.round(basePrice * (1 - (discountPercent || 0) / 100)));
    const creditCost = Number(toolPricing.creditCost || 1);

    const parsedTasks = useMemo(() => parseTaskInput(taskInput), [taskInput]);

    const groupedItems = useMemo(() => {
        const grouped = {
            do_now: [],
            schedule: [],
            delegate: [],
            eliminate: [],
        };
        if (!Array.isArray(result?.items)) return grouped;

        result.items.forEach((item) => {
            const key = item?.quadrant;
            if (!grouped[key]) return;
            grouped[key].push(item);
        });
        return grouped;
    }, [result]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(PAYMENT_STORAGE_KEY);
            if (!saved) return;
            const parsed = JSON.parse(saved);
            if (parsed?.grantToken && !parsed?.used) {
                setPaymentGrant(parsed);
                setPaymentStatus('paid');
            }
        } catch (restoreError) {
            console.error('Failed to restore payment grant', restoreError);
        }
    }, []);

    useEffect(() => {
        if (paymentGrant?.grantToken && !paymentGrant.used) {
            setShowPaymentDialog(false);
        }
    }, [paymentGrant]);

    const storeGrant = (grant) => {
        localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(grant));
        setPaymentGrant(grant);
        setPaymentStatus('paid');
    };

    const markGrantUsed = (grantOverride = null) => {
        const grant = grantOverride || paymentGrant;
        if (!grant) return;
        const updated = { ...grant, used: true, usedAt: new Date().toISOString() };
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
                body: JSON.stringify({ type: 'tool', toolKey: TOOL_KEY }),
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
                        description: 'Eisenhower Prioritizer (QPay)',
                    }),
                });
                data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.error || 'Нэхэмжлэл үүсгэхэд алдаа гарлаа');
                }
            }
            setPaymentInvoice(data);
            setPaymentStatus('pending');
        } catch (invoiceError) {
            let message = invoiceError instanceof Error ? invoiceError.message : 'Төлбөрийн системд алдаа гарлаа';
            if (invoiceError instanceof TypeError || String(invoiceError?.message || '').includes('Failed to fetch')) {
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
        } catch (paymentCheckError) {
            let message = paymentCheckError instanceof Error ? paymentCheckError.message : 'Төлбөр шалгахад алдаа гарлаа';
            if (paymentCheckError instanceof TypeError || String(paymentCheckError?.message || '').includes('Failed to fetch')) {
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
        try {
            setPaymentStatus('creating');
            setPaymentError(null);
            const response = await apiFetch('/credits/consume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({
                    toolKey: TOOL_KEY,
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
        } catch (creditError) {
            const message = creditError instanceof Error ? creditError.message : 'Credits ашиглахад алдаа гарлаа';
            setPaymentError(message);
            setPaymentStatus('error');
        }
    };

    const handleAnalyze = async ({ adminBypass = false } = {}) => {
        if (!isToolActive) {
            alert('Энэ үйлчилгээ одоогоор түр хаалттай байна.');
            return;
        }
        if (parsedTasks.length === 0) {
            setError('Task жагсаалтаа оруулна уу. Нэг мөр = нэг task.');
            return;
        }

        const isAdmin = currentUser?.role === 'admin';
        const activeGrant = paymentGrant?.grantToken && !paymentGrant.used ? paymentGrant : null;
        if (!activeGrant && !adminBypass) {
            setShowPaymentDialog(true);
            return;
        }

        setIsAnalyzing(true);
        setError('');

        try {
            const response = await apiFetch('/ai/eisenhower-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tasks: parsedTasks,
                    context: context.trim(),
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('AI endpoint олдсонгүй. Backend-ээ restart хийгээд дахин оролдоно уу (`npm run qpay:server`).');
                }
                throw new Error(payload?.error || 'AI ангилалт хийхэд алдаа гарлаа.');
            }

            const data = payload?.data || null;
            if (!data || !Array.isArray(data.items)) {
                throw new Error('AI хариу буруу форматтай байна.');
            }
            setResult(data);
            if (activeGrant) {
                markGrantUsed(activeGrant);
                try {
                    await apiFetch('/usage/log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        auth: !!currentUser,
                        body: JSON.stringify({
                            toolKey: TOOL_KEY,
                            paymentMethod: activeGrant?.creditsUsed ? 'credits' : 'pay_per_use',
                            amount: activeGrant?.amount || discountedPrice,
                            creditsUsed: activeGrant?.creditsUsed || 0,
                            invoiceId: activeGrant?.invoice_id || null,
                            grantToken: activeGrant?.grantToken || null,
                            guestSessionId: currentUser ? null : getGuestSessionId(),
                        }),
                    });
                } catch (usageLogError) {
                    console.error('Usage log error:', usageLogError);
                }
            } else if (isAdmin && adminBypass) {
                try {
                    await apiFetch('/usage/log', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        auth: !!currentUser,
                        body: JSON.stringify({
                            toolKey: TOOL_KEY,
                            paymentMethod: 'admin_free',
                            amount: 0,
                            creditsUsed: 0,
                            invoiceId: null,
                            grantToken: null,
                            guestSessionId: null,
                        }),
                    });
                } catch (usageLogError) {
                    console.error('Usage log error:', usageLogError);
                }
            }
        } catch (err) {
            setResult(null);
            let message = err instanceof Error ? err.message : 'AI ангилалтын алдаа.';
            if (err instanceof TypeError || String(err?.message || '').includes('Failed to fetch')) {
                message = 'QPay сервер асаагүй байна. `npm run qpay:server` ажиллуулна уу.';
            }
            setError(message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const applySample = () => {
        setTaskInput(SAMPLE_TASKS.join('\n'));
        setContext('Startup багийн 7 хоногийн sprint төлөвлөлт.');
        setError('');
    };

    const clearAll = () => {
        setTaskInput('');
        setContext('');
        setResult(null);
        setError('');
    };

    const paymentReady = paymentGrant?.grantToken && !paymentGrant.used;
    const paymentUsed = paymentGrant?.used;
    const paymentRequiredBeforeAnalyze = !paymentReady;

    return (
        <div className="eisenhower-page">
            <ToolHeader
                eyebrow="AI PRIORITIZER"
                title="Eisenhower Task Prioritizer"
                subtitle="Task жагсаалтаа нэг дор оруулахад AI urgency + importance үнэлж 4 quadrant ба action plan гаргана."
            />

            <div className="container tool-content">
                <section className="card eisenhower-method-card">
                    <div className="card-body">
                        <h2>Eisenhower аргачлал гэж юу вэ?</h2>
                        <p>
                            Энэхүү аргачлал нь даалгаврыг <strong>яаралтай</strong> ба <strong>ач холбогдол</strong> гэсэн 2 хэмжүүрээр ангилж,
                            хамгийн зөв дарааллаар ажиллахад тусалдаг.
                        </p>
                        <div className="eisenhower-method-tags">
                            <span>Q1: Do Now</span>
                            <span>Q2: Schedule</span>
                            <span>Q3: Delegate</span>
                            <span>Q4: Eliminate</span>
                        </div>
                    </div>
                </section>

                <ToolPaymentStatusCard
                    className="eisenhower-payment-card"
                    isToolActive={isToolActive}
                    paymentReady={paymentReady}
                    paymentUsed={paymentUsed}
                    discountedPrice={discountedPrice}
                    creditCost={creditCost}
                    onOpenPayment={() => setShowPaymentDialog(true)}
                    onResetPayment={resetPayment}
                />

                <div className="eisenhower-input-grid">
                    <section className="card eisenhower-card">
                        <div className="card-header">
                            <div className="card-title">Task жагсаалт</div>
                            <span className="badge badge-muted">{parsedTasks.length}/{MAX_TASKS}</span>
                        </div>
                        <div className="card-body">
                            <label className="eisenhower-label" htmlFor="task-input">
                                Нэг мөрт нэг task оруулна.
                            </label>
                            <textarea
                                id="task-input"
                                className="eisenhower-textarea"
                                rows={11}
                                value={taskInput}
                                onChange={(event) => setTaskInput(event.target.value)}
                                placeholder={'Маргаашийн тайлан бэлдэх\nКлиенттэй гэрээ финалчлах\nInbox цэгцлэх'}
                            />

                            <label className="eisenhower-label" htmlFor="task-context">
                                Нэмэлт контекст (optional)
                            </label>
                            <textarea
                                id="task-context"
                                className="eisenhower-textarea eisenhower-textarea--context"
                                rows={3}
                                value={context}
                                onChange={(event) => setContext(event.target.value)}
                                placeholder="Багийн зорилго, deadline, роль гэх мэт."
                            />

                            <div className="eisenhower-actions">
                                <button type="button" className="btn btn-ghost" onClick={applySample}>
                                    Жишээ оруулах
                                </button>
                                <button type="button" className="btn btn-ghost" onClick={clearAll}>
                                    Цэвэрлэх
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={handleAnalyze}
                                    disabled={isAnalyzing || parsedTasks.length === 0 || !isToolActive || paymentRequiredBeforeAnalyze}
                                >
                                    {isAnalyzing ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                                    {isAnalyzing ? 'AI үнэлж байна...' : 'AI-аар ангилах'}
                                </button>
                            </div>
                            {error && (
                                <div className="alert alert-danger eisenhower-alert">
                                    {error}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="card eisenhower-card">
                        <div className="card-header">
                            <div className="card-title">Товч дүгнэлт</div>
                            <span className="badge badge-brand">Eisenhower</span>
                        </div>
                        <div className="card-body">
                            {result ? (
                                <div className="eisenhower-summary">
                                    <p>{result.summary || 'AI summary үүсээгүй байна.'}</p>
                                    <div className="eisenhower-summary-stats">
                                        <div>
                                            <span>Do now</span>
                                            <strong>{groupedItems.do_now.length}</strong>
                                        </div>
                                        <div>
                                            <span>Schedule</span>
                                            <strong>{groupedItems.schedule.length}</strong>
                                        </div>
                                        <div>
                                            <span>Delegate</span>
                                            <strong>{groupedItems.delegate.length}</strong>
                                        </div>
                                        <div>
                                            <span>Eliminate</span>
                                            <strong>{groupedItems.eliminate.length}</strong>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <CheckCircle2 size={20} />
                                    <p>Task оруулж AI-аар ангилалт эхлүүлнэ үү.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {result && (
                    <>
                        <section className="eisenhower-quad-grid">
                            {Object.entries(QUADRANT_META).map(([key, meta]) => {
                                const Icon = meta.icon;
                                const items = groupedItems[key] || [];
                                return (
                                    <article key={key} className={`card eisenhower-quad-card ${meta.tone}`}>
                                        <div className="card-header">
                                            <div className="card-title">
                                                <Icon size={16} />
                                                {meta.title}
                                            </div>
                                            <span className="badge badge-muted">{meta.subtitle}</span>
                                        </div>
                                        <div className="card-body">
                                            {items.length === 0 ? (
                                                <p className="eisenhower-empty-quad">Task алга.</p>
                                            ) : (
                                                <ul className="eisenhower-task-list">
                                                    {items.map((item) => (
                                                        <li key={`${item.task}-${item.urgency}-${item.importance}`} className="eisenhower-task-item">
                                                            <p className="eisenhower-task-title">{item.task}</p>
                                                            <div className="eisenhower-task-meta">
                                                                <span>U {item.urgency}</span>
                                                                <span>I {item.importance}</span>
                                                            </div>
                                                            <p className="eisenhower-task-reason">{item.reason}</p>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </section>

                        <section className="card eisenhower-card">
                            <div className="card-header">
                                <div className="card-title">Action Plan</div>
                                <span className="badge badge-success">AI-generated</span>
                            </div>
                            <div className="card-body">
                                <div className="eisenhower-plan-grid">
                                    {ACTION_PLAN_META.map((section) => {
                                        const rows = Array.isArray(result?.actionPlan?.[section.key]) ? result.actionPlan[section.key] : [];
                                        return (
                                            <div key={section.key} className={`eisenhower-plan-block ${section.tone}`}>
                                                <h3>{section.title}</h3>
                                                {rows.length === 0 ? (
                                                    <p className="eisenhower-empty-quad">Зөвлөмж алга.</p>
                                                ) : (
                                                    <ul>
                                                        {rows.map((line, index) => (
                                                            <li key={`${section.key}-${index}`}>{line}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </section>
                    </>
                )}
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
                    await handleAnalyze({ adminBypass: true });
                }}
            />
        </div>
    );
};

export default EisenhowerPlanner;
