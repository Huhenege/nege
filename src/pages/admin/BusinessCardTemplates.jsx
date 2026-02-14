import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, limit } from 'firebase/firestore';
import { Trash2, Edit2, Plus, Eye, Code, Save, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { apiFetch } from '../../lib/apiClient';
import BusinessCardCanvasDesigner from '../../components/business-card/BusinessCardCanvasDesigner';
import './BusinessCardTemplates.css';
import {
    canvasTemplateToSvgTemplate,
    createDefaultCanvasTemplate,
    normalizeCanvasTemplate,
    populateBusinessCardSvg,
    svgTemplateToCanvasTemplate
} from '../../lib/businessCardCanvas';

const placeholderRegex = /\{\{\s*([^}]+)\s*\}\}/g;

const extractUniqueFieldsFromSvg = (svgContent) => {
    if (!svgContent) return [];
    const matches = [...String(svgContent).matchAll(placeholderRegex)];
    return [...new Set(matches.map((match) => String(match?.[1] || '').trim()).filter(Boolean))];
};

const supportedFieldTypes = new Set(['text', 'textarea', 'email', 'tel', 'url', 'image']);

const defaultFieldLabels = {
    fullName: 'Full Name',
    firstName: 'First Name',
    lastName: 'Last Name',
    department: 'Department',
    company: 'Company',
    position: 'Position',
    mobilePhone: 'Mobile Phone',
    phone: 'Phone',
    email: 'Email',
    web: 'Website',
    address: 'Address',
    tagline: 'Tagline',
    socialFacebook: 'Facebook',
    socialInstagram: 'Instagram',
    socialLinkedin: 'LinkedIn',
    socialX: 'X / Twitter',
    logo: 'Logo'
};

const defaultFieldPlaceholders = {
    fullName: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    department: 'Sales Department',
    company: 'Nege LLC',
    position: 'CEO & Founder',
    mobilePhone: '+976 9911-2233',
    phone: '+976 9911-2233',
    email: 'john@example.com',
    web: 'www.example.com',
    address: 'Ulaanbaatar, Mongolia',
    tagline: 'Future belongs to those who build it.',
    socialFacebook: 'johndoe',
    socialInstagram: 'johndoe',
    socialLinkedin: 'johndoe',
    socialX: 'johndoe'
};

const longPreviewSamples = {
    fullName: 'Ганбаатарын Бат-Эрдэнэ Тэмүүлэн',
    firstName: 'Тэмүүлэн',
    lastName: 'Ганбаатарын Бат-Эрдэнэ',
    company: 'New Era Global Technology Solutions LLC',
    department: 'Business Development and Strategic Partnerships',
    position: 'Senior Regional Sales & Marketing Director',
    mobilePhone: '+976 9911-2233 / +976 8811-4455',
    phone: '+976 7011-2233 / +976 7611-9988',
    email: 'very.long.email.address@enterprise-example.mn',
    web: 'https://www.enterprise-example.mn/business-card-platform',
    address: 'Сүхбаатар дүүрэг, 1-р хороо, Olympic street 8/1, Central Tower, 15 давхар, 1503 тоот, Улаанбаатар',
    tagline: 'Building digital identity systems for modern businesses across Mongolia and beyond.',
    socialFacebook: 'facebook.com/enterprise.brand.page.official',
    socialInstagram: 'instagram.com/enterprise.brand.official.account',
    socialLinkedin: 'linkedin.com/company/enterprise-global-technology-solutions',
    socialX: 'x.com/enterprise_global_brand'
};

const defaultImageDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" rx="8" fill="#E5E7EB"/><text x="60" y="45" text-anchor="middle" font-size="14" font-family="Arial, sans-serif" fill="#6B7280">IMAGE</text></svg>')}`;

const qualityRecommendedFields = ['fullName', 'company', 'position', 'phone', 'email', 'web', 'address', 'tagline', 'logo'];
const qualityContactFields = ['phone', 'mobilePhone', 'email', 'web', 'socialFacebook', 'socialInstagram', 'socialLinkedin', 'socialX'];

const AI_SYSTEM_PROMPT = `You are an expert business-card template analyst.
Your job is to map SVG text/image elements into dynamic template field names.
Respond with JSON only, no markdown.`;

const AI_USER_PROMPT = `Given the business card SVG structure and optional reference image (JPG/PNG), decide what each text/image element should map to.

Return JSON in exactly this shape:
{
  "textFields": [
    { "index": 0, "field": "fullName", "confidence": 0.98, "reason": "..." }
  ],
  "imageFields": [
    { "index": 0, "field": "logo", "confidence": 0.95, "reason": "..." }
  ]
}

Rules:
1. field must be camelCase and concise.
2. Use standard names when possible: fullName, company, position, phone, email, web, address, tagline, socialFacebook, socialInstagram, socialLinkedin, socialX, logo.
3. For extra images use image1/image2 or icon1/icon2.
4. Only include confident mappings. Skip uncertain ones.
5. Keep indices exactly from provided arrays.`;

