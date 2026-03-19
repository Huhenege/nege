/**
 * Facebook API Service
 * Handles Meta Graph API interactions for Page Insights
 */

class FacebookService {
    constructor() {
        this.appId = import.meta.env.VITE_FB_APP_ID;
        this.isInitialized = false;
    }

    /**
     * Initialize the Facebook SDK
     */
    init() {
        return new Promise((resolve) => {
            if (this.isInitialized) return resolve();
            
            window.fbAsyncInit = () => {
                window.FB.init({
                    appId: this.appId,
                    cookie: true,
                    xfbml: true,
                    version: 'v18.0'
                });
                this.isInitialized = true;
                resolve();
            };

            // Load SDK script
            (function(d, s, id) {
                var js, fjs = d.getElementsByTagName(s)[0];
                if (d.getElementById(id)) return;
                js = d.createElement(s); js.id = id;
                js.src = "https://connect.facebook.net/en_US/sdk.js";
                fjs.parentNode.insertBefore(js, fjs);
            }(document, 'script', 'facebook-jssdk'));
        });
    }

    /**
     * Login with required business permissions
     */
    login() {
        return new Promise((resolve, reject) => {
            if (!this.appId) return reject('VITE_FB_APP_ID is missing in .env');
            if (!window.FB) return reject('Facebook SDK амжилттай ачаалагдсангүй. Хуудас дахин ачаална уу.');
            
            // First check if already logged in to prevent "overriding access token" warning
            window.FB.getLoginStatus((statusResponse) => {
                if (statusResponse.status === 'connected') {
                    return resolve(statusResponse.authResponse);
                }

                window.FB.login((response) => {
                    if (response.authResponse) {
                        resolve(response.authResponse);
                    } else {
                        console.error('Meta Login Failed. Full Response:', response);
                        let reason = 'Хэрэглэгч нэвтрэхийг цуцалсан эсвэл Browser-ийн Popup хаагдсан байна.';
                        if (response.status === 'unknown') reason = 'Браузерийн Popup блок хийгдсэн байна. Та Popups-ыг нээж өгнө үү.';
                        reject({ ...response, errorMessage: reason });
                    }
                }, {
                    scope: 'public_profile,email,pages_show_list,read_insights',
                    return_scopes: true
                });
            });
        });
    }

    /**
     * Get the list of Pages the user manages
     */
    getManagedPages() {
        return new Promise((resolve, reject) => {
            window.FB.api('/me/accounts', (response) => {
                if (response && !response.error) {
                    resolve(response.data); // Array of pages with access_tokens
                } else {
                    reject(response.error);
                }
            });
        });
    }

    /**
     * Get real insights for a specific Page
     * @param {string} pageId 
     * @param {string} pageAccessToken 
     */
    getPageInsights(pageId, pageAccessToken) {
        return new Promise((resolve, reject) => {
            // Metrics for 'day' period (Simplified for compatibility)
            const dayMetrics = [
                'page_impressions_unique', 
                'page_post_engagements'
            ].join(',');

            // First call for daily metrics
            window.FB.api(
                `/${pageId}/insights`,
                'GET',
                {
                    metric: dayMetrics,
                    period: 'day',
                    access_token: pageAccessToken
                },
                (dayResponse) => {
                    if (dayResponse && !dayResponse.error) {
                        // Second call for lifetime metrics (Followers)
                        window.FB.api(
                            `/${pageId}/insights`,
                            'GET',
                            {
                                metric: 'page_fans',
                                period: 'lifetime',
                                access_token: pageAccessToken
                            },
                            (lifetimeResponse) => {
                                if (lifetimeResponse && !lifetimeResponse.error) {
                                    const combinedData = [...dayResponse.data, ...lifetimeResponse.data];
                                    resolve(this._parseInsights(combinedData));
                                } else {
                                    // Fallback if fans fail
                                    resolve(this._parseInsights(dayResponse.data));
                                }
                            }
                        );
                    } else {
                        console.error('Meta Insights API Error:', dayResponse.error);
                        reject(dayResponse.error);
                    }
                }
            );
        });
    }

    /**
     * Helper to parse raw Graph API data into a cleaner dashboard format
     */
    _parseInsights(data) {
        const findMetric = (name) => {
            const metric = data.find(m => m.name === name);
            if (!metric || !metric.values || metric.values.length === 0) return 0;
            return metric.values[0].value || 0;
        };

        return {
            reach: { value: findMetric('page_impressions_unique').toLocaleString(), trend: 'Live', up: true },
            engagement: { value: findMetric('page_post_engagements').toLocaleString(), trend: 'Live', up: true },
            followers: { value: findMetric('page_fans').toLocaleString(), trend: 'Live', up: true },
            clicks: { value: (Math.floor(findMetric('page_post_engagements') / 15)).toLocaleString(), trend: 'Live', up: true } // Simulated clicks from engagement
        };
    }
}

export const facebookService = new FacebookService();
