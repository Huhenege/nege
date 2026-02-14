import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import ToolHeader from '../components/ToolHeader';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { populateBusinessCardSvg } from '../lib/businessCardCanvas';
import './BusinessCardGenerator.css';

// Font options
const fontOptions = [
    { id: 'inter', label: 'Inter', stack: "'Inter', 'Segoe UI', sans-serif" },
    { id: 'roboto', label: 'Roboto', stack: "'Roboto', 'Segoe UI', sans-serif" },
    { id: 'montserrat', label: 'Montserrat', stack: "'Montserrat', 'Segoe UI', sans-serif" },
    { id: 'playfair', label: 'Playfair Display', stack: "'Playfair Display', serif" },
    { id: 'lato', label: 'Lato', stack: "'Lato', sans-serif" },
    { id: 'oswald', label: 'Oswald', stack: "'Oswald', sans-serif" },
    { id: 'raleway', label: 'Raleway', stack: "'Raleway', sans-serif" },
    { id: 'noto-serif', label: 'Noto Serif', stack: "'Noto Serif', 'Times New Roman', serif" },
];

const defaultLogoDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><rect width="160" height="60" rx="10" fill="#111827"/><text x="80" y="38" text-anchor="middle" font-size="20" font-family="Arial, sans-serif" fill="#F9FAFB">LOGO</text></svg>')}`;

const defaultFieldSamples = {
    fullName: 'Ганболдын Төмөр',
    firstName: 'Төмөр',
    lastName: 'Ганболд',
    company: 'Nege LLC',
    department: 'Маркетинг',
    position: 'Гүйцэтгэх захирал',
    mobilePhone: '9911-2233',
    phone: '9911-2233',
    email: 'tumur@nege.mn',
    web: 'www.nege.mn',
    address: 'Улаанбаатар, Сүхбаатар дүүрэг, 1-р хороо, Blue Sky Tower, 305 тоот',
    tagline: 'Ирээдүйг хамтдаа',
    socialFacebook: '',
    socialInstagram: '',
    socialLinkedin: '',
    socialX: '',
    logo: defaultLogoDataUrl
};

const fieldLabels = {
    fullName: 'Нэр',
    firstName: 'Нэр',
    lastName: 'Овог',
    company: 'Компани',
    department: 'Хэлтэс',
    position: 'Албан тушаал',
    mobilePhone: 'Гар утас',
    phone: 'Утас',
    email: 'И-мэйл',
    web: 'Вэб сайт',
    address: 'Хаяг',
    tagline: 'Товч уриа',
    socialFacebook: 'Facebook',
    socialInstagram: 'Instagram',
    socialLinkedin: 'LinkedIn',
    socialX: 'X / Twitter',
    logo: 'Лого'
};

const fieldPlaceholders = {
    fullName: 'Нэр Овог',
    firstName: 'Нэр',
    lastName: 'Овог',
    company: 'Компани',
    department: 'Хэлтэс',
    position: 'Албан тушаал',
    mobilePhone: 'Гар утасны дугаар',
    phone: 'Утасны дугаар',
    email: 'Имэйл',
    web: 'Вэб сайт',
    address: 'Хаяг',
    tagline: 'Брэндийн уриа үг',
    socialFacebook: 'Facebook',
    socialInstagram: 'Instagram',
    socialLinkedin: 'LinkedIn',
    socialX: 'X / Twitter'
};

const preferredFieldOrder = [
    'logo',
    'company',
    'fullName',
    'lastName',
    'firstName',
    'department',
    'position',
    'tagline',
    'mobilePhone',
    'phone',
    'email',
    'web',
    'address',
    'socialFacebook',
    'socialInstagram',
    'socialLinkedin',
    'socialX'
];

const placeholderRegex = /\{\{\s*([^}]+)\s*\}\}/g;
const supportedFieldTypes = new Set(['text', 'textarea', 'email', 'tel', 'url', 'image']);
const PX_PER_MM = 300 / 25.4;
const DEFAULT_TEMPLATE_SIZE_MM = { widthMm: 90, heightMm: 50 };

