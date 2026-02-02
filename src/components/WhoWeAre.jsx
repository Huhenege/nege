import React from 'react';

const WhoWeAre = () => {
    return (
        <section className="section" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="container">
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <h2 className="text-center">Бид хэн бэ</h2>
                    <p style={{
                        fontSize: '1.25rem',
                        lineHeight: '1.8',
                        color: 'var(--text-primary)'
                    }}>
                        Бид байгууллагын менежмент болон маркетингийн зөвлөх үйлчилгээ үзүүлж, тухайн байгууллагын онцлогт бүрэн нийцсэн дотоод удирдлагын хиймэл оюун ухаант системийг хөгжүүлэн нэвтрүүлдэг. Энэ нь нийтийн SaaS эсвэл ERP систем биш, харин зөвхөн танай байгууллагад зориулагдсан менежментийн орчин юм.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default WhoWeAre;
