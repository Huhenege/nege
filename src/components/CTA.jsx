import React from 'react';

const CTA = () => {
    return (
        <>
            <section className="section" id="contact" style={{ backgroundColor: 'var(--bg-secondary)', textAlign: 'center' }}>
                <div className="container">
                    <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Ирээдүйг илүү тодорхой бүтээцгээе.</h2>
                    <button style={{
                        backgroundColor: 'var(--text-primary)',
                        color: 'var(--bg-primary)',
                        padding: '16px 32px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        borderRadius: '4px',
                        transition: 'opacity 0.2s ease',
                        cursor: 'pointer'
                    }}
                        onMouseOver={(e) => e.target.style.opacity = '0.9'}
                        onMouseOut={(e) => e.target.style.opacity = '1'}
                    >
                        Холбогдох
                    </button>
                </div>
            </section>

            <footer style={{
                padding: 'var(--spacing-lg) 0',
                borderTop: '1px solid var(--border-light)',
                marginTop: 'auto',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: '0.875rem'
            }}>
                <div className="container">
                    <p>© {new Date().getFullYear()} NEGE. All rights reserved.</p>
                </div>
            </footer>
        </>
    );
};

export default CTA;
