import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
    Star, 
    ShieldCheck, 
    MapPin, 
    ChevronLeft, 
    Share2, 
    MessageSquare, 
    Calendar,
    Briefcase,
    CheckCircle2,
    ArrowRight
} from 'lucide-react';
import { MOCK_FREELANCERS } from './FreelancersPage';
import './Freelancers.css';

const FreelancerDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [freelancer, setFreelancer] = useState(null);
    const [bookingSuccess, setBookingSuccess] = useState(false);

    useEffect(() => {
        const found = MOCK_FREELANCERS.find(f => f.id === parseInt(id));
        setFreelancer(found);
        window.scrollTo(0, 0);
    }, [id]);

    if (!freelancer) return <div className="p-20 text-center">Loading...</div>;

    const handleHire = () => {
        setBookingSuccess(true);
        setTimeout(() => setBookingSuccess(false), 3000);
    };

    return (
        <div className="freelancer-detail">
            <header className="detail-hero">
                <div className="container">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 mb-8 hover:text-blue-600 transition-colors">
                        <ChevronLeft size={20} /> Буцах
                    </button>
                    
                    <div className="detail-header">
                        <img src={freelancer.avatar} alt={freelancer.name} className="detail-avatar" />
                        <div className="detail-main-info flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h1 className="flex items-center gap-3">
                                        {freelancer.name}
                                        {freelancer.verified && <ShieldCheck size={28} className="text-blue-600" />}
                                    </h1>
                                    <div className="text-blue-600 text-xl font-semibold mb-4">{freelancer.title}</div>
                                    <div className="flex items-center gap-6 text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <Star size={20} className="text-amber-400" fill="currentColor" />
                                            <span className="font-bold text-gray-900">{freelancer.rating}</span>
                                            <span>({freelancer.reviews} сэтгэгдэл)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <MapPin size={20} /> Улаанбаатар, Монгол
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button className="p-3 border rounded-2xl hover:bg-gray-50"><Share2 size={20} /></button>
                                    <button className="p-3 border rounded-2xl hover:bg-gray-50"><MessageSquare size={20} /></button>
                                </div>
                            </div>

                            <p className="detail-bio">{freelancer.bio}</p>

                            <div className="stats-grid">
                                <div className="stat-item">
                                    <span>Ажлын үнэлгээ</span>
                                    <strong>{freelancer.rate}</strong>
                                </div>
                                <div className="stat-item">
                                    <span>Амжилттай дууссан</span>
                                    <strong>100%</strong>
                                </div>
                                <div className="stat-item">
                                    <span>Туршлага</span>
                                    <strong>5+ жил</strong>
                                </div>
                            </div>

                            <div className="mt-8 flex gap-4">
                                <button className="btn btn-primary px-10 py-4 text-lg" onClick={handleHire}>
                                    Хамтарч ажиллах
                                </button>
                                <button className="btn btn-outline px-10 py-4 text-lg">
                                    Мессеж бичих
                                </button>
                            </div>
                            
                            {bookingSuccess && (
                                <div className="mt-4 p-4 bg-green-50 border border-green-100 text-green-700 rounded-2xl flex items-center gap-3 animate-fade-in">
                                    <CheckCircle2 size={20} />
                                    Таны хүсэлт амжилттай илгээгдлээ. Фрилансер удахгүй хариу өгөх болно.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <section className="portfolio-section container">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h2 className="text-3xl font-extrabold text-gray-900">Портфолио</h2>
                        <p className="text-gray-500 mt-2">Хийж гүйцэтгэсэн сүүлийн үеийн төслүүд</p>
                    </div>
                    <button className="text-blue-600 font-bold flex items-center gap-2">
                        Бүгдийг үзэх <ArrowRight size={18} />
                    </button>
                </div>

                <div className="portfolio-grid">
                    {freelancer.portfolio.map((img, idx) => (
                        <div key={idx} className="portfolio-item">
                            <img src={img} alt="portfolio" />
                            <div className="portfolio-overlay">
                                <h4 className="font-bold text-lg">Project Case Study #{idx + 1}</h4>
                                <p className="text-sm opacity-80 mt-1">Full process breakdown</p>
                            </div>
                        </div>
                    ))}
                    {/* Placeholder for more portfolio items */}
                    <div className="portfolio-item">
                        <img src="https://images.unsplash.com/photo-1558655146-d09347e92766?w=800&q=80" alt="portfolio" />
                        <div className="portfolio-overlay">
                            <h4 className="font-bold text-lg">Visual Brand Identity</h4>
                            <p className="text-sm opacity-80 mt-1">Client: TechCorp Inc.</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="reviews-section container border-t py-16">
                <h2 className="text-3xl font-extrabold text-gray-900 mb-10">Сэтгэгдэлүүд</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[1, 2].map(r => (
                        <div key={r} className="p-8 bg-gray-50 rounded-3xl border border-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-3 items-center">
                                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600">
                                        C{r}
                                    </div>
                                    <div>
                                        <div className="font-bold">Client Name #{r}</div>
                                        <div className="text-xs text-gray-400">March 2024</div>
                                    </div>
                                </div>
                                <div className="flex gap-1 text-amber-400">
                                    <Star size={14} fill="currentColor" />
                                    <Star size={14} fill="currentColor" />
                                    <Star size={14} fill="currentColor" />
                                    <Star size={14} fill="currentColor" />
                                    <Star size={14} fill="currentColor" />
                                </div>
                            </div>
                            <p className="text-gray-600 text-sm leading-relaxed">
                                "Маш сайн ажилласан. Төлөвлөгөөний дагуу бүх зүйлийг чанарын өндөр түвшинд гүйцэтгэж өгсөн. Цаашид дахин хамтран ажиллахдаа таатай байх болно."
                            </p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default FreelancerDetailPage;
