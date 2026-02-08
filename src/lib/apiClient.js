import { auth } from './firebase';

const API_BASE = (import.meta.env.VITE_QPAY_API_BASE || '/api').replace(/\/$/, '');

export async function getAuthToken() {
    const user = auth.currentUser;
    if (!user) return null;
    try {
        return await user.getIdToken();
    } catch (error) {
        console.error('Failed to get auth token:', error);
        return null;
    }
}

export async function apiFetch(path, options = {}) {
    const { auth: useAuth = false, ...rest } = options;
    const headers = { ...(rest.headers || {}) };

    if (useAuth) {
        const token = await getAuthToken();
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
    }

    const response = await fetch(`${API_BASE}${path}`, {
        ...rest,
        headers,
    });

    return response;
}

export function getApiBase() {
    return API_BASE;
}
