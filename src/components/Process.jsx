import React from 'react';

const Process = () => {
    const steps = [
        { title: "Зөвлөгөө", subtitle: "Advisory", desc: "Асуудлыг оношилж, хэрэгцээг тодорхойлно." },
        { title: "Логик", subtitle: "Logic", desc: "Шийдлийн бүтэц, алгоритмыг боловсруулна." },
        { title: "Хөгжүүлэлт", subtitle: "Dev", desc: "Системийг танд зориулан бүтээнэ." },
        { title: "Нэвтрүүлэлт", subtitle: "Impl", desc: "Үйл ажиллагаанд нэвтрүүлж, нутагшуулна." },
        { title: "Түншлэл", subtitle: "Partner", desc: "Байнгын сайжруулалт, хөгжүүлэлт." }
    ];

    return (
        <section className="section" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="container">
                <h2 className="text-center">Ажлын явц</h2>

                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 'var(--spacing-lg)',
                    marginTop: 'var(--spacing-lg)'
                }}>
                    {steps.map((step, index) => (
                        <div key={index} style={{
                            flex: '1 1 200px',
                            maxWidth: '250px',
                            padding: 'var(--spacing-md)',
                            borderTop: '2px solid var(--text-tertiary)'
                        }}>
                            <div style={{
                                fontSize: '0.9rem',
                                color: 'var(--text-tertiary)',
                                marginBottom: 'var(--spacing-xs)'
                            }}>
                                0{index + 1}
                            </div>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-xs)' }}>{step.title}</h3>
                            <p style={{ fontSize: '0.9rem', color: 'var(--text-tertiary)', marginBottom: 'var(--spacing-sm)' }}>{step.subtitle}</p>
                            <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Process;
