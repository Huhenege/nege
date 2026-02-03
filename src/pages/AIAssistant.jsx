import React from 'react';
import { Link } from 'react-router-dom';

const AIAssistant = () => {
    return (
        <div className="container" style={{ padding: '4rem 2rem' }}>
            <h1 className="text-3xl font-bold mb-8 text-center text-primary-900">AI Туслах</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Link to="/ai-assistant/account-statement-organizer" className="block group">
                    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-100 h-full">
                        <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary-500 transition-colors">
                            <span className="text-2xl group-hover:text-white transition-colors">📄</span>
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-gray-800">Дансны хуулга цэгцлэгч</h3>
                        <p className="text-gray-600 text-sm">
                            Банкны хуулгаа оруулж, автоматаар ангилан цэгцлэх AI хэрэгсэл.
                        </p>
                    </div>
                </Link>

                <Link to="/ai-assistant/social-insurance-holiday" className="block group">
                    <div className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all border border-gray-100 h-full">
                        <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-amber-500 transition-colors">
                            <span className="text-2xl group-hover:text-white transition-colors">🕒</span>
                        </div>
                        <h3 className="text-xl font-bold mb-2 text-gray-800">НДШ-ээс амралтын өдөр тооцоолох</h3>
                        <p className="text-gray-600 text-sm">
                            Нийгмийн даатгалын шимтгэл дээр үндэслэн ээлжийн амралтын хоногийг тооцоолох.
                        </p>
                    </div>
                </Link>
            </div>
        </div>
    );
};

export default AIAssistant;
