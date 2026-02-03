import React from 'react';
import { Phone, Mail, Globe, Facebook } from 'lucide-react';

const CTA = () => {
    return (
        <>
            <section className="home-section home-section--alt" id="contact">
                <div className="home-container">
                    <div className="home-cta">
                        <div>
                            <span className="home-eyebrow">Холбогдох</span>
                            <h2 className="home-section-title">Ирээдүйг илүү тодорхой бүтээцгээе.</h2>
                            <p className="home-section-subtitle">
                                Танд тохирсон AI шийдлийг хамтдаа хөгжүүлье.
                            </p>
                        </div>
                        <div className="home-cta-grid">
                            <a href="tel:88104099" className="home-cta-card">
                                <Phone size={18} />
                                <span>8810 4099</span>
                            </a>
                            <a href="mailto:hello@nege.mn" className="home-cta-card">
                                <Mail size={18} />
                                <span>hello@nege.mn</span>
                            </a>
                            <a href="https://facebook.com/nege.mn" target="_blank" rel="noopener noreferrer" className="home-cta-card">
                                <Facebook size={18} />
                                <span>facebook.com/nege.mn</span>
                            </a>
                            <a href="https://www.nege.mn" target="_blank" rel="noopener noreferrer" className="home-cta-card">
                                <Globe size={18} />
                                <span>www.nege.mn</span>
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <footer className="home-footer">
                <div className="home-container">
                    <p>© {new Date().getFullYear()} NEGE. All rights reserved.</p>
                </div>
            </footer>
        </>
    );
};

export default CTA;
