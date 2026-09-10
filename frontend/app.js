// Global State
let dashboardData = null;
let completenessChart = null;
let industryChart = null;
let metricsChart = null;

// Tab Management
const tabs = {
    'dashboard': { title: 'Dashboard Overview', subtitle: 'System statistics and dataset trends' },
    'scanner': { title: 'Real-time Job Scanner', subtitle: 'Analyze job postings for fraudulent indicators' },
    'model-hub': { title: 'Model Performance Hub', subtitle: 'Classifier benchmarks and evaluation metrics' },
    'about': { title: 'About the Detection System', subtitle: 'Architecture, methodology, and tech stack' }
};

document.addEventListener('DOMContentLoaded', () => {
    initTabNavigation();
    loadDashboardData();
    initFormHandlers();
    initSampleButtons();
});

// Switch tabs smoothly
function initTabNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    const quickScanBtn = document.getElementById('quick-scan-btn');

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Toggle active buttons
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Toggle active panes
            tabPanes.forEach(pane => {
                pane.classList.remove('active');
                if (pane.id === `tab-${tabId}`) {
                    pane.classList.add('active');
                }
            });

            // Update Titles
            if (tabs[tabId]) {
                pageTitle.textContent = tabs[tabId].title;
                pageSubtitle.textContent = tabs[tabId].subtitle;
            }

            // Render charts if switching to tabs that need them
            if (tabId === 'dashboard') {
                renderDashboardCharts();
            } else if (tabId === 'model-hub') {
                renderModelHubCharts();
            }
        });
    });

    // Quick Scan shortcut button in header
    quickScanBtn.addEventListener('click', () => {
        const scannerBtn = document.querySelector('[data-tab="scanner"]');
        if (scannerBtn) scannerBtn.click();
    });
}

// Fetch dataset stats from FastAPI backend
async function loadDashboardData() {
    try {
        const response = await fetch('/api/stats');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        dashboardData = await response.json();
        
        // Populate numerical statistics
        document.getElementById('stat-total').textContent = dashboardData.summary.total_postings.toLocaleString();
        document.getElementById('stat-genuine').textContent = dashboardData.summary.real_count.toLocaleString();
        document.getElementById('stat-fraud').textContent = dashboardData.summary.fake_count.toLocaleString();
        document.getElementById('stat-accuracy').textContent = `${(dashboardData.model_comparison['Random Forest'].accuracy * 100).toFixed(2)}%`;
        
        // Render keyword cloud
        renderKeywordCloud();
        
        // Render charts for the active dashboard tab
        renderDashboardCharts();
    } catch (error) {
        console.error('Error fetching dashboard statistics:', error);
        // Fallback to offline mock data if backend not fully up
        setupMockData();
        renderKeywordCloud();
        renderDashboardCharts();
    }
}

// Setup fallback mock data if fetch fails
function setupMockData() {
    dashboardData = {
        summary: { total_postings: 17880, real_count: 17014, fake_count: 866, fake_percentage: 4.84 },
        metadata_impacts: {
            logo_impact: { with_logo_fake_rate: 0.021, without_logo_fake_rate: 0.138 },
            questions_impact: { with_questions_fake_rate: 0.018, without_questions_fake_rate: 0.076 },
            telecommuting_impact: { remote_fake_rate: 0.082, onsite_fake_rate: 0.041 }
        },
        top_fake_industries: { "Oil & Energy": 109, "Financial Services": 85, "Marketing and Advertising": 74, "Customer Service": 68, "Information Technology and Services": 62 },
        top_fake_functions: { "Administrative": 115, "Customer Service": 102, "Sales": 92, "Engineering": 71, "Marketing": 58 },
        top_suspicious_words: ["earn", "investment", "unlimited", "money", "immediate", "financial", "cash", "payroll", "deposit", "post", "typing", "commission", "package", "flexible", "income", "processing", "opportunity", "startup", "hire", "representative"],
        top_genuine_words: ["experience", "development", "require", "team", "client", "service", "work", "technical", "engineering", "support", "design", "manage", "role", "system", "business", "application", "technology", "professional", "qualification", "degree"],
        model_comparison: {
            "Random Forest": { accuracy: 0.9790, f1_fraud: 0.7232, roc_auc: 0.9883 },
            "Logistic Regression": { accuracy: 0.9614, f1_fraud: 0.6906, roc_auc: 0.9894 },
            "Naive Bayes": { accuracy: 0.9597, f1_fraud: 0.4375, roc_auc: 0.9293 }
        }
    };
}

