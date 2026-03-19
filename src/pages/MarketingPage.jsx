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
  Tooltip, 
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  YAxis,
  XAxis,
  CartesianGrid
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
    const [audienceData, setAudienceData] = useState(null);

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
                
                const realInsights = await facebookService.getPageInsights(page.id, page.access_token, page);
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
            const [history, top, audience] = await Promise.all([
                facebookService.getHistoricalInsights(selectedPage.id, selectedPage.access_token, 180),
                facebookService.getTopPosts(selectedPage.id, selectedPage.access_token, 10),
                facebookService.getAudienceInsights(selectedPage.id, selectedPage.access_token)
            ]);

            setHistoricalData(history || []);
            setTopPosts(top || []);
            setAudienceData(audience);
            
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
                                                {audienceData ? (
                                                    `Өгөгдлөөс харахад танай пэйжийн үндсэн дагагчид ${audienceData.demographics.sort((a,b) => (b.female + b.male) - (a.female + a.male))[0].age} насны хүмүүс байна. 
                                                    Хамгийн их хандалт ${audienceData.cities[0]?.name} хотоос ирж байгаа бөгөөд нийт дагагчдын ${Math.round((audienceData.cities[0]?.count / (audienceData.cities.reduce((acc, c) => acc + c.count, 0) || 1)) * 100)}%-ийг эзэлж байна. 
                                                    Гол боломж: Хэрэглэгчид ${audienceData.onlineTimes.sort((a,b) => b.count - a.count)[0].hour} цагт хамгийн идэвхтэй байгаа тул энэ үед пост оруулбал engagement 30%-иар өсөх магадлалтай.`
                                                ) : historicalData.length > 0 ? (
                                                    "Сүүлийн 6 сарын өгөгдлөөс харахад танай пэйжийн Reach болон Engagement-ийн хамаарал тогтворжилт багатай байна. Reach-ийн оргил үе нь сар бүрийн 2 дахь долоо хуногт ажиглагдаж байгаа."
                                                ) : (
                                                    "Сүүлийн 7 хоногт таны пэйжийн хандалт 12%-иар өссөн байна. Ялангуяа 'Видео контент' хамгийн их хандалтыг авчирсан."
                                                )}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-8">
                                            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                                                <div className="text-blue-600 font-bold text-sm mb-1">ДИЙЛЭНХ НАСНЫ БҮЛЭГ</div>
                                                <div className="text-xl font-bold">{audienceData ? audienceData.demographics.sort((a,b) => (b.female + b.male) - (a.female + a.male))[0].age : '25-34'} нас</div>
                                            </div>
                                            <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                                                <div className="text-green-600 font-bold text-sm mb-1">ОНОВЧТОЙ ЦАГ</div>
                                                <div className="text-xl font-bold">{audienceData ? audienceData.onlineTimes.sort((a,b) => b.count - a.count)[0].hour : '19:45'}</div>
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

                        {/* Top Performing Content Section */}
                        {topPosts.length > 0 && (
                            <div className="top-posts-section animate-fade-in-up">
                                <div className="section-header">
                                    <Sparkles size={20} className="text-blue-600" />
                                    <h3>Шилдэг гүйцэтгэлтэй контентууд</h3>
                                </div>
                                <div className="posts-grid mt-6">
                                    {topPosts.map((post, idx) => (
                                        <div key={post.id || idx} className="post-card">
                                            {post.full_picture && (
                                                <div className="post-image">
                                                    <img src={post.full_picture} alt="Post" />
                                                </div>
                                            )}
                                            <div className="post-details">
                                                <p className="post-text">{post.message?.substring(0, 100)}{post.message?.length > 100 ? '...' : ''}</p>
                                                <div className="post-stats">
                                                    <div className="p-stat">
                                                        <Eye size={14} />
                                                        <span>{post.insights?.data?.find(d => d.name === 'post_impressions_unique')?.values[0]?.value || 0}</span>
                                                    </div>
                                                    <div className="p-stat">
                                                        <MousePointer2 size={14} />
                                                        <span>{post.insights?.data?.find(d => d.name === 'post_engagements')?.values[0]?.value || 0}</span>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-400 mt-2">
                                                    {new Date(post.created_time).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {/* Audience Insights Section */}
                        {audienceData && (
                            <div className="audience-deep-dive animate-fade-in-up mt-8">
                                <div className="section-header">
                                    <Users size={20} className="text-blue-600" />
                                    <h3>Хэрэглэгчийн гүнзгий хөрөг (Audience Insights)</h3>
                                </div>
                                
                                <div className="audience-grid mt-6">
                                    {/* Demographics Chart */}
                                    <div className="insight-card p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
                                        <h4 className="flex items-center gap-2 font-bold mb-6 text-gray-700">
                                            <Users size={16} /> Нас ба Хүйс
                                        </h4>
                                        <div className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={audienceData.demographics}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="age" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                                                    <Tooltip 
                                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                                                        cursor={{fill: '#f8fafc'}}
                                                    />
                                                    <Legend verticalAlign="top" align="right" iconType="circle" />
                                                    <Bar dataKey="female" name="Эмэгтэй" fill="#fb7185" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="male" name="Эрэгтэй" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Best Time to Post */}
                                    <div className="insight-card p-6 bg-white rounded-3xl border border-gray-100 shadow-sm">
                                        <h4 className="flex items-center gap-2 font-bold mb-6 text-gray-700">
                                            <Calendar size={16} /> Пост оруулахад хамгийн тохиромжтой цаг
                                        </h4>
                                        <div className="h-[300px]">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={audienceData.onlineTimes}>
                                                    <defs>
                                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                    <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                                                    <Tooltip 
                                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                                                    />
                                                    <Area 
                                                        type="monotone" 
                                                        dataKey="count" 
                                                        name="Идэвхтэй дагагчид" 
                                                        stroke="#8b5cf6" 
                                                        strokeWidth={3}
                                                        fillOpacity={1} 
                                                        fill="url(#colorCount)" 
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-4 italic">* Өгөгдлийг сүүлийн 24 цагийн дунджаар тооцов.</p>
                                    </div>

                                    {/* Top Locations */}
                                    <div className="insight-card p-6 bg-white rounded-3xl border border-gray-100 shadow-sm col-span-1 lg:col-span-2">
                                        <div className="flex justify-between items-center mb-6">
                                            <h4 className="flex items-center gap-2 font-bold text-gray-700">
                                                <Target size={16} /> Хаанаас хамгийн их хандаж байна?
                                            </h4>
                                        </div>
                                        <div className="location-stats-grid">
                                            <div className="location-list">
                                                <h5 className="text-sm font-semibold text-gray-400 mb-4">ХОТУУД</h5>
                                                {audienceData.cities.map((city, i) => (
                                                    <div key={i} className="location-item flex justify-between items-center py-3 border-b border-gray-50">
                                                        <span className="text-sm font-medium">{city.name}</span>
                                                        <span className="text-sm font-bold text-blue-600">{city.count.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="location-list">
                                                <h5 className="text-sm font-semibold text-gray-400 mb-4">УЛСУУД</h5>
                                                {audienceData.countries.map((country, i) => (
                                                    <div key={i} className="location-item flex justify-between items-center py-3 border-b border-gray-50">
                                                        <span className="text-sm font-medium">{country.name}</span>
                                                        <span className="text-sm font-bold text-green-600">{country.count.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
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
