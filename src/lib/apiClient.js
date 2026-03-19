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

export async function apiFetchWithToken(path, token, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    return fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
    });
}

export async function apiJson(path, options = {}) {
    const response = await apiFetch(path, options);
    const text = await response.text();
    let data = null;

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error('Серверийн хариу уншихад алдаа гарлаа.');
        }
    }

    if (!response.ok) {
        throw new Error(data?.error || 'Серверийн хүсэлт амжилтгүй боллоо.');
    }

    return data;
}

export function getApiBase() {
    return API_BASE;
}
