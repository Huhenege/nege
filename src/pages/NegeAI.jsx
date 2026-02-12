import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Users, Shield, Zap, BarChart3, FileText, Calendar, Layout, Award, Brain, Smartphone } from 'lucide-react';
import './NegeAI.css';

const NegeAI = () => {
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="nege-ai-page">
            {/* Hero Section */}
            <section className="nege-hero">
                <div className="container">
                    <div className="nege-hero-grid">
                        <div className="nege-hero-content animate-fade-in-up">
                            <div className="nege-hero-badge">
                                <Zap size={16} />
                                <span>AI-Powered Management System</span>
                            </div>
                            <h1 className="nege-hero-title">
                                Nege AI — байгууллагын удирдлага, HR, процессыг нэг системд
                            </h1>
                            <p className="nege-hero-sub">
                                Хүний нөөц, ажлын урсгал, бүтэц, баримт бичиг, тайлан, гүйцэтгэлийг нэг цэгээс удирдах AI платформ. Удирдлага, HR, ажилтан бүрт зориулсан тусгай интерфэйстэй.
                            </p>

                            <div className="nege-hero-actions">
                                <Link to="/contact" className="btn btn-primary btn-lg btn-glow">
                                    Демо авах <ArrowRight size={18} />
                                </Link>
                                <Link to="/trial" className="btn btn-outline btn-lg">
                                    Үнэгүй турших
                                </Link>
                            </div>

                            <div className="nege-hero-bullets">
                                <div className="nege-bullet">
                                    <span className="nege-bullet-icon"><Check size={14} /></span>
                                    Ажилтан өөрөө үйлчилгээ авах (чөлөө, баримт, хүсэлт)
                                </div>
                                <div className="nege-bullet">
                                    <span className="nege-bullet-icon"><Check size={14} /></span>
                                    Менежментийн процессыг автоматжуулна
                                </div>
                                <div className="nege-bullet">
                                    <span className="nege-bullet-icon"><Check size={14} /></span>
                                    Бодит цагийн тайлан, шийдвэрийн дэмжлэг
                                </div>
                            </div>
                        </div>

                        <div className="nege-viz hidden md:block">
                            <div className="nege-viz-card">
                                {/* Abstract UI representation */}
                                <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-4">
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">N</div>
                                    <div>
                                        <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
                                        <div className="h-3 w-20 bg-gray-100 rounded"></div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="p-4 bg-indigo-50 rounded-lg">
                                        <div className="text-2xl font-bold text-indigo-700 mb-1">98%</div>
                                        <div className="text-xs text-indigo-500 font-medium">HR Үр ашиг</div>
                                    </div>
                                    <div className="p-4 bg-emerald-50 rounded-lg">
                                        <div className="text-2xl font-bold text-emerald-700 mb-1">24/7</div>
                                        <div className="text-xs text-emerald-500 font-medium">AI Туслах</div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-orange-100 flex items-center justify-center text-orange-600"><FileText size={14} /></div>
                                            <span className="text-sm font-medium text-gray-700">Тушаал батлах</span>
                                        </div>
                                        <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Батлагдсан</span>
                                    </div>
                                    <div className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-blue-100 flex items-center justify-center text-blue-600"><Users size={14} /></div>
                                            <span className="text-sm font-medium text-gray-700">Шинэ ажилтан</span>
                                        </div>
                                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Явц 45%</span>
                                    </div>
                                </div>

                                <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-lg shadow-lg border border-gray-100 max-w-[200px]">
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex-shrink-0"></div>
                                        <div className="text-xs text-gray-600">
                                            <strong>AI Insight:</strong> Энэ сарын ирц 12%-иар сайжирсан байна.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* About / Why Section */}
            <section className="nege-section">
                <div className="container">
                    <div className="nege-section-header">
                        <h2 className="nege-section-title">Яагаад Nege AI гэж?</h2>
                        <p className="nege-section-subtitle">
                            Байгууллагын бүтэц, ажилтны lifecycle, баримт бичиг, гүйцэтгэл, тайланг нэг системд төвлөрүүлж, удирдлагад бодит мэдээлэл дээр суурилсан шийдвэр гаргах боломж олгоно.
                        </p>
                    </div>

                    <div className="nege-features-grid">
                        <div className="nege-feature-card">
                            <div className="nege-feature-icon"><Layout /></div>
                            <h3 className="nege-feature-title">Нэгдсэн удирдлага</h3>
                            <p className="nege-feature-desc">Байгууллагын HR, процесс, баримт, тайлан, бүтэц — бүгд нэг платформд.</p>
                        </div>
                        <div className="nege-feature-card">
                            <div className="nege-feature-icon"><Brain /></div>
                            <h3 className="nege-feature-title">AI-д суурилсан шийдвэр</h3>
                            <p className="nege-feature-desc">Ажиллах хүч, гүйцэтгэл, ирц, чөлөө, ур чадварын өгөгдөл дээр тулгуурласан дүн шинжилгээ.</p>
                        </div>
                        <div className="nege-feature-card">
                            <div className="nege-feature-icon"><Award /></div>
                            <h3 className="nege-feature-title">Стандартчилсан процесс</h3>
                            <p className="nege-feature-desc">Онбординг, оффбординг, баримт, журам, workflow нэг стандарт загвараар.</p>
                        </div>
                        <div className="nege-feature-card">
                            <div className="nege-feature-icon"><Shield /></div>
                            <h3 className="nege-feature-title">Хяналт ба ил тод байдал</h3>
                            <p className="nege-feature-desc">Бодит цагийн мэдээлэл, хяналтын логик, нарийвчилсан тайлан.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Modules */}
            <section className="nege-section bg-slate-50">
                <div className="container">
                    <div className="nege-section-header">
                        <h2 className="nege-section-title">Үндсэн модуль, онцлогууд</h2>
                        <p className="nege-section-subtitle">Байгууллагын бүхий л хэрэгцээг хангах цогц шийдэл</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            { title: 'Employee & Org', icon: <Users />, items: ['Ажилтны бүртгэл, профайл', 'Хөдөлмөрийн түүх, ур чадвар', 'Байгууллагын бүтэц'] },
                            { title: 'Attendance & Time', icon: <Calendar />, items: ['Ирц бүртгэл', 'Ажлын цагийн тооцоо', 'Тайлан, дүн шинжилгээ'] },
                            { title: 'Leave Management', icon: <FileText />, items: ['Чөлөө, амралтын хүсэлт', 'Автомат баталгаажуулалт', 'Баланс тооцоо'] },
                            { title: 'On/Offboarding', icon: <Zap />, items: ['Шинэ ажилтны үе шат', 'Даалгавар, хариуцагч', 'Баримт, шалгах жагсаалт'] },
                            { title: 'Document Hub', icon: <FileText />, items: ['Баримт бичгийн сан', 'Загвар, гэрээ, журам', 'Ажилтанд хүргэх систем'] },
                            { title: 'Reporting & Analytics', icon: <BarChart3 />, items: ['HR тайлан', 'Workforce analytics', 'Excel/CSV экспорт'] }
                        ].map((module, i) => (
                            <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">{module.icon}</div>
                                    <h3 className="font-bold text-lg text-slate-800">{module.title}</h3>
                                </div>
                                <ul className="space-y-2">
                                    {module.items.map((item, j) => (
                                        <li key={j} className="flex items-center gap-2 text-slate-600 text-sm">
                                            <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* AI Section (Dark Mode) */}
            <section className="nege-section nege-section-dark">
                <div className="container">
                    <div className="nege-section-header">
                        <h2 className="nege-section-title text-gradient">AI Боломжууд</h2>
                        <p className="nege-section-subtitle">
                            Зөвхөн бүртгэл биш, ухаалаг тусламж.
                        </p>
                    </div>

                    <div className="nege-ai-grid">
                        <div className="nege-ai-card">
                            <h4><BarChart3 size={20} /> Ур чадварын анализ</h4>
                            <p>Ажилтнуудын ур чадвар, гүйцэтгэлийн дүн шинжилгээг хиймэл оюун ухаанаар боловсруулна.</p>
                        </div>
                        <div className="nege-ai-card">
                            <h4><Shield size={20} /> Эрсдэлийн дохиолол</h4>
                            <p>Ажилтны ажлаас гарах магадлал, сэтгэл ханамжийн бууралтыг урьдчилан таамаглах (attrition signals).</p>
                        </div>
                        <div className="nege-ai-card">
                            <h4><FileText size={20} /> Автомат тайлан</h4>
                            <p>Долоо хоног, сарын тайланг автоматаар нэгтгэж, дүгнэлт санал зөвлөмж боловсруулна.</p>
                        </div>
                        <div className="nege-ai-card">
                            <h4><Zap size={20} /> Workflow зөвлөмж</h4>
                            <p>Ажлын процессын удаашрал, саад бэрхшээлийг илрүүлж, сайжруулах зөвлөмж өгнө.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Workflow Steps */}
            <section className="nege-section">
                <div className="container">
                    <div className="nege-section-header">
                        <h2 className="nege-section-title">Хэрхэн ажилладаг вэ?</h2>
                    </div>

                    <div className="nege-workflow">
                        {[
                            { title: 'Тохиргоо', desc: 'Байгууллагын бүтэц, дүрэм, workflow тохируулна.' },
                            { title: 'Нэгтгэл', desc: 'Ажилтны мэдээллийг нэгтгэн системд оруулна.' },
                            { title: 'Идэвхжүүлэлт', desc: 'Процессуудыг идэвхжүүлнэ (ирц, чөлөө, онбординг).' },
                            { title: 'Удирдлага', desc: 'Тайлан, AI анализ дээр суурилж ухаалаг удирдлага хийнэ.' }
                        ].map((step, i) => (
                            <div key={i} className="nege-workflow-step">
                                <div className="nege-workflow-num">{i + 1}</div>
                                <div className="nege-workflow-content">
                                    <h4>{step.title}</h4>
                                    <p>{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* FAQ */}
            <section className="nege-section bg-slate-50">
                <div className="container">
                    <div className="nege-section-header">
                        <h2 className="nege-section-title">Түгээмэл асуултууд</h2>
                    </div>

                    <div className="nege-faq-grid">
                        <div className="nege-faq-item">
                            <div className="nege-faq-q">Систем нэвтрүүлэхэд хэр хугацаа шаардлагатай вэ?</div>
                            <div className="nege-faq-a">1–7 өдөр (байгууллагын өгөгдлийн бэлэн байдлаас хамаарна).</div>
                        </div>
                        <div className="nege-faq-item">
                            <div className="nege-faq-q">Мобайл дээр ашиглаж болох уу?</div>
                            <div className="nege-faq-a">Тийм. Ажилтны интерфэйс бүрэн мобайлд тохирсон (iOS, Android web).</div>
                        </div>
                        <div className="nege-faq-item">
                            <div className="nege-faq-q">Тайлан экспортлох боломжтой юу?</div>
                            <div className="nege-faq-a">Тийм. Бүх тайланг Excel, CSV, API хэлбэрээр татаж авах боломжтой.</div>
                        </div>
                        <div className="nege-faq-item">
                            <div className="nege-faq-q">Workflow өөрчлөх боломжтой юу?</div>
                            <div className="nege-faq-a">Тийм. Байгууллагын дотоод процесс, журмын дагуу уян хатан тохируулах боломжтой.</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Footer */}
            <footer className="nege-cta-footer">
                <div className="container">
                    <h2>Байгууллагын менежментээ <br />шинэ түвшинд гарга</h2>
                    <div className="flex justify-center gap-4 mt-8">
                        <Link to="/contact" className="btn btn-white btn-lg text-indigo-600 border-white hover:bg-white/90">
                            Демо авах
                        </Link>
                        <Link to="/trial" className="btn btn-outline-white btn-lg text-white border-white hover:bg-white/10">
                            Үнэгүй турших
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default NegeAI;
