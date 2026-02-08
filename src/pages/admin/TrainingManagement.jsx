import React, { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, getDocs, doc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { Plus, Edit2, Trash2, GraduationCap, Clock, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TrainingManagement = () => {
    const [trainings, setTrainings] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

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

    const handleDelete = async (id) => {
        if (!window.confirm("Устгахдаа итгэлтэй байна уу?")) return;
        try {
            await deleteDoc(doc(db, "trainings", id));
            fetchTrainings();
        } catch (error) {
            console.error("Error deleting training:", error);
        }
    };

    const formatDuration = (value) => {
        if (!value) return value;
        return value.replace(/\b(hours|hour|hrs|hr)\b/gi, 'цаг');
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
            <div className="animate-spin" style={{ width: '30px', height: '30px', border: '3px solid var(--ink-200)', borderTopColor: '#e11d48', borderRadius: '50%' }}></div>
        </div>
    );

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: '800', color: 'var(--ink-900)', marginBottom: '0.5rem' }}>
                        Сургалтын удирдлага
                    </h1>
                    <p style={{ color: 'var(--ink-500)' }}>Шинэ сургалт нэмэх болон засах</p>
                </div>
                <button
                    onClick={() => navigate('/admin/trainings/new')}
                    style={{
                        backgroundColor: '#e11d48',
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
                    <div key={item.id} style={{ backgroundColor: 'white', border: '1px solid var(--ink-100)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <div style={{ height: '180px', backgroundColor: 'var(--ink-50)', overflow: 'hidden' }}>
                            {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-300)' }}>
                                    <GraduationCap size={64} />
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--ink-900)' }}>{item.title}</h3>
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
                            <p style={{ color: 'var(--ink-500)', fontSize: '0.9rem', marginBottom: '1.5rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {item.description}
                            </p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ink-900)', fontWeight: '600' }}>
                                    <DollarSign size={16} color="#16a34a" />
                                    <span>{(item.isFree || Number(item.price || 0) === 0) ? 'Үнэгүй' : `${Number(item.price).toLocaleString()}₮`}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ink-500)' }}>
                                    <Clock size={16} />
                                    <span>{formatDuration(item.duration)}</span>
                                </div>
                            </div>
                            {!(item.isFree || Number(item.price || 0) === 0) && Number(item.advanceAmount || 0) > 0 && Number(item.advanceAmount) < Number(item.price || 0) && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--ink-500)', marginBottom: '1rem' }}>
                                    Урьдчилгаа: <strong style={{ color: 'var(--ink-900)' }}>₮{Number(item.advanceAmount).toLocaleString()}</strong> ·
                                    Үлдэгдэл: <strong style={{ color: 'var(--ink-900)' }}>₮{Number(item.remainingAmount || (item.price - item.advanceAmount)).toLocaleString()}</strong>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--ink-100)' }}>
                                <button onClick={() => navigate(`/admin/trainings/${item.id}`)} style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--ink-200)', color: 'var(--ink-500)', backgroundColor: 'white', cursor: 'pointer' }}>
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
        </div>
    );
};

export default TrainingManagement;
