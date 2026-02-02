import React from 'react';

const Philosophy = () => {
    return (
        <section className="section" style={{
            backgroundColor: 'var(--bg-primary)',
            padding: 'var(--spacing-xxl) 0',
            textAlign: 'center'
        }}>
            <div className="container">
                <p style={{
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    color: 'var(--text-tertiary)',
                    fontSize: '0.875rem',
                    marginBottom: 'var(--spacing-md)'
                }}>
                    Бидний философи
                </p>
                <h2 style={{
                    fontSize: '2.5rem',
                    marginBottom: 'var(--spacing-lg)',
                    marginTop: 0
                }}>
                    "One logic behind everything"
                </h2>
                <p style={{
                    fontSize: '1.25rem',
                    lineHeight: '1.8',
                    maxWidth: '700px',
                    margin: '0 auto',
                    color: 'var(--text-secondary)'
                }}>
                    Аливаа асуудал хэдий чинээ төвөгтэй харагдана, түүний ард төдий чинээ энгийн логик нуугдаж байдаг. Бид тэрхүү ганц зөв логикийг олж, технологийн хүчээр амьдралд нэвтрүүлдэг. Илүүц зүйлгүй, дутуу зүйлгүй.
                </p>
            </div>
        </section>
    );
};

export default Philosophy;
