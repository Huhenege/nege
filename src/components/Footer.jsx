import { Mail, Phone, ShieldCheck, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import './Footer.css';

const Footer = () => {
    return (
        <footer className="footer">
            <div className="footer-container">
                <div className="footer-brand">
                    <Logo className="footer-logo" style={{ height: '32px', width: 'auto' }} />
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
                            <span>+976 88104099</span>
                        </li>
                    </ul>
                </div>
                <div className="footer-legal">
                    <h4 className="footer-title">Хууль эрх зүй</h4>
                    <ul className="contact-list">
                        <li>
                            <ShieldCheck size={18} />
                            <Link to="/privacy">Нууцлалын бодлого</Link>
                        </li>
                        <li>
                            <FileText size={18} />
                            <Link to="/terms">Үйлчилгээний нөхцөл</Link>
                        </li>
                    </ul>
                </div>
            </div>

            <div className="footer-bottom">
                <p>&copy; {new Date().getFullYear()} Huhe Nege. Бүх эрх хуулиар хамгаалагдсан.</p>
            </div>
        </footer>
    );
};

export default Footer;