// Render word lists with score styles
function renderKeywordCloud() {
    const cloudContainer = document.getElementById('keyword-cloud');
    if (!cloudContainer || !dashboardData) return;

    cloudContainer.innerHTML = '';
    
    // Add top 15 suspicious words
    dashboardData.top_suspicious_words.slice(0, 15).forEach((word, idx) => {
        const score = 2.5 - (idx * 0.1); // Simulated gradient score for visual appeal
        const pill = document.createElement('div');
        pill.className = 'keyword-pill suspicious';
        pill.innerHTML = `
            <i class="fa-solid fa-circle-exclamation"></i>
            <span>${word}</span>
            <span class="weight-badge">+${score.toFixed(1)}</span>
        `;
        cloudContainer.appendChild(pill);
    });

    // Add top 15 genuine words
    dashboardData.top_genuine_words.slice(0, 15).forEach((word, idx) => {
        const score = -2.2 + (idx * 0.1);
        const pill = document.createElement('div');
        pill.className = 'keyword-pill genuine';
        pill.innerHTML = `
            <i class="fa-solid fa-circle-check"></i>
            <span>${word}</span>
            <span class="weight-badge">${score.toFixed(1)}</span>
        `;
        cloudContainer.appendChild(pill);
    });
}

// Render Home Dashboard Charts
function renderDashboardCharts() {
    if (!dashboardData) return;

    // 1. Completeness Comparison Chart
    const completenessCtx = document.getElementById('completenessChart');
    if (completenessCtx) {
        if (completenessChart) completenessChart.destroy();
        
        const logo = dashboardData.metadata_impacts.logo_impact;
        const questions = dashboardData.metadata_impacts.questions_impact;
        const remote = dashboardData.metadata_impacts.telecommuting_impact;

        completenessChart = new Chart(completenessCtx, {
            type: 'bar',
            data: {
                labels: ['Logo Present', 'No Logo', 'Questions Asked', 'No Questions', 'Remote Work', 'On-Site Job'],
                datasets: [{
                    label: 'Fraud Risk Rate (%)',
                    data: [
                        (logo.with_logo_fake_rate * 100).toFixed(1),
                        (logo.without_logo_fake_rate * 100).toFixed(1),
                        (questions.with_questions_fake_rate * 100).toFixed(1),
                        (questions.without_questions_fake_rate * 100).toFixed(1),
                        (remote.remote_fake_rate * 100).toFixed(1),
                        (remote.onsite_fake_rate * 100).toFixed(1)
                    ],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.4)',  // Logo present - Low
                        'rgba(239, 68, 68, 0.65)',  // No Logo - High
                        'rgba(16, 185, 129, 0.4)',  // Questions asked - Low
                        'rgba(239, 68, 68, 0.65)',  // No Questions - High
                        'rgba(249, 115, 22, 0.55)', // Remote - Medium High
                        'rgba(59, 130, 246, 0.4)'   // Onsite - Low/Med
                    ],
                    borderColor: [
                        '#10b981', '#ef4444', '#10b981', '#ef4444', '#f97316', '#3b82f6'
                    ],
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) { return ` ${context.parsed.y}% fraud rate`; }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: value => `${value}%` }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }

    // 2. Industry vulnerabilities Chart
    const industryCtx = document.getElementById('industryChart');
    if (industryCtx) {
        if (industryChart) industryChart.destroy();
        
        const industries = Object.keys(dashboardData.top_fake_industries);
        const counts = Object.values(dashboardData.top_fake_industries);

        industryChart = new Chart(industryCtx, {
            type: 'bar',
            data: {
                labels: industries,
                datasets: [{
                    label: 'Fake Postings Count',
                    data: counts,
                    backgroundColor: 'rgba(168, 85, 247, 0.4)',
                    borderColor: '#a855f7',
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
}

// Render Model Hub Benchmarks Charts
function renderModelHubCharts() {
    if (!dashboardData) return;
    
    const metricsCtx = document.getElementById('metricsChart');
    if (metricsCtx) {
        if (metricsChart) metricsChart.destroy();
        
        const models = Object.keys(dashboardData.model_comparison);
        const accuracies = models.map(m => (dashboardData.model_comparison[m].accuracy * 100).toFixed(1));
        const f1s = models.map(m => (dashboardData.model_comparison[m].f1_fraud * 100).toFixed(1));
        const aucs = models.map(m => (dashboardData.model_comparison[m].roc_auc * 100).toFixed(1));

        metricsChart = new Chart(metricsCtx, {
            type: 'bar',
            data: {
                labels: models,
                datasets: [
                    {
                        label: 'Overall Accuracy',
                        data: accuracies,
                        backgroundColor: 'rgba(59, 130, 246, 0.4)',
                        borderColor: '#3b82f6',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Fraud Class F1-Score',
                        data: f1s,
                        backgroundColor: 'rgba(239, 68, 68, 0.4)',
                        borderColor: '#ef4444',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'ROC-AUC Area',
                        data: aucs,
                        backgroundColor: 'rgba(16, 185, 129, 0.4)',
                        borderColor: '#10b981',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        labels: { color: '#e2e8f0', font: { family: 'Outfit' } }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8', callback: value => `${value}%` }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    }
}

// Handle Form Submission for Scanning
function initFormHandlers() {
    const form = document.getElementById('job-scan-form');
    const emptySection = document.getElementById('scanner-empty-section');
    const loadingSection = document.getElementById('scanner-loading-section');
    const resultsSection = document.getElementById('scanner-results-section');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Show loading state
        emptySection.classList.add('hidden');
        resultsSection.classList.add('hidden');
        loadingSection.classList.remove('hidden');

        // Extract payload
        const payload = {
            title: document.getElementById('job-title').value,
            company_profile: document.getElementById('company-profile').value,
            description: document.getElementById('job-description').value,
            requirements: document.getElementById('job-requirements').value,
            benefits: document.getElementById('job-benefits').value,
            telecommuting: document.getElementById('meta-telecommuting').checked,
            has_company_logo: document.getElementById('meta-logo').checked,
            has_questions: document.getElementById('meta-questions').checked
        };

        try {
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Prediction request failed.');
            }

            const result = await response.json();
            
            // Render results
            displayScanResults(result, payload);
            
            // Swap screens
            loadingSection.classList.add('hidden');
            resultsSection.classList.remove('hidden');
        } catch (error) {
            console.error('Scan error:', error);
            alert('An error occurred while communicating with the classification server. Please ensure the backend is running.');
            loadingSection.classList.add('hidden');
            emptySection.classList.remove('hidden');
        }
    });
}

// Render Inference Output in UI
function displayScanResults(result, payload) {
    const riskPct = Math.round(result.fraud_probability * 100);
    const riskLabel = document.getElementById('risk-percentage');
    const verdictTitle = document.getElementById('verdict-title');
    const verdictDesc = document.getElementById('verdict-desc');
    const resultsHeaderCard = document.getElementById('results-risk-card');
    const gaugeFillPath = document.getElementById('gauge-fill-path');
    
    // Update risk score display
    riskLabel.textContent = `${riskPct}%`;
    verdictTitle.textContent = `${result.risk_level.toUpperCase()} RISK`;

    // Reset gauge color and style class
    resultsHeaderCard.className = 'results-header-card';
    gaugeFillPath.style.stroke = '';

    // Render based on risk tiers
    if (result.risk_level === 'Low') {
        resultsHeaderCard.classList.add('alert-success');
        gaugeFillPath.style.stroke = 'var(--color-green)';
        verdictDesc.textContent = 'This posting displays characteristics strongly consistent with legitimate, authentic job advertisements.';
    } else if (result.risk_level === 'Medium') {
        resultsHeaderCard.classList.add('alert-neutral');
        gaugeFillPath.style.stroke = 'var(--color-orange)';
        verdictDesc.textContent = 'Caution: This posting contains borderline textual flags or metadata choices. Verify details directly with the hiring company.';
    } else {
        resultsHeaderCard.classList.add('alert-danger');
        gaugeFillPath.style.stroke = 'var(--color-red)';
        verdictDesc.textContent = 'Warning: High likelihood of fraudulent listing! Scammer indicators match characteristics like missing company logo, excessive compensation claims, or key text spam.';
    }

    // Animate SVG Gauge
    // Semi circle path length is 125.6
    const offset = 125.6 - (125.6 * result.fraud_probability);
    gaugeFillPath.style.strokeDashoffset = offset;

    // Render Key Alerts based on listing features
    const alertsList = document.getElementById('alerts-list');
    alertsList.innerHTML = '';

    if (!payload.has_company_logo) {
        alertsList.appendChild(createAlertItem('danger', 'fa-image-slash', 'Missing Company Logo (+12% Fraud Risk Factor)'));
    } else {
        alertsList.appendChild(createAlertItem('success', 'fa-image', 'Verified Corporate Identity Logo Present'));
    }

    if (!payload.has_questions) {
        alertsList.appendChild(createAlertItem('danger', 'fa-circle-question', 'No Screening Questions Asked (+8% Fraud Risk Factor)'));
    } else {
        alertsList.appendChild(createAlertItem('success', 'fa-circle-check', 'Application includes Screening Questions'));
    }

    if (payload.telecommuting) {
        alertsList.appendChild(createAlertItem('neutral', 'fa-house-laptop', 'Telecommuting/Remote Job (Common target sector for phishing scams)'));
    }

    // Render text with word highlighting
    const highlighterOutput = document.getElementById('highlighter-output');
    
    // Combine input text for reconstruction
    const fullInputText = `${payload.title}\n\nCOMPANY PROFILE:\n${payload.company_profile}\n\nDESCRIPTION:\n${payload.description}\n\nREQUIREMENTS:\n${payload.requirements}\n\nBENEFITS:\n${payload.benefits}`;
    
    // Map words to scores for fast search
    const wordLookup = new Map();
    result.matched_words.forEach(item => {
        wordLookup.set(item.word.toLowerCase(), item);
    });

    // Split text keeping spaces and special chars
    const tokens = fullInputText.split(/([a-zA-Z]+)/);
    
    const highlightedHTML = tokens.map(token => {
        const lowerToken = token.toLowerCase();
        if (wordLookup.has(lowerToken)) {
            const info = wordLookup.get(lowerToken);
            const scoreSign = info.score > 0 ? '+' : '';
            const tooltipText = `${info.type === 'suspicious' ? 'Suspicious' : 'Trustworthy'}: ${scoreSign}${info.score.toFixed(2)}`;
            const cssClass = info.type === 'suspicious' ? 'hl-red' : 'hl-green';
            return `<span class="${cssClass}" data-score="${tooltipText}">${token}</span>`;
        }
        return token;
    }).join('');

    highlighterOutput.innerHTML = highlightedHTML;
}

// Helper to create list items
function createAlertItem(type, icon, text) {
    const item = document.createElement('div');
    item.className = `alert-item alert-${type}`;
    item.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${text}</span>
    `;
    return item;
}

// Load realistic test cases
function initSampleButtons() {
    const title = document.getElementById('job-title');
    const profile = document.getElementById('company-profile');
    const desc = document.getElementById('job-description');
    const req = document.getElementById('job-requirements');
    const ben = document.getElementById('job-benefits');
    const telecommuting = document.getElementById('meta-telecommuting');
    const logo = document.getElementById('meta-logo');
    const questions = document.getElementById('meta-questions');

    document.getElementById('fill-sample-genuine').addEventListener('click', () => {
        title.value = "Lead Frontend Engineer (React/TypeScript)";
        profile.value = "We are an established digital health platform engineering secure software for over 2 million patients globally. We value engineering excellence, security, and diversity.";
        desc.value = "We are seeking a Lead Frontend Engineer to drive our patient portal redesign. You will coordinate with product designers, implement state management structures using Redux, optimize bundle sizes, and mentor junior developers. This position requires strong technical skill, team collaboration, and experience with modern testing suites.";
        req.value = "- 5+ years of experience building scalable web applications\n- Strong proficiency in React, TypeScript, and modern JS\n- Experience writing Unit/Integration tests with Jest/RTL\n- BS/MS degree in Computer Science or related engineering field";
        ben.value = "Competitive salary ($130k - $160k), comprehensive health insurance, 401(k) matching, and annual training budget.";
        telecommuting.checked = false;
        logo.checked = true;
        questions.checked = true;
    });

    document.getElementById('fill-sample-fake').addEventListener('click', () => {
        title.value = "Data Entry Clerk - Work From Home (Immediate Start)";
        profile.value = "A fast growing international company looking to expand its team immediately. We provide high earnings from the comfort of your home.";
        desc.value = "Urgent Hiring! We are looking for self-motivated individuals to fill Data Entry positions. You will work from home. Tasks involve typing data, processing customer records, and payroll assistant duties. You can earn unlimited income. We pay weekly via bank transfer. No experience is required. Training package is provided. Start working immediately!";
        req.value = "- Must own a personal computer or smartphone\n- High speed internet connection\n- Basic typing skills\n- Willingness to start work immediately";
        ben.value = "- Work from anywhere\n- Earn $35 to $55 per hour\n- Unlimited income and bonuses\n- Weekly payout";
        telecommuting.checked = true;
        logo.checked = false;
        questions.checked = false;
    });
}
