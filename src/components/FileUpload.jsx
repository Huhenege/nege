import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import './FileUpload.css';

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
        <div className="file-upload">
            <div
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`file-upload__dropzone ${isDragOver ? 'file-upload__dropzone--active' : ''}`}
            >
                <input
                    type="file"
                    multiple
                    ref={inputRef}
                    onChange={handleChange}
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                />
                <div className="file-upload__icon">
                    <Upload size={32} />
                </div>
                <p className="file-upload__title">
                    Олон хуулга зэрэг чирж оруулах эсвэл <span style={{ color: 'var(--brand-600)' }}>дарж сонгоно уу</span>
                </p>
                <p className="file-upload__subtitle">
                    (Upload Multiple Statements)
                </p>
            </div>

            {files.length > 0 && (
                <div className="file-upload__list">
                    {files.map((file, i) => (
                        <div key={i} className="file-upload__item">
                            <div className="file-upload__item-icon">
                                <FileSpreadsheet size={20} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className="file-upload__item-name">{file.name}</div>
                                <div className="file-upload__item-meta">{(file.size / 1024).toFixed(1)} KB</div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                                className="file-upload__remove"
                                aria-label="Файл устгах"
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
