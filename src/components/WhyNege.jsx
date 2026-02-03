import React from 'react';
import { CheckCircle2, Sparkles, Layers, Target } from 'lucide-react';

const WhyNege = () => {
    const reasons = [
        { title: "Ойлгомжтой шийдэл", desc: "Төвөгтэй зүйлсгүй, энгийн бөгөөд тодорхой.", icon: CheckCircle2 },
        { title: "Танд зориулсан систем", desc: "Бэлэн загварт баригдахгүй, зөвхөн танай онцлогт нийцнэ.", icon: Layers },
        { title: "Бодит үр дүн", desc: "Хийсвэр амлалт биш, хэмжигдэхүйц өсөлт.", icon: Target },
        { title: "Нэгдмэл логик", desc: "Бүх үйл явц нэг л зарчмаар уялдана.", icon: Sparkles }
    ];

    return (
        <section className="home-section" id="why-nege">
            <div className="home-container">
                <div className="home-section-header">
                    <span className="home-eyebrow">Яагаад NEGE гэж?</span>
                    <h2 className="home-section-title">Бидний давуу тал</h2>
                    <p className="home-section-subtitle">
                        Илүү энгийн, илүү ухаалаг, илүү хэмжигдэхүйц шийдэл.
                    </p>
                </div>

                <div className="home-reason-grid">
                    {reasons.map((reason, index) => (
                        <div key={index} className="home-reason-card">
                            <div className="home-reason-icon">
                                <reason.icon size={20} />
                            </div>
                            <h3>{reason.title}</h3>
                            <p>{reason.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default WhyNege;
