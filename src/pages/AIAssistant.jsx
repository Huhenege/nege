import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FileText, Calculator, Sparkles, ArrowRight, Clock, GraduationCap, Search, Layers } from 'lucide-react';
import './AIAssistant.css';

const AIAssistant = () => {
    const { currentUser, openAuthModal } = useAuth();
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState('Бүгд');
    const [query, setQuery] = useState('');

    const guestAllowed = new Set([
        "/ai-assistant/account-statement-organizer",
        "/ai-assistant/social-insurance-holiday",
        "/ai-assistant/official-letterhead"
    ]);

    const tools = [
        {
            id: 'account',
            title: 'Дансны хуулга цэгцлэгч',
            description: 'Банкны хуулгаа (Excel/CSV) оруулж, автоматаар ангилан цэгцлэх хэрэгсэл.',
            path: '/ai-assistant/account-statement-organizer',
            icon: FileText,
            category: 'Санхүү',
            badge: 'Free',
            badgeTone: 'badge-success',
            cta: 'Эхлүүлэх',
        },
        {
            id: 'ndsh',
            title: 'НДШ Тооцоологч',
            description: 'Нийгмийн даатгалын шимтгэлийн лавлагааг уншуулж, амралтын хоног тооцоолох.',
            path: '/ai-assistant/social-insurance-holiday',
            icon: Calculator,
            category: 'Даатгал',
            badge: 'Free',
            badgeTone: 'badge-success',
            cta: 'Эхлүүлэх',
        },
        {
            id: 'letterhead',
            title: 'Албан бланк үүсгэгч',
            description: 'Албан бичгийг стандартаар үүсгэж, PDF форматаар татаж авах хэрэгсэл.',
            path: '/ai-assistant/official-letterhead',
            icon: FileText,
            category: 'Албан бичиг',
            badge: 'Free',
            badgeTone: 'badge-success',
            cta: 'Эхлүүлэх',
        },
        {
            id: 'training',
            title: 'AI Бизнес сургалт',
            description: 'AI-д тулгуурласан бүтээмжийн сургалтанд бүртгүүлж, цаг товлох.',
            path: '/ai-assistant/business-training',
            icon: GraduationCap,
            category: 'Сургалт',
            badge: 'Login',
            badgeTone: 'badge-warning',
            cta: 'Бүртгүүлэх',
        },
        {
            id: 'coming',
            title: 'Тун удахгүй',
            description: 'Цалингийн тооцоолол, гэрээ боловсруулах зэрэг шинэ боломжууд.',
            path: null,
            icon: Clock,
            category: 'Бусад',
            badge: 'Soon',
            badgeTone: 'badge-muted',
            cta: 'Тун удахгүй',
            disabled: true,
        },
    ];

    const categories = ['Бүгд', 'Санхүү', 'Даатгал', 'Албан бичиг', 'Сургалт', 'Бусад'];

    const filteredTools = useMemo(() => {
        const lowered = query.trim().toLowerCase();
        return tools.filter((tool) => {
            const matchesCategory = activeCategory === 'Бүгд' || tool.category === activeCategory;
            const matchesQuery = !lowered || `${tool.title} ${tool.description}`.toLowerCase().includes(lowered);
            return matchesCategory && matchesQuery;
        });
    }, [tools, activeCategory, query]);

    const handleToolClick = (tool) => {
        if (tool.disabled || !tool.path) return;
        if (!currentUser && !guestAllowed.has(tool.path)) {
            openAuthModal();
            return;
        }
        navigate(tool.path);
    };

    return (
        <div className="ai-page">
            <div className="container ai-container">
                <div className="ai-hero">
                    <div className="ai-hero__eyebrow">
                        <Sparkles size={16} />
                        NEGE AI TOOLS
                    </div>
                    <h1 className="ai-title">Ухаалаг Туслахуудын төв</h1>
                    <p className="ai-subtitle">
                        Таны бизнесийн өдөр тутмын ажлыг хөнгөвчлөх, нэг стандарттай AI хэрэгслүүдийн багц.
                    </p>
                    <div className="ai-hero__stats">
                        <div className="ai-stat">
                            <span>4</span>
                            <p>Идэвхтэй хэрэгсэл</p>
                        </div>
                        <div className="ai-stat">
                            <span>1</span>
                            <p>Шинэ боломж удахгүй</p>
                        </div>
                        <div className="ai-stat">
                            <span>AI</span>
                            <p>Автомат дүн шинжилгээ</p>
                        </div>
                    </div>
                </div>

                <div className="ai-toolbar">
                    <div className="ai-search">
                        <Search size={18} />
                        <input
                            className="ai-search__input"
                            placeholder="Хайлт хийх"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    <div className="ai-filters">
                        {categories.map((category) => (
                            <button
                                key={category}
                                type="button"
                                className={`ai-filter ${activeCategory === category ? 'active' : ''}`}
                                onClick={() => setActiveCategory(category)}
                            >
                                {category === 'Бүгд' ? <Layers size={14} /> : null}
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="ai-grid">
                    {filteredTools.map((tool) => {
                        const Icon = tool.icon;
                        return (
                            <button
                                key={tool.id}
                                type="button"
                                onClick={() => handleToolClick(tool)}
                                disabled={tool.disabled}
                                className={`ai-card ${tool.disabled ? 'ai-card--disabled' : ''}`}
                            >
                                <div className="ai-card__top">
                                    <div className="ai-card-icon">
                                        <Icon size={28} />
                                    </div>
                                    <span className={`badge ${tool.badgeTone}`}>{tool.badge}</span>
                                </div>
                                <h3 className="ai-card-title">{tool.title}</h3>
                                <p className="ai-card-desc">{tool.description}</p>
                                <div className="ai-card-arrow">
                                    {tool.cta}
                                    <ArrowRight size={16} />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;
