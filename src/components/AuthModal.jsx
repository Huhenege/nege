import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Mail, Lock } from 'lucide-react';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import Logo from './Logo';
import './AuthModal.css';

const AuthModal = () => {
    const { isAuthModalOpen, closeAuthModal, login, signup, loginWithGoogle } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const emailRef = useRef();
    const passwordRef = useRef();
    const passwordConfirmRef = useRef();

    if (!isAuthModalOpen) return null;

    async function handleEmailAuth(e) {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await login(emailRef.current.value, passwordRef.current.value);
            } else {
                if (passwordRef.current.value !== passwordConfirmRef.current.value) {
                    throw new Error('Нууц үгнүүд таарахгүй байна');
                }
                const userCredential = await signup(emailRef.current.value, passwordRef.current.value);
                const user = userCredential.user;
                await setDoc(doc(db, "users", user.uid), {
                    email: user.email,
                    role: 'user',
                    createdAt: serverTimestamp(),
                    status: 'active'
                });
            }
            closeAuthModal();
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleGoogleAuth() {
        setError('');
        setLoading(true);
        try {
            await loginWithGoogle();
            closeAuthModal();
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-modal-overlay" onClick={closeAuthModal}>
            <div className="auth-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="auth-modal-close" onClick={closeAuthModal}>
                    <X size={20} />
                </button>

                <div className="auth-modal-header">
                    <div className="auth-modal-logo">
                        <Logo style={{ height: '32px', width: 'auto' }} />
                    </div>
                    <h2>{isLogin ? 'Нэвтрэх' : 'Бүртгүүлэх'}</h2>
                    <p>{isLogin ? 'Тавтай морил! Үргэлжлүүлэхийн тулд нэвтэрнэ үү.' : 'Шинэ бүртгэл үүсгэж AI туслахуудыг ашиглаарай.'}</p>
                </div>

                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(true)}
                    >
                        Нэвтрэх
                    </button>
                    <button
                        className={`auth-tab ${!isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(false)}
                    >
                        Бүртгүүлэх
                    </button>
                </div>

                {error && <div className="auth-error">{error}</div>}

                <form onSubmit={handleEmailAuth} className="auth-form">
                    <div className="auth-input-group">
                        <label><Mail size={16} /> Имэйл</label>
                        <input type="email" ref={emailRef} required placeholder="email@example.com" />
                    </div>
                    <div className="auth-input-group">
                        <label><Lock size={16} /> Нууц үг</label>
                        <input type="password" ref={passwordRef} required placeholder="••••••••" />
                    </div>
                    {!isLogin && (
                        <div className="auth-input-group">
                            <label><Lock size={16} /> Нууц үг давтах</label>
                            <input type="password" ref={passwordConfirmRef} required placeholder="••••••••" />
                        </div>
                    )}
                    <button type="submit" className="auth-submit-btn" disabled={loading}>
                        {loading ? 'Уншиж байна...' : (isLogin ? 'Нэвтрэх' : 'Бүртгүүлэх')}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>эсвэл</span>
                </div>

                <button className="auth-google-btn" onClick={handleGoogleAuth} disabled={loading}>
                    <svg width="20" height="20" viewBox="0 0 18 18">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                        <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#FBBC05" />
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.443 2.048.957 4.956l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#EA4335" />
                    </svg>
                    Google-ээр үргэлжлүүлэх
                </button>
            </div>
        </div>
    );
};

export default AuthModal;
