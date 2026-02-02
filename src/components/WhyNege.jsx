import React from 'react';

const WhyNege = () => {
    const reasons = [
        { title: "Ойлгомжтой шийдэл", desc: "Төвөгтэй зүйлсгүй, энгийн бөгөөд тодорхой." },
        { title: "Танд зориулсан систем", desc: "Бэлэн загварт баригдахгүй, зөвхөн танай онцлогт нийцнэ." },
        { title: "Бодит үр дүн", desc: "Хийсвэр амлалт биш, хэмжигдэхүйц өсөлт." },
        { title: "Нэгдмэл логик", desc: "Бүх үйл явц нэг л зарчмаар уялдана." }
    ];

    return (
        <section className="section">
            <div className="container">
                <h2 className="text-center">Яагаад NEGE гэж?</h2>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    gap: 'var(--spacing-lg)',
                    marginTop: 'var(--spacing-lg)'
                }}>
                    {reasons.map((reason, index) => (
                        <div key={index} style={{
                            padding: 'var(--spacing-md)',
                            border: '1px solid var(--border-light)',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-primary)'
                        }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--spacing-sm)' }}>{reason.title}</h3>
                            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{reason.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default WhyNege;
