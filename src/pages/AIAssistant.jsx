import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, Cpu, Calculator, Sparkles, ArrowRight, Clock, GraduationCap } from 'lucide-react';
import './AIAssistant.css';

const AIAssistant = () => {
    return (
        <div className="ai-page">
            <div className="ai-container">
                {/* Hero Section */}
                <div className="ai-hero">
                    <h1 className="ai-title">Ухаалаг Туслах</h1>
                    <div className="ai-badge">
                        <Sparkles size={16} style={{ marginRight: '8px' }} />
                        <span>AI Powered Tools</span>
                    </div>
                    <p className="ai-subtitle">
                        Таны өдөр тутмын ажлыг хөнгөвчлөх хиймэл оюун ухаанд суурилсан
                        хэрэгслүүдийн цуглуулга.
                    </p>
                </div>

                {/* Grid Layout */}
                <div className="ai-grid">

                    {/* Tool 1: Account Statement */}
                    <Link to="/ai-assistant/account-statement-organizer" className="ai-card">
                        <div className="ai-card-icon icon-blue">
                            <FileText size={32} />
                        </div>
                        <h3 className="ai-card-title">Дансны хуулга цэгцлэгч</h3>
                        <p className="ai-card-desc">
                            Банкны хуулгаа (Excel/CSV) оруулж, автоматаар ангилан цэгцлэх,
                            тайлан гаргах хэрэгсэл.
                        </p>
                        <div className="ai-card-arrow">
                            Эхлүүлэх <ArrowRight size={16} style={{ marginLeft: '4px' }} />
                        </div>
                    </Link>

                    {/* Tool 2: Social Insurance */}
                    <Link to="/ai-assistant/social-insurance-holiday" className="ai-card">
                        <div className="ai-card-icon icon-purple">
                            <Calculator size={32} />
                        </div>
                        <h3 className="ai-card-title">НДШ Тооцоологч</h3>
                        <p className="ai-card-desc">
                            Нийгмийн даатгалын шимтгэлийн лавлагааг AI-аар уншуулж,
                            ээлжийн амралтын хоног тооцоолох.
                        </p>
                        <div className="ai-card-arrow">
                            Эхлүүлэх <ArrowRight size={16} style={{ marginLeft: '4px' }} />
                        </div>
                    </Link>

                    {/* Tool 3: Official Letterhead */}
                    <Link to="/ai-assistant/official-letterhead" className="ai-card">
                        <div className="ai-card-icon icon-pink">
                            <FileText size={32} />
                        </div>
                        <h3 className="ai-card-title">Албан бланк үүсгэгч</h3>
                        <p className="ai-card-desc">
                            Байгууллагын албан бичгийг стандартаар үүсгэж,
                            PDF форматаар татаж авах хөнгөвчлөх хэрэгсэл.
                        </p>
                        <div className="ai-card-arrow">
                            Эхлүүлэх <ArrowRight size={16} style={{ marginLeft: '4px' }} />
                        </div>
                    </Link>

                    {/* Tool 4: Business Training */}
                    <Link to="/ai-assistant/business-training" className="ai-card">
                        <div className="ai-card-icon icon-orange">
                            <GraduationCap size={32} />
                        </div>
                        <h3 className="ai-card-title">AI Бизнес сургалт</h3>
                        <p className="ai-card-desc">
                            "AI-д тулгуурласан Бизнесийн бүтээмжийг өсгөх нь"
                            сургалтанд бүртгүүлж, цаг товлох.
                        </p>
                        <div className="ai-card-arrow">
                            Бүртгүүлэх <ArrowRight size={16} style={{ marginLeft: '4px' }} />
                        </div>
                    </Link>

                    {/* Coming Soon */}
                    <div className="ai-card coming-soon">
                        <div className="ai-card-icon icon-blue">
                            <Clock size={32} />
                        </div>
                        <h3 className="ai-card-title">
                            Тун удахгүй
                            <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: '#f0f9ff', color: '#0369a1', marginLeft: 'auto' }}>Soon</span>
                        </h3>
                        <p className="ai-card-desc">
                            Бид цалингийн тооцоолол, гэрээ боловсруулах зэрэг
                            шинэ боломжуудыг удахгүй нэмэх болно.
                        </p>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default AIAssistant;
