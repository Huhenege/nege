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
        <section className="home-section home-section--alt" id="process">
            <div className="home-container">
                <div className="home-section-header">
                    <span className="home-eyebrow">Ажлын явц</span>
                    <h2 className="home-section-title">Алхам бүр тодорхой</h2>
                    <p className="home-section-subtitle">
                        Бидний хамтын ажиллагаа тодорхой дарааллаар, хэмжигдэхүйц үр дүнд хүрдэг.
                    </p>
                </div>

                <div className="home-process-grid">
                    {steps.map((step, index) => (
                        <div key={index} className="home-process-card">
                            <div className="home-process-index">0{index + 1}</div>
                            <h3>{step.title}</h3>
                            <span>{step.subtitle}</span>
                            <p>{step.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Process;
