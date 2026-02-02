import React from 'react';

const Hero = () => {
    return (
        <section className="section hero" style={{
            minHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            paddingTop: 'calc(var(--header-height) + var(--spacing-xl))'
        }}>
            <div className="container fade-in">
                <h1 style={{ marginBottom: 'var(--spacing-md)' }}>
                    Бүхний ард нэг л логик.
                </h1>
                <p style={{
                    fontSize: '1.25rem',
                    maxWidth: '600px',
                    margin: '0 auto',
                    color: 'var(--text-secondary)'
                }}>
                    NEGE бол зөвлөх үйлчилгээнд суурилсан хиймэл оюун ухааны технологийн компани юм.
                </p>
            </div>
        </section>
    );
};

export default Hero;
