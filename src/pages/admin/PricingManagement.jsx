import React, { useEffect, useState } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { apiJson } from '../../lib/apiClient';

const DEFAULT_CONFIG = {
    subscription: {
        monthlyPrice: 0,
        discountPercent: 20,
        monthlyCredits: 0
    },
    tools: {
        official_letterhead: { payPerUsePrice: 1000, creditCost: 1, active: true },
        ndsh_holiday: { payPerUsePrice: 1000, creditCost: 1, active: true },
        account_statement: { payPerUsePrice: 1000, creditCost: 1, active: true },
        business_card: { payPerUsePrice: 1000, creditCost: 1, active: true },
        contract_generator: { payPerUsePrice: 1000, creditCost: 1, active: true },
        eisenhower_analyzer: { payPerUsePrice: 1000, creditCost: 1, active: true },
        swot_analyzer: { payPerUsePrice: 1000, creditCost: 1, active: true }
    },
    credits: {
        bundles: []
    }
};

const TOOL_LABELS = {
    official_letterhead: 'Албан бланк үүсгэх',
    ndsh_holiday: 'Ажилсан жил тооцоолох',
    account_statement: 'Дансны хуулга цэгцлэх',
    business_card: 'Нэрийн хуудас үүсгэх',
    contract_generator: 'Гэрээ үүсгэгч',
    eisenhower_analyzer: 'Eisenhower Prioritizer',
    swot_analyzer: 'SWOT Analyzer'
};

