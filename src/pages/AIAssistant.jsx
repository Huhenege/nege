import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../contexts/BillingContext';
import {
    FileText,
    Calculator,
    ArrowRight,
    Clock,
    GraduationCap,
    Layers,
    IdCard,
    CheckSquare,
    Target,
    Sparkles,
    Workflow,
    ShieldCheck,
} from 'lucide-react';
import './AIAssistant.css';

const categories = ['Бүгд', 'Санхүү', 'Даатгал', 'Албан бичиг', 'Стратеги', 'Сургалт', 'Бусад'];

const workflowSteps = [
    {
        id: 'input',
        title: 'Өгөгдөл оруулах',
        description: 'Excel, PDF болон текст хүсэлтээ оруулахад систем автоматаар бүтэцжүүлнэ.',
        icon: Layers,
    },
    {
        id: 'process',
        title: 'AI боловсруулалт',
        description: 'Даалгаврын төрөлд тааруулж тооцоолол, анализ, баримт үүсгэх урсгал ажиллана.',
        icon: Workflow,
    },
    {
        id: 'control',
        title: 'Хяналт ба экспорт',
        description: 'Үр дүнгээ нэг самбараас шалгаад PDF, PNG эсвэл structured мэдээллээр татна.',
        icon: ShieldCheck,
    },
];

const guestAllowed = new Set([
    '/ai-assistant/account-statement-organizer',
    '/ai-assistant/social-insurance-holiday',
    '/ai-assistant/official-letterhead',
    '/ai-assistant/business-card',
    '/ai-assistant/contract-generator',
    '/ai-assistant/business-training',
    '/ai-assistant/eisenhower-planner',
    '/ai-assistant/swot-analyzer',
]);

