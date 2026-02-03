import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Log an administrative action to Firestore
 * @param {string} action - The action performed (e.g., "BAN_USER", "PROMOTE_ADMIN")
 * @param {Object} details - Additional data about the action
 * @param {Object} adminUser - The admin user performing the action { uid, email }
 */
export async function logAdminAction(action, details, adminUser) {
    try {
        await addDoc(collection(db, "audit_logs"), {
            action,
            details,
            adminId: adminUser?.uid,
            adminEmail: adminUser?.email,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error logging admin action:", error);
    }
}
