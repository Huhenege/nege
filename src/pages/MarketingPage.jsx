import React, { useState } from 'react';
import { 
    TrendingUp, 
    Megaphone, 
    Target, 
    BarChart3, 
    ChevronLeft, 
    Facebook, 
    Users, 
    MousePointer2, 
    Eye, 
    Bot, 
    Sparkles,
    CheckCircle2,
    ArrowUpRight,
    ArrowDownRight,
    Loader2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { facebookService } from '../services/FacebookService';
import './MarketingPage.css';

const MOCK_INSIGHTS = {
    reach: { value: '0', trend: 'N/A', up: true },
    engagement: { value: '0', trend: 'N/A', up: true },
    followers: { value: '0', trend: 'N/A', up: true },
    clicks: { value: '0', trend: 'N/A', up: false }
};

const MarketingPage = () => {
    const navigate = useNavigate();
    const [isConnected, setIsConnected] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [insights, setInsights] = useState(MOCK_INSIGHTS);
    const [selectedPage, setSelectedPage] = useState(null);
    const [error, setError] = useState(null);

    React.useEffect(() => {
        facebookService.init().catch(err => console.error('FB SDK Load Error:', err));
    }, []);

    const handleConnect = async () => {
        try {
            setError(null);
            await facebookService.login();
            const pages = await facebookService.getManagedPages();
            
            if (pages && pages.length > 0) {
                // For simplicity, select the first page. In a real app, let user choose.
                const page = pages[0];
                setSelectedPage(page);
                
                const realInsights = await facebookService.getPageInsights(page.id, page.access_token);
                setInsights(realInsights);
                setIsConnected(true);
            } else {
                setError('Удирдах боломжтой Facebook Page олдсонгүй.');
            }
        } catch (err) {
            console.error('FB Login Error:', err);
            const errorDetail = err?.error_description || err?.errorMessage || (typeof err === 'string' ? err : 'Фэйсбүүк-тэй холбогдоход алдаа гарлаа.');
            setError(`${errorDetail}. App ID болон https://localhost:5173 хаягаа шалгана уу.`);
        }
    };

    const handleAnalyze = () => {
        setIsAnalyzing(true);
        setTimeout(() => {
            setIsAnalyzing(false);
            setShowReport(true);
        }, 3000);
    };

    return (
        <div className="marketing-page">
            <div className="marketing-container">
                <header className="marketing-header">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-full transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                        <h1>AI Маркетинг Мэргэжилтэн</h1>
                    </div>
                    
                    {!isConnected ? (
                        <div className="flex flex-col items-end">
                            <button className="fb-connect-btn" onClick={handleConnect}>
                                <Facebook size={20} /> business.facebook.com-той холбох
                            </button>
                            {error && <span className="text-red-500 text-xs mt-2 font-bold">{error}</span>}
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-blue-100">
                            <CheckCircle2 size={18} className="text-blue-600" />
                            <span className="font-semibold text-sm">{selectedPage?.name} холбогдсон</span>
                            <button className="text-xs text-gray-400 hover:text-red-500 underline ml-2" onClick={() => {setIsConnected(false); setShowReport(false); setSelectedPage(null);}}>Салгах</button>
                        </div>
                    )}
                </header>

                {isConnected ? (
                    <div className="animate-fade-in">
                        {/* Stats Grid */}
                        <div className="marketing-grid">
                            <div className="stat-card">
                                <div className="stat-header">
                                    <div className="stat-icon"><Eye size={20} /></div>
                                    <span className={`stat-trend ${insights.reach.up ? 'up' : 'down'}`}>
                                        {insights.reach.trend}
                                    </span>
                                </div>
                                <div className="stat-value">{insights.reach.value}</div>
                                <div className="stat-label">Нийт хандалт (Reach)</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-header">
                                    <div className="stat-icon"><MousePointer2 size={20} /></div>
                                    <span className={`stat-trend ${insights.engagement.up ? 'up' : 'down'}`}>
                                        {insights.engagement.trend}
                                    </span>
                                </div>
                                <div className="stat-value">{insights.engagement.value}</div>
                                <div className="stat-label">Харилцан үйлдэл (Engagement)</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-header">
                                    <div className="stat-icon"><Users size={20} /></div>
                                    <span className={`stat-trend ${insights.followers.up ? 'up' : 'down'}`}>
                                        {insights.followers.trend}
                                    </span>
                                </div>
                                <div className="stat-value">{insights.followers.value}</div>
                                <div className="stat-label">Дагагчийн өсөлт</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-header">
                                    <div className="stat-icon"><TrendingUp size={20} /></div>
                                    <span className={`stat-trend ${insights.clicks.up ? 'up' : 'down'}`}>
                                        {insights.clicks.trend}
                                    </span>
                                </div>
                                <div className="stat-value">{insights.clicks.value}</div>
                                <div className="stat-label">Вэбсайт руу шилжилт</div>
                            </div>
                        </div>

                        {/* AI Specialist Section */}
                        <div className="ai-specialist-section">
                            <aside className="ai-spec-sidebar">
                                <div className="ai-avatar-wrapper">
                                    <Bot size={80} className="text-blue-600" />
                                </div>
                                <h2>AI Marketing Spec</h2>
                                <p>Таны пэйжийн өгөгдөлд шинжилгээ хийж, стратеги боловсруулахад бэлэн.</p>
                                
                                {!showReport ? (
                                    <button 
                                        className="btn btn-primary w-full py-4 flex items-center justify-center gap-2"
                                        onClick={handleAnalyze}
                                        disabled={isAnalyzing}
                                    >
                                        {isAnalyzing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                                        {isAnalyzing ? 'Шинжилж байна...' : 'Шинжилгээ хийлгэх'}
                                    </button>
                                ) : (
                                    <button 
                                        className="btn btn-outline w-full py-4 text-sm"
                                        onClick={() => setShowReport(false)}
                                    >
                                        Дахин шинжлүүлэх
                                    </button>
                                )}
                            </aside>

                            <main className="ai-report-pane">
                                {showReport ? (
                                    <div className="report-content animate-fade-in-up">
                                        <div className="ai-report-header">
                                            <div className="ai-report-title">Долоо хоногийн Стратегийн Тайлан</div>
                                            <span className="text-xs text-gray-400 font-bold uppercase">2024.03.11 - 2024.03.17</span>
                                        </div>

                                        <div className="mb-10">
                                            <h3><Target className="text-blue-600" size={20} /> Үндсэн дүгнэлт</h3>
                                            <p>
                                                Сүүлийн 7 хоногт таны пэйжийн хандалт 12%-иар өссөн байна. Ялангуяа "Видео контент" хамгийн их хандалтыг авчирсан бөгөөд нийт engagement-ийн 65%-ийг эзэлж байна. Хэрэглэгчид 19:00 - 21:00 цагийн хооронд хамгийн идэвхитэй байна.
                                            </p>
                                        </div>

                                        <div>
                                            <h3><Sparkles className="text-blue-600" size={20} /> Зөвлөмж алхмууд</h3>
                                            <ul className="action-steps">
                                                <li className="action-step">
                                                    <div className="step-number">1</div>
                                                    <div>
                                                        <div className="font-bold mb-1">Видео контентоо нэмэгдүүлэх</div>
                                                        <div className="text-sm text-gray-500">Долоо хоногт дор хаяж 3 удаа Reels оруулах. Видеоны эхний 3 секундэд анхаарал татах.</div>
                                                    </div>
                                                </li>
                                                <li className="action-step">
                                                    <div className="step-number">2</div>
                                                    <div>
                                                        <div className="font-bold mb-1">Постлох цагаа оновчлох</div>
                                                        <div className="text-sm text-gray-500">Оройн 19:30-д хамгийн чухал контентоо байршуулах нь reach-ийг 20%-иар өсгөх магадлалтай.</div>
                                                    </div>
                                                </li>
                                                <li className="action-step">
                                                    <div className="step-number">3</div>
                                                    <div>
                                                        <div className="font-bold mb-1">Direct Message-д хурдан хариулах</div>
                                                        <div className="text-sm text-gray-500">Мессежийн хариу өгөх хугацааг 1 цагаас дотогш болгосноор борлуулалтын хөрвүүлэлт 15%-иар өснө.</div>
                                                    </div>
                                                </li>
                                            </ul>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                                        <BarChart3 size={60} className="mb-4 opacity-20" />
                                        <p className="max-w-sm text-lg">
                                            {isAnalyzing ? 'AI өгөгдлийг оновчтой боловсруулж байна. Түр хүлээнэ үү...' : 'Шинжилгээг эхлүүлж долоо хоног бүрийн стратегийн тайланг аваарай.'}
                                        </p>
                                    </div>
                                )}
                            </main>
                        </div>
                    </div>
                ) : (
                    <div className="placeholder-view bg-white border border-dashed border-gray-300 rounded-3xl py-20 animate-fade-in">
                        <Facebook size={60} className="text-blue-600 mx-auto mb-6" />
                        <h2>Пэйжээ холбоно уу</h2>
                        <p className="max-w-md mx-auto text-lg mb-8">
                            Маркетингийн автоматжуулалт болон AI шинжилгээг ашиглахын тулд Facebook Page-ээ холбох шаардлагатай.
                        </p>
                        <button className="fb-connect-btn mx-auto text-lg py-4 px-10" onClick={handleConnect}>
                            <Facebook size={24} /> business.facebook.com-той холбох
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarketingPage;
