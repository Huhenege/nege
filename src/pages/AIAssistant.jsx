import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';
import { FileText, Calculator, Sparkles, ArrowRight, Clock, GraduationCap, Layers, IdCard } from 'lucide-react';
import './AIAssistant.css';

const AIAssistant = () => {
    const { currentUser, openAuthModal } = useAuth();
    const { config: billingConfig } = useBilling();
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState('Бүгд');

    const guestAllowed = new Set([
        "/ai-assistant/account-statement-organizer",
        "/ai-assistant/social-insurance-holiday",
        "/ai-assistant/official-letterhead",
        "/ai-assistant/business-card",
        "/ai-assistant/contract-generator",
        "/ai-assistant/business-training"
    ]);

    const tools = [
        {
            id: 'account',
            toolKey: 'account_statement',
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
            toolKey: 'ndsh_holiday',
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
            toolKey: 'official_letterhead',
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
            id: 'business-card',
            toolKey: 'business_card',
            title: 'Нэрийн хуудас бүтээгч',
            description: '90x50 мм хэмжээтэй минимал нэрийн хуудсыг PDF болон PNG-ээр бэлтгэнэ.',
            path: '/ai-assistant/business-card',
            icon: IdCard,
            category: 'Албан бичиг',
            badge: 'Free',
            badgeTone: 'badge-success',
            cta: 'Эхлүүлэх',
        },
        {
            id: 'contract',
            toolKey: 'contract_generator',
            title: 'Гэрээ үүсгэгч',
            description: 'Бэлэн загварууд ашиглан гэрээгээ хялбархан бүрдүүлж, PDF-ээр татах.',
            path: '/ai-assistant/contract-generator',
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

    const resolvedTools = tools.map((tool) => {
        if (!tool.toolKey) return tool;
        const toolConfig = billingConfig?.tools?.[tool.toolKey] || { payPerUsePrice: 0, creditCost: 0, active: true };
        const isActive = toolConfig?.active !== false;
        const priceAmount = Number(toolConfig?.payPerUsePrice || 0);
        const creditCost = Number(toolConfig?.creditCost || 0);
        const priceLabel = priceAmount > 0 ? `${priceAmount.toLocaleString()}₮` : 'Үнэгүй';
        const creditLabel = creditCost > 0 ? `${creditCost} credit` : null;
        if (isActive) {
            const isFree = priceAmount <= 0;
            return {
                ...tool,
                priceLabel,
                creditLabel,
                badge: isFree ? 'Free' : 'Төлбөртэй',
                badgeTone: isFree ? 'badge-success' : 'badge-brand',
            };
        }
        return {
            ...tool,
            disabled: true,
            badge: 'Түр хаалттай',
            badgeTone: 'badge-warning',
            cta: 'Түр хаалттай',
            priceLabel,
            creditLabel,
        };
    });

    const filteredTools = useMemo(() => {
        return resolvedTools.filter((tool) => {
            const matchesCategory = activeCategory === 'Бүгд' || tool.category === activeCategory;
            return matchesCategory;
        });
    }, [resolvedTools, activeCategory]);

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
                    <span className="ai-hero__eyebrow">NEGE AI</span>
                    <h1 className="ai-hero__title">Нэг дор бүх AI хэрэгсэл</h1>
                    <p className="ai-hero__subtitle">
                        Санхүү, даатгал, албан бичиг, сургалтын ажилд зориулсан хэрэгслүүдийг нэг дороос ашигла.
                    </p>
                </div>

                <div className="ai-toolbar">
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
                                    <span className={`badge ${tool.badgeTone}`}>{tool.badge}</span>
                                </div>
                                <h3 className="ai-card-title">{tool.title}</h3>
                                <p className="ai-card-desc">{tool.description}</p>
                                {tool.priceLabel && (
                                    <div className="ai-card-price">
                                        <span>{tool.priceLabel}</span>
                                        {tool.creditLabel && <span className="ai-card-price__divider">·</span>}
                                        {tool.creditLabel && <span>{tool.creditLabel}</span>}
                                    </div>
                                )}
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
