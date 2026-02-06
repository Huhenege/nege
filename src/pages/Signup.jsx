import React, { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

const Signup = () => {
    const emailRef = useRef();
    const passwordRef = useRef();
    const passwordConfirmRef = useRef();
    const { signup, loginWithGoogle } = useAuth();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();

        if (passwordRef.current.value !== passwordConfirmRef.current.value) {
            return setError('Нууц үгнүүд таарахгүй байна');
        }

        try {
            setError('');
            setLoading(true);

            // 1. Create Auth User
            const userCredential = await signup(emailRef.current.value, passwordRef.current.value);
            const user = userCredential.user;

            // 2. Create User Document in Firestore
            await setDoc(doc(db, "users", user.uid), {
                email: user.email,
                role: 'user', // Default role
                createdAt: serverTimestamp(),
                status: 'active'
            });

            navigate('/ai-assistant');
        } catch (err) {
            console.error(err);
            setError('Бүртгэл үүсгэхэд алдаа гарлаа: ' + err.message);
        }

        setLoading(false);
    }

    async function handleGoogleSignup() {
        try {
            setError('');
            setLoading(true);
            await loginWithGoogle();
            navigate('/ai-assistant');
        } catch (err) {
            setError('Google-ээр бүртгүүлэхэд алдаа гарлаа: ' + err.message);
        }
        setLoading(false);
    }

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '80vh'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                padding: '2rem',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>Бүртгүүлэх</h2>
                {error && <div style={{
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    padding: '0.75rem',
                    borderRadius: '4px',
                    marginBottom: '1rem',
                    textAlign: 'center'
                }}>{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Имэйл</label>
                        <input type="email" ref={emailRef} required style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                        }} />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Нууц үг</label>
                        <input type="password" ref={passwordRef} required style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                        }} />
                    </div>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Нууц үг давтах</label>
                        <input type="password" ref={passwordConfirmRef} required style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #ccc',
                            borderRadius: '4px'
                        }} />
                    </div>
                    <button disabled={loading} type="submit" style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: '#2563eb', // Primary color
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        marginBottom: '1rem'
                    }}>
                        Бүртгүүлэх
                    </button>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        margin: '1rem 0',
                        color: '#6b7280',
                        fontSize: '0.875rem'
                    }}>
                        <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
                        <span style={{ margin: '0 0.5rem' }}>эсвэл</span>
                        <div style={{ flex: 1, height: '1px', backgroundColor: '#e5e7eb' }}></div>
                    </div>

                    <button
                        disabled={loading}
                        type="button"
                        onClick={handleGoogleSignup}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: 'white',
                            color: '#374151',
                            border: '1px solid #d1d5db',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 18 18">
                            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
                            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
                            <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.172.282-1.712V4.956H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.044l3.007-2.332z" fill="#FBBC05" />
                            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.443 2.048.957 4.956l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58z" fill="#EA4335" />
                        </svg>
                        Google-ээр бүртгүүлэх
                    </button>
                </form>
                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                    Бүртгэлтэй юу? <Link to="/login" style={{ color: '#2563eb' }}>Нэвтрэх</Link>
                </div>
            </div>
        </div>
    );
};

export default Signup;
