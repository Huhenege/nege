const GUEST_SESSION_KEY = 'guest-session-id';

export function getGuestSessionId() {
    try {
        let id = localStorage.getItem(GUEST_SESSION_KEY);
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(GUEST_SESSION_KEY, id);
        }
        return id;
    } catch (error) {
        console.error('Failed to load guest session id', error);
        return `guest-${Date.now()}`;
    }
}