const toTitleCase = (value) => {
    if (!value) return '';
    const spaced = value
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .trim();
    return spaced
        .split(' ')
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const toFieldKey = (value) => {
    const cleaned = String(value || '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim();
    if (!cleaned) return '';
    const parts = cleaned.split(/\s+/);
    return parts[0].toLowerCase() + parts.slice(1).map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
};

const ensureUniqueFieldName = (base, usedNames) => {
    const safeBase = base || 'field';
    if (!usedNames.has(safeBase)) {
        usedNames.add(safeBase);
        return safeBase;
    }
    let index = 2;
    while (usedNames.has(`${safeBase}${index}`)) {
        index += 1;
    }
    const unique = `${safeBase}${index}`;
    usedNames.add(unique);
    return unique;
};

const isImageFieldName = (field) => /(^logo$|^icon\d*$|^image\d*$|avatar|photo|picture|badge|brandMark|symbol)/i.test(field || '');

const cleanJsonResponse = (raw) => {
    let str = String(raw || '').trim();
    str = str.replace(/^```(?:json)?\s*/gi, '');
    str = str.replace(/\s*```$/gi, '');
    str = str.replace(/```/g, '');
    const startIdx = str.indexOf('{');
    const endIdx = str.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        str = str.slice(startIdx, endIdx + 1);
    }
    str = str.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    return str.trim();
};

const parseAiJsonResponse = (raw) => {
    const cleaned = cleanJsonResponse(raw);
    if (!cleaned) return null;
    try {
        return JSON.parse(cleaned);
    } catch (error) {
        console.warn('Failed to parse AI JSON:', error);
        return null;
    }
};

const getDefaultFieldType = (field) => {
    if (isImageFieldName(field)) return 'image';
    if (field === 'email') return 'email';
    if (field === 'phone') return 'tel';
    if (field === 'web') return 'url';
    if (field === 'address') return 'textarea';
    return 'text';
};

const normalizeFieldType = (field, type) => {
    if (isImageFieldName(field)) return 'image';
    if (supportedFieldTypes.has(type)) return type;
    return getDefaultFieldType(field);
};

const hasFieldLike = (fields, expectedField) => {
    const pattern = new RegExp(`^${expectedField}\\d+$`);
    return fields.some(field => field === expectedField || pattern.test(field));
};

const evaluateTemplateCoverage = ({ fields, mappedTextCount, totalTextCount }) => {
    const normalizedFields = [...new Set((fields || []).filter(Boolean))];
    const hasName = hasFieldLike(normalizedFields, 'fullName') || (hasFieldLike(normalizedFields, 'firstName') && hasFieldLike(normalizedFields, 'lastName'));
    const hasContact = qualityContactFields.some(field => hasFieldLike(normalizedFields, field));
    const missingRecommendedFields = qualityRecommendedFields.filter((field) => {
        if (field === 'fullName') return !hasName;
        return !hasFieldLike(normalizedFields, field);
    });
    const missingCriticalFields = [];
    if (!hasName) missingCriticalFields.push('fullName');
    if (!hasContact) missingCriticalFields.push('contact');

    const textCoverage = totalTextCount > 0 ? Math.round((mappedTextCount / totalTextCount) * 100) : 100;
    const genericFieldCount = normalizedFields.filter(field => /^field\d+$/i.test(field)).length;

    let completenessScore = 0;
    if (hasName) completenessScore += 25;
    if (hasContact) completenessScore += 25;
    if (hasFieldLike(normalizedFields, 'company')) completenessScore += 10;
    if (hasFieldLike(normalizedFields, 'position')) completenessScore += 10;
    if (hasFieldLike(normalizedFields, 'phone') || hasFieldLike(normalizedFields, 'mobilePhone')) completenessScore += 8;
    if (hasFieldLike(normalizedFields, 'email')) completenessScore += 8;
    if (hasFieldLike(normalizedFields, 'web')) completenessScore += 5;
    if (hasFieldLike(normalizedFields, 'address')) completenessScore += 4;
    if (hasFieldLike(normalizedFields, 'tagline')) completenessScore += 3;
    if (hasFieldLike(normalizedFields, 'logo')) completenessScore += 2;
    if (textCoverage === 100) completenessScore += 5;
    completenessScore = Math.min(100, Math.max(0, Math.round(completenessScore)));

    const notes = [];
    if (!hasName) notes.push('Name field not detected. Usually fullName or firstName + lastName should exist.');
    if (!hasContact) notes.push('No direct contact field detected (phone/email/web/social).');
    if (genericFieldCount > 0) notes.push(`${genericFieldCount} generic field(s) found (field1, field2...). Rename these mappings.`);
    if (textCoverage < 100) notes.push(`Only ${textCoverage}% of text nodes mapped.`);

    return {
        completenessScore,
        textCoverage,
        missingRecommendedFields,
        missingCriticalFields,
        detectedFields: normalizedFields.sort(),
        notes
    };
};

const toUniqueList = (values) => [...new Set((values || []).map(item => String(item || '').trim()).filter(Boolean))];

const validateTemplateIntegrity = ({ svgContent, extractedFields, fieldSchema }) => {
    const normalizedFields = toUniqueList(extractedFields);
    const svgPlaceholders = toUniqueList(Array.from(String(svgContent || '').matchAll(placeholderRegex)).map(match => match[1]));
    const schema = fieldSchema || {};

    const placeholderNotInFields = svgPlaceholders.filter(field => !normalizedFields.includes(field));
    const fieldsNotInSvg = normalizedFields.filter(field => !svgPlaceholders.includes(field));
    const invalidFieldNames = normalizedFields.filter(field => !/^[a-z][a-zA-Z0-9]*$/.test(field));
    const schemaMissing = normalizedFields.filter(field => !schema[field]);
    const invalidSchemaTypes = normalizedFields.filter((field) => {
        const type = schema[field]?.type;
        return Boolean(type) && !supportedFieldTypes.has(type);
    });

    let imageNodeCount = 0;
    const imagePlaceholderFields = [];
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(String(svgContent || ''), 'image/svg+xml');
        if (!doc.querySelector('parsererror')) {
            const imageNodes = Array.from(doc.querySelectorAll('image')).filter(node => !node.closest('defs'));
            imageNodeCount = imageNodes.length;
            imageNodes.forEach((node) => {
                const href = node.getAttribute('href') || node.getAttribute('xlink:href') || '';
                const match = href.match(/\{\{\s*([^}]+)\s*\}\}/);
                if (match?.[1]) imagePlaceholderFields.push(match[1].trim());
            });
        }
    } catch {
        // ignore parse errors here, save flow handles syntax separately.
    }

    const imageFields = normalizedFields.filter(field => isImageFieldName(field));
    const imagePlaceholdersMissing = imageFields.filter(field => !imagePlaceholderFields.includes(field));

    const blockingIssues = [];
    const warnings = [];

    if (placeholderNotInFields.length > 0) {
        blockingIssues.push(`SVG placeholders missing in extracted fields: ${placeholderNotInFields.join(', ')}`);
    }
    if (invalidFieldNames.length > 0) {
        blockingIssues.push(`Invalid field naming (use camelCase): ${invalidFieldNames.join(', ')}`);
    }

    if (schemaMissing.length > 0) warnings.push(`Missing field schema for: ${schemaMissing.join(', ')}`);
    if (fieldsNotInSvg.length > 0) warnings.push(`Fields exist but not used in SVG: ${fieldsNotInSvg.join(', ')}`);
    if (invalidSchemaTypes.length > 0) warnings.push(`Unsupported field type found: ${invalidSchemaTypes.join(', ')}`);
    if (imageNodeCount === 0 && imageFields.length > 0) warnings.push('Image fields exist but SVG has no <image> nodes.');
    if (imagePlaceholdersMissing.length > 0) warnings.push(`Image fields not bound to <image href>: ${imagePlaceholdersMissing.join(', ')}`);

    return {
        blockingIssues,
        warnings,
        stats: {
            placeholdersInSvg: svgPlaceholders.length,
            extractedFieldCount: normalizedFields.length,
            schemaCount: Object.keys(schema).length,
            imageNodeCount,
            imageFieldCount: imageFields.length
        }
    };
};

const toDateSafe = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') {
        try {
            return value.toDate();
        } catch {
            return null;
        }
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
};

const formatDateKey = (date) => {
    if (!(date instanceof Date)) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const buildDefaultFieldConfig = (field) => ({
    label: defaultFieldLabels[field] || toTitleCase(field),
    type: getDefaultFieldType(field),
    required: field === 'fullName',
    placeholder: getDefaultFieldType(field) === 'image' ? '' : (defaultFieldPlaceholders[field] || toTitleCase(field)),
    defaultValue: getDefaultFieldType(field) === 'image' ? '' : (defaultFieldPlaceholders[field] || ''),
    sourceSample: ''
});

const buildFieldSchema = (fields, schema = {}) => {
    const next = {};
    fields.forEach((field) => {
        const base = buildDefaultFieldConfig(field);
        const current = schema[field] || {};
        next[field] = {
            ...base,
            ...current,
            type: normalizeFieldType(field, current.type || base.type),
            required: typeof current.required === 'boolean' ? current.required : base.required,
            sourceSample: typeof current.sourceSample === 'string' ? current.sourceSample : (base.sourceSample || '')
        };
    });
    return next;
};

const mergeTemplateSideFields = ({
    frontSvgContent,
    backSvgContent,
    preferredFields = [],
    existingSchema = {}
}) => {
    const frontFields = extractUniqueFieldsFromSvg(frontSvgContent);
    const backFields = extractUniqueFieldsFromSvg(backSvgContent);
    const extractedFields = [...new Set([
        ...(preferredFields || []),
        ...frontFields,
        ...backFields
    ])];
    return {
        extractedFields,
        fieldSchema: buildFieldSchema(extractedFields, existingSchema || {}),
        frontFields,
        backFields
    };
};

const createEmptyIntegrityReport = () => ({
    blockingIssues: [],
    warnings: [],
    stats: {
        placeholdersInSvg: 0,
        extractedFieldCount: 0,
        schemaCount: 0,
        imageNodeCount: 0,
        imageFieldCount: 0
    }
});

const prefixIntegrityMessages = (messages, prefix) => (
    (messages || []).map((message) => `${prefix}: ${message}`)
);

const combineIntegrityReports = ({ frontReport, backReport, hasBackSide }) => {
    const front = frontReport || createEmptyIntegrityReport();
    const back = backReport || createEmptyIntegrityReport();

    return {
        blockingIssues: [
            ...prefixIntegrityMessages(front.blockingIssues, 'Front'),
            ...(hasBackSide ? prefixIntegrityMessages(back.blockingIssues, 'Back') : [])
        ],
        warnings: [
            ...prefixIntegrityMessages(front.warnings, 'Front'),
            ...(hasBackSide ? prefixIntegrityMessages(back.warnings, 'Back') : [])
        ],
        stats: {
            placeholdersInSvg: Number(front.stats?.placeholdersInSvg || 0) + Number(back.stats?.placeholdersInSvg || 0),
            extractedFieldCount: Math.max(Number(front.stats?.extractedFieldCount || 0), Number(back.stats?.extractedFieldCount || 0)),
            schemaCount: Math.max(Number(front.stats?.schemaCount || 0), Number(back.stats?.schemaCount || 0)),
            imageNodeCount: Number(front.stats?.imageNodeCount || 0) + Number(back.stats?.imageNodeCount || 0),
            imageFieldCount: Math.max(Number(front.stats?.imageFieldCount || 0), Number(back.stats?.imageFieldCount || 0))
        }
    };
};

const createEmptyTemplateDraft = () => ({
    name: '',
    svgContent: '',
    backSvgContent: '',
    extractedFields: [],
    fieldSchema: {}
});

const createBlankCanvasTemplate = () => {
    const base = createDefaultCanvasTemplate();
    return normalizeCanvasTemplate({
        ...base,
        nodes: []
    });
};

const hasDifferentCanvasSize = (leftCanvas, rightCanvas, tolerance = 0.01) => {
    const left = normalizeCanvasTemplate(leftCanvas);
    const right = normalizeCanvasTemplate(rightCanvas);
    return Math.abs(Number(left.width || 0) - Number(right.width || 0)) > tolerance
        || Math.abs(Number(left.height || 0) - Number(right.height || 0)) > tolerance;
};

const alignCanvasSizeWithSource = (targetCanvas, sourceCanvas) => {
    const target = normalizeCanvasTemplate(targetCanvas);
    const source = normalizeCanvasTemplate(sourceCanvas);
    const maxSafeMargin = Math.min(source.width, source.height) / 2;
    return normalizeCanvasTemplate({
        ...target,
        width: source.width,
        height: source.height,
        safeMargin: Math.max(0, Math.min(target.safeMargin, maxSafeMargin))
    });
};

const hasCanvasNodes = (canvasDraft) => Array.isArray(canvasDraft?.nodes) && canvasDraft.nodes.length > 0;

const BusinessCardTemplates = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [currentTemplate, setCurrentTemplate] = useState(createEmptyTemplateDraft());
    const [templateInputMode, setTemplateInputMode] = useState('canvas');
    const [canvasTemplate, setCanvasTemplate] = useState(() => createDefaultCanvasTemplate());
    const [isCanvasDirty, setIsCanvasDirty] = useState(true);
    const [isCanvasSyncing, setIsCanvasSyncing] = useState(false);
    const [backTemplateInputMode, setBackTemplateInputMode] = useState('canvas');
    const [backCanvasTemplate, setBackCanvasTemplate] = useState(() => createBlankCanvasTemplate());
    const [isBackCanvasDirty, setIsBackCanvasDirty] = useState(false);
    const [isBackCanvasSyncing, setIsBackCanvasSyncing] = useState(false);
    const defaultLogoDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><rect width="160" height="60" rx="10" fill="#111827"/><text x="80" y="38" text-anchor="middle" font-size="20" font-family="Arial, sans-serif" fill="#F9FAFB">LOGO</text></svg>')}`;

    const [previewData, setPreviewData] = useState({
        fullName: 'John Doe',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Nege LLC',
        department: 'Sales',
        position: 'CEO & Founder',
        mobilePhone: '+976 9911-2233',
        phone: '+976 9911-2233',
        email: 'john@example.com',
        web: 'www.example.com',
        address: 'Ulaanbaatar, Mongolia',
        tagline: 'Future belongs to those who build it.',
        socialFacebook: 'johndoe',
        socialInstagram: 'johndoe',
        socialLinkedin: 'johndoe',
        socialX: 'johndoe',
        logo: defaultLogoDataUrl
    });

    const [aiReport, setAiReport] = useState([]);
    const [aiWarnings, setAiWarnings] = useState([]);
    const [mappingAudit, setMappingAudit] = useState(null);
    const [isAiConverting, setIsAiConverting] = useState(false);
    const [isBenchmarkRunning, setIsBenchmarkRunning] = useState(false);
    const [benchmarkResult, setBenchmarkResult] = useState(null);
    const [benchmarkError, setBenchmarkError] = useState('');
    const [benchmarkHistory, setBenchmarkHistory] = useState([]);
    const [benchmarkHistoryLoading, setBenchmarkHistoryLoading] = useState(false);
    const [referenceImage, setReferenceImage] = useState({
        dataUrl: '',
        mimeType: '',
        fileName: ''
    });
    const [showAiMappingDetails, setShowAiMappingDetails] = useState(false);
    const [showValidationDetails, setShowValidationDetails] = useState(false);
    const [showPreviewDataControls, setShowPreviewDataControls] = useState(false);
    const [showBenchmarkDashboard, setShowBenchmarkDashboard] = useState(false);
    const [editorTab, setEditorTab] = useState('design');

    useEffect(() => {
        fetchTemplates();
        fetchBenchmarkHistory();
    }, []);

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, 'businessCardTemplates'));
            const templatesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setTemplates(templatesData);
        } catch (error) {
            console.error("Error fetching templates:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchBenchmarkHistory = async () => {
        setBenchmarkHistoryLoading(true);
        try {
            const historyQuery = query(
                collection(db, 'businessCardBenchmarkRuns'),
                orderBy('createdAt', 'desc'),
                limit(100)
            );
            const snapshot = await getDocs(historyQuery);
            const runs = snapshot.docs.map((item) => {
                const data = item.data() || {};
                return {
                    id: item.id,
                    ...data,
                    createdAtDate: toDateSafe(data.createdAt)
                };
            });
            setBenchmarkHistory(runs);
        } catch (error) {
            console.error('Error fetching benchmark history:', error);
        } finally {
            setBenchmarkHistoryLoading(false);
        }
    };

    const handleRunBenchmark = async () => {
        try {
            setIsBenchmarkRunning(true);
            setBenchmarkError('');
            const response = await apiFetch('/ai/business-card-benchmark', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload?.success) {
                throw new Error(payload?.error || 'Benchmark run failed');
            }
            const resultData = payload.data || null;
            setBenchmarkResult(resultData);
            if (resultData?.summary) {
                try {
                    await addDoc(collection(db, 'businessCardBenchmarkRuns'), {
                        generatedAt: resultData.generatedAt || '',
                        summary: resultData.summary,
                        cases: Array.isArray(resultData.cases) ? resultData.cases : [],
                        createdAt: serverTimestamp()
                    });
                    fetchBenchmarkHistory();
                } catch (persistError) {
                    console.error('Failed to persist benchmark run:', persistError);
                }
            }
        } catch (error) {
            console.error('Benchmark run failed:', error);
            setBenchmarkError(error instanceof Error ? error.message : 'Benchmark run failed');
        } finally {
            setIsBenchmarkRunning(false);
        }
    };

    const extractFieldsFromSvg = (svgContent) => {
        return extractUniqueFieldsFromSvg(svgContent);
    };

    const mergeTemplateFieldsAcrossSides = (templateDraft, preferredFields) => mergeTemplateSideFields({
        frontSvgContent: templateDraft?.svgContent || '',
        backSvgContent: templateDraft?.backSvgContent || '',
        preferredFields: Array.isArray(preferredFields)
            ? preferredFields
            : (Array.isArray(templateDraft?.extractedFields) ? templateDraft.extractedFields : []),
        existingSchema: templateDraft?.fieldSchema || {}
    });

    const resetEditorState = ({ keepEditing = false } = {}) => {
        setCurrentTemplate(createEmptyTemplateDraft());
        setTemplateInputMode('canvas');
        setCanvasTemplate(createDefaultCanvasTemplate());
        setIsCanvasDirty(true);
        setIsCanvasSyncing(false);
        setBackTemplateInputMode('canvas');
        setBackCanvasTemplate(createBlankCanvasTemplate());
        setIsBackCanvasDirty(false);
        setIsBackCanvasSyncing(false);
        setAiReport([]);
        setAiWarnings([]);
        setMappingAudit(null);
        setShowAiMappingDetails(false);
        setShowValidationDetails(false);
        setShowPreviewDataControls(false);
        setEditorTab('design');
        clearReferenceImage();
        setIsEditing(keepEditing);
    };

    const buildSchemaFromCanvasSync = (extractedFields, sourceSamples, fieldKinds, existingSchema = {}) => {
        const nextSchema = buildFieldSchema(extractedFields, existingSchema);
        extractedFields.forEach((field) => {
            const sample = String(sourceSamples?.[field] || '').trim();
            const kind = fieldKinds?.[field] === 'image' ? 'image' : 'text';
            const previous = nextSchema[field] || buildDefaultFieldConfig(field);
            const shouldUseSampleAsDefault = kind === 'text'
                && sample
                && !sample.includes('{{')
                && !(defaultFieldPlaceholders[field] || '').toLowerCase().includes(sample.toLowerCase());
            nextSchema[field] = {
                ...previous,
                type: kind === 'image' ? 'image' : normalizeFieldType(field, previous.type),
                placeholder: kind === 'image'
                    ? ''
                    : (previous.placeholder || defaultFieldPlaceholders[field] || sample || toTitleCase(field)),
                defaultValue: kind === 'image'
                    ? ''
                    : (previous.defaultValue || (shouldUseSampleAsDefault ? sample : (defaultFieldPlaceholders[field] || ''))),
                sourceSample: sample || previous.sourceSample || ''
            };
        });
        return nextSchema;
    };

    const syncCanvasToSvgTemplate = ({ silentWarning = false } = {}) => {
        setIsCanvasSyncing(true);
        try {
            const normalizedCanvas = normalizeCanvasTemplate(canvasTemplate);
            const converted = canvasTemplateToSvgTemplate(normalizedCanvas);
            const schemaAfterFrontSync = buildSchemaFromCanvasSync(
                converted.extractedFields,
                converted.sourceSamples,
                converted.fieldKinds,
                currentTemplate.fieldSchema || {}
            );
            const mergedAcrossSides = mergeTemplateSideFields({
                frontSvgContent: converted.svgContent,
                backSvgContent: currentTemplate.backSvgContent || '',
                preferredFields: [
                    ...(currentTemplate.extractedFields || []),
                    ...converted.extractedFields
                ],
                existingSchema: schemaAfterFrontSync
            });
            const nextAudit = evaluateTemplateCoverage({
                fields: mergedAcrossSides.extractedFields,
                mappedTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length,
                totalTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length
            });

            setCurrentTemplate((prev) => ({
                ...prev,
                svgContent: converted.svgContent,
                extractedFields: mergedAcrossSides.extractedFields,
                fieldSchema: mergedAcrossSides.fieldSchema,
                canvasTemplate: normalizedCanvas
            }));
            setCanvasTemplate(normalizedCanvas);
            setAiReport(converted.report || []);
            setAiWarnings([
                ...(silentWarning ? [] : ['Canvas designer mapping applied.']),
                ...(converted.warnings || [])
            ]);
            setMappingAudit(nextAudit);
            setIsCanvasDirty(false);

            return {
                ...converted,
                extractedFields: mergedAcrossSides.extractedFields,
                fieldSchema: mergedAcrossSides.fieldSchema,
                mappingAudit: nextAudit,
                canvasTemplate: normalizedCanvas
            };
        } catch (error) {
            console.error('Canvas sync failed:', error);
            if (!silentWarning) {
                alert('Canvas -> SVG sync failed. Please check canvas nodes.');
            }
            return null;
        } finally {
            setIsCanvasSyncing(false);
        }
    };

    const handleCanvasTemplateChange = (nextCanvas) => {
        const normalizedNext = normalizeCanvasTemplate(nextCanvas);
        setCanvasTemplate(normalizedNext);
        setIsCanvasDirty(true);
        setBackCanvasTemplate((prevBack) => {
            const syncedBack = alignCanvasSizeWithSource(prevBack, normalizedNext);
            if (hasDifferentCanvasSize(prevBack, syncedBack) && hasCanvasNodes(syncedBack)) {
                setIsBackCanvasDirty(true);
            }
            return syncedBack;
        });
    };

    const handleImportCurrentSvgToCanvas = () => {
        if (!currentTemplate.svgContent?.trim()) {
            alert('No SVG content to import.');
            return;
        }
        const convertedCanvas = svgTemplateToCanvasTemplate(currentTemplate.svgContent);
        setCanvasTemplate(convertedCanvas);
        setBackCanvasTemplate((prevBack) => {
            const syncedBack = alignCanvasSizeWithSource(prevBack, convertedCanvas);
            if (hasDifferentCanvasSize(prevBack, syncedBack) && hasCanvasNodes(syncedBack)) {
                setIsBackCanvasDirty(true);
            }
            return syncedBack;
        });
        setIsCanvasDirty(false);
        setTemplateInputMode('canvas');
        setAiWarnings((prev) => [
            'SVG placeholders imported into canvas. Decorative vector shapes are not editable nodes.',
            ...prev.filter(Boolean)
        ]);
    };

    const syncBackCanvasToSvgTemplate = ({ silentWarning = false, canvasOverride = null } = {}) => {
        setIsBackCanvasSyncing(true);
        try {
            const normalizedBackCanvas = alignCanvasSizeWithSource(
                canvasOverride || backCanvasTemplate,
                canvasTemplate
            );
            const hasBackNodes = hasCanvasNodes(normalizedBackCanvas);
            let converted = null;
            let nextBackSvgContent = '';
            let schemaAfterBackSync = currentTemplate.fieldSchema || {};

            if (hasBackNodes) {
                converted = canvasTemplateToSvgTemplate(normalizedBackCanvas);
                nextBackSvgContent = converted.svgContent;
                schemaAfterBackSync = buildSchemaFromCanvasSync(
                    converted.extractedFields,
                    converted.sourceSamples,
                    converted.fieldKinds,
                    currentTemplate.fieldSchema || {}
                );
            }

            const mergedAcrossSides = mergeTemplateSideFields({
                frontSvgContent: currentTemplate.svgContent || '',
                backSvgContent: nextBackSvgContent,
                preferredFields: [
                    ...(currentTemplate.extractedFields || []),
                    ...((converted?.extractedFields) || [])
                ],
                existingSchema: schemaAfterBackSync
            });
            const nextAudit = evaluateTemplateCoverage({
                fields: mergedAcrossSides.extractedFields,
                mappedTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length,
                totalTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length
            });

            setCurrentTemplate((prev) => ({
                ...prev,
                backSvgContent: nextBackSvgContent,
                extractedFields: mergedAcrossSides.extractedFields,
                fieldSchema: mergedAcrossSides.fieldSchema,
                backCanvasTemplate: normalizedBackCanvas
            }));
            setBackCanvasTemplate(normalizedBackCanvas);
            setIsBackCanvasDirty(false);
            setAiReport(converted?.report || []);
            setAiWarnings([
                ...(silentWarning ? [] : ['Back canvas mapping applied.']),
                ...((converted?.warnings) || (hasBackNodes ? [] : ['Back canvas has no nodes. Back side cleared.']))
            ]);
            setMappingAudit(nextAudit);

            return {
                ...(converted || {}),
                svgContent: nextBackSvgContent,
                extractedFields: mergedAcrossSides.extractedFields,
                fieldSchema: mergedAcrossSides.fieldSchema,
                mappingAudit: nextAudit,
                canvasTemplate: normalizedBackCanvas
            };
        } catch (error) {
            console.error('Back canvas sync failed:', error);
            if (!silentWarning) {
                alert('Back canvas -> SVG sync failed. Please check back-side nodes.');
            }
            return null;
        } finally {
            setIsBackCanvasSyncing(false);
        }
    };

    const handleBackCanvasTemplateChange = (nextCanvas) => {
        const normalizedNext = alignCanvasSizeWithSource(nextCanvas, canvasTemplate);
        setBackCanvasTemplate(normalizedNext);
        setIsBackCanvasDirty(true);
    };

    const handleImportBackSvgToCanvas = () => {
        if (!currentTemplate.backSvgContent?.trim()) {
            alert('No back-side SVG content to import.');
            return;
        }
        const convertedCanvas = alignCanvasSizeWithSource(
            svgTemplateToCanvasTemplate(currentTemplate.backSvgContent),
            canvasTemplate
        );
        setBackCanvasTemplate(convertedCanvas);
        setIsBackCanvasDirty(false);
        setBackTemplateInputMode('canvas');
        setAiWarnings((prev) => [
            'Back-side SVG placeholders imported into canvas. Card size stays synced with front side.',
            ...prev.filter(Boolean)
        ]);
    };

    const handleAnalyze = () => {
        if (!currentTemplate.svgContent) return;
        setTemplateInputMode('svg');

        const mergedAcrossSides = mergeTemplateFieldsAcrossSides(
            currentTemplate,
            [
                ...(currentTemplate.extractedFields || []),
                ...extractFieldsFromSvg(currentTemplate.svgContent)
            ]
        );

        setCurrentTemplate(prev => ({
            ...prev,
            extractedFields: mergedAcrossSides.extractedFields,
            fieldSchema: mergedAcrossSides.fieldSchema
        }));
        const analyzedFrontCanvas = svgTemplateToCanvasTemplate(currentTemplate.svgContent);
        setCanvasTemplate(analyzedFrontCanvas);
        setBackCanvasTemplate((prevBack) => {
            const syncedBack = alignCanvasSizeWithSource(prevBack, analyzedFrontCanvas);
            if (hasDifferentCanvasSize(prevBack, syncedBack) && hasCanvasNodes(syncedBack)) {
                setIsBackCanvasDirty(true);
            }
            return syncedBack;
        });
        setIsCanvasDirty(false);

        setAiReport([]);
        setAiWarnings([]);
        setMappingAudit(evaluateTemplateCoverage({
            fields: mergedAcrossSides.extractedFields,
            mappedTextCount: mergedAcrossSides.extractedFields.filter(field => !isImageFieldName(field)).length,
            totalTextCount: mergedAcrossSides.extractedFields.filter(field => !isImageFieldName(field)).length
        }));
    };

    const handleSvgFileImport = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setTemplateInputMode('svg');

        const reader = new FileReader();
        reader.onload = async (loadEvent) => {
            const rawSvg = String(loadEvent.target?.result || '');
            if (!rawSvg.trim()) {
                alert('Selected SVG file is empty.');
                return;
            }
            try {
                setIsAiConverting(true);
                const converted = await convertSvgToTemplate(rawSvg, currentTemplate.fieldSchema || {}, {
                    referenceImageDataUrl: referenceImage.dataUrl,
                    referenceImageMimeType: referenceImage.mimeType
                });
                const mergedAcrossSides = mergeTemplateSideFields({
                    frontSvgContent: converted.svgContent,
                    backSvgContent: currentTemplate.backSvgContent || '',
                    preferredFields: [
                        ...(currentTemplate.extractedFields || []),
                        ...converted.extractedFields
                    ],
                    existingSchema: converted.fieldSchema
                });
                const mergedAudit = evaluateTemplateCoverage({
                    fields: mergedAcrossSides.extractedFields,
                    mappedTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length,
                    totalTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length
                });
                setCurrentTemplate((prev) => ({
                    ...prev,
                    svgContent: converted.svgContent,
                    extractedFields: mergedAcrossSides.extractedFields,
                    fieldSchema: mergedAcrossSides.fieldSchema
                }));
                const importedFrontCanvas = svgTemplateToCanvasTemplate(converted.svgContent);
                setCanvasTemplate(importedFrontCanvas);
                setBackCanvasTemplate((prevBack) => {
                    const syncedBack = alignCanvasSizeWithSource(prevBack, importedFrontCanvas);
                    if (hasDifferentCanvasSize(prevBack, syncedBack) && hasCanvasNodes(syncedBack)) {
                        setIsBackCanvasDirty(true);
                    }
                    return syncedBack;
                });
                setIsCanvasDirty(false);
                setAiReport(converted.report);
                setAiWarnings(converted.warnings);
                setMappingAudit(converted.audit
                    ? { ...converted.audit, detectedFields: mergedAcrossSides.extractedFields }
                    : mergedAudit);
            } catch (error) {
                console.error('SVG file import failed:', error);
                const mergedAcrossSides = mergeTemplateSideFields({
                    frontSvgContent: rawSvg,
                    backSvgContent: currentTemplate.backSvgContent || '',
                    preferredFields: currentTemplate.extractedFields || [],
                    existingSchema: currentTemplate.fieldSchema || {}
                });
                setCurrentTemplate((prev) => ({
                    ...prev,
                    svgContent: rawSvg,
                    extractedFields: mergedAcrossSides.extractedFields,
                    fieldSchema: mergedAcrossSides.fieldSchema
                }));
                const importedFrontCanvas = svgTemplateToCanvasTemplate(rawSvg);
                setCanvasTemplate(importedFrontCanvas);
                setBackCanvasTemplate((prevBack) => {
                    const syncedBack = alignCanvasSizeWithSource(prevBack, importedFrontCanvas);
                    if (hasDifferentCanvasSize(prevBack, syncedBack) && hasCanvasNodes(syncedBack)) {
                        setIsBackCanvasDirty(true);
                    }
                    return syncedBack;
                });
                setIsCanvasDirty(false);
                setAiReport([]);
                setAiWarnings(['SVG parse error. Raw SVG loaded without AI conversion.']);
                setMappingAudit(evaluateTemplateCoverage({
                    fields: mergedAcrossSides.extractedFields,
                    mappedTextCount: mergedAcrossSides.extractedFields.filter(field => !isImageFieldName(field)).length,
                    totalTextCount: mergedAcrossSides.extractedFields.filter(field => !isImageFieldName(field)).length
                }));
            } finally {
                setIsAiConverting(false);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleBackSvgFileImport = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setBackTemplateInputMode('svg');

        const reader = new FileReader();
        reader.onload = async (loadEvent) => {
            const rawSvg = String(loadEvent.target?.result || '');
            if (!rawSvg.trim()) {
                alert('Selected back-side SVG file is empty.');
                return;
            }
            try {
                setIsAiConverting(true);
                const converted = await convertSvgToTemplate(rawSvg, currentTemplate.fieldSchema || {}, {
                    referenceImageDataUrl: referenceImage.dataUrl,
                    referenceImageMimeType: referenceImage.mimeType
                });
                const mergedAcrossSides = mergeTemplateSideFields({
                    frontSvgContent: currentTemplate.svgContent || '',
                    backSvgContent: converted.svgContent,
                    preferredFields: [
                        ...(currentTemplate.extractedFields || []),
                        ...converted.extractedFields
                    ],
                    existingSchema: converted.fieldSchema
                });
                const mergedAudit = evaluateTemplateCoverage({
                    fields: mergedAcrossSides.extractedFields,
                    mappedTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length,
                    totalTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length
                });

                setCurrentTemplate((prev) => ({
                    ...prev,
                    backSvgContent: converted.svgContent,
                    extractedFields: mergedAcrossSides.extractedFields,
                    fieldSchema: mergedAcrossSides.fieldSchema
                }));
                const importedBackCanvas = alignCanvasSizeWithSource(
                    svgTemplateToCanvasTemplate(converted.svgContent),
                    canvasTemplate
                );
                setBackCanvasTemplate(importedBackCanvas);
                setIsBackCanvasDirty(false);
                setAiReport(converted.report);
                setAiWarnings([
                    ...converted.warnings,
                    'Back-side card size stays synced with front side.'
                ]);
                setMappingAudit(converted.audit
                    ? { ...converted.audit, detectedFields: mergedAcrossSides.extractedFields }
                    : mergedAudit);
            } catch (error) {
                console.error('Back SVG file import failed:', error);
                const mergedAcrossSides = mergeTemplateSideFields({
                    frontSvgContent: currentTemplate.svgContent || '',
                    backSvgContent: rawSvg,
                    preferredFields: currentTemplate.extractedFields || [],
                    existingSchema: currentTemplate.fieldSchema || {}
                });
                setCurrentTemplate((prev) => ({
                    ...prev,
                    backSvgContent: rawSvg,
                    extractedFields: mergedAcrossSides.extractedFields,
                    fieldSchema: mergedAcrossSides.fieldSchema
                }));
                const importedBackCanvas = alignCanvasSizeWithSource(
                    svgTemplateToCanvasTemplate(rawSvg),
                    canvasTemplate
                );
                setBackCanvasTemplate(importedBackCanvas);
                setIsBackCanvasDirty(false);
                setAiReport([]);
                setAiWarnings([
                    'Back SVG parse error. Raw SVG loaded without AI conversion.',
                    'Back-side card size stays synced with front side.'
                ]);
                setMappingAudit(evaluateTemplateCoverage({
                    fields: mergedAcrossSides.extractedFields,
                    mappedTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length,
                    totalTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length
                }));
            } finally {
                setIsAiConverting(false);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleBackAnalyze = () => {
        if (!currentTemplate.backSvgContent) return;
        setBackTemplateInputMode('svg');

        const mergedAcrossSides = mergeTemplateSideFields({
            frontSvgContent: currentTemplate.svgContent || '',
            backSvgContent: currentTemplate.backSvgContent || '',
            preferredFields: [
                ...(currentTemplate.extractedFields || []),
                ...extractFieldsFromSvg(currentTemplate.backSvgContent)
            ],
            existingSchema: currentTemplate.fieldSchema || {}
        });
        setCurrentTemplate((prev) => ({
            ...prev,
            extractedFields: mergedAcrossSides.extractedFields,
            fieldSchema: mergedAcrossSides.fieldSchema
        }));
        setBackCanvasTemplate(alignCanvasSizeWithSource(
            svgTemplateToCanvasTemplate(currentTemplate.backSvgContent),
            canvasTemplate
        ));
        setIsBackCanvasDirty(false);
        setAiReport([]);
        setAiWarnings([]);
        setMappingAudit(evaluateTemplateCoverage({
            fields: mergedAcrossSides.extractedFields,
            mappedTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length,
            totalTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length
        }));
    };

    const handleBackAiConvert = async () => {
        if (!currentTemplate.backSvgContent) return;

        try {
            setIsAiConverting(true);
            setBackTemplateInputMode('svg');
            const converted = await convertSvgToTemplate(currentTemplate.backSvgContent, currentTemplate.fieldSchema || {}, {
                referenceImageDataUrl: referenceImage.dataUrl,
                referenceImageMimeType: referenceImage.mimeType
            });
            const mergedAcrossSides = mergeTemplateSideFields({
                frontSvgContent: currentTemplate.svgContent || '',
                backSvgContent: converted.svgContent,
                preferredFields: [
                    ...(currentTemplate.extractedFields || []),
                    ...converted.extractedFields
                ],
                existingSchema: converted.fieldSchema
            });
            const mergedAudit = evaluateTemplateCoverage({
                fields: mergedAcrossSides.extractedFields,
                mappedTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length,
                totalTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length
            });
            setCurrentTemplate((prev) => ({
                ...prev,
                backSvgContent: converted.svgContent,
                extractedFields: mergedAcrossSides.extractedFields,
                fieldSchema: mergedAcrossSides.fieldSchema
            }));
            setBackCanvasTemplate(alignCanvasSizeWithSource(
                svgTemplateToCanvasTemplate(converted.svgContent),
                canvasTemplate
            ));
            setIsBackCanvasDirty(false);
            setAiReport(converted.report);
            setAiWarnings([
                ...converted.warnings,
                'Back-side card size stays synced with front side.'
            ]);
            setMappingAudit(converted.audit
                ? { ...converted.audit, detectedFields: mergedAcrossSides.extractedFields }
                : mergedAudit);
        } catch (error) {
            console.error('Back AI conversion failed:', error);
            alert('Back SVG parse failed. Please check your back-side SVG code.');
        } finally {
            setIsAiConverting(false);
        }
    };

    const handleSyncBackFields = () => {
        const mergedAcrossSides = mergeTemplateSideFields({
            frontSvgContent: currentTemplate.svgContent || '',
            backSvgContent: currentTemplate.backSvgContent || '',
            preferredFields: currentTemplate.extractedFields || [],
            existingSchema: currentTemplate.fieldSchema || {}
        });
        setCurrentTemplate((prev) => ({
            ...prev,
            extractedFields: mergedAcrossSides.extractedFields,
            fieldSchema: mergedAcrossSides.fieldSchema
        }));
        setBackCanvasTemplate(
            currentTemplate.backSvgContent?.trim()
                ? alignCanvasSizeWithSource(
                    svgTemplateToCanvasTemplate(currentTemplate.backSvgContent),
                    canvasTemplate
                )
                : alignCanvasSizeWithSource(createBlankCanvasTemplate(), canvasTemplate)
        );
        setIsBackCanvasDirty(false);
        setMappingAudit(evaluateTemplateCoverage({
            fields: mergedAcrossSides.extractedFields,
            mappedTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length,
            totalTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length
        }));
    };

    const clearBackSideTemplate = () => {
        const mergedAcrossSides = mergeTemplateSideFields({
            frontSvgContent: currentTemplate.svgContent || '',
            backSvgContent: '',
            preferredFields: currentTemplate.extractedFields || [],
            existingSchema: currentTemplate.fieldSchema || {}
        });
        setCurrentTemplate((prev) => ({
            ...prev,
            backSvgContent: '',
            extractedFields: mergedAcrossSides.extractedFields,
            fieldSchema: mergedAcrossSides.fieldSchema
        }));
        setBackCanvasTemplate(alignCanvasSizeWithSource(createBlankCanvasTemplate(), canvasTemplate));
        setBackTemplateInputMode('canvas');
        setIsBackCanvasDirty(false);
        setMappingAudit(evaluateTemplateCoverage({
            fields: mergedAcrossSides.extractedFields,
            mappedTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length,
            totalTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length
        }));
    };

    const handleReferenceImageImport = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            alert('Reference file must be an image (JPG/PNG/WebP).');
            return;
        }
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            setReferenceImage({
                dataUrl: String(loadEvent.target?.result || ''),
                mimeType: file.type || 'image/jpeg',
                fileName: file.name || ''
            });
        };
        reader.readAsDataURL(file);
        event.target.value = '';
    };

    const clearReferenceImage = () => {
        setReferenceImage({
            dataUrl: '',
            mimeType: '',
            fileName: ''
        });
    };

    const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim();

    const parseSvgNumber = (value) => {
        if (!value) return null;
        const match = String(value).match(/-?\d+(\.\d+)?/);
        return match ? parseFloat(match[0]) : null;
    };

    const parseFontSize = (element) => {
        if (!element) return null;
        const attrSize = parseSvgNumber(element.getAttribute('font-size'));
        if (attrSize) return attrSize;
        const style = element.getAttribute('style') || '';
        const match = style.match(/font-size\s*:\s*([^;]+)/i);
        if (match) {
            return parseSvgNumber(match[1]);
        }
        return null;
    };

    const parseFontSizeWithFallback = (primary, fallback) => (
        parseFontSize(primary)
        || parseFontSize(fallback)
        || null
    );

    const buildTextDescriptors = (svg) => {
        const descriptors = [];
        const textElements = Array.from(svg.querySelectorAll('text')).filter(node => !node.closest('defs'));

        textElements.forEach((textElement) => {
            const directTspans = Array.from(textElement.children || []).filter(
                child => child.tagName?.toLowerCase?.() === 'tspan'
            );
            const meaningfulTspans = directTspans
                .map((tspan) => ({
                    tspan,
                    text: normalizeText(tspan.textContent)
                }))
                .filter(item => item.text);

            if (meaningfulTspans.length >= 2) {
                meaningfulTspans.forEach((item) => {
                    descriptors.push({
                        node: textElement,
                        targetNode: item.tspan,
                        targetType: 'tspan',
                        text: item.text,
                        x: parseSvgNumber(item.tspan.getAttribute('x') || textElement.getAttribute('x')),
                        y: parseSvgNumber(item.tspan.getAttribute('y') || textElement.getAttribute('y')),
                        fontSize: parseFontSizeWithFallback(item.tspan, textElement),
                        textAnchor: item.tspan.getAttribute('text-anchor') || textElement.getAttribute('text-anchor') || '',
                        fontWeight: item.tspan.getAttribute('font-weight') || textElement.getAttribute('font-weight') || ''
                    });
                });
                return;
            }

            const text = normalizeText(textElement.textContent);
            if (!text) return;

            descriptors.push({
                node: textElement,
                targetNode: textElement,
                targetType: 'text',
                text,
                x: parseSvgNumber(textElement.getAttribute('x') || textElement.querySelector('tspan')?.getAttribute('x')),
                y: parseSvgNumber(textElement.getAttribute('y') || textElement.querySelector('tspan')?.getAttribute('y')),
                fontSize: parseFontSizeWithFallback(textElement, textElement.querySelector('tspan')),
                textAnchor: textElement.getAttribute('text-anchor') || '',
                fontWeight: textElement.getAttribute('font-weight') || ''
            });
        });

        return descriptors.map((item, index) => ({ ...item, index }));
    };

    const looksLikeName = (text) => {
        const words = text.split(' ').filter(Boolean);
        if (words.length < 2 || words.length > 4) return false;
        if (/\d/.test(text)) return false;
        const upperStart = words.filter(word => {
            const first = word.trim()[0];
            if (!first) return false;
            return first.toUpperCase() === first && first.toLowerCase() !== first;
        }).length;
        return upperStart >= Math.max(1, words.length - 1);
    };

    const guessFieldForText = (rawText) => {
        const text = normalizeText(rawText);
        if (!text) return null;
        const lower = text.toLowerCase();

        const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
        const phonePattern = /(\+?\d[\d\s().-]{6,}\d)/;
        const urlPattern = /(https?:\/\/|www\.)[^\s]+/i;
        const domainPattern = /\b[a-z0-9-]+\.(com|net|org|mn|io|co|me|dev|ai|app)\b/i;

        if (emailPattern.test(text)) {
            return { field: 'email', confidence: 0.98, reason: 'Email pattern', strength: 'strong' };
        }
        if (phonePattern.test(text)) {
            return { field: 'phone', confidence: 0.92, reason: 'Phone pattern', strength: 'strong' };
        }
        if (urlPattern.test(text) || domainPattern.test(text)) {
            return { field: 'web', confidence: 0.9, reason: 'Website pattern', strength: 'strong' };
        }

        if (lower.includes('facebook') || lower.includes('fb.com') || lower.startsWith('fb/')) {
            return { field: 'socialFacebook', confidence: 0.9, reason: 'Facebook handle', strength: 'strong' };
        }
        if (lower.includes('instagram') || lower.includes('ig.com') || lower.startsWith('ig/')) {
            return { field: 'socialInstagram', confidence: 0.9, reason: 'Instagram handle', strength: 'strong' };
        }
        if (lower.includes('linkedin') || lower.includes('lnkd.in')) {
            return { field: 'socialLinkedin', confidence: 0.9, reason: 'LinkedIn handle', strength: 'strong' };
        }
        if (lower.includes('twitter') || lower.includes('x.com') || lower.startsWith('@')) {
            return { field: 'socialX', confidence: 0.85, reason: 'X/Twitter handle', strength: 'strong' };
        }

        const companyKeywords = ['llc', 'inc', 'ltd', 'company', 'group', 'corp', 'gmbh', 'plc', 'agency', 'studio', 'labs', 'systems', 'solutions', 'tech', 'digital', 'xxk', 'ххк', 'компани', 'групп', 'банк', 'сан'];
        if (companyKeywords.some(keyword => lower.includes(keyword)) || (text.split(' ').length <= 3 && text === text.toUpperCase() && text.length >= 3)) {
            return { field: 'company', confidence: 0.72, reason: 'Company keyword', strength: 'medium' };
        }

        const roleKeywords = ['ceo', 'cto', 'cfo', 'coo', 'founder', 'manager', 'director', 'marketing', 'engineer', 'designer', 'developer', 'consultant', 'sales', 'lead', 'chief', 'захирал', 'менежер', 'мэргэжилтэн', 'инженер', 'дизайнер', 'хөгжүүлэгч', 'дарга', 'төслийн', 'зөвлөх'];
        if (roleKeywords.some(keyword => lower.includes(keyword))) {
            return { field: 'position', confidence: 0.7, reason: 'Role keyword', strength: 'medium' };
        }

        const addressKeywords = ['street', 'avenue', 'road', 'suite', 'floor', 'tower', 'building', 'blvd', 'drive', 'district', 'city', 'state', 'zip', 'box', 'хороо', 'дүүрэг', 'улаанбаатар', 'уланбаатар', 'тоот', 'гудамж', 'аймаг', 'сум', 'хот', 'баг', 'байр', 'давхар'];
        if ((/\d/.test(text) && text.length >= 10) || addressKeywords.some(keyword => lower.includes(keyword))) {
            return { field: 'address', confidence: 0.68, reason: 'Address pattern', strength: 'medium' };
        }

        if (looksLikeName(text)) {
            return { field: 'fullName', confidence: 0.62, reason: 'Name-like text', strength: 'weak' };
        }

        if (text.length >= 20 || text.split(' ').length >= 4) {
            return { field: 'tagline', confidence: 0.55, reason: 'Long text', strength: 'weak' };
        }

        return null;
    };

    const normalizeSuggestedField = (rawField, type = 'text', fallbackIndex = 1) => {
        const raw = toFieldKey(rawField);
        const aliasMap = {
            name: 'fullName',
            fullname: 'fullName',
            personname: 'fullName',
            firstname: 'firstName',
            lastname: 'lastName',
            organization: 'company',
            org: 'company',
            companyname: 'company',
            dept: 'department',
            department: 'department',
            title: 'position',
            jobtitle: 'position',
            role: 'position',
            mobile: 'phone',
            mobilephone: 'mobilePhone',
            tel: 'phone',
            telephone: 'phone',
            mail: 'email',
            website: 'web',
            url: 'web',
            location: 'address',
            slogan: 'tagline',
            moto: 'tagline',
            twitter: 'socialX',
            x: 'socialX',
            linkedin: 'socialLinkedin',
            instagram: 'socialInstagram',
            facebook: 'socialFacebook',
            brand: 'logo',
            brandlogo: 'logo',
            logoimage: 'logo'
        };
        if (raw && aliasMap[raw]) return aliasMap[raw];
        if (raw) return raw;
        if (type === 'image') return `image${fallbackIndex}`;
        return `field${fallbackIndex}`;
    };

    const requestVisionFieldMappings = async ({ svgContent, textDescriptors, imageDescriptors, imageDataUrl, imageMimeType }) => {
        const payload = {
            svg: svgContent,
            textNodes: textDescriptors,
            imageNodes: imageDescriptors,
            referenceImageDataUrl: imageDataUrl || '',
            referenceImageMimeType: imageMimeType || 'image/jpeg'
        };

        try {
            const response = await apiFetch('/ai/business-card-map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                const data = await response.json();
                const mapped = data?.data || {};
                return {
                    textFields: Array.isArray(mapped.textFields) ? mapped.textFields : [],
                    imageFields: Array.isArray(mapped.imageFields) ? mapped.imageFields : [],
                    mode: typeof mapped.mode === 'string' ? mapped.mode : '',
                    audit: mapped?.audit && typeof mapped.audit === 'object' ? mapped.audit : null
                };
            }
        } catch (error) {
            console.warn('Server vision mapping request failed:', error);
        }

        // Optional client-side fallback when browser key exists.
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey || !imageDataUrl) return null;
        try {
            const modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: modelName });

            const imageBase64 = String(imageDataUrl).split(',')[1];
            if (!imageBase64) return null;

            const result = await model.generateContent([
                AI_SYSTEM_PROMPT,
                AI_USER_PROMPT,
                JSON.stringify(payload),
                {
                    inlineData: {
                        data: imageBase64,
                        mimeType: imageMimeType || 'image/jpeg'
                    }
                }
            ]);

            const text = result?.response?.text?.() || '';
            const parsed = parseAiJsonResponse(text);
            if (!parsed || typeof parsed !== 'object') return null;
            return {
                textFields: Array.isArray(parsed.textFields) ? parsed.textFields : [],
                imageFields: Array.isArray(parsed.imageFields) ? parsed.imageFields : [],
                mode: 'client_ai',
                audit: null
            };
        } catch (error) {
            console.warn('Client vision mapping fallback failed:', error);
            return null;
        }
    };

    const applyTextPlaceholder = (textElement, placeholder) => {
        // Some SVGs mix plain text + tspans in one <text>. If we only replace tspans,
        // leftover plain text remains (e.g. "От{{fullName}}баяр").
        // Copy position attrs from the first tspan when missing, then fully replace content.
        const firstTspan = textElement.querySelector('tspan');
        if (firstTspan) {
            ['x', 'y', 'dx', 'dy'].forEach((attr) => {
                if (!textElement.hasAttribute(attr) && firstTspan.hasAttribute(attr)) {
                    textElement.setAttribute(attr, firstTspan.getAttribute(attr));
                }
            });
        }
        textElement.textContent = placeholder;
    };

    const applyPlaceholderToDescriptor = (descriptor, placeholder) => {
        if (!descriptor || !descriptor.targetNode) return;
        if (descriptor.targetType === 'tspan') {
            descriptor.targetNode.textContent = placeholder;
            return;
        }
        applyTextPlaceholder(descriptor.node, placeholder);
    };

    const extractPlaceholderField = (value) => {
        const match = String(value || '').match(/^\{\{\s*([^}]+)\s*\}\}$/);
        return match ? match[1].trim() : '';
    };

    const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const replaceFieldPlaceholders = (svgContent, oldField, nextField) => {
        if (!svgContent || !oldField || !nextField || oldField === nextField) return svgContent;
        const pattern = new RegExp(`\\{\\{\\s*${escapeRegExp(oldField)}\\s*\\}\\}`, 'g');
        return svgContent.replace(pattern, `{{${nextField}}}`);
    };

    const buildImageFieldName = (image, index, usedFieldNames) => {
        const id = image.getAttribute('id') || '';
        const className = image.getAttribute('class') || '';
        const aria = image.getAttribute('aria-label') || '';
        const title = image.getAttribute('title') || '';
        const source = `${id} ${className} ${aria} ${title}`.trim();
        const lower = source.toLowerCase();

        if (lower.includes('logo')) return ensureUniqueFieldName('logo', usedFieldNames);
        if (lower.includes('icon')) return ensureUniqueFieldName('icon', usedFieldNames);
        if (lower.includes('avatar') || lower.includes('profile')) return ensureUniqueFieldName('avatar', usedFieldNames);
        if (lower.includes('photo') || lower.includes('picture')) return ensureUniqueFieldName('photo', usedFieldNames);

        const derived = toFieldKey(source);
        if (derived) return ensureUniqueFieldName(derived, usedFieldNames);
        return ensureUniqueFieldName(`image${index + 1}`, usedFieldNames);
    };

    const convertSvgToTemplate = async (svgContent, existingSchema = {}, options = {}) => {
        const warnings = [];
        const report = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgContent, 'image/svg+xml');
        if (doc.querySelector('parsererror')) {
            throw new Error('SVG parse error');
        }
        const svg = doc.querySelector('svg');
        if (!svg) {
            throw new Error('No <svg> root element found');
        }

        const textNodes = buildTextDescriptors(svg);
        const imageNodes = Array.from(svg.querySelectorAll('image')).filter(node => !node.closest('defs'));

        let visionMappings = null;
        try {
            visionMappings = await requestVisionFieldMappings({
                svgContent,
                textDescriptors: textNodes.map((item) => ({
                    index: item.index,
                    text: item.text,
                    fontSize: item.fontSize,
                    x: item.x,
                    y: item.y,
                    textAnchor: item.textAnchor,
                    fontWeight: item.fontWeight
                })),
                imageDescriptors: imageNodes.map((image, index) => ({
                    index,
                    id: image.getAttribute('id') || '',
                    class: image.getAttribute('class') || '',
                    ariaLabel: image.getAttribute('aria-label') || '',
                    title: image.getAttribute('title') || '',
                    href: image.getAttribute('href') || image.getAttribute('xlink:href') || '',
                    x: parseSvgNumber(image.getAttribute('x')),
                    y: parseSvgNumber(image.getAttribute('y')),
                    width: parseSvgNumber(image.getAttribute('width')),
                    height: parseSvgNumber(image.getAttribute('height'))
                })),
                imageDataUrl: options.referenceImageDataUrl,
                imageMimeType: options.referenceImageMimeType
            });
        } catch (error) {
            console.warn('Vision field mapping failed:', error);
            warnings.push('Vision AI mapping request failed. Local fallback rules were used.');
        }

        if (visionMappings?.textFields?.length || visionMappings?.imageFields?.length) {
            const mode = visionMappings.mode || 'ai_hybrid';
            if (mode === 'ai') warnings.push('Vision AI mapping fully applied.');
            else if (mode === 'ai_hybrid') warnings.push('Vision AI + heuristic mapping applied.');
            else warnings.push('Heuristic mapping applied by server.');

            const completenessScore = Number(visionMappings?.audit?.completenessScore);
            if (Number.isFinite(completenessScore)) {
                warnings.push(`Business-card completeness score: ${Math.round(completenessScore)} / 100`);
            }
            const missingCriticalFields = Array.isArray(visionMappings?.audit?.missingCriticalFields)
                ? visionMappings.audit.missingCriticalFields.filter(Boolean)
                : [];
            if (missingCriticalFields.length > 0) {
                warnings.push(`Missing critical fields: ${missingCriticalFields.join(', ')}`);
            }
            const missingRecommendedFields = Array.isArray(visionMappings?.audit?.missingRecommendedFields)
                ? visionMappings.audit.missingRecommendedFields.filter(Boolean)
                : [];
            if (missingRecommendedFields.length > 0) {
                warnings.push(`Missing recommended fields: ${missingRecommendedFields.join(', ')}`);
            }
            const auditNotes = Array.isArray(visionMappings?.audit?.notes)
                ? visionMappings.audit.notes.filter(Boolean).slice(0, 3)
                : [];
            auditNotes.forEach((note) => warnings.push(note));
        } else if (!visionMappings) {
            if (options.referenceImageDataUrl) {
                warnings.push('Reference image was provided but vision mapping is unavailable. Local fallback rules were used.');
            } else {
                warnings.push('Server AI mapping unavailable. Local fallback rules were used.');
            }
        }

        const aiTextByIndex = new Map();
        (visionMappings?.textFields || []).forEach((item) => {
            const idx = Number(item?.index);
            if (!Number.isInteger(idx) || idx < 0) return;
            aiTextByIndex.set(idx, item);
        });
        const aiImageByIndex = new Map();
        (visionMappings?.imageFields || []).forEach((item) => {
            const idx = Number(item?.index);
            if (!Number.isInteger(idx) || idx < 0) return;
            aiImageByIndex.set(idx, item);
        });

        const assignments = new Map();
        const usedFields = new Set();
        const fieldSampleMap = new Map();
        const uniqueFields = new Set([
            'fullName',
            'firstName',
            'lastName',
            'company',
            'department',
            'position',
            'phone',
            'mobilePhone',
            'email',
            'web',
            'address',
            'tagline',
            'socialFacebook',
            'socialInstagram',
            'socialLinkedin',
            'socialX'
        ]);

        const rememberAssignedSample = (field, sampleText) => {
            const normalizedSample = normalizeText(sampleText);
            if (!field || !normalizedSample) return;
            if (!fieldSampleMap.has(field)) fieldSampleMap.set(field, new Set());
            fieldSampleMap.get(field).add(normalizedSample);
        };

        const registerField = (index, guess, allowDuplicate = false, sampleText = '') => {
            if (!guess?.field) return false;
            if (assignments.has(index)) return false;
            const normalizedSample = normalizeText(sampleText);

            if (uniqueFields.has(guess.field) && usedFields.has(guess.field) && !allowDuplicate) {
                const knownSamples = fieldSampleMap.get(guess.field);
                if (normalizedSample && knownSamples?.has(normalizedSample)) {
                    assignments.set(index, {
                        ...guess,
                        reason: guess.reason ? `${guess.reason} (repeated sample)` : 'Repeated sample'
                    });
                    rememberAssignedSample(guess.field, normalizedSample);
                    return true;
                }
                const renamedField = ensureUniqueFieldName(guess.field, usedFields);
                assignments.set(index, {
                    ...guess,
                    field: renamedField,
                    reason: guess.reason ? `${guess.reason} (duplicate renamed)` : 'Duplicate renamed'
                });
                rememberAssignedSample(renamedField, normalizedSample);
                return true;
            }
            assignments.set(index, guess);
            usedFields.add(guess.field);
            rememberAssignedSample(guess.field, normalizedSample);
            return true;
        };

        textNodes.forEach(item => {
            const placeholderMatch = item.text.match(/\{\{\s*([^}]+)\s*\}\}/);
            if (placeholderMatch) {
                registerField(item.index, {
                    field: placeholderMatch[1].trim(),
                    confidence: 1,
                    reason: 'Existing placeholder',
                    strength: 'strong'
                }, true, item.text);
            }
        });

        textNodes.forEach((item) => {
            if (assignments.has(item.index)) return;
            const aiSuggestion = aiTextByIndex.get(item.index);
            if (!aiSuggestion) return;
            const field = normalizeSuggestedField(aiSuggestion.field, 'text', item.index + 1);
            registerField(item.index, {
                field,
                confidence: Number(aiSuggestion.confidence) || 0.95,
                reason: aiSuggestion.reason || 'Vision AI mapping',
                strength: 'strong'
            }, false, item.text);
        });

        textNodes.forEach(item => {
            if (assignments.has(item.index)) return;
            const guess = guessFieldForText(item.text);
            if (guess && guess.strength === 'strong') {
                registerField(item.index, guess, false, item.text);
            }
        });

        textNodes.forEach(item => {
            if (assignments.has(item.index)) return;
            const guess = guessFieldForText(item.text);
            if (guess && guess.strength === 'medium') {
                registerField(item.index, guess, false, item.text);
            }
        });

        textNodes.forEach(item => {
            if (assignments.has(item.index)) return;
            const guess = guessFieldForText(item.text);
            if (guess && guess.strength === 'weak') {
                registerField(item.index, guess, false, item.text);
            }
        });

        const unassigned = textNodes.filter(item => !assignments.has(item.index))
            .sort((a, b) => (b.fontSize || 0) - (a.fontSize || 0));

        if (!usedFields.has('fullName') && unassigned[0]) {
            registerField(unassigned[0].index, {
                field: 'fullName',
                confidence: 0.5,
                reason: 'Largest text',
                strength: 'weak'
            }, true, unassigned[0].text);
        }
        if (!usedFields.has('position') && unassigned[1]) {
            registerField(unassigned[1].index, {
                field: 'position',
                confidence: 0.45,
                reason: 'Second largest text',
                strength: 'weak'
            }, true, unassigned[1].text);
        }

        const fallbackOrder = ['company', 'tagline', 'address', 'position', 'fullName'];
        textNodes.forEach((item, idx) => {
            if (assignments.has(item.index)) return;
            const field = fallbackOrder[idx % fallbackOrder.length];
            registerField(item.index, {
                field,
                confidence: 0.35,
                reason: 'Fallback assignment',
                strength: 'weak'
            }, true, item.text);
        });

        const extractedFields = [];
        const sourceSampleByField = new Map();
        const addField = (field) => {
            if (!field) return;
            if (!extractedFields.includes(field)) extractedFields.push(field);
            usedFields.add(field);
        };
        const rememberSourceSample = (field, sample) => {
            const normalizedSample = normalizeText(sample);
            if (!field || !normalizedSample) return;
            const existing = sourceSampleByField.get(field);
            if (!existing || (existing.startsWith('{{') && !normalizedSample.startsWith('{{'))) {
                sourceSampleByField.set(field, normalizedSample);
            }
        };

        assignments.forEach((guess, index) => {
            const item = textNodes.find(node => node.index === index);
            if (!item) return;
            applyPlaceholderToDescriptor(item, `{{${guess.field}}}`);
            addField(guess.field);
            rememberSourceSample(guess.field, item.text);
            report.push({
                type: 'text',
                sample: item.text,
                field: guess.field,
                confidence: guess.confidence,
                reason: guess.reason
            });
        });

        if (imageNodes.length === 0) {
            warnings.push('No <image> nodes detected. Vector icons (path/shape) stay static and are not upload fields. Convert icons to <image> in SVG to make them upload fields.');
        }

        imageNodes.forEach((image, index) => {
            const href = image.getAttribute('href') || image.getAttribute('xlink:href') || '';
            const existingField = extractPlaceholderField(href);
            const aiImageField = normalizeSuggestedField(aiImageByIndex.get(index)?.field, 'image', index + 1);
            const fieldName = existingField
                || (aiImageByIndex.has(index) ? ensureUniqueFieldName(aiImageField, usedFields) : buildImageFieldName(image, index, usedFields));
            if (existingField && !usedFields.has(existingField)) {
                usedFields.add(existingField);
            }

            image.setAttribute('href', `{{${fieldName}}}`);
            image.setAttribute('xlink:href', `{{${fieldName}}}`);
            image.setAttribute('preserveAspectRatio', 'none');

            addField(fieldName);
            rememberSourceSample(fieldName, `image#${index + 1}`);
            report.push({
                type: 'image',
                sample: `image#${index + 1}`,
                field: fieldName,
                confidence: existingField ? 1 : (aiImageByIndex.has(index) ? (Number(aiImageByIndex.get(index)?.confidence) || 0.95) : 0.9),
                reason: existingField
                    ? 'Existing placeholder'
                    : (aiImageByIndex.has(index)
                        ? (aiImageByIndex.get(index)?.reason || 'Vision AI mapping')
                        : 'Image node mapped to upload field')
            });
        });

        const fieldSchema = buildFieldSchema(extractedFields, existingSchema);
        extractedFields.forEach((field) => {
            const sourceSample = sourceSampleByField.get(field);
            fieldSchema[field] = {
                ...fieldSchema[field],
                sourceSample: sourceSample || fieldSchema[field]?.sourceSample || ''
            };
            if (!isImageFieldName(field)) return;
            fieldSchema[field] = {
                ...fieldSchema[field],
                type: 'image',
                placeholder: '',
                defaultValue: ''
            };
        });

        const localAudit = evaluateTemplateCoverage({
            fields: extractedFields,
            mappedTextCount: assignments.size,
            totalTextCount: textNodes.length
        });
        const mergedAudit = {
            ...localAudit,
            completenessScore: Number.isFinite(Number(visionMappings?.audit?.completenessScore))
                ? Math.round(Number(visionMappings.audit.completenessScore))
                : localAudit.completenessScore,
            textCoverage: Number.isFinite(Number(visionMappings?.audit?.textCoverage))
                ? Math.round(Number(visionMappings.audit.textCoverage))
                : localAudit.textCoverage,
            missingRecommendedFields: [...new Set([
                ...localAudit.missingRecommendedFields,
                ...(Array.isArray(visionMappings?.audit?.missingRecommendedFields)
                    ? visionMappings.audit.missingRecommendedFields.filter(Boolean)
                    : [])
            ])],
            missingCriticalFields: [...new Set([
                ...localAudit.missingCriticalFields,
                ...(Array.isArray(visionMappings?.audit?.missingCriticalFields)
                    ? visionMappings.audit.missingCriticalFields.filter(Boolean)
                    : [])
            ])],
            detectedFields: [...new Set([
                ...localAudit.detectedFields,
                ...(Array.isArray(visionMappings?.audit?.detectedFields)
                    ? visionMappings.audit.detectedFields.filter(Boolean)
                    : [])
            ])],
            notes: [...new Set([
                ...localAudit.notes,
                ...(Array.isArray(visionMappings?.audit?.notes)
                    ? visionMappings.audit.notes.filter(Boolean)
                    : [])
            ])]
        };

        return {
            svgContent: new XMLSerializer().serializeToString(svg),
            extractedFields,
            fieldSchema,
            report,
            warnings,
            audit: mergedAudit
        };
    };

    const handleAiConvert = async () => {
        if (!currentTemplate.svgContent) return;

        try {
            setIsAiConverting(true);
            setTemplateInputMode('svg');
            const converted = await convertSvgToTemplate(currentTemplate.svgContent, currentTemplate.fieldSchema || {}, {
                referenceImageDataUrl: referenceImage.dataUrl,
                referenceImageMimeType: referenceImage.mimeType
            });
            const mergedAcrossSides = mergeTemplateSideFields({
                frontSvgContent: converted.svgContent,
                backSvgContent: currentTemplate.backSvgContent || '',
                preferredFields: [
                    ...(currentTemplate.extractedFields || []),
                    ...converted.extractedFields
                ],
                existingSchema: converted.fieldSchema
            });
            const mergedAudit = evaluateTemplateCoverage({
                fields: mergedAcrossSides.extractedFields,
                mappedTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length,
                totalTextCount: mergedAcrossSides.extractedFields.filter((field) => !isImageFieldName(field)).length
            });
            setCurrentTemplate(prev => ({
                ...prev,
                svgContent: converted.svgContent,
                extractedFields: mergedAcrossSides.extractedFields,
                fieldSchema: mergedAcrossSides.fieldSchema
            }));
            const convertedFrontCanvas = svgTemplateToCanvasTemplate(converted.svgContent);
            setCanvasTemplate(convertedFrontCanvas);
            setBackCanvasTemplate((prevBack) => {
                const syncedBack = alignCanvasSizeWithSource(prevBack, convertedFrontCanvas);
                if (hasDifferentCanvasSize(prevBack, syncedBack) && hasCanvasNodes(syncedBack)) {
                    setIsBackCanvasDirty(true);
                }
                return syncedBack;
            });
            setIsCanvasDirty(false);
            setAiReport(converted.report);
            setAiWarnings(converted.warnings);
            setMappingAudit(converted.audit
                ? { ...converted.audit, detectedFields: mergedAcrossSides.extractedFields }
                : mergedAudit);
        } catch (error) {
            console.error('AI conversion failed:', error);
            alert('SVG parse failed. Please check your SVG code.');
        } finally {
            setIsAiConverting(false);
        }
    };

    const handleSave = async () => {
        try {
            if (!currentTemplate.name?.trim()) {
                alert('Template name is required.');
                return;
            }

            let workingFrontSvgContent = currentTemplate.svgContent;
            let workingBackSvgContent = String(currentTemplate.backSvgContent || '');
            let workingExtractedFields = Array.isArray(currentTemplate.extractedFields)
                ? currentTemplate.extractedFields
                : [];
            let workingFieldSchema = currentTemplate.fieldSchema || {};
            let workingCanvasTemplate = currentTemplate.canvasTemplate || null;
            let workingBackCanvasTemplate = currentTemplate.backCanvasTemplate || null;

            if (templateInputMode === 'canvas') {
                const synced = syncCanvasToSvgTemplate({ silentWarning: true });
                if (!synced) return;
                workingFrontSvgContent = synced.svgContent;
                workingExtractedFields = synced.extractedFields;
                workingFieldSchema = synced.fieldSchema;
                workingCanvasTemplate = synced.canvasTemplate;
            }
            if (backTemplateInputMode === 'canvas') {
                const hasBackCanvasNodes = hasCanvasNodes(backCanvasTemplate);
                if (hasBackCanvasNodes && (isBackCanvasDirty || !workingBackSvgContent?.trim())) {
                    const syncedBack = syncBackCanvasToSvgTemplate({ silentWarning: true });
                    if (!syncedBack) return;
                    workingBackSvgContent = syncedBack.svgContent || '';
                    workingExtractedFields = syncedBack.extractedFields;
                    workingFieldSchema = syncedBack.fieldSchema;
                    workingBackCanvasTemplate = syncedBack.canvasTemplate;
                } else if (!hasBackCanvasNodes) {
                    workingBackSvgContent = '';
                    workingBackCanvasTemplate = alignCanvasSizeWithSource(backCanvasTemplate, workingCanvasTemplate || canvasTemplate);
                } else {
                    workingBackCanvasTemplate = alignCanvasSizeWithSource(backCanvasTemplate, workingCanvasTemplate || canvasTemplate);
                }
            } else {
                workingBackCanvasTemplate = alignCanvasSizeWithSource(backCanvasTemplate, workingCanvasTemplate || canvasTemplate);
            }

            workingCanvasTemplate = normalizeCanvasTemplate(workingCanvasTemplate || canvasTemplate);
            workingBackCanvasTemplate = alignCanvasSizeWithSource(
                workingBackCanvasTemplate || backCanvasTemplate,
                workingCanvasTemplate
            );

            if (!workingFrontSvgContent?.trim()) {
                alert('Front-side SVG code is required.');
                return;
            }

            const mergedAcrossSides = mergeTemplateSideFields({
                frontSvgContent: workingFrontSvgContent,
                backSvgContent: workingBackSvgContent,
                preferredFields: workingExtractedFields || [],
                existingSchema: workingFieldSchema || {}
            });
            const extractedFields = mergedAcrossSides.extractedFields;
            const fieldSchema = mergedAcrossSides.fieldSchema;
            const currentAudit = evaluateTemplateCoverage({
                fields: extractedFields,
                mappedTextCount: extractedFields.filter(field => !isImageFieldName(field)).length,
                totalTextCount: extractedFields.filter(field => !isImageFieldName(field)).length
            });
            const frontIntegrity = validateTemplateIntegrity({
                svgContent: workingFrontSvgContent,
                extractedFields,
                fieldSchema
            });
            const hasBackSide = Boolean(workingBackSvgContent.trim());
            const backIntegrity = hasBackSide
                ? validateTemplateIntegrity({
                    svgContent: workingBackSvgContent,
                    extractedFields,
                    fieldSchema
                })
                : createEmptyIntegrityReport();
            const integrity = combineIntegrityReports({
                frontReport: frontIntegrity,
                backReport: backIntegrity,
                hasBackSide
            });

            if (integrity.blockingIssues.length > 0) {
                alert(`Template validation failed:\n- ${integrity.blockingIssues.join('\n- ')}`);
                return;
            }

            if (currentAudit.missingCriticalFields.length > 0) {
                const allowSave = window.confirm(
                    `Critical fields missing: ${currentAudit.missingCriticalFields.join(', ')}.\nYou can still save, but template quality is low.\n\nContinue saving?`
                );
                if (!allowSave) return;
            }
            if (integrity.warnings.length > 0) {
                const allowSaveWithWarnings = window.confirm(
                    `Template has warnings:\n- ${integrity.warnings.join('\n- ')}\n\nContinue saving?`
                );
                if (!allowSaveWithWarnings) return;
            }

            const templateData = {
                name: currentTemplate.name,
                svgContent: workingFrontSvgContent,
                backSvgContent: workingBackSvgContent,
                extractedFields,
                fieldSchema,
                mappingAudit: currentAudit,
                mappingIntegrity: integrity,
                backMappingIntegrity: backIntegrity,
                canvasTemplate: workingCanvasTemplate,
                backCanvasTemplate: workingBackCanvasTemplate,
                templateInputMode,
                backTemplateInputMode,
                updatedAt: serverTimestamp()
            };

            if (currentTemplate.id) {
                await updateDoc(doc(db, 'businessCardTemplates', currentTemplate.id), templateData);
            } else {
                await addDoc(collection(db, 'businessCardTemplates'), {
                    ...templateData,
                    createdAt: serverTimestamp()
                });
            }

            resetEditorState();
            fetchTemplates();
        } catch (error) {
            console.error("Error saving template:", error);
            alert("Error saving template");
        }
    };

    const handleEdit = (template) => {
        const mergedAcrossSides = mergeTemplateSideFields({
            frontSvgContent: template.svgContent || '',
            backSvgContent: template.backSvgContent || '',
            preferredFields: Array.isArray(template.extractedFields) ? template.extractedFields : [],
            existingSchema: template.fieldSchema || {}
        });
        const extractedFields = mergedAcrossSides.extractedFields;
        const canvasSource = template.canvasTemplate
            ? normalizeCanvasTemplate(template.canvasTemplate)
            : svgTemplateToCanvasTemplate(template.svgContent || '');
        const backCanvasSourceRaw = template.backCanvasTemplate
            ? normalizeCanvasTemplate(template.backCanvasTemplate)
            : (template.backSvgContent?.trim()
                ? svgTemplateToCanvasTemplate(template.backSvgContent)
                : createBlankCanvasTemplate());
        const backCanvasSource = alignCanvasSizeWithSource(backCanvasSourceRaw, canvasSource);
        const preferredMode = template.templateInputMode === 'canvas'
            ? 'canvas'
            : (template.templateInputMode === 'svg'
                ? 'svg'
                : (template.canvasTemplate ? 'canvas' : 'svg'));
        const preferredBackMode = template.backTemplateInputMode === 'canvas'
            ? 'canvas'
            : (template.backTemplateInputMode === 'svg'
                ? 'svg'
                : (template.backCanvasTemplate ? 'canvas' : (template.backSvgContent?.trim() ? 'svg' : 'canvas')));

        setCurrentTemplate({
            ...template,
            backSvgContent: template.backSvgContent || '',
            extractedFields,
            fieldSchema: mergedAcrossSides.fieldSchema,
            canvasTemplate: canvasSource,
            backCanvasTemplate: backCanvasSource
        });
        setCanvasTemplate(canvasSource);
        setTemplateInputMode(preferredMode);
        setIsCanvasDirty(false);
        setBackCanvasTemplate(backCanvasSource);
        setBackTemplateInputMode(preferredBackMode);
        setIsBackCanvasDirty(false);
        setIsEditing(true);
        setAiReport([]);
        setAiWarnings([]);
        setShowAiMappingDetails(false);
        setShowValidationDetails(false);
        setShowPreviewDataControls(false);
        setEditorTab('design');
        setMappingAudit(template.mappingAudit || evaluateTemplateCoverage({
            fields: extractedFields,
            mappedTextCount: extractedFields.filter(field => !isImageFieldName(field)).length,
            totalTextCount: extractedFields.filter(field => !isImageFieldName(field)).length
        }));
        clearReferenceImage();
    };

    const renameFieldMapping = (currentField, nextFieldInput) => {
        const normalizedName = toFieldKey(nextFieldInput);
        if (!normalizedName) return currentField;

        let resolvedField = currentField;
        let nextFieldsAfterRename = null;
        setCurrentTemplate((prev) => {
            const prevFields = prev.extractedFields || [];
            if (!prevFields.includes(currentField)) return prev;

            const usedNames = new Set(prevFields.filter(field => field !== currentField));
            const nextField = ensureUniqueFieldName(normalizedName, usedNames);
            resolvedField = nextField;
            if (nextField === currentField) return prev;

            const nextExtractedFields = [];
            prevFields.forEach((field) => {
                const mapped = field === currentField ? nextField : field;
                if (!nextExtractedFields.includes(mapped)) nextExtractedFields.push(mapped);
            });
            nextFieldsAfterRename = nextExtractedFields;

            const currentSchema = prev.fieldSchema || {};
            const currentConfig = currentSchema[currentField] || buildDefaultFieldConfig(currentField);
            const currentDefaultLabel = defaultFieldLabels[currentField] || toTitleCase(currentField);
            const nextDefaultLabel = defaultFieldLabels[nextField] || toTitleCase(nextField);

            const nextSchema = { ...currentSchema };
            delete nextSchema[currentField];
            nextSchema[nextField] = {
                ...buildDefaultFieldConfig(nextField),
                ...currentConfig,
                label: !currentConfig.label || currentConfig.label === currentDefaultLabel ? nextDefaultLabel : currentConfig.label,
                type: normalizeFieldType(nextField, currentConfig.type),
                sourceSample: currentConfig.sourceSample || ''
            };

            return {
                ...prev,
                svgContent: replaceFieldPlaceholders(prev.svgContent, currentField, nextField),
                backSvgContent: replaceFieldPlaceholders(prev.backSvgContent, currentField, nextField),
                extractedFields: nextExtractedFields,
                fieldSchema: nextSchema
            };
        });

        if (resolvedField !== currentField) {
            if (nextFieldsAfterRename) {
                setMappingAudit(evaluateTemplateCoverage({
                    fields: nextFieldsAfterRename,
                    mappedTextCount: nextFieldsAfterRename.filter(field => !isImageFieldName(field)).length,
                    totalTextCount: nextFieldsAfterRename.filter(field => !isImageFieldName(field)).length
                }));
            }
            setPreviewData((prev) => {
                if (!(currentField in prev) || resolvedField in prev) return prev;
                const next = { ...prev, [resolvedField]: prev[currentField] };
                delete next[currentField];
                return next;
            });
            setAiReport((prev) => prev.map(item => (
                item.field === currentField ? { ...item, field: resolvedField } : item
            )));
        }

        return resolvedField;
    };

    const getDetectedSourceSample = (field) => {
        const schemaSample = currentTemplate.fieldSchema?.[field]?.sourceSample;
        if (schemaSample) return schemaSample;
        const reportSample = aiReport.find(item => item.type === 'text' && item.field === field)?.sample;
        return reportSample || '';
    };

    const applyPreviewScenario = (mode = 'normal') => {
        const templateFields = currentTemplate.extractedFields?.length
            ? currentTemplate.extractedFields
            : Object.keys(previewData);
        const next = { ...previewData };

        templateFields.forEach((field) => {
            const fieldType = currentTemplate.fieldSchema?.[field]?.type || getDefaultFieldType(field);
            if (fieldType === 'image') {
                next[field] = field === 'logo' ? defaultLogoDataUrl : defaultImageDataUrl;
                return;
            }

            if (mode === 'empty') {
                next[field] = '';
                return;
            }
            if (mode === 'long') {
                next[field] = longPreviewSamples[field] || `${toTitleCase(field)} ${toTitleCase(field)} ${toTitleCase(field)}`;
                return;
            }

            const schemaDefault = currentTemplate.fieldSchema?.[field]?.defaultValue;
            next[field] = schemaDefault || defaultFieldPlaceholders[field] || toTitleCase(field);
        });

        setPreviewData(next);
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this template?")) return;
        try {
            await deleteDoc(doc(db, 'businessCardTemplates', id));
            fetchTemplates();
        } catch (error) {
            console.error("Error deleting template:", error);
        }
    };

    const renderPreview = (svgContent) => {
        const mergedPreview = { ...previewData };
        (currentTemplate.extractedFields || []).forEach((field) => {
            const fieldType = currentTemplate.fieldSchema?.[field]?.type || getDefaultFieldType(field);
            if (fieldType === 'image' && !mergedPreview[field]) {
                mergedPreview[field] = field === 'logo' ? defaultLogoDataUrl : defaultImageDataUrl;
                return;
            }
            if (mergedPreview[field] === undefined) {
                const fieldConfig = currentTemplate.fieldSchema?.[field];
                mergedPreview[field] = fieldConfig?.defaultValue || `[${field}]`;
            }
        });
        const processedSvg = populateBusinessCardSvg(svgContent, mergedPreview);

        return (
            <div
                className="business-card-render-preview w-full h-full flex items-center justify-center p-4 rounded border"
                dangerouslySetInnerHTML={{ __html: processedSvg }}
            />
        );
    };

    const previewEditableFields = (
        currentTemplate.extractedFields?.length
            ? currentTemplate.extractedFields
            : Object.keys(previewData)
    ).filter((field) => (currentTemplate.fieldSchema?.[field]?.type || getDefaultFieldType(field)) !== 'image');
    const textTemplateFields = (currentTemplate.extractedFields || []).filter(
        (field) => (currentTemplate.fieldSchema?.[field]?.type || getDefaultFieldType(field)) !== 'image'
    );
    const imageTemplateFields = (currentTemplate.extractedFields || []).filter(
        (field) => (currentTemplate.fieldSchema?.[field]?.type || getDefaultFieldType(field)) === 'image'
    );
    const frontIntegrityReport = validateTemplateIntegrity({
        svgContent: currentTemplate.svgContent,
        extractedFields: currentTemplate.extractedFields || [],
        fieldSchema: currentTemplate.fieldSchema || {}
    });
    const hasBackSideConfigured = Boolean(currentTemplate.backSvgContent?.trim());
    const backIntegrityReport = hasBackSideConfigured
        ? validateTemplateIntegrity({
            svgContent: currentTemplate.backSvgContent,
            extractedFields: currentTemplate.extractedFields || [],
            fieldSchema: currentTemplate.fieldSchema || {}
        })
        : createEmptyIntegrityReport();
    const integrityReport = combineIntegrityReports({
        frontReport: frontIntegrityReport,
        backReport: backIntegrityReport,
        hasBackSide: hasBackSideConfigured
    });
    const benchmarkTrend = useMemo(() => {
        const byDay = new Map();
        benchmarkHistory.forEach((run) => {
            const date = run.createdAtDate || toDateSafe(run.createdAt);
            const key = formatDateKey(date);
            if (!key) return;
            if (!byDay.has(key)) {
                byDay.set(key, {
                    totalScore: 0,
                    totalPassRate: 0,
                    count: 0
                });
            }
            const bucket = byDay.get(key);
            bucket.totalScore += Number(run?.summary?.averageScore || 0);
            bucket.totalPassRate += Number(run?.summary?.passRate || 0);
            bucket.count += 1;
        });

        const trend = [];
        const now = new Date();
        for (let index = 6; index >= 0; index -= 1) {
            const day = new Date(now);
            day.setHours(0, 0, 0, 0);
            day.setDate(day.getDate() - index);
            const key = formatDateKey(day);
            const bucket = byDay.get(key);
            const avgScore = bucket && bucket.count > 0 ? bucket.totalScore / bucket.count : null;
            const avgPassRate = bucket && bucket.count > 0 ? bucket.totalPassRate / bucket.count : null;
            trend.push({
                key,
                label: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
                avgScore,
                avgPassRate,
                count: bucket?.count || 0
            });
        }
        return trend;
    }, [benchmarkHistory]);
    const latestBenchmarkRun = benchmarkHistory[0] || null;
    const templateSummary = useMemo(() => {
        if (!templates.length) {
            return {
                total: 0,
                strongQualityCount: 0,
                averageQuality: 0,
                totalFields: 0
            };
        }

        const aggregates = templates.reduce((acc, template) => {
            const templateFields = Array.isArray(template.extractedFields)
                ? template.extractedFields
                : [...new Set([
                    ...extractFieldsFromSvg(template.svgContent || ''),
                    ...extractFieldsFromSvg(template.backSvgContent || '')
                ])];
            const fallbackAudit = evaluateTemplateCoverage({
                fields: templateFields,
                mappedTextCount: templateFields.filter(field => !isImageFieldName(field)).length,
                totalTextCount: templateFields.filter(field => !isImageFieldName(field)).length
            });
            const qualityScore = Math.round(Number(template?.mappingAudit?.completenessScore ?? fallbackAudit.completenessScore ?? 0));

            acc.totalQuality += qualityScore;
            acc.totalFields += templateFields.length;
            if (qualityScore >= 75) {
                acc.strongQualityCount += 1;
            }
            return acc;
        }, {
            totalQuality: 0,
            totalFields: 0,
            strongQualityCount: 0
        });

        return {
            total: templates.length,
            strongQualityCount: aggregates.strongQualityCount,
            averageQuality: Math.round(aggregates.totalQuality / templates.length),
            totalFields: aggregates.totalFields
        };
    }, [templates]);

    if (isEditing) {
        const templateNameReady = Boolean(currentTemplate.name?.trim());
        const frontSvgReady = Boolean(currentTemplate.svgContent?.trim());
        const backSvgReady = Boolean(currentTemplate.backSvgContent?.trim());
        const canvasReady = Array.isArray(canvasTemplate?.nodes) && canvasTemplate.nodes.length > 0;
        const backCanvasReady = Array.isArray(backCanvasTemplate?.nodes) && backCanvasTemplate.nodes.length > 0;
        const persistedDetectedFields = Array.isArray(currentTemplate.extractedFields) ? currentTemplate.extractedFields : [];
        const canvasDraftNodes = Array.isArray(canvasTemplate?.nodes) ? canvasTemplate.nodes : [];
        const canvasDraftFieldNames = [...new Set(
            canvasDraftNodes
                .map((node) => String(node?.field || '').trim())
                .filter(Boolean)
        )];
        const backCanvasDraftNodes = Array.isArray(backCanvasTemplate?.nodes) ? backCanvasTemplate.nodes : [];
        const backCanvasDraftFieldNames = [...new Set(
            backCanvasDraftNodes
                .map((node) => String(node?.field || '').trim())
                .filter(Boolean)
        )];
        const frontDraftActive = templateInputMode === 'canvas' && isCanvasDirty && canvasDraftFieldNames.length > 0;
        const backDraftActive = backTemplateInputMode === 'canvas' && isBackCanvasDirty && backCanvasDraftFieldNames.length > 0;
        const detectionUsesDraft = frontDraftActive || backDraftActive;
        const detectedFieldNames = detectionUsesDraft
            ? [...new Set([
                ...persistedDetectedFields,
                ...(frontDraftActive ? canvasDraftFieldNames : []),
                ...(backDraftActive ? backCanvasDraftFieldNames : [])
            ])]
            : persistedDetectedFields;
        const detectedTextCount = detectedFieldNames.filter(
            (field) => (currentTemplate.fieldSchema?.[field]?.type || getDefaultFieldType(field)) !== 'image'
        ).length;
        const detectedImageCount = detectedFieldNames.filter(
            (field) => (currentTemplate.fieldSchema?.[field]?.type || getDefaultFieldType(field)) === 'image'
        ).length;
        const totalDetectedFields = detectedFieldNames.length;
        const hasDetectedFields = totalDetectedFields > 0;
        const hasAiReport = aiReport.length > 0;
        const completenessScore = Number(mappingAudit?.completenessScore || 0);
        const hasCriticalGaps = Array.isArray(mappingAudit?.missingCriticalFields) && mappingAudit.missingCriticalFields.length > 0;
        const hasBlockingIntegrityIssues = integrityReport.blockingIssues.length > 0;
        const hasIntegrityWarnings = integrityReport.warnings.length > 0;
        const validationIssueCount = integrityReport.blockingIssues.length;
        const validationWarningCount = integrityReport.warnings.length;
        const requiresSvgForSave = templateInputMode === 'svg';
        const canAttemptSave = templateNameReady
            && (requiresSvgForSave ? frontSvgReady : canvasReady)
            && !isCanvasSyncing
            && !isBackCanvasSyncing
            && (!requiresSvgForSave || !hasBlockingIntegrityIssues);
        let editorPreviewSvgContent = currentTemplate.svgContent || '';
        let backEditorPreviewSvgContent = currentTemplate.backSvgContent || '';
        if (templateInputMode === 'canvas' && canvasReady) {
            try {
                editorPreviewSvgContent = canvasTemplateToSvgTemplate(canvasTemplate).svgContent || editorPreviewSvgContent;
            } catch (error) {
                console.warn('Failed to generate live canvas preview SVG:', error);
            }
        }
        if (backTemplateInputMode === 'canvas' && backCanvasReady) {
            try {
                backEditorPreviewSvgContent = canvasTemplateToSvgTemplate(backCanvasTemplate).svgContent || backEditorPreviewSvgContent;
            } catch (error) {
                console.warn('Failed to generate live back canvas preview SVG:', error);
            }
        }
        const hasBackPreviewConfigured = Boolean(backEditorPreviewSvgContent?.trim());
        const visibleDetectedFields = detectedFieldNames.slice(0, 10);
        const remainingDetectedFields = Math.max(0, totalDetectedFields - visibleDetectedFields.length);
        const visibleAiWarnings = showAiMappingDetails ? aiWarnings : aiWarnings.slice(0, 2);
        const showDesignTab = editorTab === 'design';
        const showMappingTab = editorTab === 'mapping';
        const showReviewTab = editorTab === 'review';

        let nextActionMessage = 'Ready to save.';
        if (!templateNameReady) {
            nextActionMessage = 'Template name оруулна.';
        } else if (templateInputMode === 'canvas' && !canvasReady) {
            nextActionMessage = 'Canvas дээр дор хаяж 1 field нэмнэ.';
        } else if (templateInputMode === 'canvas' && isCanvasDirty) {
            nextActionMessage = 'Canvas өөрчлөлтөө Sync To SVG хийнэ.';
        } else if (templateInputMode === 'svg' && !frontSvgReady) {
            nextActionMessage = 'SVG code эсвэл SVG file оруулна.';
        } else if (backTemplateInputMode === 'canvas' && isBackCanvasDirty && backCanvasReady) {
            nextActionMessage = 'Back canvas өөрчлөлтөө Sync To SVG хийнэ.';
        } else if (!hasDetectedFields) {
            nextActionMessage = 'Field detection ажиллуулаад mapping баталгаажуулна.';
        } else if (hasBlockingIntegrityIssues) {
            nextActionMessage = 'Blocking validation issue зассаны дараа хадгална.';
        }

        return (
            <div className="business-card-admin-page business-card-editor-page p-4 lg:p-8 max-w-[1400px] mx-auto space-y-5">
                <div className="business-card-editor-hero bg-white border border-slate-200 rounded-2xl shadow-sm p-4 lg:p-5">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold font-sans text-slate-900">
                                {currentTemplate.id ? 'Edit Template' : 'New Template'}
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                1) Input бэлтгэх 2) Mapping баталгаажуулах 3) Validation шалгах 4) Save
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                            <button
                                onClick={() => resetEditorState()}
                                className="btn btn-outline btn-sm"
                            >
                                Cancel
                            </button>
                            <button onClick={handleSave} className="btn btn-primary btn-sm" disabled={!canAttemptSave}>
                                <Save size={16} className="mr-1.5" /> Save Template
                            </button>
                        </div>
                    </div>

                    <div className="business-card-editor-stats grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                        <div className="business-card-editor-stat rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="business-card-editor-stat-label text-[11px] text-slate-500">Input</p>
                            <p className="business-card-editor-stat-value text-sm font-semibold text-slate-800">
                                {`Front ${templateInputMode === 'canvas' ? (canvasReady ? 'canvas' : 'canvas-missing') : (frontSvgReady ? 'svg' : 'svg-missing')} / Back ${backTemplateInputMode === 'canvas' ? (backCanvasReady ? 'canvas' : 'canvas-empty') : (backSvgReady ? 'svg' : 'optional')}`}
                            </p>
                        </div>
                        <div className="business-card-editor-stat rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="business-card-editor-stat-label text-[11px] text-slate-500">Fields</p>
                            <p className="business-card-editor-stat-value text-sm font-semibold text-slate-800">{totalDetectedFields}</p>
                        </div>
                        <div className="business-card-editor-stat rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="business-card-editor-stat-label text-[11px] text-slate-500">Quality</p>
                            <p className={`business-card-editor-stat-value text-sm font-semibold ${hasCriticalGaps ? 'text-rose-700' : 'text-emerald-700'}`}>
                                {Math.round(completenessScore)} / 100
                            </p>
                        </div>
                        <div className="business-card-editor-stat rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <p className="business-card-editor-stat-label text-[11px] text-slate-500">Validation</p>
                            <p className={`business-card-editor-stat-value text-sm font-semibold ${hasBlockingIntegrityIssues ? 'text-rose-700' : (hasIntegrityWarnings ? 'text-amber-700' : 'text-emerald-700')}`}>
                                {hasBlockingIntegrityIssues ? `${validationIssueCount} blocking` : (hasIntegrityWarnings ? `${validationWarningCount} warning` : 'OK')}
                            </p>
                        </div>
                    </div>

                    <div className={`business-card-next-action mt-3 rounded-lg border px-3 py-2 text-xs ${
                        nextActionMessage === 'Ready to save.'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                    }`}>
                        Next action: {nextActionMessage}
                    </div>
                </div>

                <div className="business-card-stepper bg-white border border-slate-200 rounded-2xl shadow-sm p-2">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                            type="button"
                            className={`business-card-step-tab text-left rounded-xl border px-3 py-2.5 transition-colors ${showDesignTab ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                            data-active={showDesignTab ? 'true' : 'false'}
                            onClick={() => setEditorTab('design')}
                        >
                            <div className="flex items-start gap-2">
                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${showDesignTab ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>1</span>
                                <div>
                                    <div className="font-semibold">Design</div>
                                    <div className="text-[11px] mt-0.5 opacity-80">Template Info + Canvas/SVG</div>
                                </div>
                            </div>
                        </button>
                        <button
                            type="button"
                            className={`business-card-step-tab text-left rounded-xl border px-3 py-2.5 transition-colors ${showMappingTab ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                            data-active={showMappingTab ? 'true' : 'false'}
                            onClick={() => setEditorTab('mapping')}
                        >
                            <div className="flex items-start gap-2">
                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${showMappingTab ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>2</span>
                                <div>
                                    <div className="font-semibold">Field Mapping</div>
                                    <div className="text-[11px] mt-0.5 opacity-80">{totalDetectedFields} detected field</div>
                                </div>
                            </div>
                        </button>
                        <button
                            type="button"
                            className={`business-card-step-tab text-left rounded-xl border px-3 py-2.5 transition-colors ${showReviewTab ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                            data-active={showReviewTab ? 'true' : 'false'}
                            onClick={() => setEditorTab('review')}
                        >
                            <div className="flex items-start gap-2">
                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${showReviewTab ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>3</span>
                                <div>
                                    <div className="font-semibold">Review & Save</div>
                                    <div className="text-[11px] mt-0.5 opacity-80">
                                        {hasBlockingIntegrityIssues ? `${validationIssueCount} blocking issue` : 'Validation + Preview'}
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>

                <div className={`grid grid-cols-1 ${showReviewTab ? 'xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]' : ''} gap-5`}>
                    <div className="space-y-4">
                        {showDesignTab && (
                            <>
                        <section className="business-card-panel bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <h2 className="text-sm font-semibold text-slate-900">Template Info</h2>
                            </div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Template Name</label>
                            <input
                                className="input w-full"
                                value={currentTemplate.name}
                                onChange={(e) => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                                placeholder="e.g., Clean Minimalist"
                            />
                        </section>

                        <section className="business-card-panel bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <h2 className="text-sm font-semibold text-slate-900">Template Input</h2>
                            </div>
                            <div className="business-card-input-preview-wrap mb-3">
                                <div className="business-card-input-preview-head">
                                    <span>Template Preview</span>
                                    <span>{templateInputMode === 'canvas' ? 'Canvas mode' : 'SVG mode'}</span>
                                </div>
                                <div className="business-card-input-preview-stage">
                                    {editorPreviewSvgContent ? (
                                        renderPreview(editorPreviewSvgContent)
                                    ) : (
                                        <div className="business-card-preview-empty w-full h-full rounded border flex items-center justify-center text-sm">
                                            {templateInputMode === 'canvas'
                                                ? 'Canvas дээрээс Sync хийсний дараа preview харагдана'
                                                : 'SVG code оруулсны дараа preview харагдана'}
                                        </div>
                                    )}
                                </div>
                                {templateInputMode === 'canvas' && isCanvasDirty && (
                                    <p className="business-card-input-preview-note">
                                        Canvas өөрчлөлтүүд Sync хийгдээгүй байна. <span className="font-semibold">Sync To SVG</span> дарж preview шинэчилнэ.
                                    </p>
                                )}
                            </div>
                            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 mb-3">
                                <button
                                    type="button"
                                    className={`px-3 py-1.5 text-xs rounded-md ${templateInputMode === 'canvas' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600'}`}
                                    onClick={() => setTemplateInputMode('canvas')}
                                >
                                    Canvas Designer
                                </button>
                                <button
                                    type="button"
                                    className={`px-3 py-1.5 text-xs rounded-md ${templateInputMode === 'svg' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600'}`}
                                    onClick={() => {
                                        if (templateInputMode === 'canvas' && isCanvasDirty) {
                                            syncCanvasToSvgTemplate({ silentWarning: true });
                                        }
                                        setTemplateInputMode('svg');
                                    }}
                                >
                                    SVG + AI
                                </button>
                            </div>

                            {templateInputMode === 'canvas' ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs text-slate-500">
                                            Canvas дээр text/image field-үүдээ шууд байрлуулаад Sync хийж SVG template үүсгэнэ.
                                        </p>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-ghost"
                                            onClick={handleImportCurrentSvgToCanvas}
                                            disabled={!currentTemplate.svgContent?.trim()}
                                        >
                                            Import Existing SVG Fields
                                        </button>
                                    </div>
                                    <BusinessCardCanvasDesigner
                                        value={canvasTemplate}
                                        onChange={handleCanvasTemplateChange}
                                        onSyncRequest={() => syncCanvasToSvgTemplate()}
                                        syncPending={isCanvasSyncing}
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">SVG File</label>
                                            <input
                                                type="file"
                                                accept=".svg,image/svg+xml"
                                                onChange={handleSvgFileImport}
                                                className="input input-sm w-full"
                                            />
                                            <p className="text-[11px] text-slate-500 mt-1">SVG оруулахад текст/image field-үүд автоматаар үүснэ.</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">Reference Image (Optional)</label>
                                            <input
                                                type="file"
                                                accept="image/jpeg,image/png,image/webp"
                                                onChange={handleReferenceImageImport}
                                                className="input input-sm w-full"
                                            />
                                            <p className="text-[11px] text-slate-500 mt-1">JPG/PNG нэмбэл AI semantic mapping илүү зөв ажиллана.</p>
                                        </div>
                                    </div>
                                    {referenceImage.dataUrl && (
                                        <div className="mb-3 border border-slate-200 rounded-lg p-2 bg-slate-50">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[11px] text-slate-600 truncate">{referenceImage.fileName || 'Reference image'}</span>
                                                <button type="button" className="btn btn-ghost btn-xs" onClick={clearReferenceImage}>Clear</button>
                                            </div>
                                            <img src={referenceImage.dataUrl} alt="Reference card" className="w-full max-h-44 object-contain rounded bg-white border border-slate-200" />
                                        </div>
                                    )}
                                    <label className="block text-xs font-medium text-slate-600 mb-1">SVG Code</label>
                                    <textarea
                                        className="input w-full font-mono text-xs h-[320px]"
                                        value={currentTemplate.svgContent}
                                        onChange={(e) => setCurrentTemplate({ ...currentTemplate, svgContent: e.target.value })}
                                        placeholder="<svg ...> ... {{fullName}} ... </svg>"
                                    />
                                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                                        <span className="text-xs text-slate-500">AI converts SVG into editable text/image fields.</span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleAnalyze}
                                                className="btn btn-xs btn-secondary"
                                                title="Detect placeholders"
                                                disabled={isAiConverting}
                                            >
                                                <RefreshCw size={14} className="mr-1" /> Detect
                                            </button>
                                            <button
                                                onClick={handleAiConvert}
                                                className="btn btn-xs btn-primary"
                                                title="AI convert SVG into template"
                                                disabled={isAiConverting}
                                            >
                                                <RefreshCw size={14} className="mr-1" /> {isAiConverting ? 'Converting...' : 'AI Convert'}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </section>

                        <section className="business-card-panel bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <h2 className="text-sm font-semibold text-slate-900">Back Side Template (Optional)</h2>
                                <span className={`text-[11px] px-2 py-0.5 rounded border ${
                                    hasBackPreviewConfigured
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}>
                                    {hasBackPreviewConfigured ? 'Configured' : 'Not set'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mb-2">
                                Ар талын SVG загварыг оруулбал генератор дээр flip хийхэд шууд ар талын дизайн харагдана.
                            </p>
                            <div className="business-card-input-preview-wrap mb-3">
                                <div className="business-card-input-preview-head">
                                    <span>Back Side Preview</span>
                                    <span>{backTemplateInputMode === 'canvas' ? 'Canvas mode' : 'SVG mode'}</span>
                                </div>
                                <div className="business-card-input-preview-stage">
                                    {backEditorPreviewSvgContent ? (
                                        renderPreview(backEditorPreviewSvgContent)
                                    ) : (
                                        <div className="business-card-preview-empty w-full h-full rounded border flex items-center justify-center text-sm">
                                            {backTemplateInputMode === 'canvas'
                                                ? 'Back canvas дээр node нэмээд Sync хийсний дараа preview харагдана'
                                                : 'Back-side SVG оруулсны дараа preview харагдана'}
                                        </div>
                                    )}
                                </div>
                                {backTemplateInputMode === 'canvas' && isBackCanvasDirty && (
                                    <p className="business-card-input-preview-note">
                                        Back canvas өөрчлөлтүүд Sync хийгдээгүй байна. <span className="font-semibold">Sync To SVG</span> дарж preview шинэчилнэ.
                                    </p>
                                )}
                            </div>
                            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 mb-3">
                                <button
                                    type="button"
                                    className={`px-3 py-1.5 text-xs rounded-md ${backTemplateInputMode === 'canvas' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600'}`}
                                    onClick={() => setBackTemplateInputMode('canvas')}
                                >
                                    Canvas Designer
                                </button>
                                <button
                                    type="button"
                                    className={`px-3 py-1.5 text-xs rounded-md ${backTemplateInputMode === 'svg' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-600'}`}
                                    onClick={() => {
                                        if (backTemplateInputMode === 'canvas' && isBackCanvasDirty) {
                                            syncBackCanvasToSvgTemplate({ silentWarning: true });
                                        }
                                        setBackTemplateInputMode('svg');
                                    }}
                                >
                                    SVG + AI
                                </button>
                            </div>

                            {backTemplateInputMode === 'canvas' ? (
                                <div className="space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-xs text-slate-500">
                                            Back талын text/image field-үүдээ Canvas дээр байрлуулаад Sync хийж SVG үүсгэнэ.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-ghost"
                                                onClick={handleImportBackSvgToCanvas}
                                                disabled={!currentTemplate.backSvgContent?.trim()}
                                            >
                                                Import Existing Back SVG
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-ghost"
                                                onClick={clearBackSideTemplate}
                                            >
                                                Clear Back
                                            </button>
                                        </div>
                                    </div>
                                    <BusinessCardCanvasDesigner
                                        value={backCanvasTemplate}
                                        onChange={handleBackCanvasTemplateChange}
                                        onSyncRequest={() => syncBackCanvasToSvgTemplate()}
                                        syncPending={isBackCanvasSyncing}
                                        cardSizeLocked
                                    />
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-600 mb-1">Back SVG File</label>
                                            <input
                                                type="file"
                                                accept=".svg,image/svg+xml"
                                                onChange={handleBackSvgFileImport}
                                                className="input input-sm w-full"
                                            />
                                            <p className="text-[11px] text-slate-500 mt-1">Ар талын SVG оруулахад field-үүд автоматаар map хийнэ.</p>
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-secondary"
                                                onClick={handleSyncBackFields}
                                            >
                                                Sync Back Fields
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-xs btn-ghost"
                                                onClick={clearBackSideTemplate}
                                            >
                                                Clear Back
                                            </button>
                                        </div>
                                    </div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Back SVG Code</label>
                                    <textarea
                                        className="input w-full font-mono text-xs h-[220px]"
                                        value={currentTemplate.backSvgContent || ''}
                                        onChange={(e) => setCurrentTemplate({ ...currentTemplate, backSvgContent: e.target.value })}
                                        onBlur={handleSyncBackFields}
                                        placeholder="<svg ...> ... {{company}} ... </svg>"
                                    />
                                    <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                                        <span className="text-xs text-slate-500">AI converts back SVG into editable fields.</span>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleBackAnalyze}
                                                className="btn btn-xs btn-secondary"
                                                title="Detect back placeholders"
                                                disabled={isAiConverting}
                                            >
                                                <RefreshCw size={14} className="mr-1" /> Detect
                                            </button>
                                            <button
                                                onClick={handleBackAiConvert}
                                                className="btn btn-xs btn-primary"
                                                title="AI convert back SVG"
                                                disabled={isAiConverting}
                                            >
                                                <RefreshCw size={14} className="mr-1" /> {isAiConverting ? 'Converting...' : 'AI Convert'}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </section>
                            </>
                        )}

                        {showMappingTab && (
                            <>
                        <section className="business-card-panel bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-semibold text-slate-900">Detection Result</h2>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-xs btn-ghost"
                                    onClick={() => setShowAiMappingDetails((prev) => !prev)}
                                >
                                    {showAiMappingDetails ? 'Hide details' : 'Show details'}
                                    {showAiMappingDetails ? <ChevronUp size={13} className="ml-1" /> : <ChevronDown size={13} className="ml-1" />}
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 mb-3">
                                <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded border border-indigo-100">Total: {totalDetectedFields}</span>
                                <span className="px-2 py-1 bg-sky-50 text-sky-700 text-xs rounded border border-sky-100">Text: {detectedTextCount}</span>
                                <span className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded border border-amber-100">Image: {detectedImageCount}</span>
                            </div>
                            {detectionUsesDraft && (
                                <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                    Canvas draft fields shown. Click <span className="font-semibold">Sync To SVG</span> to apply them into mapping table.
                                </div>
                            )}
                            {mappingAudit && (
                                <div className="mb-3 border border-slate-200 rounded-lg p-2 bg-slate-50">
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="font-medium text-slate-700">Template Quality</span>
                                        <span className="font-semibold text-slate-800">{Math.round(Number(mappingAudit.completenessScore || 0))} / 100</span>
                                    </div>
                                    <div className="h-2 bg-slate-200 rounded overflow-hidden">
                                        <div
                                            className={`h-full ${Number(mappingAudit.completenessScore || 0) >= 75 ? 'bg-emerald-500' : (Number(mappingAudit.completenessScore || 0) >= 50 ? 'bg-amber-500' : 'bg-rose-500')}`}
                                            style={{ width: `${Math.max(0, Math.min(100, Number(mappingAudit.completenessScore || 0)))}%` }}
                                        />
                                    </div>
                                    {Array.isArray(mappingAudit.missingCriticalFields) && mappingAudit.missingCriticalFields.length > 0 && (
                                        <p className="text-[11px] text-rose-700 mt-2">
                                            Missing critical: {mappingAudit.missingCriticalFields.join(', ')}
                                        </p>
                                    )}
                                    {Array.isArray(mappingAudit.missingRecommendedFields) && mappingAudit.missingRecommendedFields.length > 0 && (
                                        <p className="text-[11px] text-amber-700 mt-1">
                                            Missing recommended: {mappingAudit.missingRecommendedFields.join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {totalDetectedFields > 0 ? (
                                    visibleDetectedFields.map(field => (
                                        <span key={field} className="px-2 py-1 bg-slate-50 text-slate-700 text-xs rounded border border-slate-200 font-mono">
                                            {field}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-slate-400 text-sm italic">
                                        {templateInputMode === 'canvas'
                                            ? 'No fields yet. Add nodes in canvas and click "Sync To SVG".'
                                            : 'No fields detected yet. Upload SVG and run AI Convert.'}
                                    </span>
                                )}
                                {remainingDetectedFields > 0 && (
                                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded border border-slate-200">
                                        +{remainingDetectedFields} more
                                    </span>
                                )}
                            </div>
                            {aiWarnings.length > 0 && (
                                <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 space-y-1">
                                    {visibleAiWarnings.map((warning, idx) => (
                                        <div key={idx}>{warning}</div>
                                    ))}
                                    {!showAiMappingDetails && aiWarnings.length > visibleAiWarnings.length && (
                                        <button
                                            type="button"
                                            className="underline underline-offset-2"
                                            onClick={() => setShowAiMappingDetails(true)}
                                        >
                                            +{aiWarnings.length - visibleAiWarnings.length} more warnings
                                        </button>
                                    )}
                                </div>
                            )}
                            {showAiMappingDetails && hasAiReport && (
                                <div className="mt-3 border border-slate-200 rounded overflow-hidden">
                                    <div className="grid grid-cols-3 bg-slate-50 text-xs font-semibold text-slate-600 px-3 py-2">
                                        <div>Detected</div>
                                        <div>Mapped Field</div>
                                        <div>Reason</div>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-[180px] overflow-auto">
                                        {aiReport.map((item, idx) => (
                                            <div key={`${item.field}-${idx}`} className="grid grid-cols-3 px-3 py-2 text-xs text-slate-700">
                                                <div className="truncate" title={item.sample}>{item.sample}</div>
                                                <div className="font-mono">{item.field}</div>
                                                <div className="text-slate-500">{item.reason}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        <section className="business-card-panel bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <h2 className="text-sm font-semibold text-slate-900">Field Mapping Confirmation</h2>
                            </div>
                            <p className="text-xs text-slate-500 mb-2">Detected text-ийг зөв field нэртэй баталгаажуул. Field type сонголт шаардлагагүй.</p>
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                                    <div className="col-span-12 md:col-span-7">Detected Text</div>
                                    <div className="col-span-12 md:col-span-5">Field Name</div>
                                </div>
                                <div className="max-h-[280px] overflow-auto divide-y divide-slate-100">
                                    {textTemplateFields.length === 0 && (
                                        <div className="px-3 py-3 text-xs text-slate-500">No text fields detected from this SVG.</div>
                                    )}
                                    {textTemplateFields.map((field) => {
                                        const sourceSample = getDetectedSourceSample(field) || `{{${field}}}`;
                                        return (
                                            <div key={field} className="grid grid-cols-12 gap-2 px-3 py-2 items-center">
                                                <div className="col-span-12 md:col-span-7 text-xs text-slate-700 truncate" title={sourceSample}>
                                                    {sourceSample}
                                                </div>
                                                <input
                                                    className="input input-sm col-span-12 md:col-span-5 font-mono"
                                                    defaultValue={field}
                                                    onBlur={(e) => {
                                                        const renamed = renameFieldMapping(field, e.target.value);
                                                        e.target.value = renamed;
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            e.currentTarget.blur();
                                                        }
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            {imageTemplateFields.length > 0 && (
                                <p className="text-xs text-slate-500 mt-2">
                                    Image upload fields (auto): {imageTemplateFields.join(', ')}
                                </p>
                            )}
                        </section>
                            </>
                        )}

                        {showReviewTab && (
                            <>
                        <section className="business-card-panel bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-semibold text-slate-900">Template Validation</h2>
                                </div>
                                <button
                                    type="button"
                                    className="btn btn-xs btn-ghost"
                                    onClick={() => setShowValidationDetails((prev) => !prev)}
                                >
                                    {showValidationDetails ? 'Hide details' : 'Show details'}
                                    {showValidationDetails ? <ChevronUp size={13} className="ml-1" /> : <ChevronDown size={13} className="ml-1" />}
                                </button>
                            </div>
                            <div className={`text-xs border rounded p-2 ${
                                hasBlockingIntegrityIssues
                                    ? 'text-rose-700 bg-rose-50 border-rose-200'
                                    : (hasIntegrityWarnings
                                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                                        : 'text-emerald-700 bg-emerald-50 border-emerald-200')
                            }`}>
                                {hasBlockingIntegrityIssues
                                    ? `${validationIssueCount} blocking issue detected.`
                                    : (hasIntegrityWarnings
                                        ? `${validationWarningCount} warning detected.`
                                        : 'Blocking validation issues байхгүй.')}
                            </div>

                            {(templateInputMode === 'canvas' && isCanvasDirty) || (backTemplateInputMode === 'canvas' && isBackCanvasDirty) ? (
                                <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                    {templateInputMode === 'canvas' && isCanvasDirty
                                        ? <>Front canvas changes are not synced yet. Click <span className="font-semibold">Sync To SVG</span> before final validation.</>
                                        : <>Back canvas changes are not synced yet. Click <span className="font-semibold">Sync To SVG</span> before final validation.</>}
                                </div>
                            ) : null}

                            {showValidationDetails && (
                                <div className="mt-2 space-y-2">
                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                                        <div className="border border-slate-200 rounded p-2 bg-slate-50">
                                            <div className="text-slate-500">SVG placeholders</div>
                                            <div className="font-semibold text-slate-800">{integrityReport.stats.placeholdersInSvg}</div>
                                        </div>
                                        <div className="border border-slate-200 rounded p-2 bg-slate-50">
                                            <div className="text-slate-500">Extracted fields</div>
                                            <div className="font-semibold text-slate-800">{integrityReport.stats.extractedFieldCount}</div>
                                        </div>
                                        <div className="border border-slate-200 rounded p-2 bg-slate-50">
                                            <div className="text-slate-500">Schema fields</div>
                                            <div className="font-semibold text-slate-800">{integrityReport.stats.schemaCount}</div>
                                        </div>
                                        <div className="border border-slate-200 rounded p-2 bg-slate-50">
                                            <div className="text-slate-500">&lt;image&gt; nodes</div>
                                            <div className="font-semibold text-slate-800">{integrityReport.stats.imageNodeCount}</div>
                                        </div>
                                        <div className="border border-slate-200 rounded p-2 bg-slate-50">
                                            <div className="text-slate-500">Image fields</div>
                                            <div className="font-semibold text-slate-800">{integrityReport.stats.imageFieldCount}</div>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-slate-500">
                                        Back side: {hasBackPreviewConfigured ? 'configured' : 'not configured'}
                                    </p>

                                    {integrityReport.blockingIssues.length > 0 && (
                                        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2 space-y-1">
                                            {integrityReport.blockingIssues.map((issue, idx) => (
                                                <div key={`block-${idx}`}>- {issue}</div>
                                            ))}
                                        </div>
                                    )}

                                    {integrityReport.warnings.length > 0 && (
                                        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 space-y-1">
                                            {integrityReport.warnings.map((warning, idx) => (
                                                <div key={`warn-${idx}`}>- {warning}</div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                            </>
                        )}
                    </div>

                    {showReviewTab && (
                    <div className="space-y-4 xl:sticky xl:top-4 self-start">
                        <section className="business-card-panel bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                            <h3 className="font-semibold text-slate-900 mb-3 flex items-center">
                                <Eye size={17} className="mr-2 text-indigo-600" /> Live Preview
                            </h3>
                            {(templateInputMode === 'canvas' && isCanvasDirty) || (backTemplateInputMode === 'canvas' && isBackCanvasDirty) ? (
                                <div className="mb-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                                    {templateInputMode === 'canvas' && isCanvasDirty
                                        ? 'Front canvas changed. Sync to update preview.'
                                        : 'Back canvas changed. Sync to update preview.'}
                                </div>
                            ) : null}
                            <div className="space-y-3">
                                <div>
                                    <div className="text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">Front</div>
                                    <div className="aspect-[1.75] w-full">
                                        {editorPreviewSvgContent ? renderPreview(editorPreviewSvgContent) : (
                                            <div className="business-card-preview-empty w-full h-full rounded border flex items-center justify-center text-sm">
                                                {templateInputMode === 'canvas'
                                                    ? 'Canvas дээрээс Sync хийсний дараа preview харагдана'
                                                    : 'SVG code оруулсны дараа preview харагдана'}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {hasBackPreviewConfigured && (
                                    <div>
                                        <div className="text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">Back</div>
                                        <div className="aspect-[1.75] w-full">
                                            {renderPreview(backEditorPreviewSvgContent)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="business-card-panel bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-semibold text-slate-800">Preview Data Controls</h4>
                                <button
                                    type="button"
                                    className="btn btn-xs btn-ghost"
                                    onClick={() => setShowPreviewDataControls((prev) => !prev)}
                                >
                                    {showPreviewDataControls ? 'Hide' : 'Show'}
                                    {showPreviewDataControls ? <ChevronUp size={13} className="ml-1" /> : <ChevronDown size={13} className="ml-1" />}
                                </button>
                            </div>
                            {!showPreviewDataControls ? (
                                <p className="text-xs text-slate-500">Preview data controls hidden. Click Show to edit test values.</p>
                            ) : (
                                <>
                                    <div className="flex flex-wrap gap-1 mb-2">
                                        <button type="button" className="btn btn-xs btn-ghost" onClick={() => applyPreviewScenario('normal')}>
                                            Normal
                                        </button>
                                        <button type="button" className="btn btn-xs btn-ghost" onClick={() => applyPreviewScenario('long')}>
                                            Stress
                                        </button>
                                        <button type="button" className="btn btn-xs btn-ghost" onClick={() => applyPreviewScenario('empty')}>
                                            Clear
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                                        {previewEditableFields.map((field) => {
                                            const schema = currentTemplate.fieldSchema?.[field];
                                            const placeholder = schema?.label || defaultFieldLabels[field] || toTitleCase(field);
                                            return (
                                                <input
                                                    key={field}
                                                    className="input input-sm"
                                                    value={previewData[field] ?? ''}
                                                    onChange={e => setPreviewData({ ...previewData, [field]: e.target.value })}
                                                    placeholder={placeholder}
                                                />
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </section>
                    </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="business-card-admin-page business-card-list-page p-4 lg:p-8 max-w-[1400px] mx-auto">
            <div className="business-card-hero flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                <div>
                    <h1 className="text-2xl font-bold font-sans text-slate-900">Business Card Templates</h1>
                    <p className="text-slate-500 mt-1">Manage canvas/SVG templates for the Business Card Generator.</p>
                </div>
                <button onClick={() => {
                    resetEditorState({ keepEditing: true });
                }} className="btn btn-primary">
                    <Plus size={18} className="mr-2" /> New Template
                </button>
            </div>

                <div className="business-card-summary-grid grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="business-card-summary-item rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="business-card-summary-label text-[11px] uppercase tracking-wide text-slate-500">Templates</p>
                    <p className="business-card-summary-value text-2xl font-semibold text-slate-900 mt-1">{templateSummary.total}</p>
                </div>
                <div className="business-card-summary-item rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="business-card-summary-label text-[11px] uppercase tracking-wide text-slate-500">Quality Ready</p>
                    <p className="business-card-summary-value text-2xl font-semibold text-emerald-700 mt-1">{templateSummary.strongQualityCount}</p>
                </div>
                <div className="business-card-summary-item rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="business-card-summary-label text-[11px] uppercase tracking-wide text-slate-500">Average Quality</p>
                    <p className="business-card-summary-value text-2xl font-semibold text-slate-900 mt-1">{templateSummary.averageQuality}/100</p>
                </div>
                <div className="business-card-summary-item rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="business-card-summary-label text-[11px] uppercase tracking-wide text-slate-500">Mapped Fields</p>
                    <p className="business-card-summary-value text-2xl font-semibold text-slate-900 mt-1">{templateSummary.totalFields}</p>
                </div>
            </div>

            <div className="business-card-benchmark mb-6 bg-white border border-slate-200 rounded-2xl shadow-sm p-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">AI Benchmark Dashboard</h2>
                        <p className="text-xs text-slate-500 mt-1">
                            {showBenchmarkDashboard
                                ? 'Standard test cases дээр mapping quality-г шалгаж score гаргана.'
                                : 'Advanced quality dashboard. Хэрэгтэй үедээ Show дарж нээнэ.'}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleRunBenchmark}
                            className="btn btn-sm btn-secondary"
                            disabled={isBenchmarkRunning}
                        >
                            <RefreshCw size={14} className={`mr-1 ${isBenchmarkRunning ? 'animate-spin' : ''}`} />
                            {isBenchmarkRunning ? 'Running...' : 'Run Benchmark'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            onClick={() => setShowBenchmarkDashboard((prev) => !prev)}
                        >
                            {showBenchmarkDashboard ? 'Hide' : 'Show'}
                            {showBenchmarkDashboard ? <ChevronUp size={14} className="ml-1" /> : <ChevronDown size={14} className="ml-1" />}
                        </button>
                    </div>
                </div>
                {benchmarkError && (
                    <div className="mt-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
                        {benchmarkError}
                    </div>
                )}
                {!showBenchmarkDashboard ? (
                    <p className="mt-3 text-[11px] text-slate-500">
                        {benchmarkHistoryLoading
                            ? 'Loading latest benchmark...'
                            : (latestBenchmarkRun?.createdAtDate
                                ? `Latest run: ${latestBenchmarkRun.createdAtDate.toLocaleString()}`
                                : 'No benchmark run yet.')}
                    </p>
                ) : (
                    <>
                        <div className="business-card-benchmark-trend mt-3 border border-slate-200 rounded-lg p-3 bg-slate-50">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-semibold text-slate-700">7-Day Trend</h3>
                                <span className="text-[11px] text-slate-500">
                                    {benchmarkHistoryLoading
                                        ? 'Loading...'
                                        : (latestBenchmarkRun?.createdAtDate
                                            ? `Latest: ${latestBenchmarkRun.createdAtDate.toLocaleString()}`
                                            : (benchmarkResult?.generatedAt
                                                ? `Latest: ${new Date(benchmarkResult.generatedAt).toLocaleString()}`
                                                : 'No runs yet'))}
                                </span>
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {benchmarkTrend.map((point) => {
                                    const scoreHeight = point.avgScore == null ? 6 : Math.max(6, Math.min(100, Number(point.avgScore)));
                                    const passRateHeight = point.avgPassRate == null ? 4 : Math.max(4, Math.min(100, Number(point.avgPassRate)));
                                    return (
                                        <div key={point.key} className="text-center">
                                            <div className="h-20 flex items-end justify-center gap-1 mb-1">
                                                <div className="w-2 rounded bg-indigo-500/90" style={{ height: `${scoreHeight}%` }} title={`Score: ${point.avgScore == null ? '-' : point.avgScore.toFixed(1)}`} />
                                                <div className="w-2 rounded bg-emerald-500/90" style={{ height: `${passRateHeight}%` }} title={`Pass: ${point.avgPassRate == null ? '-' : point.avgPassRate.toFixed(1)}%`} />
                                            </div>
                                            <div className="text-[10px] text-slate-600">{point.label}</div>
                                            <div className="text-[10px] text-slate-400">{point.count || 0} run</div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
                                <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-indigo-500" /> Avg Score</span>
                                <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-emerald-500" /> Pass Rate</span>
                            </div>
                        </div>
                        {benchmarkResult?.summary && (
                            <div className="mt-3 space-y-3">
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                                    <div className="border border-slate-200 rounded p-2 bg-slate-50">
                                        <div className="text-slate-500">Cases</div>
                                        <div className="font-semibold text-slate-800">{benchmarkResult.summary.totalCases}</div>
                                    </div>
                                    <div className="border border-slate-200 rounded p-2 bg-slate-50">
                                        <div className="text-slate-500">Pass Rate</div>
                                        <div className="font-semibold text-slate-800">{benchmarkResult.summary.passRate}%</div>
                                    </div>
                                    <div className="border border-slate-200 rounded p-2 bg-slate-50">
                                        <div className="text-slate-500">Avg Score</div>
                                        <div className="font-semibold text-slate-800">{benchmarkResult.summary.averageScore}</div>
                                    </div>
                                    <div className="border border-slate-200 rounded p-2 bg-slate-50">
                                        <div className="text-slate-500">Index Accuracy</div>
                                        <div className="font-semibold text-slate-800">{benchmarkResult.summary.averageIndexAccuracy}%</div>
                                    </div>
                                    <div className="border border-slate-200 rounded p-2 bg-slate-50">
                                        <div className="text-slate-500">Required Coverage</div>
                                        <div className="font-semibold text-slate-800">{benchmarkResult.summary.averageRequiredCoverage}%</div>
                                    </div>
                                </div>
                                <div className="border border-slate-200 rounded overflow-hidden">
                                    <div className="grid grid-cols-12 px-3 py-2 bg-slate-50 text-[11px] font-semibold text-slate-600">
                                        <div className="col-span-4 md:col-span-3">Case</div>
                                        <div className="col-span-3 md:col-span-2">Status</div>
                                        <div className="col-span-2 md:col-span-2">Score</div>
                                        <div className="col-span-3 md:col-span-2">Index %</div>
                                        <div className="hidden md:block md:col-span-3">Notes</div>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-64 overflow-auto text-xs">
                                        {(benchmarkResult.cases || []).map((item) => (
                                            <div key={item.id} className="grid grid-cols-12 px-3 py-2 items-center">
                                                <div className="col-span-4 md:col-span-3 text-slate-700 truncate" title={item.name}>{item.name}</div>
                                                <div className="col-span-3 md:col-span-2">
                                                    <span className={`px-1.5 py-0.5 rounded border text-[10px] ${
                                                        item.status === 'pass'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : (item.status === 'warn'
                                                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                                : 'bg-rose-50 text-rose-700 border-rose-200')
                                                    }`}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                                <div className="col-span-2 md:col-span-2 text-slate-700">{item.score}</div>
                                                <div className="col-span-3 md:col-span-2 text-slate-700">{item.metrics?.indexAccuracy ?? 0}%</div>
                                                <div className="hidden md:block md:col-span-3 text-slate-500 truncate" title={item.error || ''}>
                                                    {item.error || (item.mismatches?.length ? `${item.mismatches.length} mismatch` : 'ok')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    Generated at: {benchmarkResult.generatedAt ? new Date(benchmarkResult.generatedAt).toLocaleString() : '-'}
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>

            {loading ? (
                <div className="business-card-loading-state text-center py-12">Loading templates...</div>
            ) : templates.length === 0 ? (
                <div className="business-card-empty-state text-center py-12 bg-slate-50 rounded-lg border border-slate-200 border-dashed">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <Code size={24} />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">No templates found</h3>
                    <p className="text-slate-500 mb-4">Create your first SVG template to get started.</p>
                </div>
            ) : (
                <div className="business-card-template-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {templates.map((template, index) => {
                        const templateFields = Array.isArray(template.extractedFields)
                            ? template.extractedFields
                            : [...new Set([
                                ...extractFieldsFromSvg(template.svgContent || ''),
                                ...extractFieldsFromSvg(template.backSvgContent || '')
                            ])];
                        const hasBackSide = Boolean(template.backSvgContent?.trim());
                        const fallbackAudit = evaluateTemplateCoverage({
                            fields: templateFields,
                            mappedTextCount: templateFields.filter(field => !isImageFieldName(field)).length,
                            totalTextCount: templateFields.filter(field => !isImageFieldName(field)).length
                        });
                        const qualityScore = Math.round(Number(template?.mappingAudit?.completenessScore ?? fallbackAudit.completenessScore ?? 0));
                        const qualityClass = qualityScore >= 75
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : (qualityScore >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200');

                        return (
                            <div
                                key={template.id}
                                className="business-card-template-card bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                                style={{ animationDelay: `${index * 45}ms` }}
                            >
                                <div className="business-card-template-preview aspect-[1.75] border-b">
                                    <div className="w-full h-full p-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: template.svgContent.replace(/\{\{([^}]+)\}\}/g, '...') }} />
                                </div>
                                <div className="p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <h3 className="font-bold text-slate-800 truncate">{template.name}</h3>
                                        <div className="flex items-center gap-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${qualityClass}`}>
                                                Q {qualityScore}
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border whitespace-nowrap ${
                                                hasBackSide
                                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                            }`}>
                                                {hasBackSide ? '2 Sides' : 'Front'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {templateFields.slice(0, 3).map(field => (
                                            <span key={field} className="business-card-field-chip text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                                {field}
                                            </span>
                                        ))}
                                        {templateFields.length > 3 && (
                                            <span className="business-card-field-chip text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                                                +{templateFields.length - 3}
                                            </span>
                                        )}
                                    </div>
                                    <div className="business-card-template-actions mt-3 flex gap-2">
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-secondary flex-1"
                                            onClick={() => handleEdit(template)}
                                        >
                                            <Edit2 size={13} className="mr-1" /> Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="btn btn-xs btn-outline text-rose-600 border-rose-200 hover:bg-rose-50"
                                            onClick={() => handleDelete(template.id)}
                                        >
                                            <Trash2 size={13} className="mr-1" /> Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default BusinessCardTemplates;
