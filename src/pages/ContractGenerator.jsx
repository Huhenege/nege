import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { Download, FileText, ArrowLeft, ChevronRight, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import ToolHeader from '../components/ToolHeader';
import './ContractGenerator.css';

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

const LEGAL_FRAMEWORK_LABELS = {
    mongolia: 'Монгол Улсын хууль',
    international: 'International / common law',
    mixed: 'Холимог орчин',
};

const normalizeArray = (value) => Array.isArray(value) ? value.filter(Boolean) : [];

const normalizeTemplateMeta = (rawMeta) => {
    const source = rawMeta && typeof rawMeta === 'object' ? rawMeta : {};
    return {
        identification: {
            contractType: source?.identification?.contractType || '',
            shortDescription: source?.identification?.shortDescription || '',
            useCases: normalizeArray(source?.identification?.useCases),
            version: source?.identification?.version || '',
            language: source?.identification?.language || '',
        },
        legal: {
            draftingOrganization: source?.legal?.draftingOrganization || '',
            lawFirmName: source?.legal?.lawFirmName || '',
            reviewedLawyerName: source?.legal?.reviewedLawyerName || '',
            reviewedLawyerSpecialty: source?.legal?.reviewedLawyerSpecialty || '',
            verifiedDate: source?.legal?.verifiedDate || '',
            legalFramework: source?.legal?.legalFramework || '',
            liabilityDisclaimer: source?.legal?.liabilityDisclaimer || '',
        },
        usage: {
            useConditions: source?.usage?.useConditions || '',
            intendedFor: normalizeArray(source?.usage?.intendedFor),
            cautions: source?.usage?.cautions || '',
            customizeRequiredSections: source?.usage?.customizeRequiredSections || '',
            notForConditions: source?.usage?.notForConditions || '',
        },
        structure: {
            sectionList: source?.structure?.sectionList || '',
            mandatoryClauses: source?.structure?.mandatoryClauses || '',
            optionalClauses: source?.structure?.optionalClauses || '',
        },
    };
};

const splitLines = (value) => String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);

