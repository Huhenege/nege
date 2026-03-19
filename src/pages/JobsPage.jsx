import React, { useState, useMemo } from 'react';
import { 
    Search, 
    MapPin, 
    Briefcase, 
    Clock, 
    Filter, 
    ChevronRight, 
    X, 
    CheckCircle2,
    Building2,
    DollarSign,
    Sparkles,
    Upload
} from 'lucide-react';
import './JobsPage.css';

const MOCK_JOBS = [
    {
        id: 'j1',
        title: 'Senior Frontend Developer',
        company: 'Unitel Group',
        location: 'Ulaanbaatar, MN',
        type: 'Full-time',
        level: 'Senior',
        salary: '4M - 6M ₮',
        postedAt: '2 days ago',
        category: 'Software Engineering',
        tags: ['React', 'TypeScript', 'Tailwind'],
        description: 'We are looking for a Senior Frontend Developer to lead our next-gen digital experience platform. You will work with cutting-edge technologies and impact millions of users.',
        requirements: [
            '5+ years of experience with modern React',
            'Strong understanding of UI/UX principles',
            'Experience with state management (Redux/Zustand)',
            'Leadership skills'
        ]
    },
    {
        id: 'j2',
        title: 'Financial Analyst',
        company: 'Khan Bank',
        location: 'Ulaanbaatar, MN',
        type: 'Full-time',
        level: 'Mid-level',
        salary: '2.5M - 3.5M ₮',
        postedAt: '5 hours ago',
        category: 'Finance',
        tags: ['Excel', 'Analysis', 'Bonds'],
        description: 'Join the leading bank in Mongolia as a Financial Analyst. You will be responsible for market research, financial modeling, and reporting.',
        requirements: [
            'Degree in Finance or Accounting',
            'Strong analytical skills',
            'Proficiency in Excel and Data Visualization tools'
        ]
    },
    {
        id: 'j3',
        title: 'Digital Marketing Manager',
        company: 'MCS Coca-Cola',
        location: 'Ulaanbaatar, MN',
        type: 'Full-time',
        level: 'Senior',
        salary: '3M - 4.5M ₮',
        postedAt: '1 week ago',
        category: 'Marketing',
        tags: ['Google Ads', 'Content', 'Analytics'],
        description: 'Drive the digital strategy of Mongolia\'s most iconic FMCG brand. Manage multi-channel campaigns and optimize for maximum engagement.',
        requirements: [
            'Proven experience in digital marketing',
            'Data-driven mindset',
            'Excellent communication skills'
        ]
    },
    {
        id: 'j4',
        title: 'Product Designer (UI/UX)',
        company: 'Nege AI',
        location: 'Remote / HQ',
        type: 'Contract',
        level: 'Junior-Mid',
        salary: '2.5M - 4M ₮',
        postedAt: 'Newly published',
        category: 'Design',
        tags: ['Figma', 'System Design', 'Components'],
        description: 'Help us redefine how AI workflows work. You will be the sole designer initially, building out our design system and core product interface.',
        requirements: [
            'Strong portfolio showcasing mobile/web products',
            'Deep expertise in Figma',
            'Passion for AI and productivity tools'
        ]
    },
    {
        id: 'j5',
        title: 'Accountant',
        company: 'Tavan Bogd Group',
        location: 'Ulaanbaatar, MN',
        type: 'Full-time',
        level: 'Mid-level',
        salary: '2M - 3M ₮',
        postedAt: '3 days ago',
        category: 'Finance',
        tags: ['Inventory', 'Taxes', 'Audit'],
        description: 'Manage our accounts and ensure compliance with Mongolian tax laws. You will be part of a dynamic and large accounting team.',
        requirements: [
            'CPA or equivalent is a plus',
            'Knowledge of local accounting software',
            'Organized and detail-oriented'
        ]
    }
];

const CATEGORIES = ['Software Engineering', 'Finance', 'Marketing', 'Design', 'Sales', 'Operations'];
const TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship'];

