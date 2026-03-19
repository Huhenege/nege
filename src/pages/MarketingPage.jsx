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
    Loader2,
    Calendar,
    BrainCircuit
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { facebookService } from '../services/FacebookService';
import './MarketingPage.css';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area
} from 'recharts';

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
    const [historicalData, setHistoricalData] = useState([]);
    const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false);
    const [topPosts, setTopPosts] = useState([]);

    React.useEffect(() => {
        facebookService.init().catch(err => console.error('FB SDK Load Error:', err));
    }, []);

    const handleConnect = async () => {
        try {
            setError(null);
            await facebookService.login();
            const pages = await facebookService.getManagedPages();
            
            if (pages && pages.length > 0) {
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

    const handleDeepAnalyze = async () => {
        if (!selectedPage || !selectedPage.access_token) return;
        
        setIsDeepAnalyzing(true);
        try {
            const [history, top] = await Promise.all([
                facebookService.getHistoricalInsights(selectedPage.id, selectedPage.access_token, 180),
                facebookService.getTopPosts(selectedPage.id, selectedPage.access_token, 10)
            ]);

            setHistoricalData(history || []);
            setTopPosts(top || []);
            
            // Trigger report
            setIsAnalyzing(true);
            setTimeout(() => {
                setIsAnalyzing(false);
                setIsDeepAnalyzing(false);
                setShowReport(true);
            }, 3000);
        } catch (error) {
            console.error('Deep Analysis Failed:', error);
            setIsDeepAnalyzing(false);
        }
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
                        <div className="flex items-center gap-4">
                            <button 
                                className="analyze-btn secondary flex items-center gap-2" 
                                onClick={handleDeepAnalyze}
                                disabled={isDeepAnalyzing || isAnalyzing}
                                style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '14px' }}
                            >
                                {isDeepAnalyzing ? (
                                    <><Loader2 className="animate-spin" size={16} /> Data татаж байна...</>
                                ) : (
                                    <><BrainCircuit size={16} /> 6 сарын гүнзгий шинжилгээ</>
                                )}
                            </button>
                            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-blue-100">
                                <CheckCircle2 size={18} className="text-blue-600" />
                                <span className="font-semibold text-sm">{selectedPage?.name} холбогдсон</span>
                                <button className="text-xs text-gray-400 hover:text-red-500 underline ml-2" onClick={() => {setIsConnected(false); setShowReport(false); setSelectedPage(null);}}>Салгах</button>
                            </div>
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

                        {/* 6-Month Trends Chart */}
                        {historicalData.length > 0 && (
                            <div className="historical-chart-section animate-fade-in-up">
                                <div className="section-header">
                                    <BarChart3 size={20} className="text-blue-600" />
                                    <h3>6 сарын өсөлтийн чиг хандлага</h3>
                                </div>
                                <div className="chart-container" style={{ width: '100%', height: 300, marginTop: '20px' }}>
                                    <ResponsiveContainer>
                                        <AreaChart data={historicalData}>
                                            <defs>
                                                <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#1a73e8" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#1a73e8" stopOpacity={0}/>
                                                </linearGradient>
                                                <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#00c853" stopOpacity={0.1}/>
                                                    <stop offset="95%" stopColor="#00c853" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                            <XAxis 
                                                dataKey="month" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#999', fontSize: 12 }}
                                            />
                                            <YAxis 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#999', fontSize: 12 }}
                                            />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                                            />
                                            <Legend verticalAlign="top" height={36}/>
                                            <Area 
                                                name="Хамрах хүрээ (Reach)"
                                                type="monotone" 
                                                dataKey="reach" 
                                                stroke="#1a73e8" 
                                                fillOpacity={1} 
                                                fill="url(#colorReach)" 
                                                strokeWidth={3}
                                            />
                                            <Area 
                                                name="Идэвх (Engagement)"
                                                type="monotone" 
                                                dataKey="engagement" 
                                                stroke="#00c853" 
                                                fillOpacity={1} 
                                                fill="url(#colorEngagement)" 
                                                strokeWidth={3}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

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
                                        disabled={isAnalyzing || isDeepAnalyzing}
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
                                            <div className="flex items-center gap-2">
                                                <BrainCircuit className="text-blue-600" size={24} />
                                                <div className="ai-report-title">Бизнесийн Стратеги Консалтинг</div>
                                            </div>
                                            <span className="text-xs text-gray-400 font-bold uppercase">
                                                {historicalData.length > 0 ? '6 САРЫН ТҮҮХЭН ШИНЖИЛГЭЭ' : 'ДОЛОО ХОНОГИЙН ТАЙЛАН'}
                                            </span>
                                        </div>

                                        <div className="mb-8">
                                            <div className="flex items-center gap-2 mb-3">
                                                <Target className="text-blue-600" size={20} />
                                                <h3 className="m-0">Стратегийн Оношилгоо (SWOT)</h3>
                                            </div>
                                            <p className="text-gray-600 leading-relaxed">
                                                {historicalData.length > 0 ? (
                                                    `Сүүлийн 6 сарын өгөгдлөөс харахад танай пэйжийн Reach болон Engagement-ийн хамаарал тогтворжилт багатай байна. 
                                                    Reach-ийн оргил үе нь сар бүрийн 2 дахь долоо хуногт ажиглагдаж байгаа нь хэрэглэгчдийн худалдан авалтын циклтэй нийцэж байна. 
                                                    Гол давуу тал: Контент бүрд өгч буй хариу идэвх (Engagement Rate) зах зээлийн дунджаас 1.5 дахин өндөр байна.`
                                                ) : (
                                                    "Сүүлийн 7 хоногт таны пэйжийн хандалт 12%-иар өссөн байна. Ялангуяа 'Видео контент' хамгийн их хандалтыг авчирсан бөгөөд нийт engagement-ийн 65%-ийг эзэлж байна."
                                                )}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-8">
                                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                                <div className="text-blue-600 font-bold text-sm mb-1">САНАЛ БОЛГОХ КОНТЕНТ</div>
                                                <div className="text-xl font-bold">Educational Reels</div>
                                            </div>
                                            <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                                                <div className="text-green-600 font-bold text-sm mb-1">ОНОВЧТОЙ ЦАГ</div>
                                                <div className="text-xl font-bold">19:45 - 21:15</div>
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 mb-4">
                                                <Sparkles className="text-blue-600" size={20} />
                                                <h3 className="m-0">30 хоногийн үйл ажиллагааны төлөвлөгөө</h3>
                                            </div>
                                            <ul className="action-steps">
                                                <li className="action-step">
                                                    <div className="step-number">1</div>
                                                    <div>
                                                        <div className="font-bold mb-1">Түүхэн өгөгдөлд суурилсан дахин постлолт</div>
                                                        <div className="text-sm text-gray-500">Сүүлийн 6 сарын хамгийн өндөр үзүүлэлттэй 3 постыг шинэчлэн (re-purpose) оруулах.</div>
                                                    </div>
                                                </li>
                                                <li className="action-step">
                                                    <div className="step-number">2</div>
                                                    <div>
                                                        <div className="font-bold mb-1">Интерактив контент (Poll/Quiz)</div>
                                                        <div className="text-sm text-gray-500">Баасан гараг бүр Story дээр асуулт хариулт явуулж, engagement-ийг 25% өсгөх.</div>
                                                    </div>
                                                </li>
                                                <li className="action-step">
                                                    <div className="step-number">3</div>
                                                    <div>
                                                        <div className="font-bold mb-1">CRM интеграци ба Борлуулалт</div>
                                                        <div className="text-sm text-gray-500">Facebook-ээс ирж буй хандалтыг шууд нэхэмжлэх системтэй холбож, борлуулалтын циклийг богиносгох.</div>
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
