import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';

export default function FileUpload({ files, setFiles }) {
    const [isDragOver, setIsDragOver] = useState(false);
    const inputRef = useRef(null);

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const newFiles = Array.from(e.dataTransfer.files).filter(
                f => f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv')
            );
            setFiles([...files, ...newFiles]);
        }
    };

    const handleChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);
            setFiles([...files, ...newFiles]);
        }
    };

    const removeFile = (index) => {
        const newFiles = [...files];
        newFiles.splice(index, 1);
        setFiles(newFiles);
    };

    return (
        <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                style={{
                    border: '2px dashed',
                    borderColor: isDragOver ? '#2563eb' : '#cbd5e1',
                    borderRadius: '12px',
                    padding: '3rem',
                    textAlign: 'center',
                    backgroundColor: isDragOver ? '#eff6ff' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    marginBottom: '1.5rem'
                }}
            >
                <input
                    type="file"
                    multiple
                    ref={inputRef}
                    onChange={handleChange}
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                />
                <div style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#e0e7ff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto',
                    color: '#4f46e5'
                }}>
                    <Upload size={32} />
                </div>
                <p style={{ fontSize: '1.1rem', fontWeight: '500', color: '#334155', marginBottom: '0.5rem' }}>
                    Олон хуулга зэрэг чирж оруулах эсвэл <span style={{ color: '#2563eb' }}>дарж сонгоно уу</span>
                </p>
                <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    (Upload Multiple Statements)
                </p>
            </div>

            {files.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {files.map((file, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '1rem',
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{
                                padding: '0.5rem',
                                backgroundColor: '#ecfdf5',
                                borderRadius: '6px',
                                color: '#059669',
                                marginRight: '1rem'
                            }}>
                                <FileSpreadsheet size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.95rem', fontWeight: '500', color: '#1e293b' }}>{file.name}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{(file.size / 1024).toFixed(1)} KB</div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                style={{
                                    border: 'none',
                                    background: 'none',
                                    color: '#94a3b8',
                                    cursor: 'pointer',
                                    padding: '0.5rem',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
