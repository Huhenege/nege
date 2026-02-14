import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../lib/firebase'; // Adjust path if needed
import { collection, query, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Plus, Edit, Trash2, FileText, Search, Loader2 } from 'lucide-react';
import './AdminDashboard.css'; // Reusing admin styles

const CONTRACT_TYPE_LABELS = {
    nda: 'NDA',
    employment: 'Employment',
    serviceAgreement: 'Service Agreement',
    salesSupply: 'Sales / Supply',
    lease: 'Lease',
    other: 'Бусад',
};

const LANGUAGE_LABELS = {
    mn: 'MN',
    en: 'EN',
    bilingual: 'Bilingual',
};

const normalizeTemplateMeta = (rawMeta) => {
    const source = rawMeta && typeof rawMeta === 'object' ? rawMeta : {};
    return {
        identification: {
            contractType: source?.identification?.contractType || '',
            language: source?.identification?.language || '',
            version: source?.identification?.version || '',
            shortDescription: source?.identification?.shortDescription || '',
            useCases: Array.isArray(source?.identification?.useCases) ? source.identification.useCases : [],
        },
        legal: {
            reviewedLawyerName: source?.legal?.reviewedLawyerName || '',
        },
    };
};

const ContractTemplates = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'contractTemplates'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const list = [];
            querySnapshot.forEach((doc) => {
                list.push({ id: doc.id, ...doc.data() });
            });
            setTemplates(list);
        } catch (error) {
            console.error("Error fetching templates: ", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Та энэ загварыг устгахдаа итгэлтэй байна уу?')) {
            try {
                await deleteDoc(doc(db, 'contractTemplates', id));
                setTemplates(templates.filter(t => t.id !== id));
            } catch (error) {
                console.error("Error deleting template: ", error);
                alert('Устгахад алдаа гарлаа');
            }
        }
    };

    const filteredTemplates = templates.filter((template) => {
        const meta = normalizeTemplateMeta(template.templateMeta || template.meta);
        const searchable = [
            template.title,
            template.category,
            meta.identification.shortDescription,
            meta.identification.version,
            CONTRACT_TYPE_LABELS[meta.identification.contractType] || meta.identification.contractType,
            LANGUAGE_LABELS[meta.identification.language] || meta.identification.language,
            ...(meta.identification.useCases || []),
            meta.legal.reviewedLawyerName,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return searchable.includes(searchTerm.toLowerCase());
    });

    return (
        <div className="admin-page">
            <header className="admin-header">
                <div>
                    <h1>Гэрээний загварууд</h1>
                    <p>Системийн гэрээний загваруудыг удирдах</p>
                </div>
                <Link to="/admin/contracts/new" className="admin-btn-primary">
                    <Plus size={18} />
                    Шинэ загвар үүсгэх
                </Link>
            </header>

            <div className="admin-content-card">
                <div className="admin-toolbar">
                    <div className="search-box">
                        <Search size={18} />
                        <input
                            type="text"
                            placeholder="Хайх..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Loader2 className="spinner" />
                        <span>Уншиж байна...</span>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Нэр</th>
                                    <th>Төрөл</th>
                                    <th>Хэл / Хувилбар</th>
                                    <th>Хувьсагчид</th>
                                    <th>Хянасан хуульч</th>
                                    <th>Үүсгэсэн</th>
                                    <th>Үйлдэл</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTemplates.length > 0 ? (
                                    filteredTemplates.map((template) => {
                                        const meta = normalizeTemplateMeta(template.templateMeta || template.meta);
                                        const contractTypeLabel = CONTRACT_TYPE_LABELS[meta.identification.contractType] || 'Тодорхойгүй';
                                        const languageLabel = LANGUAGE_LABELS[meta.identification.language] || '-';
                                        const versionLabel = meta.identification.version || '-';
                                        const useCases = meta.identification.useCases.length > 0
                                            ? meta.identification.useCases.join(', ')
                                            : 'Кейс заагаагүй';
                                        return (
                                            <tr key={template.id}>
                                            <td>
                                                <div className="item-with-icon">
                                                    <FileText size={18} className="text-muted" />
                                                    <div>
                                                        <strong>{template.title}</strong>
                                                        <div className="text-muted text-sm" style={{ marginTop: '0.18rem' }}>
                                                            {meta.identification.shortDescription || useCases}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge badge-blue">{contractTypeLabel}</span>
                                            </td>
                                            <td>
                                                <span className="text-muted">{languageLabel} / {versionLabel}</span>
                                            </td>
                                            <td>
                                                {template.variables ? template.variables.length : 0}
                                            </td>
                                            <td>
                                                {meta.legal.reviewedLawyerName || '-'}
                                            </td>
                                            <td>
                                                {template.createdAt?.toDate ? new Date(template.createdAt.toDate()).toLocaleDateString() : '-'}
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <Link to={`/admin/contracts/${template.id}`} className="btn-icon" title="Засах">
                                                        <Edit size={18} />
                                                    </Link>
                                                    <button onClick={() => handleDelete(template.id)} className="btn-icon danger" title="Устгах">
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="text-center py-8 text-muted">
                                            Загвар олдсонгүй
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContractTemplates;
