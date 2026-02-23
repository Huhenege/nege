import { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle,
    Loader2,
    ShieldAlert,
    ShieldCheck,
    Sparkles,
    Target,
    TrendingUp,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';
import useAccess from '../hooks/useAccess';
import ToolHeader from '../components/ToolHeader';
import ToolPaymentDialog from '../components/ToolPaymentDialog';
import ToolPaymentStatusCard from '../components/ToolPaymentStatusCard';
import { apiFetch } from '../lib/apiClient';
import { getGuestSessionId } from '../lib/guest';
import './SwotAnalyzer.css';

const PAYMENT_STORAGE_KEY = 'swot-analyzer-grant';
const TOOL_KEY = 'swot_analyzer';

const SWOT_META = {
    strengths: {
        title: 'Strengths',
        subtitle: 'Дотоод давуу тал',
        icon: ShieldCheck,
        tone: 'strengths',
    },
    weaknesses: {
        title: 'Weaknesses',
        subtitle: 'Дотоод сул тал',
        icon: AlertTriangle,
        tone: 'weaknesses',
    },
    opportunities: {
        title: 'Opportunities',
        subtitle: 'Гадаад боломж',
        icon: TrendingUp,
        tone: 'opportunities',
    },
    threats: {
        title: 'Threats',
        subtitle: 'Гадаад эрсдэл',
        icon: ShieldAlert,
        tone: 'threats',
    },
};

const STRATEGY_META = [
    { key: 'so', title: 'SO Strategy', subtitle: 'Давуу талаа ашиглан боломж барих', tone: 'strengths' },
    { key: 'st', title: 'ST Strategy', subtitle: 'Давуу талаар эрсдэлийг хамгаалах', tone: 'threats' },
    { key: 'wo', title: 'WO Strategy', subtitle: 'Сул талаа сайжруулж боломж авах', tone: 'opportunities' },
    { key: 'wt', title: 'WT Strategy', subtitle: 'Сул тал + эрсдэлийг бууруулах', tone: 'weaknesses' },
];

const SAMPLE_TOPIC = `Манай стартап жижиг бизнесүүдэд зориулсан санхүүгийн тайлан автоматжуулалтын SaaS хөгжүүлж байна.
Зорилт: 6 сарын дотор 100 төлбөртэй хэрэглэгчтэй болох.`;

const normalizeSwotItem = (item, index) => {
    if (typeof item === 'string') {
        return { point: item, reason: '' };
    }
    const point = String(item?.point || item?.title || item?.item || '').trim();
    const reason = String(item?.reason || item?.note || item?.impact || '').trim();
    if (!point) return null;
    return {
        point,
        reason,
        _key: `${point}-${index}`,
    };
};

const SwotAnalyzer = () => {
    const { currentUser, refreshUserProfile, userProfile } = useAuth();
    const { config: billingConfig } = useBilling();
    const { discountPercent } = useAccess();
    const [topic, setTopic] = useState('');
    const [goal, setGoal] = useState('');
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

    const matrixData = useMemo(() => {
        if (!result) {
            return {
                strengths: [],
                weaknesses: [],
                opportunities: [],
                threats: [],
            };
        }

        return {
            strengths: (Array.isArray(result.strengths) ? result.strengths : []).map(normalizeSwotItem).filter(Boolean),
            weaknesses: (Array.isArray(result.weaknesses) ? result.weaknesses : []).map(normalizeSwotItem).filter(Boolean),
            opportunities: (Array.isArray(result.opportunities) ? result.opportunities : []).map(normalizeSwotItem).filter(Boolean),
            threats: (Array.isArray(result.threats) ? result.threats : []).map(normalizeSwotItem).filter(Boolean),
        };
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
                        description: 'SWOT Analyzer (QPay)',
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
        const trimmedTopic = topic.trim();
        if (!trimmedTopic) {
            setError('SWOT хийх сэдвээ оруулна уу.');
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
            const response = await apiFetch('/ai/swot-analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topic: trimmedTopic,
                    goal: goal.trim(),
                    context: context.trim(),
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error('AI endpoint олдсонгүй. Backend-ээ restart хийгээд дахин оролдоно уу (`npm run qpay:server`).');
                }
                throw new Error(payload?.error || 'SWOT шинжилгээ хийхэд алдаа гарлаа.');
            }
            const data = payload?.data || null;
            if (!data) {
                throw new Error('AI хариу хоосон байна.');
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
            let message = err instanceof Error ? err.message : 'SWOT шинжилгээний алдаа.';
            if (err instanceof TypeError || String(err?.message || '').includes('Failed to fetch')) {
                message = 'QPay сервер асаагүй байна. `npm run qpay:server` ажиллуулна уу.';
            }
            setError(message);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const applySample = () => {
        setTopic(SAMPLE_TOPIC);
        setGoal('100 төлбөртэй харилцагчид хүрч сар бүр тогтмол MRR өсгөх.');
        setContext('Монголын жижиг бизнесийн зах зээл, B2B борлуулалтын цикл 2-4 долоо хоног.');
        setError('');
    };

    const resetAll = () => {
        setTopic('');
        setGoal('');
        setContext('');
        setResult(null);
        setError('');
    };

    const paymentReady = paymentGrant?.grantToken && !paymentGrant.used;
    const paymentUsed = paymentGrant?.used;
    const paymentRequiredBeforeAnalyze = !paymentReady;

    return (
        <div className="swot-page">
            <ToolHeader
                eyebrow="AI STRATEGY TOOL"
                title="SWOT Analyzer"
                subtitle="Төслийнхөө Strength, Weakness, Opportunity, Threat-ийг AI-аар задалж стратегийн чиглэл гарга."
            />

            <div className="container tool-content">
                <section className="card swot-method-card">
                    <div className="card-body">
                        <h2>SWOT аргачлал</h2>
                        <p>
                            SWOT нь байгууллага эсвэл төслийн дотоод хүчин зүйлс (<strong>S/W</strong>) болон
                            гадаад орчны хүчин зүйлс (<strong>O/T</strong>)-ийг нэг матрицад харж,
                            зөв стратеги (SO, ST, WO, WT) боловсруулахад ашиглагддаг.
                        </p>
                    </div>
                </section>

                <ToolPaymentStatusCard
                    className="swot-payment-card"
                    isToolActive={isToolActive}
                    paymentReady={paymentReady}
                    paymentUsed={paymentUsed}
                    discountedPrice={discountedPrice}
                    creditCost={creditCost}
                    onOpenPayment={() => setShowPaymentDialog(true)}
                    onResetPayment={resetPayment}
                />

                <section className="swot-input-layout">
                    <div className="card swot-card">
                        <div className="card-header">
                            <div className="card-title">SWOT Input</div>
                            <span className="badge badge-brand">AI</span>
                        </div>
                        <div className="card-body">
                            <label className="swot-label" htmlFor="swot-topic">Сэдэв / бизнесийн нөхцөл</label>
                            <textarea
                                id="swot-topic"
                                className="swot-textarea"
                                rows={7}
                                value={topic}
                                onChange={(event) => setTopic(event.target.value)}
                                placeholder="Танай бизнес, бүтээгдэхүүн, нөхцөл байдлыг 3-6 өгүүлбэрээр бичнэ үү."
                            />

                            <label className="swot-label" htmlFor="swot-goal">Зорилт (optional)</label>
                            <textarea
                                id="swot-goal"
                                className="swot-textarea swot-textarea--small"
                                rows={2}
                                value={goal}
                                onChange={(event) => setGoal(event.target.value)}
                                placeholder="Ж: 3 сарын дотор борлуулалтаа 30% өсгөх."
                            />

                            <label className="swot-label" htmlFor="swot-context">Нэмэлт контекст (optional)</label>
                            <textarea
                                id="swot-context"
                                className="swot-textarea swot-textarea--small"
                                rows={3}
                                value={context}
                                onChange={(event) => setContext(event.target.value)}
                                placeholder="Ж: Зах зээлийн нөхцөл, өрсөлдөгч, багийн нөөц."
                            />

                            <div className="swot-actions">
                                <button type="button" className="btn btn-ghost" onClick={applySample}>Жишээ</button>
                                <button type="button" className="btn btn-ghost" onClick={resetAll}>Цэвэрлэх</button>
                                <button type="button" className="btn btn-primary" onClick={handleAnalyze} disabled={isAnalyzing || !topic.trim() || !isToolActive || paymentRequiredBeforeAnalyze}>
                                    {isAnalyzing ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                                    {isAnalyzing ? 'AI боловсруулж байна...' : 'SWOT гаргах'}
                                </button>
                            </div>

                            {error && <div className="alert alert-danger swot-alert">{error}</div>}
                        </div>
                    </div>

                    <div className="card swot-card">
                        <div className="card-header">
                            <div className="card-title">Хураангуй</div>
                            <span className="badge badge-muted">Summary</span>
                        </div>
                        <div className="card-body">
                            {result ? (
                                <div className="swot-summary">
                                    <p>{result.summary || 'Товч дүгнэлт үүсгээгүй байна.'}</p>
                                    <div className="swot-summary-stats">
                                        <div><span>S</span><strong>{matrixData.strengths.length}</strong></div>
                                        <div><span>W</span><strong>{matrixData.weaknesses.length}</strong></div>
                                        <div><span>O</span><strong>{matrixData.opportunities.length}</strong></div>
                                        <div><span>T</span><strong>{matrixData.threats.length}</strong></div>
                                    </div>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <Target size={20} />
                                    <p>Сэдвээ оруулж SWOT шинжилгээ эхлүүлнэ үү.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {result && (
                    <>
                        <section className="swot-matrix-grid">
                            {Object.entries(SWOT_META).map(([key, meta]) => {
                                const Icon = meta.icon;
                                const items = matrixData[key] || [];
                                return (
                                    <article key={key} className={`card swot-matrix-card ${meta.tone}`}>
                                        <div className="card-header">
                                            <div className="card-title"><Icon size={16} /> {meta.title}</div>
                                            <span className="badge badge-muted">{meta.subtitle}</span>
                                        </div>
                                        <div className="card-body">
                                            {items.length === 0 ? (
                                                <p className="swot-empty">Илрүүлсэн өгөгдөл алга.</p>
                                            ) : (
                                                <ul className="swot-list">
                                                    {items.map((item, index) => (
                                                        <li key={item._key || `${item.point}-${index}`} className="swot-list-item">
                                                            <p className="swot-point">{item.point}</p>
                                                            {item.reason ? <p className="swot-reason">{item.reason}</p> : null}
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </section>

                        <section className="card swot-card">
                            <div className="card-header">
                                <div className="card-title">Стратегийн санал (SO / ST / WO / WT)</div>
                                <span className="badge badge-success">Action Plan</span>
                            </div>
                            <div className="card-body">
                                <div className="swot-strategy-grid">
                                    {STRATEGY_META.map((meta) => {
                                        const list = Array.isArray(result?.strategicActions?.[meta.key]) ? result.strategicActions[meta.key] : [];
                                        return (
                                            <div key={meta.key} className={`swot-strategy-card ${meta.tone}`}>
                                                <h3>{meta.title}</h3>
                                                <p>{meta.subtitle}</p>
                                                {list.length === 0 ? (
                                                    <div className="swot-empty">Стратеги алга.</div>
                                                ) : (
                                                    <ul>
                                                        {list.map((item, index) => (
                                                            <li key={`${meta.key}-${index}`}>{item}</li>
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

export default SwotAnalyzer;
