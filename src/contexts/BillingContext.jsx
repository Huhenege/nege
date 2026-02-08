import React, { useCallback, useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { apiFetch } from '../lib/apiClient';

const BillingContext = React.createContext();

const DEFAULT_BILLING_CONFIG = {
    subscription: {
        monthlyPrice: 0,
        discountPercent: 20
    },
    tools: {
        official_letterhead: { payPerUsePrice: 1000, creditCost: 1 },
        ndsh_holiday: { payPerUsePrice: 1000, creditCost: 1 },
        account_statement: { payPerUsePrice: 1000, creditCost: 1 }
    },
    credits: {
        bundles: []
    }
};

export function useBilling() {
    return React.useContext(BillingContext);
}

export function BillingProvider({ children }) {
    const [config, setConfig] = useState(DEFAULT_BILLING_CONFIG);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        let resolved = false;
        try {
            const docRef = doc(db, 'settings', 'billing');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data() || {};
                setConfig({
                    ...DEFAULT_BILLING_CONFIG,
                    ...data,
                    subscription: {
                        ...DEFAULT_BILLING_CONFIG.subscription,
                        ...(data.subscription || {})
                    },
                    tools: {
                        ...DEFAULT_BILLING_CONFIG.tools,
                        ...(data.tools || {})
                    },
                    credits: {
                        ...DEFAULT_BILLING_CONFIG.credits,
                        ...(data.credits || {})
                    }
                });
                resolved = true;
            } else {
                setConfig(DEFAULT_BILLING_CONFIG);
                resolved = true;
            }
        } catch (err) {
            console.error('Billing config firestore error:', err);
        }
        if (!resolved) {
            try {
                const response = await apiFetch('/billing/config');
                const data = await response.json();
                if (response.ok && data?.config) {
                    setConfig({
                        ...DEFAULT_BILLING_CONFIG,
                        ...data.config,
                        subscription: {
                            ...DEFAULT_BILLING_CONFIG.subscription,
                            ...(data.config.subscription || {})
                        },
                        tools: {
                            ...DEFAULT_BILLING_CONFIG.tools,
                            ...(data.config.tools || {})
                        },
                        credits: {
                            ...DEFAULT_BILLING_CONFIG.credits,
                            ...(data.config.credits || {})
                        }
                    });
                } else {
                    setError(data?.error || 'Billing config уншихад алдаа гарлаа.');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Billing config уншихад алдаа гарлаа.');
            }
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const value = {
        config,
        loading,
        error,
        refresh
    };

    return (
        <BillingContext.Provider value={value}>
            {children}
        </BillingContext.Provider>
    );
}
