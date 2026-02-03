import React from 'react';

const CTA = () => {
    return (
        <>
            <section className="section" id="contact" style={{ backgroundColor: 'var(--bg-secondary)', textAlign: 'center' }}>
                <div className="container">
                    <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Ирээдүйг илүү тодорхой бүтээцгээе.</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        <a href="tel:88104099" style={{ color: 'inherit', textDecoration: 'none' }}>8810 4099</a>
                        <a href="mailto:hello@nege.mn" style={{ color: 'inherit', textDecoration: 'none' }}>hello@nege.mn</a>
                        <a href="https://facebook.com/nege.mn" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>facebook.com/nege.mn</a>
                        <a href="https://www.nege.mn" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>www.nege.mn</a>
                    </div>
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
