import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';

function parseDateValue(value) {
    if (!value) return null;
    if (value?.toDate) return value.toDate();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function useAccess() {
    const { currentUser, userProfile } = useAuth();
    const { config } = useBilling();

    return useMemo(() => {
        const subscription = userProfile?.subscription || {};
        const endAt = parseDateValue(subscription.endAt);
        const isSubscriber = subscription.status === 'active' && endAt && endAt.getTime() > Date.now();
        const isRegistered = !!currentUser;

        return {
            tier: isSubscriber ? 'subscriber' : (isRegistered ? 'registered' : 'guest'),
            isSubscriber,
            isRegistered,
            subscriptionEndAt: endAt,
            discountPercent: isSubscriber ? (Number(config?.subscription?.discountPercent) || 0) : 0,
            canUseTemplates: isSubscriber
        };
    }, [currentUser, userProfile, config]);
}