const PricingManagement = () => {
    const [config, setConfig] = useState(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        const loadConfig = async () => {
            setLoading(true);
            try {
                const data = await apiJson('/billing/config');
                if (data?.config) {
                    const mergedTools = {
                        ...DEFAULT_CONFIG.tools,
                        ...(data.config.tools || {})
                    };
                    Object.keys(DEFAULT_CONFIG.tools).forEach((toolKey) => {
                        mergedTools[toolKey] = {
                            ...DEFAULT_CONFIG.tools[toolKey],
                            ...(data.config.tools?.[toolKey] || {})
                        };
                    });

                    const normalized = {
                        ...DEFAULT_CONFIG,
                        ...data.config,
                        subscription: {
                            ...DEFAULT_CONFIG.subscription,
                            ...(data.config.subscription || {})
                        },
                        tools: {
                            ...mergedTools
                        },
                        credits: {
                            ...DEFAULT_CONFIG.credits,
                            ...(data.config.credits || {})
                        }
                    };
                    setConfig(normalized);
                } else {
                    setConfig(DEFAULT_CONFIG);
                }
            } catch (error) {
                console.error('Error loading billing config:', error);
            } finally {
                setLoading(false);
            }
        };

        loadConfig();
    }, []);

    const handleToolChange = (toolKey, field, value) => {
        const parsedValue = field === 'active' ? !!value : Number(value);
        setConfig((prev) => ({
            ...prev,
            tools: {
                ...prev.tools,
                [toolKey]: {
                    ...prev.tools[toolKey],
                    [field]: parsedValue
                }
            }
        }));
    };

    const handleSubscriptionChange = (field, value) => {
        setConfig((prev) => ({
            ...prev,
            subscription: {
                ...prev.subscription,
                [field]: Number(value)
            }
        }));
    };

    const handleBundleChange = (idx, field, value) => {
        setConfig((prev) => {
            const bundles = [...(prev.credits?.bundles || [])];
            bundles[idx] = {
                ...bundles[idx],
                [field]: field === 'name' ? value : (field === 'active' ? value : Number(value))
            };
            return {
                ...prev,
                credits: {
                    ...prev.credits,
                    bundles
                }
            };
        });
    };

    const addBundle = () => {
        setConfig((prev) => ({
            ...prev,
            credits: {
                ...prev.credits,
                bundles: [
                    ...(prev.credits?.bundles || []),
                    {
                        id: crypto.randomUUID(),
                        name: 'Шинэ багц',
                        credits: 10,
                        price: 1000,
                        active: true
                    }
                ]
            }
        }));
    };

    const removeBundle = (idx) => {
        setConfig((prev) => {
            const bundles = [...(prev.credits?.bundles || [])];
            bundles.splice(idx, 1);
            return {
                ...prev,
                credits: {
                    ...prev.credits,
                    bundles
                }
            };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);
        try {
            const normalizedBundles = (config.credits?.bundles || []).map((bundle) => ({
                ...bundle,
                id: bundle.id || crypto.randomUUID(),
            }));
            const data = await apiJson('/admin/settings/billing', {
                method: 'POST',
                auth: true,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    config: {
                        ...config,
                        credits: {
                            ...config.credits,
                            bundles: normalizedBundles,
                        },
                    },
                }),
            });

            const syncResult = data?.syncResult || null;
            const summary = syncResult && !syncResult.skipped && Number(syncResult.updated) > 0
                ? `Идэвхтэй ${syncResult.updated} хэрэглэгчийн credits +${syncResult.delta} нэмэгдлээ.`
                : (syncResult && Number(syncResult.delta) < 0)
                    ? 'Сарын credits багассан тул идэвхтэй хэрэглэгчдийн үлдэгдэлд өөрчлөлт оруулаагүй.'
                    : '';

            setMessage({
                type: 'success',
                text: summary
                    ? `Billing тохиргоо хадгалагдлаа. ${summary}`
                    : 'Billing тохиргоо хадгалагдлаа.',
            });
        } catch (error) {
            console.error('Error saving billing config:', error);
            setMessage({ type: 'error', text: 'Хадгалахад алдаа гарлаа.' });
        } finally {
            setSaving(false);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: 'var(--ink-900)', marginBottom: '0.5rem' }}>
                        Pricing & Billing
                    </h1>
                    <p style={{ color: 'var(--ink-500)' }}>Subscription, pay‑per‑use, credits багцуудын тохиргоо</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        backgroundColor: '#e11d48',
                        color: 'white',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '10px',
                        border: 'none',
                        fontWeight: '600',
                        cursor: saving ? 'not-allowed' : 'pointer'
                    }}
                >
                    <Save size={18} />
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                </button>
            </div>

            {message && (
                <div style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    color: message.type === 'success' ? '#166534' : '#991b1b',
                    marginBottom: '1.5rem',
                    fontSize: '0.9rem'
                }}>
                    {message.text}
                </div>
            )}

            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--ink-200)', padding: '2rem', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--ink-900)' }}>Subscription</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <label>
                        Сарын үнэ (₮)
                        <input
                            type="number"
                            value={config.subscription?.monthlyPrice || 0}
                            onChange={(e) => handleSubscriptionChange('monthlyPrice', e.target.value)}
                            style={{ width: '100%', marginTop: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--ink-300)' }}
                        />
                    </label>
                    <label>
                        Сарын credits
                        <input
                            type="number"
                            value={config.subscription?.monthlyCredits || 0}
                            onChange={(e) => handleSubscriptionChange('monthlyCredits', e.target.value)}
                            style={{ width: '100%', marginTop: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--ink-300)' }}
                        />
                    </label>
                    <label>
                        Discount (%)
                        <input
                            type="number"
                            value={config.subscription?.discountPercent || 0}
                            onChange={(e) => handleSubscriptionChange('discountPercent', e.target.value)}
                            style={{ width: '100%', marginTop: '0.5rem', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--ink-300)' }}
                        />
                    </label>
                </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--ink-200)', padding: '2rem', marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--ink-900)' }}>Tool pricing</h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.6fr', gap: '1rem', fontSize: '0.85rem', color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <div>Tool</div>
                        <div>Pay-per-use ₮</div>
                        <div>Credit cost</div>
                        <div>Идэвхтэй</div>
                    </div>
                    {Object.keys(config.tools || {}).map((toolKey) => (
                        <div key={toolKey} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.6fr', gap: '1rem', alignItems: 'center' }}>
                            <div style={{ fontWeight: '600' }}>{TOOL_LABELS[toolKey] || toolKey}</div>
                            <input
                                type="number"
                                value={config.tools?.[toolKey]?.payPerUsePrice || 0}
                                onChange={(e) => handleToolChange(toolKey, 'payPerUsePrice', e.target.value)}
                                style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--ink-300)' }}
                            />
                            <input
                                type="number"
                                value={config.tools?.[toolKey]?.creditCost || 0}
                                onChange={(e) => handleToolChange(toolKey, 'creditCost', e.target.value)}
                                style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--ink-300)' }}
                            />
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--ink-500)' }}>
                                <input
                                    type="checkbox"
                                    checked={config.tools?.[toolKey]?.active !== false}
                                    onChange={(e) => handleToolChange(toolKey, 'active', e.target.checked)}
                                />
                                {config.tools?.[toolKey]?.active === false ? 'Off' : 'On'}
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid var(--ink-200)', padding: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--ink-900)' }}>Credits bundles</h3>
                    <button onClick={addBundle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--ink-200)', background: 'white', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer' }}>
                        <Plus size={16} /> Нэмэх
                    </button>
                </div>
                {config.credits?.bundles?.length ? (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {config.credits.bundles.map((bundle, idx) => (
                            <div key={bundle.id || idx} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 0.6fr auto', gap: '0.75rem', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    value={bundle.name || ''}
                                    onChange={(e) => handleBundleChange(idx, 'name', e.target.value)}
                                    style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--ink-300)' }}
                                />
                                <input
                                    type="number"
                                    value={bundle.credits || 0}
                                    onChange={(e) => handleBundleChange(idx, 'credits', e.target.value)}
                                    style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--ink-300)' }}
                                />
                                <input
                                    type="number"
                                    value={bundle.price || 0}
                                    onChange={(e) => handleBundleChange(idx, 'price', e.target.value)}
                                    style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--ink-300)' }}
                                />
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={bundle.active !== false}
                                        onChange={(e) => handleBundleChange(idx, 'active', e.target.checked)}
                                    />
                                    Active
                                </label>
                                <button onClick={() => removeBundle(idx)} style={{ border: 'none', background: '#fee2e2', color: '#b91c1c', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer' }}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ color: 'var(--ink-400)' }}>Багц алга байна.</div>
                )}
            </div>
        </div>
    );
};

export default PricingManagement;
