import React from 'react';
import { Building2 } from 'lucide-react';

const WhoWeAre = () => {
    return (
        <section className="home-section home-section--alt" id="who-we-are">
            <div className="home-container">
                <div className="home-section-header">
                    <span className="home-eyebrow">Бид хэн бэ</span>
                    <h2 className="home-section-title">Зөвлөх үйлчилгээ + ухаалаг дотоод систем</h2>
                    <p className="home-section-subtitle">
                        Бид байгууллагын менежмент, маркетингийн зөвлөх үйлчилгээ үзүүлж,
                        тухайн байгууллагын онцлогт бүрэн нийцсэн AI дотоод удирдлагын системийг хөгжүүлнэ.
                    </p>
                </div>
                <div className="home-info-card">
                    <div className="home-info-icon">
                        <Building2 size={20} />
                    </div>
                    <div>
                        <h3>Танай байгууллагад зориулсан менежментийн орчин</h3>
                        <p>
                            Энэ нь нийтийн SaaS эсвэл ERP биш. Харин зөвхөн танай байгууллагад зориулсан
                            оновчтой логик, процесс, AI суурьтай орчин юм.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default WhoWeAre;
