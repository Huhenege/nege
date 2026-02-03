import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

const Hero = () => {
    return (
        <section className="home-hero">
            <div className="home-container">
                <div className="home-hero-badge">
                    <Sparkles size={16} />
                    AI + Advisory
                </div>
                <h1 className="home-hero-title">
                    Бүхний ард
                    <span> нэг л логик</span>.
                </h1>
                <p className="home-hero-subtitle">
                    NEGE бол зөвлөх үйлчилгээнд суурилсан хиймэл оюун ухааны технологийн компани.
                    Бид танай байгууллагын онцлогт тохируулсан ухаалаг шийдлийг бүтээгдэг.
                </p>
                <div className="home-hero-actions">
                    <a className="home-btn home-btn--primary" href="#contact">
                        Холбогдох
                        <ArrowRight size={18} />
                    </a>
                    <a className="home-btn home-btn--secondary" href="#what-we-do">
                        Үйлчилгээнүүд
                    </a>
                </div>
                <div className="home-hero-cards">
                    <div className="home-hero-card">
                        <p>Стратеги ба зөвлөх үйлчилгээ</p>
                        <span>Бизнесийн логик, процессийн зураглал</span>
                    </div>
                    <div className="home-hero-card">
                        <p>AI Дотоод систем</p>
                        <span>Автоматжуулалт ба өгөгдлийн ухаалаг дүн шинжилгээ</span>
                    </div>
                    <div className="home-hero-card">
                        <p>Байнгын түншлэл</p>
                        <span>Өөрчлөгдөх орчинд тасралтгүй сайжруулалт</span>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
