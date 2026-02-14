import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Save, Info, Sparkles } from 'lucide-react';
import RichTextEditor from '../../components/RichTextEditor';
import { apiFetch } from '../../lib/apiClient';
import './AdminDashboard.css';
import './ContractTemplateEditor.css';

const FIXED_PAGE_SIZE = 'A4';
const FIXED_PAGE_ORIENTATION = 'portrait';
const DEFAULT_DISCLAIMER = 'Энэхүү загвар нь зөвхөн жишиг зориулалттай. Тухайн кейс бүр дээр мэргэжлийн хуульчаас зөвлөгөө авч ашиглана уу.';

const CONTRACT_TYPE_OPTIONS = [
    { value: 'nda', label: 'NDA' },
    { value: 'employment', label: 'Employment' },
    { value: 'serviceAgreement', label: 'Service Agreement' },
    { value: 'salesSupply', label: 'Sales / Supply' },
    { value: 'lease', label: 'Lease' },
    { value: 'other', label: 'Бусад' },
];

const USE_CASE_OPTIONS = [
    'HR',
    'Procurement',
    'Vendor',
    'Healthcare',
    'Finance',
    'IT',
];

const LANGUAGE_OPTIONS = [
    { value: 'mn', label: 'MN' },
    { value: 'en', label: 'EN' },
    { value: 'bilingual', label: 'Bilingual' },
];

const LEGAL_FRAMEWORK_OPTIONS = [
    { value: 'mongolia', label: 'Монгол Улсын хууль' },
    { value: 'international', label: 'International / common law' },
    { value: 'mixed', label: 'Холимог (MN + International)' },
];

const AUDIENCE_OPTIONS = [
    'SME',
    'Startup',
    'Corporate',
];

const normalizeArray = (value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean)));
};

const createDefaultTemplateMeta = () => ({
    identification: {
        contractType: 'serviceAgreement',
        shortDescription: '',
        useCases: [],
        version: 'v1.0',
        language: 'mn',
    },
    legal: {
        draftingOrganization: '',
        lawFirmName: '',
        reviewedLawyerName: '',
        reviewedLawyerSpecialty: '',
        verifiedDate: '',
        legalFramework: 'mongolia',
        liabilityDisclaimer: DEFAULT_DISCLAIMER,
    },
    usage: {
        useConditions: '',
        intendedFor: [],
        cautions: '',
        customizeRequiredSections: '',
        notForConditions: '',
    },
    structure: {
        sectionList: 'Parties\nScope\nTerm\nPayment\nLiability\nTermination',
        mandatoryClauses: '',
        optionalClauses: '',
    },
});

const normalizeTemplateMeta = (rawMeta) => {
    const defaults = createDefaultTemplateMeta();
    const source = rawMeta && typeof rawMeta === 'object' ? rawMeta : {};
    return {
        identification: {
            ...defaults.identification,
            ...(source.identification || {}),
            useCases: normalizeArray(source?.identification?.useCases),
        },
        legal: {
            ...defaults.legal,
            ...(source.legal || {}),
        },
        usage: {
            ...defaults.usage,
            ...(source.usage || {}),
            intendedFor: normalizeArray(source?.usage?.intendedFor),
        },
        structure: {
            ...defaults.structure,
            ...(source.structure || {}),
        },
    };
};

