import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Settings, Save, AlertTriangle, ToggleLeft, ToggleRight, Layout, Globe, Moon } from 'lucide-react';
import { logAdminAction } from '../../lib/logger';
import { useAuth } from '../../contexts/AuthContext';

const AdminSettings = () => {
    const { currentUser } = useAuth();
    const [settings, setSettings] = useState({
        maintenanceMode: false,
        registrationEnabled: true,
        defaultUserRole: 'user',
        siteName: 'Nege.mn',
        primaryColor: '#4f46e5'
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "settings", "global");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSettings(prev => ({ ...prev, ...docSnap.data() }));
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage(null);

        try {
            await setDoc(doc(db, "settings", "global"), {
                ...settings,
                updatedAt: serverTimestamp(),
                updatedBy: currentUser?.email
            }, { merge: true });

            await logAdminAction('UPDATE_SETTINGS', { changedKeys: Object.keys(settings) }, currentUser);

            setMessage({ type: 'success', text: 'Тохиргоо амжилттай хадгалагдлаа.' });
        } catch (error) {
            console.error("Error saving settings:", error);
            setMessage({ type: 'error', text: 'Хадгалахад алдаа гарлаа.' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%' }}></div>
        </div>
    );

    const SettingRow = ({ label, description, children }) => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 0', borderBottom: '1px solid #f1f5f9' }}>
            <div>
                <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem' }}>{label}</h4>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>{description}</p>
            </div>
            <div>{children}</div>
        </div>
    );

    return (
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.5rem' }}>
                        Системийн тохиргоо
                    </h1>
                    <p style={{ color: '#64748b' }}>Аппликейшны ерөнхий тохиргоог удирдах</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        backgroundColor: '#4f46e5',
                        color: 'white',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '10px',
                        border: 'none',
                        fontWeight: '600',
                        cursor: saving ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)'
                    }}
                >
                    <Save size={18} />
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                </button>
            </div>

            {message && (
                <div style={{
                    padding: '1rem',
                    borderRadius: '12px',
                    backgroundColor: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                    border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                    color: message.type === 'success' ? '#166534' : '#991b1b',
                    marginBottom: '1.5rem',
                    fontSize: '0.9rem'
                }}>
                    {message.text}
                </div>
            )}

            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '2rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Globe size={20} className="text-blue-600" />
                    Ерөнхий
                </h3>

                <SettingRow label="Maintenance Mode" description="Системийг түр хугацаанд засар горимд шилжүүлэх">
                    <button
                        onClick={() => setSettings(s => ({ ...s, maintenanceMode: !s.maintenanceMode }))}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                    >
                        {settings.maintenanceMode ? <ToggleRight size={40} className="text-blue-600" /> : <ToggleLeft size={40} color="#cbd5e1" />}
                    </button>
                </SettingRow>

                <SettingRow label="Allow Signups" description="Шинэ хэрэглэгч бүртгүүлэх боломжийг идэвхжүүлэх">
                    <button
                        onClick={() => setSettings(s => ({ ...s, registrationEnabled: !s.registrationEnabled }))}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                    >
                        {settings.registrationEnabled ? <ToggleRight size={40} className="text-blue-600" /> : <ToggleLeft size={40} color="#cbd5e1" />}
                    </button>
                </SettingRow>

                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginTop: '2.5rem', marginBottom: '1rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layout size={20} className="text-purple-600" />
                    UI & Branding
                </h3>

                <SettingRow label="Site Name" description="Системийн гарчиг (Title)">
                    <input
                        type="text"
                        value={settings.siteName}
                        onChange={(e) => setSettings(s => ({ ...s, siteName: e.target.value }))}
                        style={{ padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', width: '200px' }}
                    />
                </SettingRow>

                <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#fff7ed', borderRadius: '12px', border: '1px solid #ffedd5', display: 'flex', gap: '0.75rem' }}>
                    <AlertTriangle size={20} color="#ea580c" style={{ flexShrink: 0 }} />
                    <p style={{ fontSize: '0.85rem', color: '#9a3412' }}>
                        <b>Анхаар:</b> Эдгээр тохиргоог өөрчлөх нь бүх хэрэглэгчдэд шууд нөлөөлнө. Туршилтыг дотоод орчинд хийсний дараа хадгалахыг зөвлөж байна.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
