import React from 'react';
import { Brain, LineChart, Cpu } from 'lucide-react';

const WhatWeDo = () => {
    return (
        <section className="home-section" id="what-we-do">
            <div className="home-container">
                <div className="home-section-header">
                    <span className="home-eyebrow">Бид юу хийдэг вэ</span>
                    <h2 className="home-section-title">Логик, систем, гүйцэтгэл</h2>
                    <p className="home-section-subtitle">
                        Байгууллагын стратегиас эхлээд AI суурьтай автоматжуулалт хүртэлх бүтэн шийдлийг гаргана.
                    </p>
                </div>

                <div className="home-grid">
                    <div className="home-feature-card">
                        <div className="home-feature-icon">
                            <LineChart size={20} />
                        </div>
                        <h3>Зөвлөх үйлчилгээ</h3>
                        <p className="home-feature-tag">Advisory</p>
                        <p>
                            Засаглал, менежмент, маркетингийн стратегид дүн шинжилгээ хийж,
                            оновчтой логик бүтэц, процессийн зураглалыг гаргана.
                        </p>
                    </div>

                    <div className="home-feature-card">
                        <div className="home-feature-icon">
                            <Brain size={20} />
                        </div>
                        <h3>AI Дотоод Удирдлагын Систем</h3>
                        <p className="home-feature-tag">Internal AI Platform</p>
                        <p>
                            Танай байгууллагын үйл ажиллагааг хөнгөвчлөх, автоматжуулах хиймэл
                            оюун ухаант системийг бүтээнэ.
                        </p>
                    </div>

                    <div className="home-feature-card">
                        <div className="home-feature-icon">
                            <Cpu size={20} />
                        </div>
                        <h3>Өгөгдлийн ухаалаг шийдэл</h3>
                        <p className="home-feature-tag">Data Intelligence</p>
                        <p>
                            Өгөгдлийг утгатай шийдвэр болгон хувиргаж,
                            бодит хэмжигдэхүйц өсөлтийг бий болгоно.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default WhatWeDo;
