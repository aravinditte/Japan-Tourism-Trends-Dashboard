// Tourism Data and Chart Management
class JapanTourismDashboard {
    constructor() {
        this.chart = null;
        this.tourismData = {};
        this.currentCountry = 'South Korea';
        this.init();
    }

    async init() {
        try {
            await this.loadData();
            this.setupEventListeners();
            this.createChart();
            this.updateStats();
        } catch (error) {
            console.error('Failed to initialize dashboard:', error);
            this.showError();
        }
    }

    async loadData() {
        try {
            const response = await fetch('./tourism_data.json');
            if (!response.ok) {
                throw new Error('Failed to load data');
            }
            this.tourismData = await response.json();
            console.log('Data loaded successfully:', this.tourismData);
        } catch (error) {
            console.error('Error loading data:', error);
            // Fallback to embedded data if JSON file fails to load
            this.tourismData = {
                "South Korea": [
                    {"year": 2018, "visitors": 7538952},
                    {"year": 2019, "visitors": 5584737},
                    {"year": 2020, "visitors": 265477},
                    {"year": 2021, "visitors": 51705},
                    {"year": 2022, "visitors": 1123429},
                    {"year": 2023, "visitors": 6958000},
                    {"year": 2024, "visitors": 8817800}
                ],
                "China": [
                    {"year": 2018, "visitors": 8380034},
                    {"year": 2019, "visitors": 9594300},
                    {"year": 2020, "visitors": 87400},
                    {"year": 2021, "visitors": 25500},
                    {"year": 2022, "visitors": 195400},
                    {"year": 2023, "visitors": 2426000},
                    {"year": 2024, "visitors": 6981200}
                ],
                "Taiwan": [
                    {"year": 2018, "visitors": 4757258},
                    {"year": 2019, "visitors": 4890000},
                    {"year": 2020, "visitors": 171218},
                    {"year": 2021, "visitors": 34567},
                    {"year": 2022, "visitors": 894567},
                    {"year": 2023, "visitors": 4201000},
                    {"year": 2024, "visitors": 6044400}
                ],
                "USA": [
                    {"year": 2018, "visitors": 1526407},
                    {"year": 2019, "visitors": 1723861},
                    {"year": 2020, "visitors": 434834},
                    {"year": 2021, "visitors": 98432},
                    {"year": 2022, "visitors": 1345623},
                    {"year": 2023, "visitors": 2044000},
                    {"year": 2024, "visitors": 2724600}
                ],
                "Hong Kong": [
                    {"year": 2018, "visitors": 2207804},
                    {"year": 2019, "visitors": 2290792},
                    {"year": 2020, "visitors": 73008},
                    {"year": 2021, "visitors": 15234},
                    {"year": 2022, "visitors": 234567},
                    {"year": 2023, "visitors": 2115000},
                    {"year": 2024, "visitors": 2683500}
                ]
            };
        }
    }

    setupEventListeners() {
        const select = document.getElementById('countrySelect');
        select.addEventListener('change', (e) => {
            this.currentCountry = e.target.value;
            this.updateChart();
            this.updateStats();
        });
    }

    createChart() {
        const ctx = document.getElementById('tourismChart').getContext('2d');
        const data = this.getCountryData(this.currentCountry);
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.years,
                datasets: [{
                    label: 'Number of Visitors',
                    data: data.visitors,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#667eea',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#667eea',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (context) => {
                                return `Visitors: ${this.formatNumber(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Year',
                            font: {
                                size: 14,
                                weight: '600'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Number of Visitors',
                            font: {
                                size: 14,
                                weight: '600'
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            callback: (value) => this.formatNumber(value)
                        }
                    }
                },
                elements: {
                    point: {
                        hoverBorderWidth: 3
                    }
                }
            }
        });
    }

    updateChart() {
        const data = this.getCountryData(this.currentCountry);
        
        this.chart.data.labels = data.years;
        this.chart.data.datasets[0].data = data.visitors;
        this.chart.update('active');
        
        document.getElementById('chartTitle').textContent = 
            `Visitor Arrivals from ${this.currentCountry}`;
    }

    getCountryData(country) {
        const countryData = this.tourismData[country] || [];
        return {
            years: countryData.map(item => item.year),
            visitors: countryData.map(item => item.visitors)
        };
    }

    updateStats() {
        const data = this.tourismData[this.currentCountry] || [];
        if (data.length === 0) return;

        // Latest year data (2024)
        const latest = data[data.length - 1];
        document.getElementById('currentYear').textContent = latest.year;
        document.getElementById('currentVisitors').textContent = 
            `${this.formatNumber(latest.visitors)} visitors`;

        // Pre-COVID peak (2019)
        const peak2019 = data.find(item => item.year === 2019);
        if (peak2019) {
            document.getElementById('peakYear').textContent = '2019';
            document.getElementById('peakVisitors').textContent = 
                `${this.formatNumber(peak2019.visitors)} visitors`;
            
            // Recovery rate calculation
            const recoveryRate = Math.round((latest.visitors / peak2019.visitors) * 100);
            document.getElementById('recoveryRate').textContent = `${recoveryRate}%`;
        }
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(0) + 'K';
        }
        return num.toLocaleString();
    }

    showError() {
        const container = document.querySelector('.chart-container');
        container.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h2 style="color: #e74c3c;">Unable to Load Data</h2>
                <p style="color: #666;">Please check your connection and try again.</p>
            </div>
        `;
    }
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new JapanTourismDashboard();
});