const ContractGenerator = () => {
    const { templateId } = useParams();
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({});
    const [generating, setGenerating] = useState(false);
    const previewRef = useRef(null);

    // Fetch all templates for the list view
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const q = query(collection(db, 'contractTemplates'), orderBy('createdAt', 'desc'));
                const querySnapshot = await getDocs(q);
                const list = [];
                querySnapshot.forEach((doc) => {
                    list.push({ id: doc.id, ...doc.data() });
                });
                setTemplates(list);
            } catch (error) {
                console.error("Error fetching templates:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTemplates();
    }, []);

    // Fetch specific template if ID is present
    useEffect(() => {
        if (templateId) {
            const fetchTemplate = async () => {
                try {
                    const docRef = doc(db, 'contractTemplates', templateId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setSelectedTemplate({ id: docSnap.id, ...data });
                        // Initialize form data
                        const initialData = {};
                        if (data.variables) {
                            data.variables.forEach(v => {
                                initialData[v.key] = '';
                            });
                        }
                        setFormData(initialData);
                    } else {
                        alert('Template not found');
                        navigate('/ai-assistant/contract-generator');
                    }
                } catch (error) {
                    console.error("Error fetching template:", error);
                }
            };
            fetchTemplate();
        } else {
            setSelectedTemplate(null);
        }
    }, [templateId, navigate]);

    const handleInputChange = (key, value) => {
        setFormData(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const formatValue = (value, format) => {
        if (!value) return value;

        switch (format) {
            case 'currency':
                const num = Number(value.toString().replace(/[^0-9.-]+/g, ""));
                return new Intl.NumberFormat('en-US').format(num) + '₮';
            case 'integer':
                return parseInt(value.toString().replace(/[^0-9.-]+/g, "")).toString();
            case 'long':
                try {
                    const date = new Date(value);
                    if (isNaN(date.getTime())) return value;
                    return `${date.getFullYear()} оны ${date.getMonth() + 1}-р сарын ${date.getDate()}-ны өдөр`;
                } catch (e) {
                    return value;
                }
            default:
                return value;
        }
    };

    const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const getPreviewContent = () => {
        if (!selectedTemplate) return '';
        let content = selectedTemplate.content;

        // Replace all variables
        if (selectedTemplate.variables) {
            selectedTemplate.variables.forEach(v => {
                let value = formData[v.key];

                if (value && v.format) {
                    value = formatValue(value, v.format);
                }

                const displayValue = value || `<span class="variable-placeholder">[${v.label || v.key}]</span>`;
                // Global replace with optional spaces inside {{ ... }}
                const escapedKey = escapeRegex(v.key);
                const regex = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g');
                content = content.replace(regex, displayValue);
            });
        }

        // Render HTML
        return <div className="prose-content" dangerouslySetInnerHTML={{ __html: content }} />;
    };

    const handleDownload = () => {
        setGenerating(true);
        const element = previewRef.current;
        const opt = {
            margin: [20, 20, 20, 20], // top, left, bottom, right
            filename: `${selectedTemplate.title || 'Contract'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save().then(() => {
            setGenerating(false);
        }).catch((err) => {
            console.error("PDF generation failed:", err);
            setGenerating(false);
            alert('PDF үүсгэхэд алдаа гарлаа.');
        });
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <Loader2 className="animate-spin text-blue-600" size={32} />
            </div>
        );
    }

    // LIST VIEW
    if (!templateId) {
        return (
            <div className="page-container">
                <ToolHeader
                    title="Гэрээ үүсгэгч"
                    subtitle="Бэлэн загвар ашиглан гэрээгээ хялбархан бүрдүүлээрэй"
                />

                <div className="container mx-auto px-4 py-8">
                    {templates.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">Одоогоор загвар байхгүй байна</h3>
                            <p className="mt-1 text-sm text-gray-500">Админ хэсгээс загвар нэмнэ үү.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                            {templates.map((template) => {
                                const meta = normalizeTemplateMeta(template.templateMeta || template.meta);
                                const contractType = CONTRACT_TYPE_LABELS[meta.identification.contractType] || 'Төрөл заагаагүй';
                                const language = LANGUAGE_LABELS[meta.identification.language] || '-';
                                const version = meta.identification.version || '-';
                                const summary = meta.identification.shortDescription || (template.content ? template.content.substring(0, 100) + '...' : 'Тайлбар байхгүй');

                                return (
                                    <Link
                                        key={template.id}
                                        to={`/ai-assistant/contract-generator/${template.id}`}
                                        style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                                    >
                                        <div style={{
                                            backgroundColor: 'white',
                                            borderRadius: '0.75rem',
                                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                                            border: '1px solid #e5e7eb',
                                            padding: '1.5rem',
                                            height: '100%',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            transition: 'box-shadow 0.2s'
                                        }}
                                            className="hover:shadow-md"
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                                <span style={{ padding: '0.5rem', backgroundColor: '#eff6ff', color: '#2563eb', borderRadius: '0.5rem' }}>
                                                    <FileText size={20} />
                                                </span>
                                                {template.category && (
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '0.25rem 0.5rem', backgroundColor: '#f3f4f6', color: '#4b5563', borderRadius: '9999px' }}>
                                                        {template.category}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}>
                                                {template.title}
                                            </h3>
                                            <div className="cg-template-badges">
                                                <span>{contractType}</span>
                                                <span>{language}</span>
                                                <span>{version}</span>
                                            </div>
                                            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', marginTop: '0.6rem', flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                                {summary}
                                            </p>
                                            <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.875rem', color: '#2563eb', fontWeight: 500 }}>
                                                Гэрээг үүсгэх
                                                <ChevronRight size={16} style={{ marginLeft: '0.25rem' }} />
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // GENERATOR VIEW
    if (!selectedTemplate) return null;
    const selectedMeta = normalizeTemplateMeta(selectedTemplate.templateMeta || selectedTemplate.meta);
    const selectedUseCases = selectedMeta.identification.useCases.join(', ');
    const selectedAudience = selectedMeta.usage.intendedFor.join(', ');
    const selectedSectionList = splitLines(selectedMeta.structure.sectionList);

    return (
        <div className="cg-page">
            {/* Header */}
            <div className="cg-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Link
                        to="/ai-assistant/contract-generator"
                        style={{ padding: '0.5rem', borderRadius: '9999px', color: '#6b7280', display: 'flex' }}
                        title="Жагсаалт руу буцах"
                    >
                        <ArrowLeft size={22} />
                    </Link>
                    <div>
                        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', lineHeight: 1.25 }}>{selectedTemplate.title}</h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#6b7280', marginTop: '0.125rem' }}>
                            <FileText size={14} />
                            <span>Гэрээ үүсгэгч</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleDownload}
                    disabled={generating}
                    className="cg-btn"
                >
                    {generating ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                    <span className="hidden sm:inline">Татах (PDF)</span>
                </button>
            </div>

            {/* Main Content Area */}
            <div className="cg-content">
                {/* Left: Input Sidebar */}
                <div className="cg-sidebar">
                    <div className="cg-sidebar-header">
                        <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Sparkles size={16} color="#2563eb" />
                            Мэдээлэл оруулах
                        </h2>
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            Доорх талбаруудыг бөглөнө үү.
                        </p>
                    </div>

                    <div className="cg-sidebar-body">
                        <section className="cg-meta-card">
                            <h3 className="cg-meta-card-title">Загварын дэлгэрэнгүй</h3>

                            {selectedMeta.identification.shortDescription && (
                                <p className="cg-meta-summary">{selectedMeta.identification.shortDescription}</p>
                            )}

                            <div className="cg-meta-badges">
                                <span>{CONTRACT_TYPE_LABELS[selectedMeta.identification.contractType] || 'Төрөл заагаагүй'}</span>
                                <span>{LANGUAGE_LABELS[selectedMeta.identification.language] || 'Хэл заагаагүй'}</span>
                                <span>{selectedMeta.identification.version || 'Хувилбар заагаагүй'}</span>
                            </div>

                            <dl className="cg-meta-list">
                                <dt>Ашиглах кейс</dt>
                                <dd>{selectedUseCases || '-'}</dd>

                                <dt>Зориулалт</dt>
                                <dd>{selectedAudience || '-'}</dd>

                                <dt>Хуульч</dt>
                                <dd>{selectedMeta.legal.reviewedLawyerName || '-'}</dd>

                                <dt>Хуулийн орчин</dt>
                                <dd>{LEGAL_FRAMEWORK_LABELS[selectedMeta.legal.legalFramework] || '-'}</dd>

                                <dt>Баталгаажсан огноо</dt>
                                <dd>{selectedMeta.legal.verifiedDate || '-'}</dd>
                            </dl>

                            {selectedMeta.usage.cautions && (
                                <div className="cg-meta-note">
                                    <strong>Анхаарах:</strong> {selectedMeta.usage.cautions}
                                </div>
                            )}

                            {selectedMeta.usage.notForConditions && (
                                <div className="cg-meta-note">
                                    <strong>Хэрэглэхгүй:</strong> {selectedMeta.usage.notForConditions}
                                </div>
                            )}

                            {selectedSectionList.length > 0 && (
                                <div className="cg-meta-structure">
                                    <strong>Гол бүлгүүд</strong>
                                    <ul>
                                        {selectedSectionList.map((sectionName) => (
                                            <li key={sectionName}>{sectionName}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {selectedMeta.legal.liabilityDisclaimer && (
                                <p className="cg-meta-disclaimer">{selectedMeta.legal.liabilityDisclaimer}</p>
                            )}
                        </section>

                        {selectedTemplate.variables && selectedTemplate.variables.map((v) => (
                            <div key={v.key} className="cg-input-group">
                                <label className="cg-label">
                                    {v.label || v.key}
                                </label>

                                {v.type === 'textarea' ? (
                                    <textarea
                                        className="cg-textarea"
                                        value={formData[v.key] || ''}
                                        onChange={(e) => handleInputChange(v.key, e.target.value)}
                                        placeholder={`Утга оруулах...`}
                                    />
                                ) : v.type === 'select' ? (
                                    <select
                                        className="cg-input"
                                        value={formData[v.key] || ''}
                                        onChange={(e) => handleInputChange(v.key, e.target.value)}
                                    >
                                        <option value="">Сонгох...</option>
                                        {(v.options || '').split(',').map(opt => (
                                            <option key={opt.trim()} value={opt.trim()}>
                                                {opt.trim()}
                                            </option>
                                        ))}
                                    </select>
                                ) : v.type === 'radio' ? (
                                    <div className="flex flex-col gap-2 mt-1">
                                        {(v.options || '').split(',').map(opt => (
                                            <label key={opt.trim()} className="flex items-center gap-2 text-sm cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name={v.key}
                                                    value={opt.trim()}
                                                    checked={formData[v.key] === opt.trim()}
                                                    onChange={(e) => handleInputChange(v.key, e.target.value)}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                                />
                                                <span className="text-gray-700">{opt.trim()}</span>
                                            </label>
                                        ))}
                                    </div>
                                ) : (
                                    <input
                                        type={v.type === 'date' ? 'date' : v.type === 'number' ? 'number' : 'text'}
                                        className="cg-input"
                                        value={formData[v.key] || ''}
                                        onChange={(e) => handleInputChange(v.key, e.target.value)}
                                        placeholder={v.type === 'number' ? '0' : `Утга оруулах...`}
                                    />
                                )}
                            </div>
                        ))}

                        {(!selectedTemplate.variables || selectedTemplate.variables.length === 0) && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2.5rem 0', color: '#9ca3af' }}>
                                <FileText size={48} strokeWidth={1} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                                <p style={{ fontSize: '0.875rem', fontWeight: 500 }}>Энэ загварт бөглөх талбар байхгүй байна.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Document Preview */}
                <div className="cg-preview">
                    <div className="cg-paper-container">
                        <div
                            className="cg-paper"
                            ref={previewRef}
                            style={{
                                fontFamily: '"Times New Roman", serif',
                                fontSize: '12pt',
                                lineHeight: '1.6',
                                color: '#1a1a1a',
                            }}
                        >
                            {/* Document Content */}
                            {getPreviewContent()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContractGenerator;