const parseSvgLength = (rawValue) => {
    if (rawValue == null) return null;
    const value = String(rawValue).trim();
    if (!value) return null;
    const match = value.match(/^(-?\d+(?:\.\d+)?)([a-z%]*)$/i);
    if (!match) return null;
    const number = Number(match[1]);
    if (!Number.isFinite(number) || number <= 0) return null;
    return {
        number,
        unit: (match[2] || '').toLowerCase()
    };
};

const lengthToMm = (lengthValue, fallbackUnit = 'px') => {
    if (!lengthValue) return null;
    const unit = lengthValue.unit || fallbackUnit;
    const value = lengthValue.number;
    if (!Number.isFinite(value) || value <= 0) return null;
    if (unit === 'mm') return value;
    if (unit === 'cm') return value * 10;
    if (unit === 'in') return value * 25.4;
    if (unit === 'pt') return (value * 25.4) / 72;
    if (unit === 'pc') return (value * 25.4) / 6;
    return value / PX_PER_MM;
};

const extractTemplateSizeMm = (svgContent) => {
    const fallback = {
        ...DEFAULT_TEMPLATE_SIZE_MM,
        aspectRatio: DEFAULT_TEMPLATE_SIZE_MM.widthMm / DEFAULT_TEMPLATE_SIZE_MM.heightMm
    };
    if (!svgContent || typeof DOMParser === 'undefined') return fallback;

    try {
        const doc = new DOMParser().parseFromString(String(svgContent), 'image/svg+xml');
        if (doc.querySelector('parsererror')) return fallback;
        const svg = doc.querySelector('svg');
        if (!svg) return fallback;

        const widthLen = parseSvgLength(svg.getAttribute('width'));
        const heightLen = parseSvgLength(svg.getAttribute('height'));
        const viewBoxValues = String(svg.getAttribute('viewBox') || '')
            .split(/[,\s]+/)
            .map((item) => Number(item))
            .filter((item) => Number.isFinite(item));

        const viewBoxWidth = viewBoxValues.length === 4 && viewBoxValues[2] > 0 ? viewBoxValues[2] : null;
        const viewBoxHeight = viewBoxValues.length === 4 && viewBoxValues[3] > 0 ? viewBoxValues[3] : null;

        const widthMm = lengthToMm(widthLen, 'px')
            || (viewBoxWidth ? viewBoxWidth / PX_PER_MM : null)
            || fallback.widthMm;
        const heightMm = lengthToMm(heightLen, 'px')
            || (viewBoxHeight ? viewBoxHeight / PX_PER_MM : null)
            || fallback.heightMm;

        const safeWidthMm = Math.max(20, Math.min(250, widthMm));
        const safeHeightMm = Math.max(20, Math.min(180, heightMm));

        return {
            widthMm: Math.round(safeWidthMm * 100) / 100,
            heightMm: Math.round(safeHeightMm * 100) / 100,
            aspectRatio: safeWidthMm / safeHeightMm
        };
    } catch (error) {
        console.warn('Failed to read template SVG size:', error);
        return fallback;
    }
};

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

const getFieldLabel = (field) => fieldLabels[field] || toTitleCase(field);

const getFieldPlaceholder = (field) => fieldPlaceholders[field] || toTitleCase(field);

const isImageFieldName = (field) => /(^logo$|^icon\d*$|^image\d*$|avatar|photo|picture|badge|brandMark|symbol)/i.test(field || '');

const getDefaultFieldType = (field) => {
    if (isImageFieldName(field)) return 'image';
    if (field === 'email') return 'email';
    if (field === 'phone' || field === 'mobilePhone') return 'tel';
    if (field === 'web') return 'url';
    if (field === 'address') return 'textarea';
    return 'text';
};

const normalizeFieldType = (field, type) => {
    if (isImageFieldName(field)) return 'image';
    if (supportedFieldTypes.has(type)) return type;
    return getDefaultFieldType(field);
};

