import React from 'react';

const WhatWeDo = () => {
    return (
        <section className="section">
            <div className="container">
                <h2 className="text-center">Бид юу хийдэг вэ</h2>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                    gap: 'var(--spacing-xl)',
                    marginTop: 'var(--spacing-lg)'
                }}>
                    {/* Advisory */}
                    <div style={{ padding: 'var(--spacing-lg)' }}>
                        <h3>Зөвлөх үйлчилгээ</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Advisory</p>
                        <p className="description">
                            Байгууллагын засаглал, менежмент, маркетингийн стратегид дүн шинжилгээ хийж, оновчтой логик бүтэц, процессийн зураглалыг гаргана. "Юуг, яагаад" хийх суурь логикийг бид бүрдүүлдэг.
                        </p>
                    </div>

                    {/* AI Platform */}
                    <div style={{ padding: 'var(--spacing-lg)', borderLeft: '1px solid var(--border-light)' }}>
                        <h3>AI Дотоод Удирдлагын Систем</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Internal AI Platform</p>
                        <p className="description">
                            Тодорхойлсон логик, процессийн дагуу танай байгууллагын үйл ажиллагааг хөнгөвчлөх, автоматжуулах хиймэл оюун ухаант системийг бүтээнэ. Энэ нь "Яаж" хийх хурд, оновчлолыг бий болгоно.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default WhatWeDo;
