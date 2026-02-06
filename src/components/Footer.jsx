import React from 'react';
import { Mail, Phone, MapPin, Facebook, Instagram, Twitter } from 'lucide-react';
import Logo from './Logo';
import './Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-brand">
                    <Logo style={{ height: '32px', width: 'auto', marginBottom: '1.5rem' }} />
                    <p className="footer-tagline">
                        Нэг логик, нэг шийдэл.
                        Бизнесийн үйл ажиллагааг хялбарчлах AI туслах.
                    </p>
                </div>

                <div className="footer-contact" id="contact">
                    <h4 className="footer-title">Холбоо барих</h4>
                    <ul className="contact-list">
                        <li>
                            <Mail size={18} />
                            <span>info@nege.mn</span>
                        </li>
                        <li>
                            <Phone size={18} />
                            <span>+976 8800-XXXX</span>
                        </li>
                        <li>
                            <MapPin size={18} />
                            <span>Улаанбаатар хот, Сүхбаатар дүүрэг</span>
                        </li>
                    </ul>
                </div>

                <div className="footer-social">
                    <h4 className="footer-title">Биднийг дагах</h4>
                    <div className="social-links">
                        <a href="https://facebook.com/nege.mn" target="_blank" rel="noopener noreferrer" className="social-icon">
                            <Facebook size={20} />
                        </a>
                        <a href="https://instagram.com/nege.mn" target="_blank" rel="noopener noreferrer" className="social-icon">
                            <Instagram size={20} />
                        </a>
                        <a href="#" className="social-icon">
                            <Twitter size={20} />
                        </a>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} Huhe Nege. Бүх эрх хуулиар хамгаалагдсан.</p>
            </div>
        </footer>
    );
};

export default Footer;