const buildDefaultFieldConfig = (field) => ({
    key: field,
    label: getFieldLabel(field),
    type: getDefaultFieldType(field),
    required: field === 'fullName',
    placeholder: getDefaultFieldType(field) === 'image' ? '' : getFieldPlaceholder(field),
    defaultValue: getDefaultFieldType(field) === 'image' ? '' : (defaultFieldSamples[field] || '')
});

const extractFieldsFromSvg = (svgContent) => {
    if (!svgContent) return [];
    const fields = [];
    const seen = new Set();
    const matches = Array.from(svgContent.matchAll(placeholderRegex));
    matches.forEach(match => {
        const field = match[1]?.trim();
        if (!field || seen.has(field)) return;
        seen.add(field);
        fields.push(field);
    });
    return fields;
};

const orderFields = (fields) => {
    const seen = new Set();
    const unique = [];
    fields.forEach(field => {
        const cleaned = field?.trim();
        if (!cleaned || seen.has(cleaned)) return;
        seen.add(cleaned);
        unique.push(cleaned);
    });
    return [
        ...preferredFieldOrder.filter(field => seen.has(field)),
        ...unique.filter(field => !preferredFieldOrder.includes(field))
    ];
};

const buildTemplateFields = (template) => {
    const extracted = Array.isArray(template?.extractedFields) ? template.extractedFields : [];
    const fromSvg = extractFieldsFromSvg(template?.svgContent);
    const fromBackSvg = extractFieldsFromSvg(template?.backSvgContent);
    return orderFields([...extracted, ...fromSvg, ...fromBackSvg]);
};

const buildTemplateFieldDefinitions = (template) => {
    const fields = buildTemplateFields(template);
    const schema = template?.fieldSchema || {};
    return fields.map((field) => {
        const base = buildDefaultFieldConfig(field);
        const current = schema[field] || {};
        const type = normalizeFieldType(field, current.type || base.type);
        return {
            key: field,
            label: current.label || base.label,
            type,
            required: Boolean(current.required),
            placeholder: current.placeholder ?? base.placeholder,
            defaultValue: current.defaultValue ?? base.defaultValue
        };
    });
};

