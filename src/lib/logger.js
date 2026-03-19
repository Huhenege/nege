import { apiJson } from './apiClient';

/**
 * Log an administrative action to Firestore
 * @param {string} action - The action performed (e.g., "BAN_USER", "PROMOTE_ADMIN")
 * @param {Object} details - Additional data about the action
 * @param {Object} adminUser - The admin user performing the action { uid, email }
 */
export async function logAdminAction(action, details, adminUser) {
    try {
        await apiJson('/admin/logs', {
            method: 'POST',
            auth: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action,
                details,
                adminId: adminUser?.uid,
                adminEmail: adminUser?.email,
            }),
        });
    } catch (error) {
        console.error("Error logging admin action:", error);
    }
}
