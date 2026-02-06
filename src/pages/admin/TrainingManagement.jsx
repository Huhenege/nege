import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Plus, Edit2, Trash2, X, Check, Save, GraduationCap, Clock, DollarSign, User } from 'lucide-react';

const TrainingManagement = () => {
    const [trainings, setTrainings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        teacherName: '',
        teacherBio: '',
        price: '',
        duration: '',
        active: true,
        imageUrl: ''
    });

    const fetchTrainings = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "trainings"), orderBy("createdAt", "desc"));
            const querySnapshot = await getDocs(q);
            const data = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTrainings(data);
        } catch (error) {
            console.error("Error fetching trainings:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrainings();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const data = {
                ...formData,
                price: Number(formData.price),
                updatedAt: serverTimestamp()
            };

            if (editingId) {
                await updateDoc(doc(db, "trainings", editingId), data);
            } else {
                await addDoc(collection(db, "trainings"), {
                    ...data,
                    createdAt: serverTimestamp()
                });
            }

            setIsModalOpen(false);
            setEditingId(null);
            setFormData({
                title: '',
                description: '',
                teacherName: '',
                teacherBio: '',
                price: '',
                duration: '',
                active: true,
                imageUrl: ''
            });
            fetchTrainings();
        } catch (error) {
            console.error("Error saving training:", error);
            alert("Хадгалахад алдаа гарлаа.");
        }
    };

    const handleEdit = (training) => {
        setEditingId(training.id);
        setFormData({
            title: training.title,
            description: training.description,
            teacherName: training.teacherName,
            teacherBio: training.teacherBio,
            price: training.price,
            duration: training.duration,
            active: training.active,
            imageUrl: training.imageUrl || ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Устгахдаа итгэлтэй байна уу?")) return;
        try {
            await deleteDoc(doc(db, "trainings", id));
            fetchTrainings();
        } catch (error) {
            console.error("Error deleting training:", error);
        }
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid #e2e8f0', borderTopColor: '#4f46e5', borderRadius: '50%' }}></div>
        </div>
    );

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: '#1e293b', marginBottom: '0.5rem' }}>
                        Сургалтын удирдлага
                    </h1>
                    <p style={{ color: '#64748b' }}>Шинэ сургалт нэмэх болон засах</p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setFormData({ title: '', description: '', teacherName: '', teacherBio: '', price: '', duration: '', active: true, imageUrl: '' });
                        setIsModalOpen(true);
                    }}
                    style={{
                        backgroundColor: '#4f46e5',
                        color: 'white',
                        border: 'none',
                        padding: '0.75rem 1.5rem',
                        borderRadius: '10px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        cursor: 'pointer',
                        transition: 'opacity 0.2s'
                    }}
                >
                    <Plus size={20} /> Сургалт нэмэх
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {trainings.map(item => (
                    <div key={item.id} style={{ backgroundColor: 'white', border: '1px solid #f1f5f9', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <div style={{ height: '180px', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
                            {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1' }}>
                                    <GraduationCap size={64} />
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#1e293b' }}>{item.title}</h3>
                                <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '0.7rem',
                                    fontWeight: '700',
                                    backgroundColor: item.active ? '#ecfdf5' : '#fef2f2',
                                    color: item.active ? '#059669' : '#dc2626'
                                }}>
                                    {item.active ? 'Идэвхтэй' : 'Идэвхгүй'}
                                </span>
                            </div>
                            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {item.description}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#1e293b', fontWeight: '600' }}>
                                    <DollarSign size={16} color="#10b981" />
                                    <span>{Number(item.price).toLocaleString()}₮</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                                    <Clock size={16} />
                                    <span>{item.duration}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                                <button onClick={() => handleEdit(item)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b', backgroundColor: 'white', cursor: 'pointer' }}>
                                    <Edit2 size={18} />
                                </button>
                                <button onClick={() => handleDelete(item.id)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid #fee2e2', color: '#dc2626', backgroundColor: '#fef2f2', cursor: 'pointer' }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit/Add Modal */}
            {isModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '1rem' }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '20px', width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#1e293b' }}>
                                {editingId ? 'Сургалт засах' : 'Шинэ сургалт нэмэх'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>Гарчиг</label>
                                    <input
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>Тайлбар</label>
                                    <textarea
                                        required
                                        rows={4}
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', resize: 'vertical' }}
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>Үнэ (₮)</label>
                                        <input
                                            required
                                            type="number"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>Хугацаа</label>
                                        <input
                                            required
                                            placeholder="жнь: 2 цаг, 3 өдөр"
                                            value={formData.duration}
                                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>Багшийн нэр</label>
                                        <input
                                            required
                                            value={formData.teacherName}
                                            onChange={(e) => setFormData({ ...formData, teacherName: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>Зураг URL (сонголттой)</label>
                                        <input
                                            value={formData.imageUrl}
                                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#64748b', marginBottom: '0.5rem' }}>Багшийн танилцуулга</label>
                                    <textarea
                                        rows={2}
                                        value={formData.teacherBio}
                                        onChange={(e) => setFormData({ ...formData, teacherBio: e.target.value })}
                                        style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', resize: 'vertical' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        id="active"
                                        checked={formData.active}
                                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                    />
                                    <label htmlFor="active" style={{ fontSize: '0.875rem', fontWeight: '600', color: '#334155', cursor: 'pointer' }}>Идэвхтэй (Хэрэглэгчдэд харагдана)</label>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: 'white', color: '#64748b', fontWeight: '600', cursor: 'pointer' }}
                                >
                                    Болих
                                </button>
                                <button
                                    type="submit"
                                    style={{ padding: '0.75rem 2rem', borderRadius: '10px', border: 'none', backgroundColor: '#4f46e5', color: 'white', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                >
                                    <Save size={18} />
                                    {editingId ? 'Шинэчлэх' : 'Хадгалах'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainingManagement;