const JobsPage = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedJob, setSelectedJob] = useState(null);
    const [isApplying, setIsApplying] = useState(false);
    const [applySuccess, setApplySuccess] = useState(false);

    const filteredJobs = useMemo(() => {
        return MOCK_JOBS.filter(job => {
            const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 job.company.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCategory = selectedCategory === 'All' || job.category === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [searchQuery, selectedCategory]);

    const handleApply = (e) => {
        e.stopPropagation();
        setIsApplying(true);
        // Simulate upload/process
        setTimeout(() => {
            setIsApplying(false);
            setApplySuccess(true);
            setTimeout(() => {
                setApplySuccess(false);
                setSelectedJob(null);
            }, 3000);
        }, 1500);
    };

    return (
        <div className="jobs-page">
            <div className="jobs-page__glow jobs-page__glow--one" aria-hidden="true" />
            <div className="jobs-page__glow jobs-page__glow--two" aria-hidden="true" />

            <div className="container jobs-container">
                <section className="jobs-hero">
                    <span className="jobs-hero__eyebrow">
                        <Sparkles size={14} />
                        Career Opportunities
                    </span>
                    <h1 className="jobs-hero__title">
                        Өөрийн <span>мөрөөдлийн</span> ажлаа ол
                    </h1>
                    <p className="jobs-hero__subtitle">
                        Монголын шилдэг технологийн болон бизнесийн байгууллагуудад нээлттэй буй ажлын байрны зарууд.
                    </p>

                    <div className="jobs-search">
                        <div className="search-input-group">
                            <Search size={20} />
                            <input 
                                type="text" 
                                placeholder="Албан тушаал, компани..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="search-input-group">
                            <MapPin size={20} />
                            <input type="text" placeholder="Байршил" defaultValue="Улаанбаатар" />
                        </div>
                        <button className="btn btn-primary">Хайх</button>
                    </div>
                </section>

                <div className="jobs-content">
                    <aside className="jobs-sidebar">
                        <div className="filter-section">
                            <h3>Category</h3>
                            <div className="filter-list">
                                <label className="filter-item">
                                    <input 
                                        type="radio" 
                                        name="category" 
                                        checked={selectedCategory === 'All'}
                                        onChange={() => setSelectedCategory('All')}
                                    />
                                    All Categories
                                </label>
                                {CATEGORIES.map(cat => (
                                    <label key={cat} className="filter-item">
                                        <input 
                                            type="radio" 
                                            name="category" 
                                            checked={selectedCategory === cat}
                                            onChange={() => setSelectedCategory(cat)}
                                        />
                                        {cat}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="filter-section">
                            <h3>Job Type</h3>
                            <div className="filter-list">
                                {TYPES.map(type => (
                                    <label key={type} className="filter-item">
                                        <input type="checkbox" defaultChecked />
                                        {type}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </aside>

                    <main className="jobs-list">
                        <div className="jobs-count">
                            <p>Showing <strong>{filteredJobs.length}</strong> available jobs</p>
                        </div>

                        {filteredJobs.map(job => (
                            <div key={job.id} className="job-card" onClick={() => setSelectedJob(job)}>
                                <div className="job-card__logo">
                                    <Building2 size={32} strokeWidth={1.5} className="text-brand-500" />
                                </div>
                                <div className="job-card__main">
                                    <div className="job-card__header">
                                        <h3 className="job-card__title">{job.title}</h3>
                                        <div className="job-tags">
                                            {job.tags.slice(0, 2).map(tag => (
                                                <span key={tag} className="job-tag">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <p className="job-card__company">{job.company}</p>
                                    <div className="job-card__meta">
                                        <div className="job-card__meta-item">
                                            <MapPin size={14} /> {job.location}
                                        </div>
                                        <div className="job-card__meta-item">
                                            <Briefcase size={14} /> {job.type}
                                        </div>
                                        <div className="job-card__meta-item">
                                            <Clock size={14} /> {job.postedAt}
                                        </div>
                                        <div className="job-card__meta-item">
                                            <DollarSign size={14} /> {job.salary}
                                        </div>
                                    </div>
                                </div>
                                <div className="job-card__actions">
                                    <ChevronRight size={20} className="text-ink-300" />
                                    <button className="apply-btn" onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedJob(job);
                                    }}>Харах</button>
                                </div>
                            </div>
                        ))}
                    </main>
                </div>
            </div>

            {/* Job Detail/Application Modal */}
            {selectedJob && (
                <div className="job-modal-overlay" onClick={() => !isApplying && setSelectedJob(null)}>
                    <div className="job-modal" onClick={e => e.stopPropagation()}>
                        <button className="job-modal__close" onClick={() => setSelectedJob(null)}>
                            <X size={20} />
                        </button>
                        
                        <div className="job-modal__content">
                            <div className="job-modal__header">
                                <div className="job-card__logo" style={{ marginBottom: '1.5rem' }}>
                                    <Building2 size={40} className="text-brand-500" />
                                </div>
                                <h2 className="jobs-hero__title" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                                    {selectedJob.title}
                                </h2>
                                <p className="job-card__company" style={{ fontSize: '1.2rem' }}>{selectedJob.company}</p>
                                <div className="job-card__meta" style={{ marginTop: '1rem' }}>
                                    <span className="job-tag primary">{selectedJob.type}</span>
                                    <span className="job-tag">{selectedJob.level}</span>
                                    <span className="job-card__meta-item"><MapPin size={16} /> {selectedJob.location}</span>
                                    <span className="job-card__meta-item"><DollarSign size={16} /> {selectedJob.salary}</span>
                                </div>
                            </div>

                            <div className="job-modal__body">
                                <h4>Job Description</h4>
                                <p>{selectedJob.description}</p>
                                
                                <h4>Requirements</h4>
                                <ul>
                                    {selectedJob.requirements.map((req, i) => (
                                        <li key={i}>{req}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        <div className="job-modal__footer">
                            <div className="application-status">
                                {applySuccess ? (
                                    <div className="flex items-center gap-2 text-success-600 font-bold">
                                        <CheckCircle2 size={20} /> CV Амжилттай илгээгдлээ
                                    </div>
                                ) : (
                                    <span className="text-ink-500 text-sm">Upload your latest CV in PDF format</span>
                                )}
                            </div>
                            <div className="flex gap-4">
                                {!applySuccess && (
                                    <button 
                                        className={`btn btn-primary ${isApplying ? 'loading' : ''}`}
                                        onClick={handleApply}
                                        disabled={isApplying}
                                    >
                                        {isApplying ? (
                                            <>Processing...</>
                                        ) : (
                                            <>
                                                <Upload size={18} style={{ marginRight: '8px' }} />
                                                Apply with CV
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JobsPage;
