import React, { useState, useMemo } from 'react';
import { 
    User, 
    Briefcase, 
    GraduationCap, 
    Wrench, 
    Plus, 
    Trash2, 
    Download, 
    FileText,
    Mail,
    Phone,
    MapPin,
    Globe,
    ChevronLeft,
    CheckCircle2,
    Calendar,
    Layout
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './MyCVPage.css';

const STEPS = [
    { id: 'personal', label: 'Хувийн мэдээлэл', icon: <User size={20} /> },
    { id: 'experience', label: 'Ажлын туршлага', icon: <Briefcase size={20} /> },
    { id: 'education', label: 'Боловсрол', icon: <GraduationCap size={20} /> },
    { id: 'skills', label: 'Ур чадвар', icon: <Wrench size={20} /> }
];

const MyCVPage = () => {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState('personal');
    
    // Initial State
    const [cvData, setCvData] = useState({
        personalInfo: {
            fullName: 'Жамбалын Бат-Эрдэнэ',
            title: 'Senior Frontend Developer',
            email: 'bat-erdene@example.mn',
            phone: '9911-XXXX',
            location: 'Улаанбаатар, Монгол',
            website: 'linkedin.com/in/bat-erdene',
            summary: 'Технологийн салбарт 5-аас дээш жил ажилласан туршлагатай Frontend хөгжүүлэгч. React, TypeScript болон орчин үеийн вэб технологиудыг ашиглан цар хүрээ ихтэй төслүүдийг амжилттай хэрэгжүүлж байсан туршлагатай.'
        },
        experience: [
            {
                id: 1,
                role: 'Senior Developer',
                company: 'Unitel Group',
                date: '2021 - Одоо',
                description: 'Дижитал шилжилтийн хүрээнд шинэ төрлийн аппликейшнүүдийн Frontend архитектурыг хариуцан ажиллаж байна.'
            }
        ],
        education: [
            {
                id: 1,
                degree: 'Мэдээлэл Технологийн Инженер',
                school: 'ШУТИС-МХТС',
                date: '2014 - 2018',
                description: 'Программ хангамжийн чиглэлээр бакалаврын зэрэг хамгаалсан.'
            }
        ],
        skills: ['React', 'TypeScript', 'Node.js', 'UI/UX Design', 'Agile']
    });

    const calculateProgress = useMemo(() => {
        let score = 0;
        if (cvData.personalInfo.fullName) score += 25;
        if (cvData.experience.length > 0) score += 25;
        if (cvData.education.length > 0) score += 25;
        if (cvData.skills.length > 0) score += 25;
        return score;
    }, [cvData]);

    const handlePersonalInfoChange = (e) => {
        const { name, value } = e.target;
        setCvData(prev => ({
            ...prev,
            personalInfo: { ...prev.personalInfo, [name]: value }
        }));
    };

    const updateArrayItem = (section, id, field, value) => {
        setCvData(prev => ({
            ...prev,
            [section]: prev[section].map(item => 
                item.id === id ? { ...item, [field]: value } : item
            )
        }));
    };

    const addArrayItem = (section) => {
        const newItem = section === 'experience' 
            ? { id: Date.now(), role: '', company: '', date: '', description: '' }
            : { id: Date.now(), degree: '', school: '', date: '', description: '' };
        
        setCvData(prev => ({
            ...prev,
            [section]: [...prev[section], newItem]
        }));
    };

    const removeArrayItem = (section, id) => {
        setCvData(prev => ({
            ...prev,
            [section]: prev[section].filter(item => item.id !== id)
        }));
    };

    const handleSkillChange = (index, value) => {
        setCvData(prev => {
            const newSkills = [...prev.skills];
            newSkills[index] = value;
            return { ...prev, skills: newSkills };
        });
    };

    const addSkill = () => {
        setCvData(prev => ({ ...prev, skills: [...prev.skills, ''] }));
    };

    const removeSkill = (index) => {
        setCvData(prev => ({ 
            ...prev, 
            skills: prev.skills.filter((_, i) => i !== index) 
        }));
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="cv-builder">
            <header className="cv-builder__header">
                <div className="container cv-builder__header-inner">
                    <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm">
                        <ChevronLeft size={18} /> Буцах
                    </button>
                    <h2 className="flex items-center gap-2 font-bold text-gray-900">
                        <FileText size={22} className="text-blue-600" />
                        Миний CV бүтээгч
                    </h2>
                    <div className="flex items-center gap-3">
                        <button className="btn btn-outline btn-sm">
                            <Layout size={16} style={{ marginRight: '6px' }} /> Загвар солих
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={handlePrint}>
                            <Download size={16} style={{ marginRight: '8px' }} /> PDF татах
                        </button>
                    </div>
                </div>
            </header>

            <div className="cv-builder__content">
                {/* Stepper Sidebar */}
                <aside className="cv-builder__sidebar">
                    <div className="mb-6 px-2">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">CV-ний бүрдэл</span>
                            <span className="text-xs font-bold text-blue-600">{calculateProgress}%</span>
                        </div>
                        <div className="progress-container">
                            <div className="progress-bar" style={{ width: `${calculateProgress}%` }}></div>
                        </div>
                    </div>
                    
                    {STEPS.map(step => (
                        <div 
                            key={step.id} 
                            className={`stepper-item ${activeSection === step.id ? 'active' : ''}`}
                            onClick={() => setActiveSection(step.id)}
                        >
                            <div className="stepper-icon">
                                {step.icon}
                            </div>
                            <div className="stepper-info">
                                <span className="stepper-label">{step.label}</span>
                                <span className="stepper-status">Бүрэн бөглөсөн</span>
                            </div>
                            {step.id === 'personal' && cvData.personalInfo.fullName && <CheckCircle2 size={16} className="ml-auto text-blue-600" />}
                        </div>
                    ))}
                </aside>

                {/* Main Form Pane */}
                <main className="cv-builder__form-pane">
                    {/* PERSONAL INFO */}
                    {activeSection === 'personal' && (
                        <div className="animate-fade-in-up">
                            <div className="section-head">
                                <h2>Хувийн мэдээлэл</h2>
                                <p>Ажил олгогчид тантай холбогдох боломжийг бүрдүүлээрэй.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-x-6">
                                <div className="modern-field col-span-2">
                                    <label>Бүтэн нэр</label>
                                    <div className="input-wrapper">
                                        <User size={18} />
                                        <input 
                                            type="text" 
                                            name="fullName" 
                                            className="modern-input"
                                            placeholder="Ж: Доржийн Бат"
                                            value={cvData.personalInfo.fullName} 
                                            onChange={handlePersonalInfoChange} 
                                        />
                                    </div>
                                </div>
                                <div className="modern-field col-span-2">
                                    <label>Албан тушаал / Мэргэжил</label>
                                    <div className="input-wrapper">
                                        <Briefcase size={18} />
                                        <input 
                                            type="text" 
                                            name="title" 
                                            className="modern-input"
                                            placeholder="Ж: Ахлах хөгжүүлэгч"
                                            value={cvData.personalInfo.title} 
                                            onChange={handlePersonalInfoChange} 
                                        />
                                    </div>
                                </div>
                                <div className="modern-field">
                                    <label>Имэйл хаяг</label>
                                    <div className="input-wrapper">
                                        <Mail size={18} />
                                        <input 
                                            type="email" 
                                            name="email" 
                                            className="modern-input"
                                            placeholder="example@mail.mn"
                                            value={cvData.personalInfo.email} 
                                            onChange={handlePersonalInfoChange} 
                                        />
                                    </div>
                                </div>
                                <div className="modern-field">
                                    <label>Утасны дугаар</label>
                                    <div className="input-wrapper">
                                        <Phone size={18} />
                                        <input 
                                            type="text" 
                                            name="phone" 
                                            className="modern-input"
                                            placeholder="9911-XXXX"
                                            value={cvData.personalInfo.phone} 
                                            onChange={handlePersonalInfoChange} 
                                        />
                                    </div>
                                </div>
                                <div className="modern-field col-span-2">
                                    <label>Товч танилцуулга</label>
                                    <textarea 
                                        name="summary" 
                                        rows="6"
                                        className="modern-textarea"
                                        placeholder="Өөрийн мэргэжлийн давуу тал, туршлага болон зорилгоо товч бичээрэй..."
                                        value={cvData.personalInfo.summary} 
                                        onChange={handlePersonalInfoChange}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EXPERIENCE */}
                    {activeSection === 'experience' && (
                        <div className="animate-fade-in-up">
                            <div className="section-head">
                                <h2>Ажлын туршлага</h2>
                                <p>Хамгийн сүүлийн ажилласан газраас эхлэн бичээрэй.</p>
                            </div>

                            {cvData.experience.map((item, idx) => (
                                <div key={item.id} className="entry-card">
                                    <button className="entry-card__remove" onClick={() => removeArrayItem('experience', item.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="modern-field">
                                            <label>Албан тушаал</label>
                                            <input 
                                                type="text" 
                                                className="modern-input"
                                                style={{ paddingLeft: '1rem' }}
                                                value={item.role} 
                                                onChange={(e) => updateArrayItem('experience', item.id, 'role', e.target.value)} 
                                            />
                                        </div>
                                        <div className="modern-field">
                                            <label>Байгууллага / Компани</label>
                                            <input 
                                                type="text" 
                                                className="modern-input"
                                                style={{ paddingLeft: '1rem' }}
                                                value={item.company} 
                                                onChange={(e) => updateArrayItem('experience', item.id, 'company', e.target.value)} 
                                            />
                                        </div>
                                        <div className="modern-field col-span-2">
                                            <label>Ажилласан хугацаа</label>
                                            <div className="input-wrapper">
                                                <Calendar size={18} />
                                                <input 
                                                    type="text" 
                                                    className="modern-input"
                                                    placeholder="2020 - Одоо"
                                                    value={item.date} 
                                                    onChange={(e) => updateArrayItem('experience', item.id, 'date', e.target.value)} 
                                                />
                                            </div>
                                        </div>
                                        <div className="modern-field col-span-2">
                                            <label>Хийж гүйцэтгэсэн ажил</label>
                                            <textarea 
                                                rows="4"
                                                className="modern-textarea"
                                                value={item.description} 
                                                onChange={(e) => updateArrayItem('experience', item.id, 'description', e.target.value)} 
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button className="add-btn" onClick={() => addArrayItem('experience')}>
                                <Plus size={18} /> Туршлага нэмэх
                            </button>
                        </div>
                    )}

                    {/* EDUCATION */}
                    {activeSection === 'education' && (
                        <div className="animate-fade-in-up">
                            <div className="section-head">
                                <h2>Боловсрол</h2>
                                <p>Төгссөн сургууль, курсуудаа нэмээрэй.</p>
                            </div>

                            {cvData.education.map(item => (
                                <div key={item.id} className="entry-card">
                                    <button className="entry-card__remove" onClick={() => removeArrayItem('education', item.id)}>
                                        <Trash2 size={16} />
                                    </button>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="modern-field">
                                            <label>Мэргэжил / Зэрэг</label>
                                            <input 
                                                type="text" 
                                                className="modern-input"
                                                style={{ paddingLeft: '1rem' }}
                                                value={item.degree} 
                                                onChange={(e) => updateArrayItem('education', item.id, 'degree', e.target.value)} 
                                            />
                                        </div>
                                        <div className="modern-field">
                                            <label>Сургууль</label>
                                            <input 
                                                type="text" 
                                                className="modern-input"
                                                style={{ paddingLeft: '1rem' }}
                                                value={item.school} 
                                                onChange={(e) => updateArrayItem('education', item.id, 'school', e.target.value)} 
                                            />
                                        </div>
                                        <div className="modern-field col-span-2">
                                            <label>Сурсан хугацаа</label>
                                            <div className="input-wrapper">
                                                <Calendar size={18} />
                                                <input 
                                                    type="text" 
                                                    className="modern-input"
                                                    value={item.date} 
                                                    onChange={(e) => updateArrayItem('education', item.id, 'date', e.target.value)} 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button className="add-btn" onClick={() => addArrayItem('education')}>
                                <Plus size={18} /> Боловсрол нэмэх
                            </button>
                        </div>
                    )}

                    {/* SKILLS */}
                    {activeSection === 'skills' && (
                        <div className="animate-fade-in-up">
                            <div className="section-head">
                                <h2>Ур чадвар</h2>
                                <p>Та өөрийн гол давуу тал болон техникийн ур чадваруудаа нэмээрэй.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {cvData.skills.map((skill, index) => (
                                    <div key={index} className="input-wrapper bg-gray-50 border rounded-xl overflow-hidden focus-within:border-blue-500 transition-all">
                                        <input 
                                            className="w-full border-none bg-transparent p-3 text-sm focus:ring-0"
                                            value={skill}
                                            onChange={(e) => handleSkillChange(index, e.target.value)}
                                            placeholder="Ур чадвар нэмэх"
                                        />
                                        <button onClick={() => removeSkill(index)} className="p-3 text-gray-400 hover:text-red-500">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button className="add-btn mt-6" onClick={addSkill}>
                                <Plus size={18} /> Ур чадвар нэмэх
                            </button>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="nav-buttons">
                        <button 
                            className="btn btn-ghost" 
                            disabled={activeSection === 'personal'}
                            onClick={() => {
                                const idx = STEPS.findIndex(s => s.id === activeSection);
                                setActiveSection(STEPS[idx-1].id);
                                document.querySelector('.cv-builder__form-pane').scrollTo(0,0);
                            }}
                        >
                            Өмнөх
                        </button>
                        {activeSection !== 'skills' ? (
                            <button 
                                className="btn btn-primary"
                                onClick={() => {
                                    const idx = STEPS.findIndex(s => s.id === activeSection);
                                    setActiveSection(STEPS[idx+1].id);
                                    document.querySelector('.cv-builder__form-pane').scrollTo(0,0);
                                }}
                            >
                                Дараах
                            </button>
                        ) : (
                            <button className="btn btn-primary" onClick={handlePrint}>
                                <Download size={18} style={{ marginRight: '8px' }} /> Дуусгах & Татах
                            </button>
                        )}
                    </div>
                </main>

                {/* Enhanced Preview Pane */}
                <aside className="cv-builder__preview-pane">
                    <div className="resume-paper" id="resume-preview">
                        <header className="resume-header">
                            <h1 className="resume-name">{cvData.personalInfo.fullName}</h1>
                            <p className="resume-title">{cvData.personalInfo.title}</p>
                            <div className="resume-contact mt-4 flex gap-x-6 gap-y-2 flex-wrap text-sm text-gray-600">
                                {cvData.personalInfo.email && <span className="flex items-center gap-2"><Mail size={14}/> {cvData.personalInfo.email}</span>}
                                {cvData.personalInfo.phone && <span className="flex items-center gap-2"><Phone size={14}/> {cvData.personalInfo.phone}</span>}
                                {cvData.personalInfo.location && <span className="flex items-center gap-2"><MapPin size={14}/> {cvData.personalInfo.location}</span>}
                            </div>
                        </header>

                        {cvData.personalInfo.summary && (
                            <section>
                                <h2 className="resume-section-title">Мэргэжлийн хураангуй</h2>
                                <p className="text-gray-800 leading-relaxed whitespace-pre-line">{cvData.personalInfo.summary}</p>
                            </section>
                        )}

                        {cvData.experience.length > 0 && cvData.experience[0].role && (
                            <section>
                                <h2 className="resume-section-title">Ажлын туршлага</h2>
                                {cvData.experience.map(item => (
                                    <div key={item.id} className="mb-6 last:mb-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="text-lg font-bold text-gray-900">{item.role}</span>
                                            <span className="text-sm font-semibold text-gray-500">{item.date}</span>
                                        </div>
                                        <div className="text-blue-600 font-bold mb-2">{item.company}</div>
                                        <p className="text-gray-700 whitespace-pre-line text-sm leading-relaxed">{item.description}</p>
                                    </div>
                                ))}
                            </section>
                        )}

                        {cvData.education.length > 0 && cvData.education[0].degree && (
                            <section>
                                <h2 className="resume-section-title">Боловсрол</h2>
                                {cvData.education.map(item => (
                                    <div key={item.id} className="mb-4 last:mb-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="font-bold text-gray-900 text-lg">{item.degree}</span>
                                            <span className="text-sm font-semibold text-gray-500">{item.date}</span>
                                        </div>
                                        <div className="text-gray-700 font-semibold">{item.school}</div>
                                    </div>
                                ))}
                            </section>
                        )}

                        {cvData.skills.length > 0 && cvData.skills[0] && (
                            <section>
                                <h2 className="resume-section-title">Ур чадвар</h2>
                                <div className="skill-grid">
                                    {cvData.skills.filter(s => s.trim() !== '').map((skill, index) => (
                                        <span key={index} className="skill-tag">{skill}</span>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};

export default MyCVPage;
