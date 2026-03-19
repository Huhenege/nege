/* eslint-disable react-refresh/only-export-components */
import React, { useContext, useState, useEffect } from "react"
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "firebase/auth"
import { auth, googleProvider } from "../lib/firebase"
import { apiFetchWithToken, apiJson } from "../lib/apiClient"

const AuthContext = React.createContext()

export function useAuth() {
    return useContext(AuthContext)
}

function buildSessionUser(user, profile, authz) {
    if (!user) return null;
    return {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        role: profile?.role || 'user',
        firestoreData: profile || null,
        authz: authz || null,
    };
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState()
    const [userProfile, setUserProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    function signup(email, password) {
        return createUserWithEmailAndPassword(auth, email, password)
    }

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password)
    }

    function logout() {
        return signOut(auth)
    }

    async function loginWithGoogle() {
        return signInWithPopup(auth, googleProvider);
    }

    async function syncProfile(user) {
        if (!user) return null;
        const token = await user.getIdToken();
        const response = await apiFetchWithToken('/auth/bootstrap', token, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data?.error || 'Профайл ачааллахад алдаа гарлаа.');
        }

        const profile = data?.profile || null;
        setUserProfile(profile);
        return {
            profile,
            authz: data?.authz || null,
        };
    }

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setLoading(true);
            if (user) {
                try {
                    const synced = await syncProfile(user);
                    setCurrentUser(buildSessionUser(user, synced?.profile, synced?.authz));
                } catch (error) {
                    console.error("Error syncing user data:", error);
                    setUserProfile(null);
                    setCurrentUser(buildSessionUser(user, null, null));
                }
            } else {
                setUserProfile(null);
                setCurrentUser(null);
            }
            setLoading(false);
        });

        return () => {
            unsubscribeAuth();
        };
    }, []);

    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

    function openAuthModal() {
        setIsAuthModalOpen(true);
    }

    function closeAuthModal() {
        setIsAuthModalOpen(false);
    }

    async function refreshUserProfile() {
        if (!currentUser?.uid) return null;
        try {
            const data = await apiJson('/me/profile', { auth: true });
            if (data?.profile) {
                setUserProfile(data.profile);
                setCurrentUser((prev) => prev ? {
                    ...prev,
                    role: data.profile.role,
                    firestoreData: data.profile,
                    authz: data?.authz || null,
                } : prev);
                return data.profile;
            }
        } catch (error) {
            console.error("Error refreshing user data:", error);
        }
        return null;
    }

    const value = {
        currentUser,
        loading,
        login,
        signup,
        loginWithGoogle,
        logout,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        userProfile,
        refreshUserProfile
    }

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    )
}
