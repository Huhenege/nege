import React, { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, Brain, Upload, FileText, CheckCircle,
    AlertTriangle, Loader2, Calendar, LayoutDashboard, Key
} from 'lucide-react';
import { extractNDSHFromImage } from '../lib/ndshParser';

const SocialInsuranceHoliday = () => {
    const [file, setFile] = useState(null);
    const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '');
    const [step, setStep] = useState('idle'); // idle, uploading, analyzing, complete, error
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState(null);
    const [parsedData, setParsedData] = useState(null);

    // Calculation state
    const [baseVacationDays, setBaseVacationDays] = useState(15);
    const [includeVoluntary, setIncludeVoluntary] = useState(true);
    const [abnormalMonths, setAbnormalMonths] = useState({}); // { 2024: 5, 2023: 12 }

    const fileInputRef = useRef(null);

    // Save API key
    const handleApiKeyChange = (e) => {
        const key = e.target.value;
        setApiKey(key);
        localStorage.setItem('gemini_api_key', key);
    };

    // --- File Handling ---
    const handleFileSelect = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) validateAndSetFile(selectedFile);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) validateAndSetFile(droppedFile);
    };

    const validateAndSetFile = (f) => {
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(f.type)) {
            setError('Зөвхөн зурган файл (JPG, PNG) оруулна уу. PDF одоогоор дэмжигдээгүй.');
            return;
        }
        setFile(f);
        setError(null);
    };

    const processFile = async () => {
        if (!file) return;
        if (!apiKey) {
            setError('API Key оруулна уу');
            return;
        }

        try {
            setStep('analyzing');
            setProgress(10);

            // Convert file to base64 data URL
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            setProgress(40);

            // Call AI Parser
            const result = await extractNDSHFromImage(dataUrl, file.type, apiKey);

            setProgress(80);
            setParsedData(result);
            setStep('complete');
            setProgress(100);

        } catch (err) {
            console.error(err);
            setError(err.message || 'Алдаа гарлаа');
            setStep('error');
        }
    };

    const reset = () => {
        setFile(null);
        setStep('idle');
        setParsedData(null);
        setError(null);
        setProgress(0);
    };

    // --- Calculation Logic ---

    // Group payments by year for UI toggle
    const yearlyStats = useMemo(() => {
        if (!parsedData) return {};

        const stats = {};
        parsedData.payments.forEach(p => {
            if (!stats[p.year]) stats[p.year] = { total: 0, voluntary: 0, regular: 0, months: new Set() };
            if (p.paid) {
                stats[p.year].months.add(p.month);
                if (p.organization.toLowerCase().includes('сайн дур')) {
                    stats[p.year].voluntary++;
                } else {
                    stats[p.year].regular++;
                }
            }
        });

        Object.keys(stats).forEach(y => {
            stats[y].total = stats[y].months.size;
        });

        return stats;
    }, [parsedData]);

    // Calculate total abnormal months from inputs
    const totalAbnormalMonths = useMemo(() => {
        return Object.values(abnormalMonths).reduce((sum, val) => sum + (val || 0), 0);
    }, [abnormalMonths]);

    // Core Vacation Logic
    const vacationCalculation = useMemo(() => {
        if (!parsedData) return { total: 0 };

        let totalMonths = 0;

        // Sum user's effective months
        Object.entries(yearlyStats).forEach(([year, stat]) => {
            // Simple logic: Use total unique months
            totalMonths += stat.total;
        });

        // Abnormal logic
        const ABNORMAL_INTERVALS = [
            { days: 5, min: 61, max: 120 },
            { days: 7, min: 121, max: 180 },
            { days: 9, min: 181, max: 240 },
            { days: 12, min: 241, max: 300 },
            { days: 15, min: 301, max: 372 },
            { days: 18, min: 373, max: Infinity },
        ];

        let matchedInterval = null;
        for (let i = ABNORMAL_INTERVALS.length - 1; i >= 0; i--) {
            if (totalAbnormalMonths >= ABNORMAL_INTERVALS[i].min) {
                matchedInterval = ABNORMAL_INTERVALS[i];
                break;
            }
        }

        const abnormalQualifies = matchedInterval !== null;
        const effectiveAbnormalMonths = abnormalQualifies ? matchedInterval.min : 0;

        // Normal months = Total - Effective Abnormal
        const normalMonths = Math.max(0, totalMonths - effectiveAbnormalMonths);

        // Calculate Additional Days
        const getNormalAdditional = (m) => {
            if (m >= 373) return 14;
            if (m >= 301) return 11;
            if (m >= 241) return 9;
            if (m >= 181) return 7;
            if (m >= 121) return 5;
            if (m >= 61) return 3;
            return 0;
        };

        const normalAdditional = getNormalAdditional(normalMonths);
        const abnormalAdditional = abnormalQualifies ? matchedInterval.days : getNormalAdditional(effectiveAbnormalMonths); // Fallback if not qualified but has months (treated as normal)

        // Note: If abnormal doesn't qualify as abnormal interval (e.g. < 61), 
        // those months are verified as "normal" in this simplified logic 
        // by subtracting 0 from total.

        const total = baseVacationDays + normalAdditional + abnormalAdditional;

        return {
            total,
            base: baseVacationDays,
            normalMonths,
            normalAdditional,
            effectiveAbnormalMonths,
            abnormalAdditional,
            abnormalQualifies
        };
    }, [parsedData, yearlyStats, totalAbnormalMonths, baseVacationDays]);


    return (
        <div style={{ paddingTop: 'calc(var(--header-height) + 2rem)', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <div className="container" style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 1rem' }}>
                <Link to="/ai-assistant" style={{ display: 'inline-flex', alignItems: 'center', color: '#64748b', textDecoration: 'none', marginBottom: '2rem' }}>
                    <ArrowLeft size={20} style={{ marginRight: '0.5rem' }} /> Буцах
                </Link>

                <div style={{ display: 'grid', gridTemplateColumns: parsedData ? '1fr 1fr' : '1fr', gap: '2rem' }}>

                    {/* Left: Upload & Config */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* API Key Input */}
                        {!parsedData && (
                            <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.9rem' }}>
                                    Gemini API Key
                                </label>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <input
                                            type="password"
                                            value={apiKey}
                                            onChange={handleApiKeyChange}
                                            placeholder="AI Key оруулна уу..."
                                            style={{ width: '100%', padding: '0.6rem 0.8rem 0.6rem 2.2rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                                        />
                                        <Key size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                                    </div>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                                    Зөвхөн таны хөтөч дээр хадгалагдана.
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" style={{ color: '#2563eb', marginLeft: '4px' }}>Key авах</a>
                                </p>
                            </div>
                        )}

                        {/* Upload Card */}
                        <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Upload size={20} className="text-blue-600" />
                                НДШ Тайлбар (Лавлагаа)
                            </h2>

                            {!parsedData ? (
                                <div
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    style={{
                                        border: '2px dashed #cbd5e1',
                                        borderRadius: '12px',
                                        padding: '3rem 1rem',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        backgroundColor: '#f8fafc',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />

                                    {step === 'analyzing' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <Loader2 size={40} className="animate-spin text-blue-600" />
                                            <p style={{ marginTop: '1rem', fontWeight: '500' }}>AI шинжилж байна...</p>
                                            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>Түр хүлээнэ үү ({progress}%)</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ width: '48px', height: '48px', backgroundColor: '#e0e7ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', color: '#4f46e5' }}>
                                                <Brain size={24} />
                                            </div>
                                            <p style={{ fontWeight: '500', color: '#334155' }}>Зурган файл оруулна уу</p>
                                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '0.25rem' }}>JPG, PNG</p>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#16a34a', marginBottom: '1rem' }}>
                                        <CheckCircle size={20} />
                                        <span style={{ fontWeight: '600' }}>Амжилттай уншлаа</span>
                                    </div>
                                    <button onClick={reset} style={{ color: '#64748b', fontSize: '0.9rem', textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer' }}>
                                        Өөр файл оруулах
                                    </button>
                                </div>
                            )}

                            {error && (
                                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                                    <AlertTriangle size={18} className="text-red-600" style={{ flexShrink: 0, marginTop: '2px' }} />
                                    <p style={{ fontSize: '0.9rem', color: '#b91c1c' }}>{error}</p>
                                </div>
                            )}

                            {!parsedData && (
                                <button
                                    onClick={processFile}
                                    disabled={!file || step === 'analyzing'}
                                    style={{
                                        width: '100%',
                                        marginTop: '1.5rem',
                                        backgroundColor: '#2563eb',
                                        color: 'white',
                                        padding: '0.75rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontWeight: '600',
                                        cursor: (!file || step === 'analyzing') ? 'not-allowed' : 'pointer',
                                        opacity: (!file || step === 'analyzing') ? 0.7 : 1
                                    }}
                                >
                                    {step === 'analyzing' ? 'Уншиж байна...' : 'Тооцоолох'}
                                </button>
                            )}
                        </div>

                        {/* Abnormal Months Input Section (Visible only after parsing) */}
                        {parsedData && (
                            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem' }}>Хэвийн бус нөхцөл</h3>
                                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
                                    Тухайн жилд хэвийн бус нөхцөлд ажилласан сарыг гараар оруулна уу.
                                </p>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                                    {Object.entries(yearlyStats).sort((a, b) => b[0] - a[0]).map(([year, stats]) => (
                                        <div key={year} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                                            <div>
                                                <span style={{ fontWeight: '600', color: '#334155' }}>{year} он</span>
                                                <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.5rem' }}>
                                                    (Нийт {stats.total} сар)
                                                </span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={stats.total}
                                                    value={abnormalMonths[year] || ''}
                                                    onChange={(e) => {
                                                        const val = Math.min(stats.total, Math.max(0, parseInt(e.target.value) || 0));
                                                        setAbnormalMonths(prev => ({ ...prev, [year]: val }));
                                                    }}
                                                    placeholder="0"
                                                    style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1', textAlign: 'center' }}
                                                />
                                                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>сар</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Results Dashboard */}
                    {parsedData && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                            {/* Summary Card */}
                            <div style={{
                                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                                borderRadius: '20px',
                                padding: '2rem',
                                color: 'white',
                                boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                                    <div style={{ padding: '10px', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: '12px' }}>
                                        <Calendar size={32} />
                                    </div>
                                    <div>
                                        <p style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: '2px' }}>Нийт амралтын хоног</p>
                                        <h1 style={{ fontSize: '3rem', fontWeight: '800', lineHeight: 1 }}>
                                            {vacationCalculation.total} <span style={{ fontSize: '1.25rem', fontWeight: '500', opacity: 0.9 }}>өдөр</span>
                                        </h1>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr', gap: '0.5rem', alignItems: 'center' }}>
                                    {/* Base */}
                                    <div style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '1rem 0.5rem', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', fontWeight: 'bold' }}>СУУРЬ</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{vacationCalculation.base}</p>
                                    </div>
                                    <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>+</span>

                                    {/* Normal Add */}
                                    <div style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '1rem 0.5rem', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', fontWeight: 'bold' }}>ХЭВИЙН</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{vacationCalculation.normalAdditional}</p>
                                    </div>
                                    <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>+</span>

                                    {/* Abnormal Add */}
                                    <div style={{ backgroundColor: vacationCalculation.abnormalQualifies ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1rem 0.5rem', textAlign: 'center', border: vacationCalculation.abnormalQualifies ? '1px solid rgba(255,255,255,0.5)' : 'none' }}>
                                        <p style={{ fontSize: '0.7rem', opacity: 0.7, textTransform: 'uppercase', fontWeight: 'bold' }}>ХЭВ. БУС</p>
                                        <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{vacationCalculation.abnormalAdditional}</p>
                                    </div>
                                </div>

                                {totalAbnormalMonths > 0 && (
                                    <div style={{ marginTop: '1.5rem', backgroundColor: 'rgba(0,0,0,0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem' }}>
                                        ℹ️ Хэвийн бус <b>{totalAbnormalMonths}</b> сар сонгосноос
                                        <b> {vacationCalculation.effectiveAbnormalMonths}</b> сар нь нэмэгдэлд тооцогдож байна.
                                    </div>
                                )}
                            </div>

                            {/* Employee Info */}
                            {parsedData.employeeInfo && (
                                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px' }}>
                                    <h3 style={{ fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem', fontWeight: '600' }}>Ажилтны мэдээлэл</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <div>
                                            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Овог Нэр</p>
                                            <p style={{ fontWeight: '600', color: '#1e293b' }}>
                                                {parsedData.employeeInfo.lastName} {parsedData.employeeInfo.firstName}
                                            </p>
                                        </div>
                                        <div>
                                            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Регистр</p>
                                            <p style={{ fontWeight: '600', color: '#1e293b' }}>
                                                {parsedData.employeeInfo.registrationNumber || '-'}
                                            </p>
                                        </div>
                                        <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                                            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Нийт ажилласан хугацаа</p>
                                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                                                <p style={{ fontWeight: '600' }}>{parsedData.summary.totalYears} жил</p>
                                                <p style={{ fontWeight: '600' }}>{parsedData.summary.totalMonths} сар</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Settings */}
                            <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px' }}>
                                <h3 style={{ fontSize: '0.9rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '1rem', fontWeight: '600' }}>Тохиргоо</h3>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                                    <span style={{ fontSize: '0.95rem' }}>Суурь амралтын хоног</span>
                                    <select
                                        value={baseVacationDays}
                                        onChange={(e) => setBaseVacationDays(Number(e.target.value))}
                                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                    >
                                        <option value={15}>15 өдөр (Ердийн)</option>
                                        <option value={20}>20 өдөр (18- / ХБИ)</option>
                                    </select>
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default SocialInsuranceHoliday;
