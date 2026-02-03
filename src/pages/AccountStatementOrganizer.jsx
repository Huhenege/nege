import React, { useState } from 'react';
import FileUpload from '../components/FileUpload';
import { processStatement, exportToAndDownloadExcel } from '../lib/standardizer';

const AccountStatementOrganizer = () => {
    const [files, setFiles] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isDone, setIsDone] = useState(false);

    const handleGenerate = async () => {
        if (files.length === 0) return;

        setIsProcessing(true);
        try {
            let allTransactions = [];

            // Process all files
            for (const file of files) {
                const transactions = await processStatement(file);
                allTransactions = [...allTransactions, ...transactions];
            }

            // Sort by date
            allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            // Direct download
            exportToAndDownloadExcel(allTransactions);
            setIsDone(true);
        } catch (error) {
            console.error(error);
            alert('Файлыг боловсруулахад алдаа гарлаа. Console шалгана уу.');
        } finally {
            setIsProcessing(false);
        }
    };

    const reset = () => {
        setIsDone(false);
        setFiles([]);
    };

    return (
        <div style={{ paddingTop: 'calc(var(--header-height) + 2rem)', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
            <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1rem', color: '#1e293b' }}>
                        Санхүүгийн тайлангаа <br />
                        <span style={{ color: '#2563eb' }}>Нэг товшилтоор</span> цэгцэл
                    </h1>
                    <p style={{ fontSize: '1.1rem', color: '#64748b' }}>
                        Банкны хуулгаа оруулаад AI-аар автоматаар нэгтгэж Excel болгон татаж ав.
                    </p>
                </div>

                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '16px',
                    padding: '2rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                }}>
                    {isDone ? (
                        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                backgroundColor: '#dcfce7',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 1.5rem auto',
                                color: '#16a34a'
                            }}>
                                <span style={{ fontSize: '2.5rem' }}>✓</span>
                            </div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#166534', marginBottom: '0.5rem' }}>Амжилттай!</h2>
                            <p style={{ color: '#4b5563', marginBottom: '2rem' }}>Таны файлыг Excel хэлбэрээр татаж авлаа.</p>
                            <button
                                onClick={reset}
                                style={{
                                    backgroundColor: '#2563eb',
                                    color: 'white',
                                    padding: '0.75rem 2rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    fontSize: '1rem'
                                }}
                            >
                                Дахин эхлүүлэх
                            </button>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: '2rem' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '1rem' }}>
                                    Хуулгаа оруулна уу (Upload)
                                </h2>
                                <FileUpload files={files} setFiles={setFiles} />
                            </div>

                            <div style={{ textAlign: 'center' }}>
                                <button
                                    onClick={handleGenerate}
                                    disabled={files.length === 0 || isProcessing}
                                    style={{
                                        backgroundColor: files.length > 0 ? '#2563eb' : '#94a3b8',
                                        color: 'white',
                                        padding: '1rem 3rem',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontWeight: '600',
                                        fontSize: '1.1rem',
                                        cursor: files.length > 0 ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.2s',
                                        boxShadow: files.length > 0 ? '0 4px 6px -1px rgba(37, 99, 235, 0.3)' : 'none',
                                        width: '100%',
                                        maxWidth: '400px'
                                    }}
                                >
                                    {isProcessing ? 'Боловсруулж байна...' : `Цэгцлэх(${files.length} файл)`}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccountStatementOrganizer;