const ContractTemplateEditor = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isNew = !id;

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
    const [aiNotes, setAiNotes] = useState([]);

    // Form State
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [content, setContent] = useState('');
    const [templateMeta, setTemplateMeta] = useState(createDefaultTemplateMeta());

    // Variables state: { key: 'firstName', label: 'Нэр', type: 'text' }
    const [variables, setVariables] = useState([]);

    useEffect(() => {
        if (!isNew && id) {
            fetchTemplate(id);
        }
    }, [id, isNew]);

    // Parse variables from content whenever it changes
    useEffect(() => {
        extractVariables(content);
    }, [content]);

    const fetchTemplate = async (templateId) => {
        try {
            const docRef = doc(db, 'contractTemplates', templateId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setTitle(data.title || '');
                setCategory(data.category || '');
                setContent(data.content || '');
                setTemplateMeta(normalizeTemplateMeta(data.templateMeta || data.meta));
                // Merge loaded variables with extracted ones to keep labels/types
                // specific implementation handled in extractVariables if we want to retain configs
                // simpler: just load saved config if it matches, otherwise use defaults

                // For now, let's load saved variables to preserve their config (labels/types)
                if (data.variables) {
                    // We'll update the state, but we also need to respect current content
                    // Actually, let's just use what's saved, and let extractVariables handle updates
                    // But extractVariables runs on mount due to content change, so we need to be careful not to overwrite
                }
                // We will rely on extractVariables to merge saved config with current text
                // So we need to store saved config temporarily
                setSavedVariableConfig(data.variables || []);
            } else {
                alert('Template not found');
                navigate('/admin/contracts');
            }
        } catch (error) {
            console.error("Error fetching template:", error);
        } finally {
            setLoading(false);
        }
    };

    const [savedVariableConfig, setSavedVariableConfig] = useState([]);

    const extractVariables = (text) => {
        const regex = /\{\{([^}]+)\}\}/g;
        const found = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            found.push(match[1].trim());
        }

        // Remove duplicates
        const uniqueKeys = [...new Set(found)];

        setVariables(prevVars => {
            // merge with existing state and saved config to preserve labels/types
            return uniqueKeys.map(key => {
                const existing = prevVars.find(v => v.key === key) || savedVariableConfig.find(v => v.key === key);
                return {
                    key: key,
                    label: existing?.label || key, // Default label to key name
                    type: existing?.type || 'text', // Default type to text
                    options: existing?.options || '', // Options for select/radio
                    format: existing?.format || '' // Format for number/date
                };
            });
        });
    };

    const handleVariableChange = (idx, field, value) => {
        const newVars = [...variables];
        newVars[idx][field] = value;
        setVariables(newVars);
    };

    const handleMetaFieldChange = (section, field, value) => {
        setTemplateMeta((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value,
            },
        }));
    };

    const handleMetaArrayToggle = (section, field, option) => {
        setTemplateMeta((prev) => {
            const current = Array.isArray(prev?.[section]?.[field]) ? prev[section][field] : [];
            const exists = current.includes(option);
            return {
                ...prev,
                [section]: {
                    ...prev[section],
                    [field]: exists ? current.filter((item) => item !== option) : [...current, option],
                },
            };
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            alert('Гарчиг болон агуулга оруулна уу');
            return;
        }

        setSaving(true);
        try {
            const templateData = {
                title,
                category,
                content,
                variables, // Save the configured variables
                templateMeta: normalizeTemplateMeta(templateMeta),
                pageSize: FIXED_PAGE_SIZE,
                pageOrientation: FIXED_PAGE_ORIENTATION,
                updatedAt: serverTimestamp()
            };

            if (isNew) {
                templateData.createdAt = serverTimestamp();
                await addDoc(collection(db, 'contractTemplates'), templateData);
            } else {
                await updateDoc(doc(db, 'contractTemplates', id), templateData);
            }
            navigate('/admin/contracts');
        } catch (error) {
            console.error("Error saving template:", error);
            alert('Хадгалахад алдаа гарлаа');
        } finally {
            setSaving(false);
        }
    };

    const handleAutoMapVariablesWithAI = async () => {
        const sourceContent = String(content || '').trim();
        if (!sourceContent || sourceContent === '<p></p>') {
            alert('AI analyze хийхийн өмнө гэрээний агуулгаа оруулна уу.');
            return;
        }

        try {
            setIsAiAnalyzing(true);
            setAiNotes([]);
            const response = await apiFetch('/ai/contract-variable-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: sourceContent,
                    existingVariables: variables
                })
            });
            const rawText = await response.text();
            let payload = {};
            if (rawText) {
                try {
                    payload = JSON.parse(rawText);
                } catch (parseError) {
                    payload = {};
                }
            }
            if (!response.ok || !payload?.success) {
                const fallbackMessage = response.status >= 500
                    ? 'AI server ажиллахгүй байна. `npm run qpay:server` командаар backend асаана уу.'
                    : `AI analyze амжилтгүй боллоо. (HTTP ${response.status})`;
                throw new Error(payload?.error || fallbackMessage);
            }

            const mapped = payload?.data || {};
            const mappedVariables = Array.isArray(mapped.variables) ? mapped.variables : [];
            const mappedContent = String(mapped.updatedContent || sourceContent);
            const notes = Array.isArray(mapped.notes) ? mapped.notes.filter(Boolean) : [];

            setSavedVariableConfig(mappedVariables);
            setVariables(mappedVariables);
            setContent(mappedContent);
            setAiNotes(notes);
        } catch (error) {
            console.error('Contract AI variable mapping failed:', error);
            const isNetworkError = error instanceof TypeError && /fetch|network|failed/i.test(String(error.message || ''));
            if (isNetworkError) {
                alert('AI server-т холбогдож чадсангүй. `npm run qpay:server` командаар backend асаана уу.');
                return;
            }
            alert(error instanceof Error ? error.message : 'AI analyze хийхэд алдаа гарлаа.');
        } finally {
            setIsAiAnalyzing(false);
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    return (
        <div className="admin-page contract-template-editor-page">
            <header className="admin-header">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/admin/contracts')} className="btn-icon">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1>{isNew ? 'Шинэ гэрээний загвар' : 'Загвар засах'}</h1>
                    </div>
                </div>
                <button onClick={handleSave} disabled={saving} className="admin-btn-primary">
                    <Save size={18} />
                    {saving ? 'Хадгалж байна...' : 'Хадгалах'}
                </button>
            </header>

            <div className="admin-content-grid contract-template-editor-grid">
                {/* Left: Editor */}
                <div className="admin-content-card contract-editor-card">
                    <div className="form-group mb-4">
                        <label>Гэрээний нэр</label>
                        <input
                            type="text"
                            className="form-control"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Жишээ: Зээлийн гэрээ"
                        />
                    </div>

                    <div className="form-group mb-4">
                        <label>Ангилал</label>
                        <input
                            type="text"
                            className="form-control"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="Жишээ: Санхүү"
                        />
                    </div>

                    <section className="contract-meta-section mb-4">
                        <h3 className="contract-meta-title">1. Таних мэдээлэл (Identification)</h3>
                        <p className="contract-meta-desc">Гэрээг системд зөв ялгаж таних суурь мэдээллүүд.</p>

                        <div className="contract-meta-grid">
                            <div className="form-group">
                                <label>Гэрээний төрөл</label>
                                <select
                                    className="form-control"
                                    value={templateMeta.identification.contractType}
                                    onChange={(e) => handleMetaFieldChange('identification', 'contractType', e.target.value)}
                                >
                                    {CONTRACT_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Version</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={templateMeta.identification.version}
                                    onChange={(e) => handleMetaFieldChange('identification', 'version', e.target.value)}
                                    placeholder="Жишээ: v1.0"
                                />
                            </div>

                            <div className="form-group">
                                <label>Language</label>
                                <select
                                    className="form-control"
                                    value={templateMeta.identification.language}
                                    onChange={(e) => handleMetaFieldChange('identification', 'language', e.target.value)}
                                >
                                    {LANGUAGE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group contract-meta-grid-full">
                                <label>Товч тайлбар (1-2 өгүүлбэр)</label>
                                <textarea
                                    className="form-control contract-meta-textarea"
                                    value={templateMeta.identification.shortDescription}
                                    onChange={(e) => handleMetaFieldChange('identification', 'shortDescription', e.target.value)}
                                    placeholder="Энэ загварыг ямар нөхцөлд ашиглахыг товч тайлбарлана уу."
                                />
                            </div>

                            <div className="form-group contract-meta-grid-full">
                                <label>Ашиглах салбар / кейс</label>
                                <div className="contract-chip-list">
                                    {USE_CASE_OPTIONS.map((option) => {
                                        const checked = templateMeta.identification.useCases.includes(option);
                                        return (
                                            <label key={option} className={`contract-chip ${checked ? 'checked' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => handleMetaArrayToggle('identification', 'useCases', option)}
                                                />
                                                <span>{option}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="contract-meta-section mb-4">
                        <h3 className="contract-meta-title">2. Хууль эрх зүйн баталгаажуулалт (Legal credibility)</h3>
                        <p className="contract-meta-desc">Итгэлцэл үүсгэх хууль зүйн шалгуур мэдээлэл.</p>

                        <div className="contract-meta-grid">
                            <div className="form-group">
                                <label>Загварыг боловсруулсан байгууллага</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={templateMeta.legal.draftingOrganization}
                                    onChange={(e) => handleMetaFieldChange('legal', 'draftingOrganization', e.target.value)}
                                    placeholder="Жишээ: Nege Legal Desk"
                                />
                            </div>

                            <div className="form-group">
                                <label>Хуулийн фирмийн нэр</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={templateMeta.legal.lawFirmName}
                                    onChange={(e) => handleMetaFieldChange('legal', 'lawFirmName', e.target.value)}
                                    placeholder="Жишээ: XYZ Law Firm"
                                />
                            </div>

                            <div className="form-group">
                                <label>Хянасан хуульчийн нэр</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={templateMeta.legal.reviewedLawyerName}
                                    onChange={(e) => handleMetaFieldChange('legal', 'reviewedLawyerName', e.target.value)}
                                    placeholder="Жишээ: Б.Энхтүвшин"
                                />
                            </div>

                            <div className="form-group">
                                <label>Мэргэжлийн чиглэл</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={templateMeta.legal.reviewedLawyerSpecialty}
                                    onChange={(e) => handleMetaFieldChange('legal', 'reviewedLawyerSpecialty', e.target.value)}
                                    placeholder="Жишээ: Labor, Corporate, IP"
                                />
                            </div>

                            <div className="form-group">
                                <label>Баталгаажуулсан огноо</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={templateMeta.legal.verifiedDate}
                                    onChange={(e) => handleMetaFieldChange('legal', 'verifiedDate', e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Хамаарах хууль эрх зүйн орчин</label>
                                <select
                                    className="form-control"
                                    value={templateMeta.legal.legalFramework}
                                    onChange={(e) => handleMetaFieldChange('legal', 'legalFramework', e.target.value)}
                                >
                                    {LEGAL_FRAMEWORK_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group contract-meta-grid-full">
                                <label>Liability disclaimer</label>
                                <textarea
                                    className="form-control contract-meta-textarea"
                                    value={templateMeta.legal.liabilityDisclaimer}
                                    onChange={(e) => handleMetaFieldChange('legal', 'liabilityDisclaimer', e.target.value)}
                                />
                            </div>
                        </div>
                    </section>

                    <section className="contract-meta-section mb-4">
                        <h3 className="contract-meta-title">3. Ашиглах нөхцөл (Usage conditions)</h3>
                        <p className="contract-meta-desc">Хэрэглэгчийн шийдвэрт нөлөөлөх нөхцөл мэдээлэл.</p>

                        <div className="contract-meta-grid">
                            <div className="form-group contract-meta-grid-full">
                                <label>Ямар нөхцөлд ашиглах вэ</label>
                                <textarea
                                    className="form-control contract-meta-textarea"
                                    value={templateMeta.usage.useConditions}
                                    onChange={(e) => handleMetaFieldChange('usage', 'useConditions', e.target.value)}
                                    placeholder="Жишээ: ажилд авах, нууцлал, нийлүүлэлт..."
                                />
                            </div>

                            <div className="form-group contract-meta-grid-full">
                                <label>Хэнд зориулагдсан</label>
                                <div className="contract-chip-list">
                                    {AUDIENCE_OPTIONS.map((option) => {
                                        const checked = templateMeta.usage.intendedFor.includes(option);
                                        return (
                                            <label key={option} className={`contract-chip ${checked ? 'checked' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => handleMetaArrayToggle('usage', 'intendedFor', option)}
                                                />
                                                <span>{option}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="form-group contract-meta-grid-full">
                                <label>Хэрэглэхээс өмнө анхаарах зүйлс</label>
                                <textarea
                                    className="form-control contract-meta-textarea"
                                    value={templateMeta.usage.cautions}
                                    onChange={(e) => handleMetaFieldChange('usage', 'cautions', e.target.value)}
                                />
                            </div>

                            <div className="form-group contract-meta-grid-full">
                                <label>Customize хийх шаардлагатай хэсгүүд</label>
                                <textarea
                                    className="form-control contract-meta-textarea"
                                    value={templateMeta.usage.customizeRequiredSections}
                                    onChange={(e) => handleMetaFieldChange('usage', 'customizeRequiredSections', e.target.value)}
                                />
                            </div>

                            <div className="form-group contract-meta-grid-full">
                                <label>Хэрэглэхгүй байх нөхцөл</label>
                                <textarea
                                    className="form-control contract-meta-textarea"
                                    value={templateMeta.usage.notForConditions}
                                    onChange={(e) => handleMetaFieldChange('usage', 'notForConditions', e.target.value)}
                                    placeholder="Жишээ: jurisdiction mismatch, өндөр эрсдэлтэй гэрээ..."
                                />
                            </div>
                        </div>
                    </section>

                    <section className="contract-meta-section mb-4">
                        <h3 className="contract-meta-title">4. Гэрээний бүтэц (Structure overview)</h3>
                        <p className="contract-meta-desc">Preview болон бүтэц ойлгоход зориулагдсан хэсэг.</p>

                        <div className="contract-meta-grid">
                            <div className="form-group contract-meta-grid-full">
                                <label>Гол бүлгүүдийн жагсаалт</label>
                                <textarea
                                    className="form-control contract-meta-textarea"
                                    value={templateMeta.structure.sectionList}
                                    onChange={(e) => handleMetaFieldChange('structure', 'sectionList', e.target.value)}
                                    placeholder="Parties&#10;Scope&#10;Term&#10;Payment&#10;Liability&#10;Termination"
                                />
                            </div>

                            <div className="form-group">
                                <label>Mandatory clauses</label>
                                <textarea
                                    className="form-control contract-meta-textarea"
                                    value={templateMeta.structure.mandatoryClauses}
                                    onChange={(e) => handleMetaFieldChange('structure', 'mandatoryClauses', e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label>Optional clauses</label>
                                <textarea
                                    className="form-control contract-meta-textarea"
                                    value={templateMeta.structure.optionalClauses}
                                    onChange={(e) => handleMetaFieldChange('structure', 'optionalClauses', e.target.value)}
                                />
                            </div>
                        </div>
                    </section>

                    <div className="form-group">
                        <label className="contract-content-label">
                            <span>Гэрээний агуулга</span>
                            <span className="contract-content-meta">
                                <span className="text-sm text-muted contract-page-badge">
                                    Цаас: {FIXED_PAGE_SIZE} босоо (Зүүн 20мм, бусад 15мм)
                                </span>
                                <span className="text-sm text-muted">
                                    Хувьсагчийг <code>{'{{variable}}'}</code> гэж бичнэ үү.
                                </span>
                                <span className="text-sm text-muted">
                                    Toolbar дээрх <strong>Батлах 2 багана</strong> товчоор хоёр талын батлах хэсэг нэмнэ.
                                </span>
                                <button
                                    type="button"
                                    className="contract-ai-map-btn"
                                    onClick={handleAutoMapVariablesWithAI}
                                    disabled={isAiAnalyzing}
                                >
                                    <Sparkles size={15} />
                                    {isAiAnalyzing ? 'AI уншиж байна...' : 'AI-аар хувьсагч үүсгэх'}
                                </button>
                            </span>
                        </label>
                        {aiNotes.length > 0 && (
                            <div className="contract-ai-notes">
                                {aiNotes.map((note, index) => (
                                    <div key={`${note}-${index}`}>{note}</div>
                                ))}
                            </div>
                        )}
                        <div className="prose-editor-wrapper contract-editor-paper-wrap">
                            <div className="contract-editor-paper">
                                <RichTextEditor
                                    content={content}
                                    onChange={(html) => setContent(html)}
                                    placeholder="Гэрээний эхийг энд хуулна уу. Жишээ: Энэхүү гэрээг {{компани_нэр}} болон {{ажилтан_нэр}} нар байгуулав."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Variable Configuration */}
                <div className="admin-content-card contract-variable-card">
                    <h3 className="card-title mb-4 flex items-center gap-2">
                        <Info size={16} />
                        Хувьсагчийн тохиргоо
                    </h3>

                    {variables.length === 0 ? (
                        <p className="text-muted text-sm">
                            Текст дотор <code>{'{{...}}'}</code> хаалт ашиглан хувьсагч үүсгэнэ үү.
                        </p>
                    ) : (
                        <div className="variables-list space-y-4">
                            {variables.map((v, idx) => (
                                <div key={v.key} className="variable-item p-3 bg-gray-50 rounded border">
                                    <div className="mb-2 font-mono text-sm font-bold text-blue-600">
                                        {`{{${v.key}}}`}
                                    </div>
                                    <div className="grid gap-2">
                                        <div>
                                            <label className="text-xs text-muted">Харагдах нэр (Label)</label>
                                            <input
                                                type="text"
                                                className="form-control form-control-sm"
                                                value={v.label}
                                                onChange={(e) => handleVariableChange(idx, 'label', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted">Төрөл</label>
                                            <select
                                                className="form-control form-control-sm"
                                                value={v.type}
                                                onChange={(e) => handleVariableChange(idx, 'type', e.target.value)}
                                            >
                                                <option value="text">Текст (Text)</option>
                                                <option value="textarea">Урт Текст (Textarea)</option>
                                                <option value="date">Огноо (Date)</option>
                                                <option value="number">Тоо (Number)</option>
                                                <option value="select">Сонголт (Select)</option>
                                                <option value="radio">Сонголт (Radio)</option>
                                            </select>
                                        </div>

                                        {(v.type === 'select' || v.type === 'radio') && (
                                            <div>
                                                <label className="text-xs text-muted">Сонголтууд (таслалаар тусгаарлах)</label>
                                                <input
                                                    type="text"
                                                    className="form-control form-control-sm"
                                                    value={v.options}
                                                    onChange={(e) => handleVariableChange(idx, 'options', e.target.value)}
                                                    placeholder="Тийм, Үгүй"
                                                />
                                            </div>
                                        )}

                                        {v.type === 'number' && (
                                            <div>
                                                <label className="text-xs text-muted">Формат</label>
                                                <select
                                                    className="form-control form-control-sm"
                                                    value={v.format}
                                                    onChange={(e) => handleVariableChange(idx, 'format', e.target.value)}
                                                >
                                                    <option value="">Үндсэн (None)</option>
                                                    <option value="currency">Мөнгөн дүн (Currency ₮)</option>
                                                    <option value="integer">Бүхэл тоо (Integer)</option>
                                                </select>
                                            </div>
                                        )}

                                        {v.type === 'date' && (
                                            <div>
                                                <label className="text-xs text-muted">Формат</label>
                                                <select
                                                    className="form-control form-control-sm"
                                                    value={v.format}
                                                    onChange={(e) => handleVariableChange(idx, 'format', e.target.value)}
                                                >
                                                    <option value="">Үндсэн (YYYY-MM-DD)</option>
                                                    <option value="long">Урт формат (YYYY оны MM сарын DD)</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContractTemplateEditor;
