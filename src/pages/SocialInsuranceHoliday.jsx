import React from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft,
    Brain,
    Upload,
    FileText,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    Building2,
    CalendarDays,
    TrendingUp,
    FileImage,
    Download,
    Sparkles,
    Save,
    RefreshCw,
    Heart,
    ChevronDown,
    ChevronRight,
    ChevronsUpDown,
} from 'lucide-react';
import { extractNDSHFromImage } from '../lib/ndshParser';
import './SocialInsuranceHoliday.css';

const STORAGE_KEY = 'ndsh-saved-data';

const SocialInsuranceHoliday = () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    const [file, setFile] = React.useState(null);
    const [step, setStep] = React.useState('idle');
    const [progress, setProgress] = React.useState(0);
    const [error, setError] = React.useState(null);
    const [parsedData, setParsedData] = React.useState(null);
    const [savedData, setSavedData] = React.useState(null);
    const [isSaving, setIsSaving] = React.useState(false);
    const [showUpload, setShowUpload] = React.useState(false);
    const [includeVoluntary, setIncludeVoluntary] = React.useState(true);
    const [expandedYears, setExpandedYears] = React.useState(new Set());
    const [abnormalMonths, setAbnormalMonths] = React.useState({});
    const [baseVacationDays, setBaseVacationDays] = React.useState(15);
    const [toast, setToast] = React.useState(null);
    const [isPrinting, setIsPrinting] = React.useState(false);

    const fileInputRef = React.useRef(null);
    const previousExpandedRef = React.useRef(new Set());

    React.useEffect(() => {
        const handleAfterPrint = () => {
            setIsPrinting(false);
            setExpandedYears(new Set(previousExpandedRef.current));
        };

        window.addEventListener('afterprint', handleAfterPrint);
        return () => window.removeEventListener('afterprint', handleAfterPrint);
    }, []);

    React.useEffect(() => {
        try {
            const savedRaw = localStorage.getItem(STORAGE_KEY);
            if (!savedRaw) return;
            const saved = JSON.parse(savedRaw);
            if (saved?.parsedData) {
                setParsedData(saved.parsedData);
                setAbnormalMonths(saved.abnormalMonths || {});
                setBaseVacationDays(saved.baseVacationDays || 15);
                setSavedData(saved);
                setStep('complete');
            }
        } catch (e) {
            console.error('Failed to load saved NDSH data', e);
        }
    }, []);

    const showToast = React.useCallback((payload) => {
        setToast(payload);
        window.setTimeout(() => setToast(null), 3200);
    }, []);

    const updateAbnormalMonths = (year, value, maxMonths) => {
        const clampedValue = Math.max(0, Math.min(value, maxMonths));
        setAbnormalMonths((prev) => ({
            ...prev,
            [year]: clampedValue,
        }));
    };

    const totalAbnormalMonths = React.useMemo(() => {
        return Object.values(abnormalMonths).reduce((sum, val) => sum + (val || 0), 0);
    }, [abnormalMonths]);

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(selectedFile.type)) {
            showToast({
                variant: 'error',
                title: 'Буруу файл төрөл',
                description: 'PDF, JPG, PNG файл оруулна уу',
            });
            return;
        }
        if (selectedFile.size > 20 * 1024 * 1024) {
            showToast({
                variant: 'error',
                title: 'Файл хэт том',
                description: 'Файлын хэмжээ 20MB-аас бага байх ёстой',
            });
            return;
        }
        setFile(selectedFile);
        setError(null);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (!droppedFile) return;
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (validTypes.includes(droppedFile.type)) {
            setFile(droppedFile);
            setError(null);
        }
    };

    const processFile = async () => {
        if (!file) return;
        if (!apiKey) {
            setStep('error');
            setError('API Key тохируулагдаагүй байна (.env).');
            showToast({
                variant: 'error',
                title: 'Алдаа',
                description: 'API Key тохируулагдаагүй байна (.env).',
            });
            return;
        }

        try {
            setStep('uploading');
            setProgress(20);

            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            setProgress(40);
            setStep('analyzing');

            const result = await extractNDSHFromImage(dataUrl, file.type, apiKey);

            setProgress(90);
            setParsedData(result);
            setStep('complete');
            setProgress(100);
            setShowUpload(false);

            const paymentCount = result?.payments?.length || 0;
            if (paymentCount === 0) {
                showToast({
                    variant: 'error',
                    title: 'Анхааруулга',
                    description: 'Файлаас НДШ төлөлтийн мэдээлэл олдсонгүй.',
                });
            } else {
                showToast({
                    variant: 'success',
                    title: 'Амжилттай!',
                    description: `${paymentCount} бүртгэл олдлоо`,
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Алдаа гарлаа';
            console.error('NDSH processing error:', errorMessage);
            setStep('error');
            setError(errorMessage);
            showToast({
                variant: 'error',
                title: 'Алдаа',
                description: errorMessage,
            });
        }
    };

    const resetState = () => {
        setFile(null);
        setStep('idle');
        setProgress(0);
        setError(null);
        setParsedData(null);
        setShowUpload(false);
    };

    const handleSave = async () => {
        if (!parsedData) return;
        setIsSaving(true);
        try {
            const payload = {
                parsedData,
                abnormalMonths,
                baseVacationDays,
                updatedAt: new Date().toISOString(),
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            setSavedData(payload);
            showToast({
                variant: 'success',
                title: 'Амжилттай хадгалагдлаа!',
                description: `Амралтын хоног: ${vacationCalculation.total} өдөр`,
            });
        } catch (e) {
            showToast({
                variant: 'error',
                title: 'Алдаа',
                description: 'Хадгалахад алдаа гарлаа',
            });
        } finally {
            setIsSaving(false);
        }
    };

    const hasUnsavedChanges = React.useMemo(() => {
        if (!parsedData) return false;
        if (!savedData?.parsedData) return true;
        if ((parsedData.payments?.length || 0) !== (savedData.parsedData.payments?.length || 0)) return true;
        const savedAbnormal = savedData.abnormalMonths || {};
        if (JSON.stringify(abnormalMonths) !== JSON.stringify(savedAbnormal)) return true;
        const savedBaseDays = savedData.baseVacationDays || 15;
        if (baseVacationDays !== savedBaseDays) return true;
        return false;
    }, [parsedData, savedData, abnormalMonths, baseVacationDays]);

    const groupedByYear = React.useMemo(() => {
        if (!parsedData) return {};
        const grouped = {};
        parsedData.payments.forEach((payment) => {
            if (!grouped[payment.year]) grouped[payment.year] = {};
            if (!grouped[payment.year][payment.organization]) {
                grouped[payment.year][payment.organization] = Array(12).fill(false);
            }
            if (payment.month >= 1 && payment.month <= 12) {
                grouped[payment.year][payment.organization][payment.month - 1] = payment.paid;
            }
        });
        return grouped;
    }, [parsedData]);

    const isVoluntaryInsurance = (org) => {
        return org.toLowerCase().includes('сайн дурын') || org.toLowerCase().includes('сайн дурын даатгал');
    };

    const voluntaryStats = React.useMemo(() => {
        if (!parsedData) return { totalMonths: 0, uniqueMonths: new Set() };
        const uniqueMonths = new Set();
        parsedData.payments.forEach((payment) => {
            if (payment.paid && isVoluntaryInsurance(payment.organization)) {
                uniqueMonths.add(`${payment.year}-${payment.month}`);
            }
        });
        return { totalMonths: uniqueMonths.size, uniqueMonths };
    }, [parsedData]);

    const yearlyStats = React.useMemo(() => {
        if (!parsedData) return {};
        const stats = {};
        parsedData.payments.forEach((payment) => {
            if (!stats[payment.year]) {
                stats[payment.year] = {
                    paidMonths: 0,
                    uniqueMonths: new Set(),
                    voluntaryMonths: new Set(),
                    regularMonths: new Set(),
                };
            }
            if (payment.paid && payment.month >= 1 && payment.month <= 12) {
                stats[payment.year].uniqueMonths.add(payment.month);
                if (isVoluntaryInsurance(payment.organization)) {
                    stats[payment.year].voluntaryMonths.add(payment.month);
                } else {
                    stats[payment.year].regularMonths.add(payment.month);
                }
            }
        });

        Object.keys(stats).forEach((year) => {
            stats[year].paidMonths = stats[year].uniqueMonths.size;
        });

        return stats;
    }, [parsedData]);

    const totalStats = React.useMemo(() => {
        const entries = Object.entries(yearlyStats);
        if (entries.length === 0) {
            return {
                totalMonths: 0,
                totalYears: 0,
                yearsCount: 0,
                remainingMonths: 0,
                fullYears: 0,
                regularMonths: 0,
            };
        }

        let totalMonths = 0;
        let regularMonths = 0;
        let yearsWithFullPayment = 0;

        entries.forEach(([, stats]) => {
            if (includeVoluntary) {
                totalMonths += stats.uniqueMonths.size;
            } else {
                totalMonths += stats.regularMonths.size;
            }
            regularMonths += stats.regularMonths.size;
            if (stats.paidMonths === 12) {
                yearsWithFullPayment++;
            }
        });

        return {
            totalMonths,
            totalYears: entries.length,
            yearsCount: Math.floor(totalMonths / 12),
            remainingMonths: totalMonths % 12,
            fullYears: yearsWithFullPayment,
            regularMonths,
        };
    }, [yearlyStats, includeVoluntary]);

    const sortedYears = Object.keys(groupedByYear).map(Number).sort((a, b) => b - a);

    const toggleYear = (year) => {
        setExpandedYears((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(year)) {
                newSet.delete(year);
            } else {
                newSet.add(year);
            }
            return newSet;
        });
    };

    const toggleAllYears = () => {
        if (expandedYears.size === sortedYears.length) {
            setExpandedYears(new Set());
        } else {
            setExpandedYears(new Set(sortedYears));
        }
    };

    const ABNORMAL_INTERVALS = [
        { days: 5, min: 61, max: 120, label: '6–10 жил' },
        { days: 7, min: 121, max: 180, label: '11–15 жил' },
        { days: 9, min: 181, max: 240, label: '16–20 жил' },
        { days: 12, min: 241, max: 300, label: '21–25 жил' },
        { days: 15, min: 301, max: 372, label: '26–31 жил' },
        { days: 18, min: 373, max: Infinity, label: '32+ жил' },
    ];

    const getAdditionalDays = (months, isAbnormal) => {
        if (isAbnormal) {
            if (months >= 373) return 18;
            if (months >= 301) return 15;
            if (months >= 241) return 12;
            if (months >= 181) return 9;
            if (months >= 121) return 7;
            if (months >= 61) return 5;
            return 0;
        }
        if (months >= 373) return 14;
        if (months >= 301) return 11;
        if (months >= 241) return 9;
        if (months >= 181) return 7;
        if (months >= 121) return 5;
        if (months >= 61) return 3;
        return 0;
    };

    const getAbnormalInterval = (months) => {
        for (let i = ABNORMAL_INTERVALS.length - 1; i >= 0; i--) {
            if (months >= ABNORMAL_INTERVALS[i].min) {
                return ABNORMAL_INTERVALS[i];
            }
        }
        return null;
    };

    const vacationCalculation = React.useMemo(() => {
        const matchedInterval = getAbnormalInterval(totalAbnormalMonths);
        const abnormalQualifies = matchedInterval !== null;
        const effectiveAbnormalMonths = abnormalQualifies ? matchedInterval.min : 0;
        const excessAbnormalMonths = abnormalQualifies ? totalAbnormalMonths - matchedInterval.min : totalAbnormalMonths;
        const normalMonths = Math.max(0, totalStats.totalMonths - effectiveAbnormalMonths);

        const normalAdditional = getAdditionalDays(normalMonths, false);
        const abnormalAdditional = getAdditionalDays(effectiveAbnormalMonths, true);
        const total = baseVacationDays + normalAdditional + abnormalAdditional;

        return {
            base: baseVacationDays,
            normalMonths,
            normalAdditional,
            effectiveAbnormalMonths,
            excessAbnormalMonths,
            abnormalAdditional,
            abnormalQualifies,
            matchedInterval,
            total,
        };
    }, [baseVacationDays, totalStats.totalMonths, totalAbnormalMonths]);

    const isProcessing = step === 'uploading' || step === 'analyzing';
    const showUploadSection = step === 'idle' || step === 'uploading' || step === 'analyzing' || step === 'error' || showUpload;

    const handleExportPdf = () => {
        if (!parsedData) return;
        previousExpandedRef.current = new Set(expandedYears);
        setExpandedYears(new Set(sortedYears));
        setIsPrinting(true);

        window.setTimeout(() => {
            window.print();
        }, 120);
    };

    return (
        <div className={`ndsh2-page ${isPrinting ? 'ndsh2-printing' : ''}`}>
            <div className="ndsh2-header">
                <div className="ndsh2-header-inner">
                    <div>
                        <h1>Ажилсан жил тооцоолох</h1>
                        <p>НДШ төлөлтийн лавлагаагаар ажилласан жил тооцоолох</p>
                    </div>
                    <Link to="/ai-assistant" className="ndsh2-btn ndsh2-btn--ghost">
                        <ArrowLeft className="ndsh2-icon" />
                        Буцах
                    </Link>
                </div>
            </div>

            <div className="ndsh2-content">
                {toast && (
                    <div className={`ndsh2-toast ndsh2-toast--${toast.variant || 'success'}`}>
                        <div>
                            <p className="ndsh2-toast-title">{toast.title}</p>
                            <p className="ndsh2-toast-desc">{toast.description}</p>
                        </div>
                    </div>
                )}

                {showUploadSection && (
                    <div className="ndsh2-card ndsh2-card--stack">
                        <div className="ndsh2-card-header">
                            <div className="ndsh2-card-title">
                                <Sparkles className="ndsh2-icon" />
                                НДШ төлөлтийн лавлагаа оруулах
                            </div>
                        </div>
                        <div className="ndsh2-card-body">
                            {step === 'idle' && (
                                <>
                                    <div
                                        className={`ndsh2-dropzone ${file ? 'ndsh2-dropzone--active' : ''}`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDrop={handleDrop}
                                        onDragOver={(e) => e.preventDefault()}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                                            onChange={handleFileSelect}
                                            className="ndsh2-hidden"
                                        />
                                        {file ? (
                                            <div className="ndsh2-dropzone-file">
                                                <div className="ndsh2-file-icon">
                                                    <FileText className="ndsh2-icon" />
                                                </div>
                                                <p className="ndsh2-file-name">{file.name}</p>
                                                <p className="ndsh2-file-meta">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                            </div>
                                        ) : (
                                            <div className="ndsh2-dropzone-empty">
                                                <div className="ndsh2-upload-icon">
                                                    <Upload className="ndsh2-icon" />
                                                </div>
                                                <p className="ndsh2-dropzone-title">НДШ лавлагааг энд чирж оруулна уу</p>
                                                <p className="ndsh2-dropzone-sub">эсвэл дарж сонгоно уу</p>
                                                <div className="ndsh2-badge-row">
                                                    <span className="ndsh2-badge ndsh2-badge--secondary">
                                                        <FileText className="ndsh2-icon" />
                                                        PDF
                                                    </span>
                                                    <span className="ndsh2-badge ndsh2-badge--secondary">
                                                        <FileImage className="ndsh2-icon" />
                                                        JPG/PNG
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="ndsh2-action-row">
                                        <button
                                            type="button"
                                            className="ndsh2-btn ndsh2-btn--outline"
                                            onClick={() => {
                                                if (parsedData) {
                                                    setShowUpload(false);
                                                    setFile(null);
                                                } else {
                                                    resetState();
                                                }
                                            }}
                                        >
                                            {parsedData ? 'Болих' : 'Цэвэрлэх'}
                                        </button>
                                        <button
                                            type="button"
                                            className="ndsh2-btn ndsh2-btn--primary"
                                            onClick={processFile}
                                            disabled={!file}
                                        >
                                            <Brain className="ndsh2-icon" />
                                            AI-аар шинжлэх
                                        </button>
                                    </div>
                                </>
                            )}

                            {isProcessing && (
                                <div className="ndsh2-processing">
                                    <div className="ndsh2-processing-icon">
                                        <Brain className="ndsh2-icon" />
                                        <span className="ndsh2-processing-spinner">
                                            <Loader2 className="ndsh2-icon" />
                                        </span>
                                    </div>
                                    <div className="ndsh2-processing-text">
                                        <p>{step === 'uploading' ? 'Файл уншиж байна...' : 'AI шинжилж байна...'}</p>
                                        <span>Түр хүлээнэ үү</span>
                                    </div>
                                    <div className="ndsh2-progress">
                                        <div style={{ width: `${progress}%` }} />
                                    </div>
                                </div>
                            )}

                            {step === 'error' && (
                                <div className="ndsh2-error">
                                    <div className="ndsh2-error-icon">
                                        <AlertTriangle className="ndsh2-icon" />
                                    </div>
                                    <div>
                                        <p>Алдаа гарлаа</p>
                                        <span>{error}</span>
                                    </div>
                                    <button type="button" className="ndsh2-btn ndsh2-btn--outline" onClick={resetState}>
                                        Дахин оролдох
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {step === 'complete' && parsedData && !showUpload && (
                    <div className="ndsh2-results">
                        <div className="ndsh2-hero">
                            <div className="ndsh2-hero-main">
                                <div className="ndsh2-hero-icon">
                                    <CalendarDays className="ndsh2-icon" />
                                </div>
                                <div>
                                    <p>Нийт амралтын хоног</p>
                                    <h2>
                                        {vacationCalculation.total}
                                        <span>өдөр</span>
                                    </h2>
                                </div>
                            </div>
                            <div className="ndsh2-hero-breakdown">
                                <div className="ndsh2-hero-pill">
                                    <p>Суурь</p>
                                    <strong>{vacationCalculation.base}</strong>
                                    <span>{baseVacationDays === 15 ? 'Ердийн' : 'ХБИ/18-'}</span>
                                </div>
                                <span className="ndsh2-hero-plus">+</span>
                                <div className="ndsh2-hero-pill">
                                    <p>Хэвийн нэмэлт</p>
                                    <strong>{vacationCalculation.normalAdditional}</strong>
                                    <span>{vacationCalculation.normalMonths} сар</span>
                                </div>
                                <span className="ndsh2-hero-plus">+</span>
                                <div className={`ndsh2-hero-pill ${vacationCalculation.abnormalQualifies ? '' : 'ndsh2-hero-pill--muted'}`}>
                                    <p>Хэв. бус нэмэлт</p>
                                    <strong>{vacationCalculation.abnormalAdditional}</strong>
                                    <span>
                                        {vacationCalculation.abnormalQualifies
                                            ? `${vacationCalculation.effectiveAbnormalMonths} сар`
                                            : `${totalAbnormalMonths} сар < 61`}
                                    </span>
                                </div>
                            </div>
                            {totalAbnormalMonths > 0 && (
                                <div className="ndsh2-hero-note">
                                    {!vacationCalculation.abnormalQualifies ? (
                                        <span>
                                            Хэвийн бус <strong>{totalAbnormalMonths}</strong> сар нь 61 сарын доогуур учир бүгд хэвийн нөхцөлд шилжив.
                                            <span className="ndsh2-hero-note-muted"> (Хэвийн: {vacationCalculation.normalMonths} сар)</span>
                                        </span>
                                    ) : (
                                        <span>
                                            Хэвийн бус <strong>{totalAbnormalMonths}</strong> сар →
                                            <strong className="ndsh2-hero-note-accent"> {vacationCalculation.effectiveAbnormalMonths}</strong> сар
                                            ({vacationCalculation.matchedInterval?.min}–
                                            {vacationCalculation.matchedInterval?.max === Infinity ? '∞' : vacationCalculation.matchedInterval?.max} интервал).
                                            {vacationCalculation.excessAbnormalMonths > 0 && (
                                                <span className="ndsh2-hero-note-success">
                                                    Илүүдэл <strong>{vacationCalculation.excessAbnormalMonths}</strong> сар хэвийн рүү шилжив.
                                                </span>
                                            )}
                                            <span className="ndsh2-hero-note-muted"> (Хэвийн: {vacationCalculation.normalMonths} сар)</span>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {parsedData.employeeInfo && (parsedData.employeeInfo.lastName || parsedData.employeeInfo.firstName) && (
                            <div className="ndsh2-card ndsh2-card--compact">
                                <div className="ndsh2-card-body ndsh2-employee">
                                    <div className="ndsh2-employee-icon">👤</div>
                                    <div>
                                        <p className="ndsh2-employee-label">Даатгуулагч</p>
                                        <p className="ndsh2-employee-name">
                                            {parsedData.employeeInfo.lastName} {parsedData.employeeInfo.firstName}
                                            {parsedData.employeeInfo.registrationNumber && (
                                                <span className="ndsh2-employee-reg">({parsedData.employeeInfo.registrationNumber})</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="ndsh2-card ndsh2-card--compact ndsh2-card--accent">
                            <div className="ndsh2-card-body ndsh2-base-days">
                                <div className="ndsh2-base-info">
                                    <div className="ndsh2-base-icon">
                                        <CalendarDays className="ndsh2-icon" />
                                    </div>
                                    <div>
                                        <p>Жилийн суурь амралт</p>
                                        <span>Ажилтны ангилал сонгох</span>
                                    </div>
                                </div>
                                <div className="ndsh2-base-actions">
                                    <button
                                        type="button"
                                        onClick={() => setBaseVacationDays(15)}
                                        className={`ndsh2-toggle ${baseVacationDays === 15 ? 'ndsh2-toggle--active' : ''}`}
                                    >
                                        <strong>15 өдөр</strong>
                                        <span>Ердийн ажилтан</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBaseVacationDays(20)}
                                        className={`ndsh2-toggle ${baseVacationDays === 20 ? 'ndsh2-toggle--active' : ''}`}
                                    >
                                        <strong>20 өдөр</strong>
                                        <span>ХБИ / 18-аас доош</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {voluntaryStats.totalMonths > 0 && (
                            <div className="ndsh2-card ndsh2-card--compact ndsh2-card--voluntary">
                                <div className="ndsh2-card-body ndsh2-voluntary">
                                    <div className="ndsh2-voluntary-info">
                                        <div className="ndsh2-voluntary-icon">
                                            <Heart className="ndsh2-icon" />
                                        </div>
                                        <div>
                                            <p>Сайн дурын даатгал</p>
                                            <span>{voluntaryStats.totalMonths} сар илэрсэн</span>
                                        </div>
                                    </div>
                                    <div className="ndsh2-voluntary-actions">
                                        <label className="ndsh2-checkbox">
                                            <input
                                                type="checkbox"
                                                checked={includeVoluntary}
                                                onChange={(e) => setIncludeVoluntary(e.target.checked)}
                                            />
                                            <span>Нийт хугацаанд оруулах</span>
                                        </label>
                                        <span className={`ndsh2-badge ${includeVoluntary ? 'ndsh2-badge--success' : 'ndsh2-badge--muted'}`}>
                                            {includeVoluntary ? 'Оруулсан' : 'Оруулаагүй'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="ndsh2-summary-grid">
                            <div className="ndsh2-card ndsh2-card--compact">
                                <div className="ndsh2-card-header ndsh2-card-header--plain">
                                    <div className="ndsh2-card-title">
                                        <TrendingUp className="ndsh2-icon" />
                                        Нэмэлт хоног (жилд)
                                    </div>
                                </div>
                                <div className="ndsh2-card-body ndsh2-table-stack">
                                    <div>
                                        <p className="ndsh2-table-label ndsh2-table-label--success">
                                            <CheckCircle2 className="ndsh2-icon" />
                                            Хэвийн нөхцөлд ({vacationCalculation.normalMonths} сар)
                                        </p>
                                        <div className="ndsh2-table">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th className="ndsh2-right">Нэмэлт</th>
                                                        <th>Интервал</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[
                                                        { days: 3, range: '61–120', years: '6–10 жил', min: 61, max: 120 },
                                                        { days: 5, range: '121–180', years: '11–15 жил', min: 121, max: 180 },
                                                        { days: 7, range: '181–240', years: '16–20 жил', min: 181, max: 240 },
                                                        { days: 9, range: '241–300', years: '21–25 жил', min: 241, max: 300 },
                                                        { days: 11, range: '301–372', years: '26–31 жил', min: 301, max: 372 },
                                                        { days: 14, range: '373+', years: '32+ жил', min: 373, max: Infinity },
                                                    ].map((row, idx) => {
                                                        const isActive = vacationCalculation.normalMonths >= row.min && vacationCalculation.normalMonths <= row.max;
                                                        return (
                                                            <tr key={idx} className={isActive ? 'is-active' : ''}>
                                                                <td className="ndsh2-right">
                                                                    {row.days} өдөр {isActive && '✓'}
                                                                </td>
                                                                <td>
                                                                    {row.range} сар <span>({row.years})</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="ndsh2-table-label ndsh2-table-label--danger">
                                            <AlertTriangle className="ndsh2-icon" />
                                            Хэвийн бус нөхцөлд
                                            {totalAbnormalMonths > 0 && (
                                                <span>
                                                    ({totalAbnormalMonths} сар
                                                    {vacationCalculation.abnormalQualifies
                                                        ? ` → ${vacationCalculation.effectiveAbnormalMonths} сар`
                                                        : ' → хэвийн рүү'}
                                                    {vacationCalculation.excessAbnormalMonths > 0 && ` +${vacationCalculation.excessAbnormalMonths} хэвийн`})
                                                </span>
                                            )}
                                        </p>
                                        <div className={`ndsh2-table ${vacationCalculation.abnormalQualifies ? '' : 'ndsh2-table--muted'}`}>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th className="ndsh2-right">Нэмэлт</th>
                                                        <th>Интервал</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {[
                                                        { days: 5, range: '61–120', years: '6–10 жил', min: 61, max: 120 },
                                                        { days: 7, range: '121–180', years: '11–15 жил', min: 121, max: 180 },
                                                        { days: 9, range: '181–240', years: '16–20 жил', min: 181, max: 240 },
                                                        { days: 12, range: '241–300', years: '21–25 жил', min: 241, max: 300 },
                                                        { days: 15, range: '301–372', years: '26–31 жил', min: 301, max: 372 },
                                                        { days: 18, range: '373+', years: '32+ жил', min: 373, max: Infinity },
                                                    ].map((row, idx) => {
                                                        const isActive =
                                                            vacationCalculation.abnormalQualifies &&
                                                            vacationCalculation.effectiveAbnormalMonths >= row.min &&
                                                            vacationCalculation.effectiveAbnormalMonths <= row.max;
                                                        return (
                                                            <tr key={idx} className={isActive ? 'is-active' : ''}>
                                                                <td className="ndsh2-right">
                                                                    {row.days} өдөр {isActive && '✓'}
                                                                </td>
                                                                <td>
                                                                    {row.range} сар <span>({row.years})</span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="ndsh2-summary-cards">
                                <div className="ndsh2-summary-card ndsh2-summary-card--emerald">
                                    <CalendarDays className="ndsh2-icon" />
                                    <div>
                                        <p>Нийт хугацаа</p>
                                        <strong>
                                            {totalStats.yearsCount > 0 ? `${totalStats.yearsCount} жил ` : ''}
                                            {totalStats.remainingMonths > 0
                                                ? `${totalStats.remainingMonths} сар`
                                                : totalStats.yearsCount === 0
                                                    ? '0 сар'
                                                    : ''}
                                        </strong>
                                    </div>
                                </div>
                                <div className="ndsh2-summary-card ndsh2-summary-card--blue">
                                    <CheckCircle2 className="ndsh2-icon" />
                                    <div>
                                        <p>Нийт сар</p>
                                        <strong>{totalStats.totalMonths}</strong>
                                    </div>
                                </div>
                                <div className="ndsh2-summary-card ndsh2-summary-card--violet">
                                    <TrendingUp className="ndsh2-icon" />
                                    <div>
                                        <p>Хамрагдсан жил</p>
                                        <strong>{totalStats.totalYears}</strong>
                                    </div>
                                </div>
                                <div className="ndsh2-summary-card ndsh2-summary-card--amber">
                                    <Building2 className="ndsh2-icon" />
                                    <div>
                                        <p>Байгууллага</p>
                                        <strong>
                                            {Object.keys(
                                                Object.values(groupedByYear).reduce((acc, orgs) => ({
                                                    ...acc,
                                                    ...orgs,
                                                }), {})
                                            ).length}
                                        </strong>
                                    </div>
                                </div>
                                <div className="ndsh2-summary-card ndsh2-summary-card--rose">
                                    <AlertTriangle className="ndsh2-icon" />
                                    <div>
                                        <p>Хэвийн бус нөхцөл</p>
                                        <strong>{totalAbnormalMonths} сар</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {parsedData.summary?.longestEmployment?.organization && (
                            <div className="ndsh2-card ndsh2-card--compact">
                                <div className="ndsh2-card-body ndsh2-longest">
                                    <div className="ndsh2-longest-icon">
                                        <Building2 className="ndsh2-icon" />
                                    </div>
                                    <div>
                                        <p>Хамгийн удаан ажилласан байгууллага</p>
                                        <strong>{parsedData.summary.longestEmployment.organization}</strong>
                                    </div>
                                    <span className="ndsh2-badge ndsh2-badge--indigo">
                                        {parsedData.summary.longestEmployment.months} сар
                                    </span>
                                </div>
                            </div>
                        )}

                        {sortedYears.length === 0 && (
                            <div className="ndsh2-card ndsh2-card--compact ndsh2-empty">
                                <AlertTriangle className="ndsh2-icon" />
                                <h3>Өгөгдөл олдсонгүй</h3>
                                <p>
                                    Файлаас НДШ төлөлтийн мэдээлэл олдсонгүй. Зөв форматтай файл оруулсан эсэхээ шалгана уу.
                                    НДШ-ийн лавлагаа нь он, сар, байгууллагын нэр, төлөлтийн мэдээллийг агуулсан байх ёстой.
                                </p>
                            </div>
                        )}

                        {sortedYears.length > 0 && (
                            <div className="ndsh2-expand-row">
                                <button type="button" className="ndsh2-btn ndsh2-btn--ghost" onClick={toggleAllYears}>
                                    <ChevronsUpDown className="ndsh2-icon" />
                                    {expandedYears.size === sortedYears.length ? 'Бүгдийг хураах' : 'Бүгдийг дэлгэх'}
                                </button>
                            </div>
                        )}

                        {sortedYears.map((year) => {
                            const yearStat = yearlyStats[year];
                            const paidMonths = yearStat?.paidMonths || 0;
                            const isFullYear = paidMonths === 12;
                            const isExpanded = expandedYears.has(year);
                            const orgCount = Object.keys(groupedByYear[year] || {}).length;
                            const yearAbnormal = abnormalMonths[year] || 0;

                            return (
                                <div key={year} className="ndsh2-card ndsh2-card--table">
                                    <div className="ndsh2-table-header" onClick={() => toggleYear(year)}>
                                        <div className="ndsh2-table-title">
                                            {isExpanded ? <ChevronDown className="ndsh2-icon" /> : <ChevronRight className="ndsh2-icon" />}
                                            <span>🗓️ {year} он</span>
                                            <span className="ndsh2-table-sub">({orgCount} байгууллага)</span>
                                        </div>
                                        <div className="ndsh2-table-actions" onClick={(e) => e.stopPropagation()}>
                                            <div className="ndsh2-abnormal-input">
                                                <AlertTriangle className="ndsh2-icon" />
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={paidMonths}
                                                    value={yearAbnormal || ''}
                                                    onChange={(e) => updateAbnormalMonths(year, parseInt(e.target.value) || 0, paidMonths)}
                                                    placeholder="0"
                                                />
                                                <span>/{paidMonths}</span>
                                            </div>
                                            <span className={`ndsh2-badge ${isFullYear ? 'ndsh2-badge--success' : paidMonths >= 6 ? 'ndsh2-badge--blue' : 'ndsh2-badge--amber'}`}>
                                                {paidMonths}/12 сар {isFullYear && '✓'}
                                            </span>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="ndsh2-table-body">
                                            <div className="ndsh2-scroll">
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>Байгууллага</th>
                                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                                                                <th key={month} className="ndsh2-month">{month}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Object.entries(groupedByYear[year]).map(([org, months], idx) => {
                                                            const isVoluntary = isVoluntaryInsurance(org);
                                                            return (
                                                                <tr key={`${year}-${org}-${idx}`} className={isVoluntary && !includeVoluntary ? 'is-muted' : ''}>
                                                                    <td className="ndsh2-org" title={org}>
                                                                        <div>
                                                                            <span>{org}</span>
                                                                            {isVoluntary && (
                                                                                <span className="ndsh2-badge ndsh2-badge--pink">СД</span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    {months.map((paid, monthIdx) => (
                                                                        <td key={monthIdx} className="ndsh2-check">
                                                                            <span className={paid ? '' : 'is-empty'}>{paid ? '✅' : '⬜'}</span>
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        <div className="ndsh2-action-row ndsh2-action-row--end">
                            <button
                                type="button"
                                className="ndsh2-btn ndsh2-btn--outline"
                                onClick={handleExportPdf}
                                disabled={isPrinting}
                            >
                                <Download className="ndsh2-icon" />
                                PDF татах
                            </button>
                            <button
                                type="button"
                                className={`ndsh2-btn ${hasUnsavedChanges ? 'ndsh2-btn--success' : 'ndsh2-btn--dark'}`}
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? <Loader2 className="ndsh2-icon ndsh2-spin" /> : <Save className="ndsh2-icon" />}
                                {hasUnsavedChanges ? 'Хадгалах' : 'Дахин хадгалах'}
                            </button>
                            {!hasUnsavedChanges && savedData && (
                                <span className="ndsh2-badge ndsh2-badge--success-outline">
                                    <CheckCircle2 className="ndsh2-icon" />
                                    Хадгалагдсан
                                </span>
                            )}
                            <button
                                type="button"
                                className="ndsh2-btn ndsh2-btn--outline"
                                onClick={() => {
                                    resetState();
                                    setShowUpload(true);
                                }}
                            >
                                <RefreshCw className="ndsh2-icon" />
                                Шинэчлэх
                            </button>
                            <Link to="/ai-assistant" className="ndsh2-btn ndsh2-btn--primary">
                                <ArrowLeft className="ndsh2-icon" />
                                Буцах
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SocialInsuranceHoliday;
