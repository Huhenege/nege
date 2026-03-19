import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertCircle,
    CalendarClock,
    CheckCircle2,
    CreditCard,
    FileText,
    History,
    Wallet,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';
import { apiFetch } from '../lib/apiClient';
import './UserProfile.css';

const UserProfile = () => {
    const { currentUser, refreshUserProfile, userProfile } = useAuth();
    const { config: billingConfig } = useBilling();

    const [loading, setLoading] = useState(true);
    const [userInfo, setUserInfo] = useState(null);
    const [creditInvoice, setCreditInvoice] = useState(null);
    const [creditStatus, setCreditStatus] = useState('idle'); // idle, creating, pending, success, error
    const [creditError, setCreditError] = useState(null);
    const [isCheckingCredit, setIsCheckingCredit] = useState(false);
    const [creditPurchase, setCreditPurchase] = useState(null);
    const [subscriptionInvoice, setSubscriptionInvoice] = useState(null);
    const [subscriptionStatus, setSubscriptionStatus] = useState('idle'); // idle, creating, pending, success, error
    const [subscriptionError, setSubscriptionError] = useState(null);
    const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
    const [subscriptionPurchase, setSubscriptionPurchase] = useState(null);
    const [showCreditBundles, setShowCreditBundles] = useState(false);

    const fetchUserData = useCallback(async () => {
        if (!currentUser) {
            setUserInfo(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            if (userProfile) {
                setUserInfo(userProfile);
            } else {
                const profile = await refreshUserProfile();
                setUserInfo(profile || null);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            setLoading(false);
        }
    }, [currentUser, refreshUserProfile, userProfile]);

    useEffect(() => {
        fetchUserData();
    }, [fetchUserData]);

    useEffect(() => {
        if (userProfile) {
            setUserInfo(userProfile);
            setLoading(false);
        }
    }, [userProfile]);

    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const formatAmount = (amount) => `${new Intl.NumberFormat('mn-MN').format(amount)}₮`;

    const subscriptionEndAt = userInfo?.subscription?.endAt
        ? (userInfo.subscription.endAt.toDate ? userInfo.subscription.endAt.toDate() : new Date(userInfo.subscription.endAt))
        : null;
    const subscriptionActive = userInfo?.subscription?.status === 'active' && subscriptionEndAt && subscriptionEndAt.getTime() > Date.now();
    const creditsBalance = userInfo?.credits?.balance || 0;
    const creditBundles = (billingConfig?.credits?.bundles || []).filter((bundle) => bundle?.active !== false);
    const subscriptionPrice = Number(billingConfig?.subscription?.monthlyPrice || 0);
    const subscriptionCredits = Number(billingConfig?.subscription?.monthlyCredits || 0);
    const showCreditOptions = showCreditBundles || creditStatus === 'pending';

    const bestValueBundleId = useMemo(() => {
        if (!creditBundles.length) return null;
        const sorted = [...creditBundles].sort((a, b) => {
            const aPricePerCredit = Number(a.price || 0) / Math.max(Number(a.credits || 0), 1);
            const bPricePerCredit = Number(b.price || 0) / Math.max(Number(b.credits || 0), 1);
            return aPricePerCredit - bPricePerCredit;
        });
        return sorted[0]?.id || null;
    }, [creditBundles]);

    const createCreditInvoice = async (bundle) => {
        if (!bundle) return;
        setCreditStatus('creating');
        setCreditError(null);
        setShowCreditBundles(true);
        try {
            let response = await apiFetch('/billing/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({
                    type: 'credits',
                    bundleId: bundle.id,
                }),
            });
            let data = await response.json();
            let source = 'billing';
            if (!response.ok) {
                const shouldFallback = response.status === 404 || response.status >= 500;
                if (!shouldFallback || !import.meta.env.DEV) {
                    throw new Error(data?.error || 'Нэхэмжлэл үүсгэхэд алдаа гарлаа');
                }
                response = await apiFetch('/qpay/invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: Number(bundle.price || 0),
                        description: `Credits багц: ${bundle.name || `${bundle.credits} credit`}`,
                    }),
                });
                data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.error || 'Нэхэмжлэл үүсгэхэд алдаа гарлаа');
                }
                source = 'qpay';
            }

            setCreditInvoice(data);
            setCreditPurchase({
                bundleId: bundle.id,
                credits: Number(bundle.credits || 0),
                price: Number(bundle.price || 0),
                name: bundle.name || '',
                source,
            });
            setCreditStatus('pending');
        } catch (error) {
            setCreditStatus('error');
            setCreditError(error instanceof Error ? error.message : 'Алдаа гарлаа');
        }
    };

    const checkCreditPayment = async () => {
        if (!creditInvoice?.invoice_id) return;
        setIsCheckingCredit(true);
        try {
            let response = await apiFetch('/billing/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({ invoice_id: creditInvoice.invoice_id }),
            });
            let data = await response.json();
            if (!response.ok) {
                const shouldFallback = response.status === 404 || response.status >= 500;
                if (!shouldFallback || !import.meta.env.DEV) {
                    throw new Error(data?.error || 'Төлбөр шалгахад алдаа гарлаа');
                }
                response = await apiFetch('/qpay/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoice_id: creditInvoice.invoice_id }),
                });
                data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.error || 'Төлбөр шалгахад алдаа гарлаа');
                }
            }

            if (data.paid) {
                if (creditPurchase?.source === 'qpay') {
                    throw new Error('Billing entitlement sync шаардлагатай. `/billing/check` endpoint ашиглана уу.');
                }
                setCreditStatus('success');
                setCreditInvoice(null);
                setCreditPurchase(null);
                await refreshUserProfile();
                await fetchUserData();
            }
        } catch (error) {
            setCreditStatus('error');
            setCreditError(error instanceof Error ? error.message : 'Төлбөр шалгахад алдаа гарлаа');
        } finally {
            setIsCheckingCredit(false);
        }
    };

    const createSubscriptionInvoice = async () => {
        if (!subscriptionPrice || subscriptionPrice <= 0) {
            setSubscriptionError('Сарын үнэ тохируулагдаагүй байна.');
            setSubscriptionStatus('error');
            return;
        }
        setSubscriptionStatus('creating');
        setSubscriptionError(null);
        try {
            let response = await apiFetch('/billing/invoice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({ type: 'subscription' }),
            });
            let data = await response.json();
            let source = 'billing';
            if (!response.ok) {
                const shouldFallback = response.status === 404 || response.status >= 500;
                if (!shouldFallback || !import.meta.env.DEV) {
                    throw new Error(data?.error || 'Нэхэмжлэл үүсгэхэд алдаа гарлаа');
                }
                response = await apiFetch('/qpay/invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: subscriptionPrice,
                        description: 'Subscription сарын төлбөр',
                    }),
                });
                data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.error || 'Нэхэмжлэл үүсгэхэд алдаа гарлаа');
                }
                source = 'qpay';
            }

            setSubscriptionInvoice(data);
            setSubscriptionPurchase({
                price: subscriptionPrice,
                credits: subscriptionCredits,
                source,
            });
            setSubscriptionStatus('pending');
        } catch (error) {
            setSubscriptionStatus('error');
            setSubscriptionError(error instanceof Error ? error.message : 'Алдаа гарлаа');
        }
    };

    const checkSubscriptionPayment = async () => {
        if (!subscriptionInvoice?.invoice_id) return;
        setIsCheckingSubscription(true);
        try {
            let response = await apiFetch('/billing/check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                auth: true,
                body: JSON.stringify({ invoice_id: subscriptionInvoice.invoice_id }),
            });
            let data = await response.json();
            if (!response.ok) {
                const shouldFallback = response.status === 404 || response.status >= 500;
                if (!shouldFallback || !import.meta.env.DEV) {
                    throw new Error(data?.error || 'Төлбөр шалгахад алдаа гарлаа');
                }
                response = await apiFetch('/qpay/check', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoice_id: subscriptionInvoice.invoice_id }),
                });
                data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.error || 'Төлбөр шалгахад алдаа гарлаа');
                }
            }

            if (data.paid) {
                if (subscriptionPurchase?.source === 'qpay') {
                    throw new Error('Billing entitlement sync шаардлагатай. `/billing/check` endpoint ашиглана уу.');
                }
                setSubscriptionStatus('success');
                setSubscriptionInvoice(null);
                setSubscriptionPurchase(null);
                await refreshUserProfile();
                await fetchUserData();
            }
        } catch (error) {
            setSubscriptionStatus('error');
            setSubscriptionError(error instanceof Error ? error.message : 'Төлбөр шалгахад алдаа гарлаа');
        } finally {
            setIsCheckingSubscription(false);
        }
    };

    const renderBankLinks = (invoice) => {
        if (!invoice?.urls || invoice.urls.length === 0) {
            return null;
        }

        return (
            <div className="profile-bank-links">
                <div className="profile-bank-label">Банкны апп-аар төлөх:</div>
                <div className="profile-bank-grid">
                    {invoice.urls.map((bank, idx) => (
                        <a
                            key={idx}
                            href={bank.link}
                            className="profile-bank-item"
                            title={bank.description || bank.name}
                            target="_blank"
                            rel="noreferrer"
                        >
                            {bank.logo ? (
                                <img src={bank.logo} alt={bank.name || bank.description} />
                            ) : (
                                <span className="profile-bank-placeholder">{(bank.description || bank.name || '').slice(0, 2)}</span>
                            )}
                            <span>{bank.description || bank.name}</span>
                        </a>
                    ))}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="profile-loading">
                <div className="spinner" />
                <p>Уншиж байна...</p>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="container profile-container">
                <section className="profile-hero">
                    <div className="profile-hero__content">
                        <h1 className="profile-hero__title">Профайл</h1>
                        <p className="profile-hero__subtitle">Credit, subscription болон төлбөрийн мэдээллээ нэг дороос удирдаарай.</p>
                        <div className="profile-hero__chips">
                            <span className={`profile-chip ${subscriptionActive ? 'profile-chip--success' : 'profile-chip--muted'}`}>
                                {subscriptionActive ? 'Идэвхтэй subscription' : 'Subscription идэвхгүй'}
                            </span>
                            <span className="profile-chip profile-chip--plain">{currentUser?.email || 'Хэрэглэгч'}</span>
                        </div>
                    </div>

                    <div className="profile-hero__actions">
                        <Link to="/profile/transactions" className="profile-btn profile-btn--ghost">
                            <History size={16} />
                            Гүйлгээний түүх
                        </Link>
                        <Link to="/profile/letterhead-templates" className="profile-btn profile-btn--ghost">
                            <FileText size={16} />
                            Албан бичгийн загвар
                        </Link>
                    </div>
                </section>

                <section className="profile-stats">
                    <article className="profile-stat-card">
                        <span className="profile-stat-card__icon"><Wallet size={16} /></span>
                        <p className="profile-stat-card__label">Credit үлдэгдэл</p>
                        <h3 className="profile-stat-card__value">{creditsBalance}</h3>
                    </article>
                    <article className="profile-stat-card">
                        <span className="profile-stat-card__icon"><CreditCard size={16} /></span>
                        <p className="profile-stat-card__label">Сарын үнэ</p>
                        <h3 className="profile-stat-card__value">{formatAmount(subscriptionPrice || 0)}</h3>
                    </article>
                    <article className="profile-stat-card">
                        <span className="profile-stat-card__icon"><CalendarClock size={16} /></span>
                        <p className="profile-stat-card__label">Дуусах огноо</p>
                        <h3 className="profile-stat-card__value profile-stat-card__value--sm">{subscriptionEndAt ? formatDate(subscriptionEndAt) : '-'}</h3>
                    </article>
                </section>

                <section className="profile-grid">
                    <article className="profile-card">
                        <div className="profile-card__head">
                            <div>
                                <h2 className="profile-card__title">1. Credit цэнэглэх</h2>
                                <p className="profile-card__subtitle">Багц сонгоод төлбөрөө хийсний дараа төлөвөө шалгана.</p>
                            </div>
                            <button
                                className="profile-btn profile-btn--primary"
                                onClick={() => setShowCreditBundles((prev) => !prev)}
                                disabled={creditStatus === 'creating'}
                            >
                                {creditStatus === 'creating' ? 'Үүсгэж байна...' : showCreditOptions ? 'Хаах' : 'Цэнэглэх'}
                            </button>
                        </div>

                        {creditStatus === 'success' && (
                            <div className="profile-notice profile-notice--success">
                                <CheckCircle2 size={16} />
                                Credit амжилттай нэмэгдлээ.
                            </div>
                        )}
                        {creditStatus === 'error' && creditError && (
                            <div className="profile-notice profile-notice--error">
                                <AlertCircle size={16} />
                                {creditError}
                            </div>
                        )}

                        {showCreditOptions && (
                            <div className="bundle-list">
                                {creditBundles.length === 0 ? (
                                    <div className="empty-hint">Одоогоор багц тохируулаагүй байна.</div>
                                ) : (
                                    creditBundles.map((bundle) => {
                                        const isBestValue = bundle.id === bestValueBundleId;
                                        return (
                                            <div key={bundle.id} className={`bundle-item ${isBestValue ? 'bundle-item--best' : ''}`}>
                                                <div className="bundle-info">
                                                    <div className="bundle-name-row">
                                                        <div className="bundle-name">{bundle.name || `${bundle.credits} credit`}</div>
                                                        {isBestValue && <span className="bundle-badge">Илүү ашигтай</span>}
                                                    </div>
                                                    <div className="bundle-desc">{bundle.credits} credit · {formatAmount(bundle.price)}</div>
                                                </div>
                                                <button
                                                    className="profile-btn profile-btn--ghost profile-btn--sm"
                                                    onClick={() => createCreditInvoice(bundle)}
                                                    disabled={creditStatus === 'creating'}
                                                >
                                                    Сонгох
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {creditStatus === 'pending' && creditInvoice && (
                            <div className="payment-panel">
                                <div className="payment-panel__header">
                                    <strong>Credit төлбөр хүлээгдэж байна</strong>
                                    <span>QPay эсвэл банкны апп ашиглана уу.</span>
                                </div>

                                <div className="payment-panel__body">
                                    {creditInvoice.qr_image ? (
                                        <img src={`data:image/png;base64,${creditInvoice.qr_image}`} alt="QPay QR" className="payment-qr" />
                                    ) : null}
                                    <div className="payment-panel__actions">
                                        {renderBankLinks(creditInvoice)}
                                        <div className="payment-actions">
                                            <button
                                                className="profile-btn profile-btn--primary profile-btn--sm"
                                                onClick={checkCreditPayment}
                                                disabled={isCheckingCredit}
                                            >
                                                {isCheckingCredit ? 'Шалгаж байна...' : 'Төлбөр шалгах'}
                                            </button>
                                            <button
                                                className="profile-btn profile-btn--ghost profile-btn--sm"
                                                onClick={() => {
                                                    setCreditInvoice(null);
                                                    setCreditStatus('idle');
                                                }}
                                            >
                                                Болих
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </article>

                    <article className="profile-card">
                        <div className="profile-card__head">
                            <div>
                                <h2 className="profile-card__title">2. Subscription</h2>
                                <p className="profile-card__subtitle">Сарын багцаа идэвхжүүлж credit-ээ тогтмол нэмээрэй.</p>
                            </div>
                            <button
                                className="profile-btn profile-btn--primary"
                                onClick={createSubscriptionInvoice}
                                disabled={subscriptionStatus === 'creating' || subscriptionPrice <= 0}
                            >
                                {subscriptionStatus === 'creating' ? 'Үүсгэж байна...' : subscriptionActive ? 'Сунгах' : 'Идэвхжүүлэх'}
                            </button>
                        </div>

                        <div className="subscription-meta">
                            <div className="subscription-meta__item">
                                <span>Төлөв</span>
                                <strong>{subscriptionActive ? 'Идэвхтэй' : 'Идэвхгүй'}</strong>
                            </div>
                            <div className="subscription-meta__item">
                                <span>Сарын үнэ</span>
                                <strong>{formatAmount(subscriptionPrice || 0)}</strong>
                            </div>
                            <div className="subscription-meta__item">
                                <span>Дагалдах credit</span>
                                <strong>{subscriptionCredits || 0}</strong>
                            </div>
                            <div className="subscription-meta__item">
                                <span>Дуусах</span>
                                <strong>{subscriptionEndAt ? formatDate(subscriptionEndAt) : '-'}</strong>
                            </div>
                        </div>

                        {subscriptionStatus === 'success' && (
                            <div className="profile-notice profile-notice--success">
                                <CheckCircle2 size={16} />
                                Subscription амжилттай идэвхжлээ.
                            </div>
                        )}
                        {subscriptionStatus === 'error' && subscriptionError && (
                            <div className="profile-notice profile-notice--error">
                                <AlertCircle size={16} />
                                {subscriptionError}
                            </div>
                        )}

                        {subscriptionStatus === 'pending' && subscriptionInvoice && (
                            <div className="payment-panel">
                                <div className="payment-panel__header">
                                    <strong>Subscription төлбөр хүлээгдэж байна</strong>
                                    <span>Төлбөр батлагдмагц хугацаа автоматаар сунгагдана.</span>
                                </div>

                                <div className="payment-panel__body">
                                    {subscriptionInvoice.qr_image ? (
                                        <img src={`data:image/png;base64,${subscriptionInvoice.qr_image}`} alt="QPay QR" className="payment-qr" />
                                    ) : null}
                                    <div className="payment-panel__actions">
                                        {renderBankLinks(subscriptionInvoice)}
                                        <div className="payment-actions">
                                            <button
                                                className="profile-btn profile-btn--primary profile-btn--sm"
                                                onClick={checkSubscriptionPayment}
                                                disabled={isCheckingSubscription}
                                            >
                                                {isCheckingSubscription ? 'Шалгаж байна...' : 'Төлбөр шалгах'}
                                            </button>
                                            <button
                                                className="profile-btn profile-btn--ghost profile-btn--sm"
                                                onClick={() => {
                                                    setSubscriptionInvoice(null);
                                                    setSubscriptionStatus('idle');
                                                }}
                                            >
                                                Болих
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </article>
                </section>

            </div>
        </div>
    );
};

export default UserProfile;
