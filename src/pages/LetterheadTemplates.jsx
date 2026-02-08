import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    getDoc,
    serverTimestamp
} from 'firebase/firestore';
import { ArrowLeft, FileText, Save, CheckCircle2, Plus } from 'lucide-react';
import useAccess from '../hooks/useAccess';
import './LetterheadTemplates.css';

const defaultTemplate = {
    title: 'Миний загвар',
    orgName: 'БАЙГУУЛЛАГЫН НЭР',
    orgTagline: 'БАЙГУУЛЛАГЫН ҮЙЛ АЖИЛЛАГААНЫ ЧИГЛЭЛ',
    address: 'Улаанбаатар хот, Сүхбаатар дүүрэг, 1-р хороо, Чингисийн талбай-1',
    phone: '7700-0000',
    email: 'info@organization.mn',
    web: 'www.organization.mn',
    signPosition: 'Захирал',
    signName: 'Г.Гэрэлт',
    fontFamily: 'Times New Roman'
};

const LetterheadTemplates = () => {
    const { currentUser } = useAuth();
    const { canUseTemplates } = useAccess();
    const [templates, setTemplates] = useState([]);
    const [form, setForm] = useState(defaultTemplate);
    const [editingId, setEditingId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState('');
    const [formInitialized, setFormInitialized] = useState(false);

    useEffect(() => {
        const loadTemplates = async () => {
            if (!currentUser) return;
            setLoading(true);
            try {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                const userData = userDoc.exists() ? userDoc.data() : null;

                const templatesRef = collection(db, 'letterheadTemplates');
                const q = query(
                    templatesRef,
                    where('userId', '==', currentUser.uid)
                );
                const snapshot = await getDocs(q);
                const templateList = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data()
                })).sort((a, b) => {
                    const aTime = a.updatedAt?.toDate?.().getTime?.() || a.createdAt?.toDate?.().getTime?.() || 0;
                    const bTime = b.updatedAt?.toDate?.().getTime?.() || b.createdAt?.toDate?.().getTime?.() || 0;
                    return bTime - aTime;
                });
                setTemplates(templateList);

                if (!formInitialized) {
                    const preferred = templateList[0];
                    if (preferred?.template) {
                        setForm({
                            ...defaultTemplate,
                            title: preferred.title || defaultTemplate.title,
                            ...preferred.template
                        });
                        setEditingId(preferred.id);
                    } else if (!templateList.length && userData?.letterheadTemplate) {
                        setForm({
                            ...defaultTemplate,
                            title: defaultTemplate.title,
                            ...userData.letterheadTemplate
                        });
                        setEditingId(null);
                    }
                    setFormInitialized(true);
                }
            } catch (error) {
                console.error('Error loading templates:', error);
            } finally {
                setLoading(false);
            }
        };

        loadTemplates();
    }, [currentUser, formInitialized]);

    const formatDate = (timestamp) => {
        if (!timestamp) return '-';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('mn-MN', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setStatus('');
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const buildTemplatePayload = () => ({
        title: form.title?.trim() || defaultTemplate.title,
        template: {
            orgName: form.orgName,
            orgTagline: form.orgTagline,
            address: form.address,
            phone: form.phone,
            email: form.email,
            web: form.web,
            signPosition: form.signPosition,
            signName: form.signName,
            fontFamily: form.fontFamily
        }
    });

    const handleSave = async () => {
        if (!currentUser) return;
        setSaving(true);
        setStatus('');
        try {
            const payload = buildTemplatePayload();
            if (editingId) {
                await updateDoc(doc(db, 'letterheadTemplates', editingId), {
                    ...payload,
                    updatedAt: serverTimestamp()
                });
            } else {
                const docRef = await addDoc(collection(db, 'letterheadTemplates'), {
                    ...payload,
                    userId: currentUser.uid,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                setEditingId(docRef.id);
            }
            setStatus('saved');
            setFormInitialized(false);
        } catch (error) {
            console.error('Error saving template:', error);
            setStatus('error');
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (templateItem) => {
        setEditingId(templateItem.id);
        setStatus('');
        setForm({
            ...defaultTemplate,
            title: templateItem.title || defaultTemplate.title,
            ...templateItem.template
        });
    };

    const handleNew = () => {
        setEditingId(null);
        setStatus('');
        setForm(defaultTemplate);
    };


    if (!canUseTemplates) {
        return (
            <div className="templates-page">
                <div className="templates-container">
                    <div className="templates-header">
                        <div>
                            <h1>Загварын сан (Subscriber)</h1>
                            <p>Албан бичгийн загваруудыг хадгалах боломж зөвхөн subscriber хэрэглэгчдэд нээлттэй.</p>
                        </div>
                        <Link to="/profile" className="templates-back">
                            <ArrowLeft size={18} />
                            Профайл руу буцах
                        </Link>
                    </div>
                    <div className="templates-card" style={{ padding: '2rem', textAlign: 'center' }}>
                        <p style={{ marginBottom: '1rem' }}>Та subscription идэвхжүүлснээр templates ашиглах боломжтой.</p>
                        <Link to="/profile" className="templates-back">
                            Subscription‑ээ шалгах
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="templates-loading">
                <div className="spinner"></div>
                <p>Уншиж байна...</p>
            </div>
        );
    }

    return (
        <div className="templates-page">
            <div className="templates-container">
                <div className="templates-header">
                    <div>
                        <h1>Миний хадгалсан албан бичгийн загварууд</h1>
                        <p>Өөрийн албан бичгийн загваруудыг хадгалах, сонгох, засах</p>
                    </div>
                    <Link to="/profile" className="templates-back">
                        <ArrowLeft size={18} />
                        Профайл руу буцах
                    </Link>
                </div>

                <div className="templates-content">
                    <div className="templates-card">
                        <div className="templates-card-header">
                            <FileText size={18} />
                            Загварын мэдээлэл
                        </div>
                        <div className="templates-card-body">
                            <div className="templates-form-grid">
                                <div className="templates-input">
                                    <label>Загварын нэр</label>
                                    <input name="title" value={form.title} onChange={handleChange} />
                                </div>
                                <div className="templates-input">
                                    <label>Байгууллагын нэр</label>
                                    <input name="orgName" value={form.orgName} onChange={handleChange} />
                                </div>
                                <div className="templates-input">
                                    <label>Үйл ажиллагааны чиглэл</label>
                                    <input name="orgTagline" value={form.orgTagline} onChange={handleChange} />
                                </div>
                                <div className="templates-input templates-input--full">
                                    <label>Хаяг</label>
                                    <textarea name="address" rows={2} value={form.address} onChange={handleChange} />
                                </div>
                                <div className="templates-input">
                                    <label>Утас</label>
                                    <input name="phone" value={form.phone} onChange={handleChange} />
                                </div>
                                <div className="templates-input">
                                    <label>И-мэйл</label>
                                    <input name="email" value={form.email} onChange={handleChange} />
                                </div>
                                <div className="templates-input">
                                    <label>Вэб</label>
                                    <input name="web" value={form.web} onChange={handleChange} />
                                </div>
                                <div className="templates-input">
                                    <label>Гарын үсэг (албан тушаал)</label>
                                    <input name="signPosition" value={form.signPosition} onChange={handleChange} />
                                </div>
                                <div className="templates-input">
                                    <label>Гарын үсэг (нэр)</label>
                                    <input name="signName" value={form.signName} onChange={handleChange} />
                                </div>
                                <div className="templates-input">
                                    <label>Фонт</label>
                                    <select name="fontFamily" value={form.fontFamily} onChange={handleChange}>
                                        <option value="Times New Roman">Times New Roman</option>
                                        <option value="Arial">Arial</option>
                                    </select>
                                </div>
                            </div>
                            <div className="templates-actions">
                                <button className="templates-save" onClick={handleSave} disabled={saving}>
                                    {saving ? 'Хадгалж байна...' : (
                                        <>
                                            <Save size={16} />
                                            Загвар хадгалах
                                        </>
                                    )}
                                </button>
                                <button className="templates-new" onClick={handleNew} type="button">
                                    <Plus size={16} />
                                    Шинэ загвар
                                </button>
                                {status === 'saved' && (
                                    <span className="templates-status success">
                                        <CheckCircle2 size={14} />
                                        Амжилттай хадгаллаа
                                    </span>
                                )}
                                {status === 'error' && (
                                    <span className="templates-status error">Хадгалах үед алдаа гарлаа</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="templates-card">
                        <div className="templates-card-header">
                            <FileText size={18} />
                            Хадгалсан загварууд
                        </div>
                        <div className="templates-card-body">
                            {templates.length === 0 ? (
                                <div className="templates-empty">
                                    <p>Одоогоор хадгалсан загвар алга байна.</p>
                                </div>
                            ) : (
                                <div className="templates-list">
                                    {templates.map((templateItem) => (
                                        <div
                                            key={templateItem.id}
                                            className="templates-item"
                                        >
                                            <div className="templates-item-header">
                                                <div>
                                                    <div className="templates-item-title">{templateItem.title || 'Нэргүй загвар'}</div>
                                                    <div className="templates-item-meta">
                                                        Сүүлд шинэчилсэн: {formatDate(templateItem.updatedAt || templateItem.createdAt)}
                                                    </div>
                                                </div>
                                            </div>
                                        <div className="templates-item-actions">
                                            <button onClick={() => handleEdit(templateItem)} type="button">
                                                Засах
                                            </button>
                                            <Link
                                                to={`/ai-assistant/official-letterhead?templateId=${templateItem.id}`}
                                                className="primary"
                                            >
                                                Албан бичиг үүсгэх
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LetterheadTemplates;
