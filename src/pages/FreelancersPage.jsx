import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Star, ShieldCheck, ChevronRight, Filter } from 'lucide-react';
import './Freelancers.css';

export const MOCK_FREELANCERS = [
    {
        id: 1,
        name: 'А. Сараа',
        title: 'Senior UI/UX Designer',
        avatar: '/Users/huhenege/.gemini/antigravity/brain/8a4e1105-72bb-4dc1-aebf-55a9ed3fbf34/freelancer_portrait_1_1773818571551.png',
        rating: 4.9,
        reviews: 42,
        category: 'Design',
        skills: ['Figma', 'Web Design', 'Mobile UI'],
        rate: '60,000₮/цаг',
        verified: true,
        bio: 'Вэб болон гар утасны аппликейшны дизайны чиглэлээр 6 жил ажиллаж байна. Хэрэглэгчийн туршлага (UX) дээр суурилсан хамгийн шилдэг шийдлүүдийг санал болгоно.',
        portfolio: [
            'https://images.unsplash.com/photo-1586717791821-3f44a563dc4c?w=800&q=80',
            'https://images.unsplash.com/photo-1545235617-9465d2a55698?w=800&q=80'
        ]
    },
    {
        id: 2,
        name: 'Т. Тулга',
        title: 'Fullstack Developer',
        avatar: '/Users/huhenege/.gemini/antigravity/brain/8a4e1105-72bb-4dc1-aebf-55a9ed3fbf34/freelancer_portrait_2_1773818856038.png',
        rating: 5.0,
        reviews: 28,
        category: 'Code',
        skills: ['React', 'Node.js', 'PostgreSQL'],
        rate: '75,000₮/цаг',
        verified: true,
        bio: 'Түргэн шуурхай, чанартай программ хангамжийн шийдэл. Вэб систем, API хөгжүүлэлт.',
        portfolio: [
            'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800&q=80',
            'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&q=80'
        ]
    },
    {
        id: 3,
        name: 'Б. Ану',
        title: 'Professional Photographer',
        avatar: '/Users/huhenege/.gemini/antigravity/brain/8a4e1105-72bb-4dc1-aebf-55a9ed3fbf34/freelancer_portrait_3_1773818872128.png',
        rating: 4.8,
        reviews: 56,
        category: 'Photo',
        skills: ['Lifestyle', 'Commercial', 'Event'],
        rate: '150,000₮/багц',
        verified: false,
        bio: 'Бүтээгдэхүүн болон эвент зураг авалт. Таны нандин мөчүүдийг чанарын өндөр түвшинд мөнхөлнө.',
        portfolio: [
            'https://images.unsplash.com/photo-1554080353-a576cf803bda?w=800&q=80',
            'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&q=80'
        ]
    },
    {
        id: 4,
        name: 'Ж. Бат',
        title: 'Senior Video Editor',
        avatar: '/Users/huhenege/.gemini/antigravity/brain/8a4e1105-72bb-4dc1-aebf-55a9ed3fbf34/freelancer_portrait_4_1773818897772.png',
        rating: 4.9,
        reviews: 31,
        category: 'Video',
        skills: ['Premiere Pro', 'After Effects', 'Color Grading'],
        rate: '80,000₮/цаг',
        verified: true,
        bio: 'Видео эвлүүлэг, моушн график. Сошиал медиа болон ТВ рекламны чиглэлээр мэргэшсэн.',
        portfolio: [
            'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&q=80',
            'https://images.unsplash.com/photo-1536240478700-b8673fa92d96?w=800&q=80'
        ]
    },
    {
        id: 5,
        name: 'М. Номин',
        title: 'Content Creator',
        avatar: '/Users/huhenege/.gemini/antigravity/brain/8a4e1105-72bb-4dc1-aebf-55a9ed3fbf34/freelancer_portrait_5_1773818914442.png',
        rating: 4.7,
        reviews: 19,
        category: 'Creative',
        skills: ['Copywriting', 'SMM', 'UGC'],
        rate: '40,000₮/пост',
        verified: true,
        bio: 'Сошиал медиа контент бэлтгэл. Брэндийн тань хандалтыг өндөрт аваачих бүтээлч санаанууд.',
        portfolio: [
            'https://images.unsplash.com/photo-1493612276216-ee3925520721?w=800&q=80',
            'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80'
        ]
    },
    {
        id: 6,
        name: 'Д. Болдоо',
        title: '3D Artist',
        avatar: '/Users/huhenege/.gemini/antigravity/brain/8a4e1105-72bb-4dc1-aebf-55a9ed3fbf34/freelancer_portrait_6_1773818955580.png',
        rating: 5.0,
        reviews: 12,
        category: 'Design',
        skills: ['Blender', 'Cinema 4D', 'Rendering'],
        rate: '100,000₮/цаг',
        verified: true,
        bio: '3D моделчлол, рендер. Бүтээгдэхүүний 3D дизайн болон архитектурын дүрслэл.',
        portfolio: [
            'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&q=80',
            'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80'
        ]
    }
];

const CATEGORIES = ['All', 'Design', 'Code', 'Photo', 'Video', 'Creative'];

const FreelancersPage = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [activeCategory, setActiveCategory] = useState('All');

    const filteredFreelancers = useMemo(() => {
        return MOCK_FREELANCERS.filter(f => {
            const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase()) || 
                                f.title.toLowerCase().includes(search.toLowerCase()) ||
                                f.skills.some(s => s.toLowerCase().includes(search.toLowerCase()));
            const matchesCategory = activeCategory === 'All' || f.category === activeCategory;
            return matchesSearch && matchesCategory;
        });
    }, [search, activeCategory]);

    return (
        <div className="freelancers-page">
            <div className="container">
                <header className="freelancers-hero">
                    <h1>Шилдэг Фрилансерүүд</h1>
                    <p>Монголын хамгийн бүтээлч, чадварлаг чөлөөт уран бүтээлчидтэй холбогдож төслөө амжилттай хэрэгжүүлээрэй.</p>
                </header>

                <div className="freelancers-filters">
                    <div className="flex-1 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input 
                            type="text" 
                            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none"
                            placeholder="Фрилансер хайх (нэр, ур чадвар...)"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="filter-group">
                        {CATEGORIES.map(cat => (
                            <button 
                                key={cat}
                                className={`filter-chip ${activeCategory === cat ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="freelancers-grid">
                    {filteredFreelancers.map(f => (
                        <div key={f.id} className="freelancer-card" onClick={() => navigate(`/freelancers/${f.id}`)}>
                            <div className="card-header">
                                <img src={f.avatar} alt={f.name} className="freelancer-avatar" />
                                <div className="freelancer-info">
                                    <h3>
                                        {f.name}
                                        {f.verified && <ShieldCheck className="verified-badge" size={18} />}
                                    </h3>
                                    <div className="freelancer-title">{f.title}</div>
                                    <div className="rating-badge">
                                        <Star size={14} fill="currentColor" />
                                        {f.rating} <span>({f.reviews})</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="freelancer-skills">
                                {f.skills.map(s => <span key={s} className="skill-tag">{s}</span>)}
                            </div>

                            <div className="card-footer">
                                <div className="rate-info">
                                    <span>Rate</span>
                                    <strong>{f.rate}</strong>
                                </div>
                                <div className="text-blue-600 font-bold flex items-center gap-1 group">
                                    Profile үзэх 
                                    <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default FreelancersPage;
