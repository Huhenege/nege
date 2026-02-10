import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { History } from 'lucide-react';
import { useBilling } from '../contexts/BillingContext';
import { apiFetch } from '../lib/apiClient';
import './UserProfile.css';

const UserProfile = () => {
    const { currentUser, refreshUserProfile } = useAuth();
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

    useEffect(() => {
        fetchUserData();
    }, [currentUser]);

    async function fetchUserData() {
        if (!currentUser) return;

        try {
            // Fetch user info
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserInfo(data);
            }

        } catch (error) {
            console.error('Error fetching user data:', error);
        } finally {
            setLoading(false);
        }
    }

    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const formatAmount = (amount) => {
        return new Intl.NumberFormat('mn-MN').format(amount) + '₮';
    };

    const subscriptionEndAt = userInfo?.subscription?.endAt
        ? (userInfo.subscription.endAt.toDate ? userInfo.subscription.endAt.toDate() : new Date(userInfo.subscription.endAt))
        : null;
    const subscriptionActive = userInfo?.subscription?.status === 'active' && subscriptionEndAt && subscriptionEndAt.getTime() > Date.now();
    const creditsBalance = userInfo?.credits?.balance || 0;
    const creditBundles = (billingConfig?.credits?.bundles || []).filter(b => b?.active !== false);
    const subscriptionPrice = Number(billingConfig?.subscription?.monthlyPrice || 0);
    const subscriptionCredits = Number(billingConfig?.subscription?.monthlyCredits || 0);
    const showCreditOptions = showCreditBundles || creditStatus === 'pending';

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
                    bundleId: bundle.id
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
                        description: `Credits багц: ${bundle.name || bundle.credits + ' credit'}`,
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
                    if (!import.meta.env.DEV) {
                        throw new Error('Credits цэнэглэх сервер олдсонгүй. Дахин оролдоно уу.');
                    }
                    if (creditPurchase?.credits > 0 && currentUser?.uid) {
                        await updateDoc(doc(db, 'users', currentUser.uid), {
                            credits: {
                                balance: increment(creditPurchase.credits),
                                updatedAt: serverTimestamp(),
                            },
                            updatedAt: serverTimestamp(),
                        });
                    }
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

    const addOneMonth = (date) => {
        const next = new Date(date);
        next.setMonth(next.getMonth() + 1);
        return next;
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
                    if (!import.meta.env.DEV) {
                        throw new Error('Subscription төлбөрийн сервер олдсонгүй. Дахин оролдоно уу.');
                    }
                    if (currentUser?.uid) {
                        const baseDate = subscriptionEndAt && subscriptionEndAt.getTime() > Date.now()
                            ? subscriptionEndAt
                            : new Date();
                        const nextEnd = addOneMonth(baseDate);
                        await updateDoc(doc(db, 'users', currentUser.uid), {
                            'credits.balance': increment(subscriptionCredits),
                            'credits.updatedAt': serverTimestamp(),
                            'subscription.status': 'active',
                            'subscription.startAt': userInfo?.subscription?.startAt || new Date().toISOString(),
                            'subscription.endAt': nextEnd.toISOString(),
                            'subscription.updatedAt': serverTimestamp(),
                            updatedAt: serverTimestamp(),
                        });
                    }
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

    if (loading) {
        return (
            <div className="profile-loading">
                <div className="spinner"></div>
                <p>Уншиж байна...</p>
            </div>
        );
    }

    return (
        <div className="profile-page">
            <div className="profile-container">
                <div className="profile-card">
                    <div className="card-row">
                        <div>
                            <div className="card-label">Миний хэтэвч</div>
                            <div className="card-value">{creditsBalance} credit</div>
                        </div>
                        <div className="card-actions">
                            <Link to="/profile/transactions" className="profile-btn profile-btn--ghost">
                                <History size={18} />
                                Гүйлгээний түүх
                            </Link>
                            <button
                                className="profile-btn profile-btn--primary"
                                onClick={() => setShowCreditBundles((prev) => !prev)}
                                disabled={creditStatus === 'creating'}
                            >
                                {showCreditOptions ? 'Хаах' : 'Цэнэглэх'}
                            </button>
                        </div>
                    </div>

                    {showCreditOptions && (
                        <div className="bundle-list">
                            {creditBundles.length === 0 ? (
                                <div className="empty-hint">Одоогоор багц тохируулаагүй байна.</div>
                            ) : (
                                creditBundles.map((bundle) => (
                                    <div key={bundle.id} className="bundle-item">
                                        <div className="bundle-info">
                                            <div className="bundle-name">{bundle.name || `${bundle.credits} credit`}</div>
                                            <div className="bundle-desc">{bundle.credits} credit · {formatAmount(bundle.price)}</div>
                                        </div>
                                        <button
                                            className="profile-btn profile-btn--ghost profile-btn--sm"
                                            onClick={() => createCreditInvoice(bundle)}
                                            disabled={creditStatus === 'creating'}
                                        >
                                            Цэнэглэх
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {creditStatus === 'pending' && creditInvoice && (
                        <div className="payment-panel">
                            {creditInvoice.qr_image ? (
                                <img src={`data:image/png;base64,${creditInvoice.qr_image}`} alt="QPay QR" className="payment-qr" />
                            ) : null}
                            {creditInvoice?.urls && creditInvoice.urls.length > 0 && (
                                <div className="profile-bank-links">
                                    <div className="profile-bank-label">Банкны апп-аар төлөх:</div>
                                    <div className="profile-bank-grid">
                                        {creditInvoice.urls.map((bank, idx) => (
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
                            )}
                            <div className="payment-actions">
                                <button className="profile-btn profile-btn--primary profile-btn--sm" onClick={checkCreditPayment} disabled={isCheckingCredit}>
                                    {isCheckingCredit ? 'Шалгаж байна...' : 'Төлбөр шалгах'}
                                </button>
                                <button className="profile-btn profile-btn--ghost profile-btn--sm" onClick={() => { setCreditInvoice(null); setCreditStatus('idle'); }}>
                                    Болих
                                </button>
                            </div>
                            {creditError && <p className="payment-error">{creditError}</p>}
                        </div>
                    )}

                </div>

                <div className="profile-card">
                    <div className="card-row">
                        <div>
                            <div className="card-label">Сарын төлбөр</div>
                            <div className="card-sub">Сарын үнэ: {formatAmount(subscriptionPrice || 0)} · Дагалдах credits: {subscriptionCredits || 0}</div>
                            <div className="card-sub">
                                Төлөв: {subscriptionActive ? 'Идэвхтэй' : 'Идэвхгүй'} · Дуусах: {subscriptionEndAt ? formatDate(subscriptionEndAt) : '-'}
                            </div>
                        </div>
                        <button
                            className="profile-btn profile-btn--primary"
                            onClick={createSubscriptionInvoice}
                            disabled={subscriptionStatus === 'creating' || subscriptionPrice <= 0}
                        >
                            {subscriptionActive ? 'Сунгах' : 'Төлөх'}
                        </button>
                    </div>

                    {subscriptionStatus === 'pending' && subscriptionInvoice && (
                        <div className="payment-panel">
                            {subscriptionInvoice.qr_image ? (
                                <img src={`data:image/png;base64,${subscriptionInvoice.qr_image}`} alt="QPay QR" className="payment-qr" />
                            ) : null}
                            {subscriptionInvoice?.urls && subscriptionInvoice.urls.length > 0 && (
                                <div className="profile-bank-links">
                                    <div className="profile-bank-label">Банкны апп-аар төлөх:</div>
                                    <div className="profile-bank-grid">
                                        {subscriptionInvoice.urls.map((bank, idx) => (
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
                            )}
                            <div className="payment-actions">
                                <button className="profile-btn profile-btn--primary profile-btn--sm" onClick={checkSubscriptionPayment} disabled={isCheckingSubscription}>
                                    {isCheckingSubscription ? 'Шалгаж байна...' : 'Төлбөр шалгах'}
                                </button>
                                <button className="profile-btn profile-btn--ghost profile-btn--sm" onClick={() => { setSubscriptionInvoice(null); setSubscriptionStatus('idle'); }}>
                                    Болих
                                </button>
                            </div>
                            {subscriptionError && <p className="payment-error">{subscriptionError}</p>}
                        </div>
                    )}
                </div>

                <div className="profile-card">
                    <Link to="/profile/letterhead-templates" className="simple-link">
                        Миний хадгалсан албан бичгийн загварууд
                    </Link>
                    <div className="card-sub">Өөрийн загваруудыг хадгалах, сонгох, засах</div>
                </div>
            </div>

        </div>
    );
};

export default UserProfile;