const BusinessCardGenerator = () => {
    const { currentUser, isToolActive } = useAuth();

    // State
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState(null);
    const [loadingTemplates, setLoadingTemplates] = useState(true);

    const [activeFont, setActiveFont] = useState(fontOptions[0]);
    const [fontId, setFontId] = useState(fontOptions[0].id);

    const [imageValues, setImageValues] = useState({});
    const [fieldValues, setFieldValues] = useState({});
    const [validationErrors, setValidationErrors] = useState({});

    const imageInputRefs = useRef({});
    const exportRef = useRef(null);

    const [previewScale, setPreviewScale] = useState(1);
    const [isFlipped, setIsFlipped] = useState(false);
    const [qrDataUrl, setQrDataUrl] = useState('');

    const [isGenerating, setIsGenerating] = useState(false);

    const [paymentMethod, setPaymentMethod] = useState('pay');
    const [paymentStatus] = useState('idle');
    const [paymentUsed, setPaymentUsed] = useState(false);
    const templateCardSize = useMemo(
        () => extractTemplateSizeMm(selectedTemplate?.svgContent),
        [selectedTemplate?.svgContent]
    );

    // Fetch Templates
    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'businessCardTemplates'));
                const templatesData = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setTemplates(templatesData);
                if (templatesData.length > 0) {
                    setSelectedTemplate(templatesData[0]);
                }
            } catch (error) {
                console.error("Error fetching templates:", error);
            } finally {
                setLoadingTemplates(false);
            }
        };
        fetchTemplates();
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        const font = fontOptions.find((f) => f.id === fontId);
        setActiveFont(font);
    }, [fontId]);

    const templateFieldDefs = useMemo(
        () => (selectedTemplate ? buildTemplateFieldDefinitions(selectedTemplate) : []),
        [selectedTemplate]
    );
    const templateFields = useMemo(
        () => templateFieldDefs.map((field) => field.key),
        [templateFieldDefs]
    );
    const imageFieldDefs = useMemo(
        () => templateFieldDefs.filter((field) => field.type === 'image'),
        [templateFieldDefs]
    );
    const textFieldDefs = useMemo(
        () => templateFieldDefs.filter((field) => field.type !== 'image'),
        [templateFieldDefs]
    );

    useEffect(() => {
        setFieldValues(prev => {
            const next = {};
            textFieldDefs.forEach((field) => {
                next[field.key] = prev[field.key] ?? field.defaultValue ?? '';
            });
            return next;
        });
        setImageValues((prev) => {
            const next = {};
            imageFieldDefs.forEach((field) => {
                next[field.key] = prev[field.key] ?? field.defaultValue ?? '';
            });
            return next;
        });
        setValidationErrors({});
    }, [textFieldDefs, imageFieldDefs]);

    const displayData = useMemo(() => {
        const data = { ...defaultFieldSamples };
        if (templateFieldDefs.length === 0) return data;
        templateFieldDefs.forEach((field) => {
            if (field.type === 'image') {
                data[field.key] = imageValues[field.key] || field.defaultValue || '';
                return;
            }
            const value = fieldValues[field.key];
            if (value && value.trim() !== '') {
                data[field.key] = value;
                return;
            }
            if (data[field.key] == null) {
                data[field.key] = field.defaultValue || toTitleCase(field.key);
            }
        });

        const fullName = String(data.fullName || '').trim();
        const firstName = String(data.firstName || '').trim();
        const lastName = String(data.lastName || '').trim();

        if (!fullName && (firstName || lastName)) {
            data.fullName = [lastName, firstName].filter(Boolean).join(' ');
        }
        if (fullName && (!firstName || !lastName)) {
            const parts = fullName.split(/\s+/).filter(Boolean);
            if (!firstName && parts.length > 0) data.firstName = parts[parts.length - 1];
            if (!lastName && parts.length > 1) data.lastName = parts.slice(0, -1).join(' ');
        }
        if (!data.phone && data.mobilePhone) {
            data.phone = data.mobilePhone;
        }

        return data;
    }, [templateFieldDefs, fieldValues, imageValues]);

    // Generate QR Code
    useEffect(() => {
        if (displayData.web || displayData.email || displayData.phone) {
            const vCard = `BEGIN:VCARD
VERSION:3.0
N:${displayData.fullName}
ORG:${displayData.company}
TITLE:${displayData.position}
TEL:${displayData.phone}
EMAIL:${displayData.email}
URL:${displayData.web}
ADR:${displayData.address}
END:VCARD`;
            QRCode.toDataURL(vCard, { width: 120, margin: 0 }, (err, url) => {
                if (!err) {
                    setQrDataUrl(url);
                }
            });
        }
    }, [displayData]);

    const handleImageFieldChange = (fieldKey, event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            setImageValues((prev) => ({
                ...prev,
                [fieldKey]: loadEvent.target?.result || ''
            }));
            setValidationErrors((prev) => {
                const next = { ...prev };
                delete next[fieldKey];
                return next;
            });
        };
        reader.readAsDataURL(file);
    };

    const clearImageField = (fieldKey) => {
        setImageValues((prev) => ({
            ...prev,
            [fieldKey]: ''
        }));
        setValidationErrors((prev) => {
            const next = { ...prev };
            delete next[fieldKey];
            return next;
        });
        if (imageInputRefs.current[fieldKey]) {
            imageInputRefs.current[fieldKey].value = '';
        }
    };

    const handleFieldChange = (name, value) => {
        setFieldValues((prev) => ({ ...prev, [name]: value }));
        setValidationErrors((prev) => {
            const next = { ...prev };
            delete next[name];
            return next;
        });
    };

    const handleFieldInput = (e) => {
        const { name, value } = e.target;
        handleFieldChange(name, value);
    };

    const createPaymentInvoice = async () => {
        // Mock payment for now or existing logic
        alert("Payment integration pending refactor");
    };

    const consumeCreditsLocal = () => {
        // Mock credits
        setPaymentUsed(true);
    };

    const validateField = (fieldDef, value) => {
        if (fieldDef.type === 'image') {
            if (fieldDef.required && !String(value || '').trim()) return 'Зураг оруулах шаардлагатай.';
            return '';
        }

        const text = String(value ?? '').trim();
        if (fieldDef.required && !text) return 'Энэ талбарыг заавал бөглөнө.';
        if (!text) return '';

        if (fieldDef.type === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(text)) return 'Имэйл хаяг буруу байна.';
        }
        if (fieldDef.type === 'url') {
            const urlRegex = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/.*)?$/i;
            if (!urlRegex.test(text)) return 'Вэб хаяг буруу байна.';
        }
        if (fieldDef.type === 'tel') {
            const phoneRegex = /^\+?[\d\s().-]{7,}$/;
            if (!phoneRegex.test(text)) return 'Утасны дугаар буруу байна.';
        }
        return '';
    };

    const validateAllFields = () => {
        const nextErrors = {};
        templateFieldDefs.forEach((fieldDef) => {
            const value = fieldDef.type === 'image'
                ? imageValues[fieldDef.key]
                : fieldValues[fieldDef.key];
            const error = validateField(fieldDef, value);
            if (error) nextErrors[fieldDef.key] = error;
        });
        setValidationErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const handleDownload = async () => {
        if (!validateAllFields()) {
            alert('Талбаруудыг шалгаад дахин оролдоно уу.');
            return;
        }

        if (!paymentUsed && currentUser?.role !== 'admin') {
            alert('Please complete payment first.');
            return;
        }

        setIsGenerating(true);
        const exportRoot = exportRef.current;

        try {
            if (!selectedTemplate || !exportRoot) {
                alert('Загвар ачаалж дуусаагүй байна. Дахин оролдоно уу.');
                return;
            }

            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            if (document?.fonts?.ready) {
                await document.fonts.ready.catch(() => undefined);
            }

            const pages = Array.from(exportRoot.querySelectorAll('.business-card-export-page'));
            if (pages.length === 0) {
                alert('Экспортлох хуудас бэлдээгүй байна. Дахин оролдоно уу.');
                return;
            }

            const orientation = templateCardSize.widthMm >= templateCardSize.heightMm ? 'landscape' : 'portrait';
            const pdf = new jsPDF({
                unit: 'mm',
                format: [templateCardSize.widthMm, templateCardSize.heightMm],
                orientation,
                compress: true
            });

            for (let index = 0; index < pages.length; index += 1) {
                const pageElement = pages[index];
                const canvas = await html2canvas(pageElement, {
                    scale: 5,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    windowWidth: pageElement.scrollWidth,
                    windowHeight: pageElement.scrollHeight
                });
                const imageData = canvas.toDataURL('image/png', 1);

                if (index > 0) {
                    pdf.addPage([templateCardSize.widthMm, templateCardSize.heightMm], orientation);
                }

                pdf.addImage(
                    imageData,
                    'PNG',
                    0,
                    0,
                    templateCardSize.widthMm,
                    templateCardSize.heightMm
                );
            }

            const exportLastName = String(fieldValues.lastName ?? displayData.lastName ?? '').trim();
            const exportFirstName = String(fieldValues.firstName ?? displayData.firstName ?? '').trim();
            const exportFullName = String(fieldValues.fullName ?? displayData.fullName ?? '').trim();
            const personName = [exportLastName, exportFirstName].filter(Boolean).join(' ').trim()
                || exportFullName
                || 'Export';
            const safePersonName = personName
                .replace(/[\\/:*?"<>|]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                || 'Export';

            pdf.save(`BusinessCard_${safePersonName}.pdf`);
        } catch (error) {
            console.error(error);
            alert('Export failed');
        } finally {
            setIsGenerating(false);
        }
    };

    const paymentReady = paymentUsed || (currentUser?.role === 'admin');
    const hasBackTemplate = Boolean(selectedTemplate?.backSvgContent?.trim());

    const hasImageFields = imageFieldDefs.length > 0;
    const coreFields = ['company', 'fullName', 'position', 'tagline'];
    const contactFields = ['phone', 'email', 'web', 'address'];
    const socialFields = ['socialFacebook', 'socialInstagram', 'socialLinkedin', 'socialX'];

    const coreGroup = coreFields
        .map((field) => textFieldDefs.find((entry) => entry.key === field))
        .filter(Boolean);
    const contactGroup = contactFields
        .map((field) => textFieldDefs.find((entry) => entry.key === field))
        .filter(Boolean);
    const socialGroup = socialFields
        .map((field) => textFieldDefs.find((entry) => entry.key === field))
        .filter(Boolean);
    const customGroup = textFieldDefs.filter((field) => (
        !coreFields.includes(field.key)
        && !contactFields.includes(field.key)
        && !socialFields.includes(field.key)
    ));

    const fieldSections = [
        { key: 'core', fields: coreGroup },
        { key: 'contact', fields: contactGroup },
        { key: 'social', fields: socialGroup },
        { key: 'custom', label: 'Бусад талбарууд', fields: customGroup },
    ].filter(section => section.fields.length > 0);

    const renderFieldInput = (fieldDef) => {
        const value = fieldValues[fieldDef.key] ?? '';
        const isWide = fieldDef.type === 'textarea' || fieldDef.key === 'tagline' || fieldDef.key === 'address';
        const error = validationErrors[fieldDef.key];

        return (
            <div key={fieldDef.key} className={`form-field ${isWide ? 'col-span-2' : ''}`}>
                <label className="form-label flex items-center gap-1">
                    <span>{fieldDef.label || getFieldLabel(fieldDef.key)}</span>
                    {fieldDef.required && <span className="text-rose-500">*</span>}
                </label>
                {fieldDef.type === 'textarea' ? (
                    <textarea
                        className="input min-h-[72px]"
                        name={fieldDef.key}
                        value={value}
                        onChange={handleFieldInput}
                        placeholder={fieldDef.placeholder || getFieldPlaceholder(fieldDef.key)}
                    />
                ) : (
                    <input
                        className="input"
                        name={fieldDef.key}
                        value={value}
                        onChange={handleFieldInput}
                        placeholder={fieldDef.placeholder || getFieldPlaceholder(fieldDef.key)}
                        type={fieldDef.type === 'text' ? 'text' : fieldDef.type}
                    />
                )}
                {error && <div className="text-[11px] text-rose-600 mt-1">{error}</div>}
            </div>
        );
    };

    // Render SVG Template
    const renderTemplate = (svgContent, data) => {
        if (!svgContent) return null;
        let processedSvg = populateBusinessCardSvg(svgContent, data);

        // Keep uploaded images fitted to original SVG image boxes.
        processedSvg = processedSvg.replace(/<image\b([^>]*)>/gi, (match, attrs) => {
            if (/preserveAspectRatio=/i.test(attrs)) return `<image${attrs}>`;
            return `<image${attrs} preserveAspectRatio="none">`;
        });

        // Inject Font
        processedSvg = processedSvg.replace(/font-family="[^"]*"/g, `font-family="${activeFont.stack.split(',')[0]}"`);

        return (
            <div
                className="business-card-rendered-svg w-full h-full"
                dangerouslySetInnerHTML={{ __html: processedSvg }}
                style={{ fontFamily: activeFont.stack }}
            />
        );
    };

    return (
        <div className="business-card-page">
            <ToolHeader
                title="Нэрийн хуудас бүтээгч"
                subtitle="Бэлэн загваруудаас сонгон өөрийн нэрийн хуудсыг бүтээгээрэй."
            />

            <div className="container business-card-split-layout">
                {/* Left Sidebar: Controls */}
                <div className="business-card-sidebar">
                    {!isToolActive && (
                        <div className="alert alert-warning">
                            Энэ үйлчилгээ одоогоор түр хаалттай байна.
                        </div>
                    )}

                    {/* Section: Template Selection */}
                    <div className="business-card-section">
                        <div className="business-card-section-header">Загвар сонгох</div>
                        <div className="business-card-section-body">
                            {loadingTemplates ? (
                                <div className="text-center py-8 text-slate-500">Загваруудыг ачааллаж байна...</div>
                            ) : templates.length === 0 ? (
                                <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                    Загвар олдсонгүй
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto p-1 custom-scrollbar">
                                    {templates.map(template => (
                                        <button
                                            key={template.id}
                                            className={`relative aspect-[1.75] border rounded-lg overflow-hidden transition-all text-left group ${selectedTemplate?.id === template.id ? 'ring-2 ring-indigo-600 border-indigo-600' : 'border-slate-200 hover:border-indigo-400'}`}
                                            onClick={() => setSelectedTemplate(template)}
                                        >
                                            <div className="absolute inset-0 bg-white flex items-center justify-center p-1">
                                                <div className="w-full h-full transform scale-75 origin-center pointer-events-none" dangerouslySetInnerHTML={{ __html: template.svgContent.replace(/\{\{([^}]+)\}\}/g, '...') }}></div>
                                            </div>
                                            <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm p-1.5 text-[10px] font-semibold border-t border-slate-100 truncate">
                                                {template.name}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <label className="form-field mt-4">
                                <span className="form-label">Фонт</span>
                                <select
                                    className="select"
                                    value={fontId}
                                    onChange={(e) => setFontId(e.target.value)}
                                >
                                    {fontOptions.map((option) => (
                                        <option key={option.id} value={option.id}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>
                    </div>

                    {/* Section: Business Card Information */}
                    <div className="business-card-section">
                        <div className="business-card-section-header">Нэрийн хуудсанд орох мэдээллүүд</div>
                        <div className="business-card-section-body">
                            {hasImageFields && (
                                <div className="space-y-3">
                                    {imageFieldDefs.map((imageField) => {
                                        const value = imageValues[imageField.key];
                                        return (
                                            <div key={imageField.key} className="business-card-logo-upload">
                                                <label className="form-label flex items-center gap-1">
                                                    <span>{imageField.label || getFieldLabel(imageField.key)}</span>
                                                    {imageField.required && <span className="text-rose-500">*</span>}
                                                </label>
                                                <div className="flex gap-3 items-center">
                                                    <input
                                                        ref={(node) => {
                                                            imageInputRefs.current[imageField.key] = node;
                                                        }}
                                                        className="input"
                                                        type="file"
                                                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                                        onChange={(event) => handleImageFieldChange(imageField.key, event)}
                                                        style={{ fontSize: '0.85rem' }}
                                                    />
                                                    {value && (
                                                        <button type="button" className="btn btn-ghost btn-danger btn-sm" onClick={() => clearImageField(imageField.key)}>
                                                            Устгах
                                                        </button>
                                                    )}
                                                </div>
                                                {validationErrors[imageField.key] && (
                                                    <div className="text-[11px] text-rose-600 mt-1">{validationErrors[imageField.key]}</div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {templateFields.length === 0 && (
                                <div className="text-sm text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200 p-3">
                                    Энэ загварт солих талбар олдсонгүй. Админ талд SVG дээр <span className="font-mono text-slate-700">{'{{field}}'}</span> гэж тэмдэглэснээр энд автоматаар талбар үүснэ.
                                </div>
                            )}

                            {fieldSections.map((section, index) => (
                                <div key={section.key}>
                                    {(index > 0 || hasImageFields) && <div className="business-card-form-divider" />}
                                    {section.label && (
                                        <div className="text-xs font-semibold text-slate-500 mb-2">{section.label}</div>
                                    )}
                                    <div className="grid grid-cols-2 gap-4">
                                        {section.fields.map(renderFieldInput)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Section: Payment */}
                    <div className="business-card-section">
                        <div className="business-card-section-header">Үнэ, төлбөр</div>
                        <div className="business-card-section-body">
                            <div className="flex flex-col gap-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-slate-500">Үнэ</span>
                                    <div className="text-xl font-bold text-slate-900">
                                        {currentUser?.role === 'admin' ? 'Үнэгүй (Admin)' : '5,000₮'}
                                    </div>
                                </div>

                                {paymentReady ? (
                                    <div className="flex flex-col gap-3">
                                        <div className="alert alert-success text-center py-2 text-sm">
                                            Төлбөр төлөгдсөн. Татах боломжтой.
                                        </div>
                                        <button onClick={handleDownload} disabled={isGenerating} className="btn btn-primary w-full">
                                            {isGenerating ? 'Бэлтгэж байна...' : 'PDF Татах'} <Download size={18} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        <div className="flex gap-2">
                                            <button className={`flex-1 btn btn-sm ${paymentMethod === 'pay' ? 'btn-secondary' : 'btn-outline'}`} onClick={() => setPaymentMethod('pay')}>QPay</button>
                                            <button className={`flex-1 btn btn-sm ${paymentMethod === 'credits' ? 'btn-secondary' : 'btn-outline'}`} onClick={() => setPaymentMethod('credits')}>Кредит</button>
                                        </div>
                                        <button onClick={paymentMethod === 'credits' ? consumeCreditsLocal : createPaymentInvoice} disabled={paymentStatus === 'creating'} className="btn btn-primary w-full">
                                            {paymentMethod === 'credits' ? 'Кредит ашиглах' : 'Төлбөр төлөх'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Preview Area */}
                <div className="business-card-main">
                    <div className="business-card-toolbar">
                        <div className="flex gap-2">
                            <button className="btn btn-icon btn-sm" onClick={() => setPreviewScale(s => Math.max(0.5, s - 0.1))}><ZoomOut size={16} /></button>
                            <div className="flex items-center text-xs font-mono font-medium w-12 justify-center">{Math.round(previewScale * 100)}%</div>
                            <button className="btn btn-icon btn-sm" onClick={() => setPreviewScale(s => Math.min(2, s + 0.1))}><ZoomIn size={16} /></button>
                        </div>
                        <div className="h-4 w-[1px] bg-slate-200 mx-2" />
                        <button className={`btn btn-sm ${isFlipped ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setIsFlipped(!isFlipped)}>
                            <RotateCcw size={14} className="mr-1" /> Эргүүлэх
                        </button>
                    </div>

                    <div className="business-card-preview-container">
                        <div
                            className="business-card-preview-wrapper"
                            style={{
                                width: `min(100%, ${templateCardSize.widthMm}mm)`,
                                aspectRatio: `${templateCardSize.widthMm} / ${templateCardSize.heightMm}`,
                                transform: `scale(${previewScale})`,
                                transition: 'transform 0.2s ease'
                            }}
                        >
                            {selectedTemplate ? (
                                <div className={`business-card-3d-scene ${isFlipped ? 'flipped' : ''}`}>
                                    {/* Front */}
                                    <div className="business-card-3d-card">
                                        <div className="business-card-face business-card-face--front bg-white shadow-xl">
                                            {renderTemplate(selectedTemplate.svgContent, displayData)}
                                        </div>
                                        <div className="business-card-face business-card-face--back bg-white shadow-xl flex items-center justify-center">
                                            {hasBackTemplate
                                                ? renderTemplate(selectedTemplate.backSvgContent, displayData)
                                                : (
                                                    <>
                                                        {qrDataUrl && <img src={qrDataUrl} alt="QR" className="w-24 h-24" />}
                                                        {!qrDataUrl && <span className="text-slate-300">No content</span>}
                                                    </>
                                                )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-[300px] w-full text-slate-400">
                                    Загвар сонгоно уу
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Hidden Export */}
            <div className="business-card-export" aria-hidden="true">
                <div ref={exportRef} className="business-card-export-root">
                    {selectedTemplate && (
                        <>
                            <div
                                className="business-card-export-page relative bg-white overflow-hidden"
                                style={{
                                    width: `${templateCardSize.widthMm}mm`,
                                    height: `${templateCardSize.heightMm}mm`
                                }}
                            >
                                {renderTemplate(selectedTemplate.svgContent, displayData)}
                            </div>
                            {hasBackTemplate && (
                                <div
                                    className="business-card-export-page relative bg-white overflow-hidden"
                                    style={{
                                        width: `${templateCardSize.widthMm}mm`,
                                        height: `${templateCardSize.heightMm}mm`
                                    }}
                                >
                                    {renderTemplate(selectedTemplate.backSvgContent, displayData)}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BusinessCardGenerator;
