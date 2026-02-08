import React, { useContext, useState, useEffect } from "react"
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    onAuthStateChanged
} from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db, googleProvider } from "../lib/firebase"

const AuthContext = React.createContext()

export function useAuth() {
    return useContext(AuthContext)
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
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user = result.user;

            // Check if user document exists in Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (!userDoc.exists()) {
                // Create user document for new Google user
                await setDoc(doc(db, "users", user.uid), {
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    role: 'user',
                    createdAt: serverTimestamp(),
                    status: 'active',
                    subscription: {
                        status: 'inactive',
                        startAt: null,
                        endAt: null
                    },
                    credits: {
                        balance: 0,
                        updatedAt: serverTimestamp()
                    },
                    authProvider: 'google'
                });
            }
            return result;
        } catch (error) {
            throw error;
        }
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch user role from Firestore
                try {
                    const userDoc = await getDoc(doc(db, "users", user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        // Merge Firestore data into the user object
                        user.role = userData.role;
                        user.firestoreData = userData;
                        setUserProfile(userData);
                    } else {
                        setUserProfile(null);
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    setUserProfile(null);
                }
            } else {
                setUserProfile(null);
            }
            setCurrentUser(user);
            setLoading(false);
        });

        return unsubscribe;
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
            const userDoc = await getDoc(doc(db, "users", currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setUserProfile(data);
                return data;
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