const toolCatalog = [
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
        title: 'НДШ тооцоологч',
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
        id: 'eisenhower',
        toolKey: 'eisenhower_analyzer',
        title: 'Eisenhower prioritizer',
        description: 'Task жагсаалтаа AI-аар urgency/importance үнэлүүлж 4 quadrant-д автоматаар байршуул.',
        path: '/ai-assistant/eisenhower-planner',
        icon: CheckSquare,
        category: 'Стратеги',
        badge: 'Free',
        badgeTone: 'badge-success',
        cta: 'Эхлүүлэх',
    },
    {
        id: 'swot',
        toolKey: 'swot_analyzer',
        title: 'SWOT analyzer',
        description: 'Төслийнхөө Strength, Weakness, Opportunity, Threat-ийг AI-аар matrix болгон шинжил.',
        path: '/ai-assistant/swot-analyzer',
        icon: Target,
        category: 'Стратеги',
        badge: 'Free',
        badgeTone: 'badge-success',
        cta: 'Эхлүүлэх',
    },
    {
        id: 'training',
        title: 'AI бизнес сургалт',
        description: 'AI-д тулгуурласан бүтээмжийн сургалтанд бүртгүүлж, цаг товлох.',
        path: '/ai-assistant/business-training',
        icon: GraduationCap,
        category: 'Сургалт',
        badge: 'Open',
        badgeTone: 'badge-success',
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

const AIAssistant = () => {
    const { currentUser, openAuthModal } = useAuth();
    const { config: billingConfig } = useBilling();
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState('Бүгд');

    const resolvedTools = useMemo(() => {
        return toolCatalog.map((tool) => {
            if (!tool.toolKey) {
                return {
                    ...tool,
                    isActive: !tool.disabled,
                    isFree: tool.badge === 'Free',
                    priceAmount: 0,
                    creditCost: 0,
                };
            }

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
                    priceAmount,
                    creditCost,
                    isActive,
                    isFree,
                    badge: isFree ? 'Free' : 'Төлбөртэй',
                    badgeTone: isFree ? 'badge-success' : 'badge-brand',
                };
            }

            return {
                ...tool,
                disabled: true,
                isActive: false,
                isFree: false,
                priceAmount,
                creditCost,
                badge: 'Түр хаалттай',
                badgeTone: 'badge-warning',
                cta: 'Түр хаалттай',
                priceLabel,
                creditLabel,
            };
        });
    }, [billingConfig]);

    const categoryCounts = useMemo(() => {
        const counts = resolvedTools.reduce((accumulator, tool) => {
            accumulator[tool.category] = (accumulator[tool.category] || 0) + 1;
            return accumulator;
        }, {});
        counts['Бүгд'] = resolvedTools.length;
        return counts;
    }, [resolvedTools]);

    const filteredTools = useMemo(() => {
        return resolvedTools.filter((tool) => {
            const matchesCategory = activeCategory === 'Бүгд' || tool.category === activeCategory;
            return matchesCategory;
        });
    }, [resolvedTools, activeCategory]);

    const activeToolCount = useMemo(() => {
        return resolvedTools.filter((tool) => !tool.disabled && Boolean(tool.path)).length;
    }, [resolvedTools]);

    const freeToolCount = useMemo(() => {
        return resolvedTools.filter((tool) => !tool.disabled && tool.isFree).length;
    }, [resolvedTools]);

    const premiumToolCount = useMemo(() => {
        return resolvedTools.filter((tool) => !tool.disabled && Number(tool.priceAmount) > 0).length;
    }, [resolvedTools]);

    const featuredTools = useMemo(() => {
        return resolvedTools.filter((tool) => !tool.disabled && Boolean(tool.path)).slice(0, 4);
    }, [resolvedTools]);

    const handleToolClick = (tool) => {
        if (tool.disabled || !tool.path) return;
        if (!currentUser && !guestAllowed.has(tool.path)) {
            openAuthModal();
            return;
        }
        navigate(tool.path);
    };

    const handleScrollToTools = () => {
        const toolsSection = document.getElementById('ai-tools');
        if (toolsSection) {
            toolsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleTrainingClick = () => {
        const trainingTool = resolvedTools.find((tool) => tool.id === 'training');
        if (trainingTool) {
            handleToolClick(trainingTool);
        }
    };

    const heroStats = [
        { label: 'Идэвхтэй модуль', value: `${activeToolCount}+` },
        { label: 'Үнэгүй хэрэгсэл', value: `${freeToolCount}` },
        { label: 'Premium workflow', value: `${premiumToolCount}` },
    ];

    return (
        <div className="ai-page">
            <div className="ai-page__glow ai-page__glow--one" aria-hidden="true" />
            <div className="ai-page__glow ai-page__glow--two" aria-hidden="true" />

            <div className="container ai-container">
                <section className="ai-hero">
                    <div className="ai-hero__content">
                        <span className="ai-hero__eyebrow">
                            <Sparkles size={14} />
                            AI Command Center
                        </span>
                        <h1 className="ai-hero__title">
                            Бизнесийн <span>AI workflow</span>-оо
                            <br />
                            нэг самбараас удирд
                        </h1>
                        <p className="ai-hero__subtitle">
                            Санхүү, албан бичиг, стратеги, сургалтын бүх урсгалыг нэг интерфейст нэгтгэж, өдөр тутмын
                            шийдвэр гаргалтыг илүү хурдан болго.
                        </p>

                        <div className="ai-hero__actions">
                            <button type="button" className="ai-cta ai-cta--primary" onClick={handleScrollToTools}>
                                Хэрэгслүүд үзэх
                                <ArrowRight size={16} />
                            </button>
                            <button type="button" className="ai-cta ai-cta--ghost" onClick={handleTrainingClick}>
                                AI сургалт эхлүүлэх
                                <GraduationCap size={16} />
                            </button>
                        </div>

                        <div className="ai-hero__stats">
                            {heroStats.map((stat) => (
                                <div key={stat.label} className="ai-stat">
                                    <p className="ai-stat__value">{stat.value}</p>
                                    <span className="ai-stat__label">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <aside className="ai-hero-panel" aria-label="AI workflow status">
                        <div className="ai-hero-panel__scan" aria-hidden="true" />
                        <div className="ai-hero-panel__header">
                            <div>
                                <p className="ai-hero-panel__title">Live workspace</p>
                                <span className="ai-hero-panel__caption">Өнөөдрийн санал болгох урсгалууд</span>
                            </div>
                            <span className="ai-hero-panel__chip">{activeToolCount} online</span>
                        </div>

                        <div className="ai-hero-panel__list">
                            {featuredTools.map((tool) => {
                                const Icon = tool.icon;
                                return (
                                    <button
                                        key={`featured-${tool.id}`}
                                        type="button"
                                        className="ai-hero-panel__tool"
                                        onClick={() => handleToolClick(tool)}
                                    >
                                        <span className="ai-hero-panel__icon">
                                            <Icon size={16} />
                                        </span>
                                        <span className="ai-hero-panel__tool-copy">
                                            <strong>{tool.title}</strong>
                                            <small>{tool.category}</small>
                                        </span>
                                        <ArrowRight size={14} />
                                    </button>
                                );
                            })}
                        </div>
                    </aside>
                </section>

                <section className="ai-flow" aria-labelledby="ai-flow-heading">
                    <div className="ai-flow__header">
                        <p className="ai-flow__eyebrow">Workflow</p>
                        <h2 id="ai-flow-heading">AI процессоо 3 шатлалаар ажиллуул</h2>
                    </div>

                    <div className="ai-flow__grid">
                        {workflowSteps.map((step, index) => {
                            const Icon = step.icon;
                            return (
                                <article key={step.id} className="ai-flow-card">
                                    <div className="ai-flow-card__top">
                                        <span className="ai-flow-card__index">{`0${index + 1}`}</span>
                                        <span className="ai-flow-card__icon">
                                            <Icon size={16} />
                                        </span>
                                    </div>
                                    <h3>{step.title}</h3>
                                    <p>{step.description}</p>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <section className="ai-catalog" id="ai-tools">
                    <div className="ai-toolbar">
                        <div className="ai-toolbar__intro">
                            <h2 className="ai-toolbar__title">Tool Library</h2>
                            <p className="ai-toolbar__subtitle">
                                Ангиллаар шүүж, хамгийн тохирох AI хэрэгслээ сонгоод нэг товчоор ажиллуул.
                            </p>
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
                                    <span>{category}</span>
                                    <em>{categoryCounts[category] || 0}</em>
                                </button>
                            ))}
                        </div>
                    </div>

                    {filteredTools.length > 0 ? (
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
                                            <span className="ai-card__icon">
                                                <Icon size={18} />
                                            </span>
                                            <span className="ai-card__category">{tool.category}</span>
                                            <span className={`badge ${tool.badgeTone}`}>{tool.badge}</span>
                                        </div>
                                        <h3 className="ai-card-title">{tool.title}</h3>
                                        <p className="ai-card-desc">{tool.description}</p>
                                        <div className={`ai-card-footer ${tool.priceLabel ? '' : 'ai-card-footer--end'}`}>
                                            {tool.priceLabel && (
                                                <div className="ai-card-price">
                                                    <span>{tool.priceLabel}</span>
                                                    {tool.creditLabel && <span className="ai-card-price__divider">·</span>}
                                                    {tool.creditLabel && <span>{tool.creditLabel}</span>}
                                                </div>
                                            )}
                                            <div className="ai-card-arrow" aria-hidden="true">
                                                <ArrowRight size={16} />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="ai-empty">
                            <p>Сонгосон ангилалд хараахан хэрэгсэл нэмэгдээгүй байна.</p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default AIAssistant;
