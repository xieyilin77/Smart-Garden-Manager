// ============================================
// KONFIGURATION - HIER ANPASSEN!
// ============================================

// !!! WICHTIG: Ersetzen Sie dies nach dem Deployment mit Ihrer API Gateway URL !!!
const API_URL = 'YOUR_API_GATEWAY_URL'; // Beispiel: https://xxxxxxxxxx.execute-api.region.amazonaws.com/prod/data
const SENSOR_ID = 'sensor-001';
const REFRESH_INTERVAL = 30000; // 30 Sekunden

// ============================================
// GLOBALE VARIABLEN
// ============================================

let charts = {};
let refreshTimer = null;

// ============================================
// CHARTS INITIALISIEREN
// ============================================

function initCharts() {
    console.log('📊 Initialisiere Charts...');
    
    const chartConfig = {
        type: 'line',
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 15,
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            elements: {
                point: {
                    radius: 2
                }
            }
        }
    };
    
    // Temperatur Chart
    const tempCtx = document.getElementById('tempChart');
    if (tempCtx) {
        charts.tempChart = new Chart(tempCtx, {
            ...chartConfig,
            data: {
                labels: [],
                datasets: [{
                    label: 'Temperatur (°C)',
                    data: [],
                    borderColor: '#e74c3c',
                    backgroundColor: 'rgba(231, 76, 60, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                ...chartConfig.options,
                plugins: {
                    ...chartConfig.options.plugins,
                    title: {
                        display: true,
                        text: 'Temperatur',
                        color: '#e74c3c',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            }
        });
    }
    
    // Luftfeuchtigkeit Chart
    const humidityCtx = document.getElementById('humidityChart');
    if (humidityCtx) {
        charts.humidityChart = new Chart(humidityCtx, {
            ...chartConfig,
            data: {
                labels: [],
                datasets: [{
                    label: 'Luftfeuchtigkeit (%)',
                    data: [],
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                ...chartConfig.options,
                plugins: {
                    ...chartConfig.options.plugins,
                    title: {
                        display: true,
                        text: 'Luftfeuchtigkeit',
                        color: '#3498db',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            }
        });
    }
    
    // Bodenfeuchte Chart
    const moistureCtx = document.getElementById('moistureChart');
    if (moistureCtx) {
        charts.moistureChart = new Chart(moistureCtx, {
            ...chartConfig,
            data: {
                labels: [],
                datasets: [{
                    label: 'Bodenfeuchte (%)',
                    data: [],
                    borderColor: '#27ae60',
                    backgroundColor: 'rgba(39, 174, 96, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                ...chartConfig.options,
                plugins: {
                    ...chartConfig.options.plugins,
                    title: {
                        display: true,
                        text: 'Bodenfeuchte',
                        color: '#27ae60',
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            }
        });
    }
    
    console.log('✅ Charts initialisiert');
}

// ============================================
// DATEN LADEN
// ============================================

async function loadData() {
    try {
        console.log('🔄 Lade Daten...');
        
        // Zeitraum aus Dropdown
        const timeRange = document.getElementById('timeRange');
        const hours = timeRange ? timeRange.value : 24;
        
        // API aufrufen
        const url = `${API_URL}?sensor_id=${SENSOR_ID}&hours=${hours}`;
        console.log(`📡 API Call: ${url}`);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('✅ Daten empfangen:', data);
        
        // Aktuelle Werte aktualisieren
        updateCurrentValues(data.latest);
        
        // Charts aktualisieren
        updateCharts(data.history);
        
        // Statistiken aktualisieren
        updateStats(data.stats, data.count);
        
        // Tabelle aktualisieren
        updateTable(data.history);
        
        // Letztes Update
        const now = new Date();
        document.getElementById('lastUpdate').textContent = 
            `🔄 Letztes Update: ${now.toLocaleTimeString('de-DE')}`;
        
        // Datenpunkte zählen
        document.getElementById('dataPoints').textContent = 
            `${data.count || 0} Datenpunkte`;
        
    } catch (error) {
        console.error('❌ Fehler beim Laden:', error);
        document.getElementById('dataTableBody').innerHTML = 
            `<tr><td colspan="4" class="loading-text">❌ Fehler: ${error.message}</td></tr>`;
    }
}

// ============================================
// AKTUELLE WERTE AKTUALISIEREN
// ============================================

function updateCurrentValues(latest) {
    if (!latest || Object.keys(latest).length === 0) {
        document.getElementById('currentTemp').textContent = '--°C';
        document.getElementById('currentHumidity').textContent = '--%';
        document.getElementById('currentMoisture').textContent = '--%';
        document.getElementById('sensorStatus').textContent = '🔴 Offline';
        return;
    }
    
    document.getElementById('currentTemp').textContent = 
        latest.temperature ? `${latest.temperature}°C` : '--°C';
    document.getElementById('currentHumidity').textContent = 
        latest.humidity ? `${latest.humidity}%` : '--%';
    document.getElementById('currentMoisture').textContent = 
        latest.soil_moisture ? `${latest.soil_moisture}%` : '--%';
    
    // Status basierend auf Bodenfeuchte
    const statusEl = document.getElementById('sensorStatus');
    if (latest.soil_moisture !== undefined) {
        statusEl.textContent = '🟢 Online';
        statusEl.style.color = '#27ae60';
    } else {
        statusEl.textContent = '🔴 Offline';
        statusEl.style.color = '#e74c3c';
    }
}

// ============================================
// CHARTS AKTUALISIEREN
// ============================================

function updateCharts(history) {
    if (!history || history.length === 0) {
        console.log('⚠️ Keine Historie für Charts');
        return;
    }
    
    // Daten für Charts vorbereiten
    const labels = history.map(h => {
        if (h.timestamp) {
            return h.timestamp.substring(11, 16); // HH:MM
        }
        return '';
    });
    
    const tempData = history.map(h => h.temperature || 0);
    const humData = history.map(h => h.humidity || 0);
    const moistData = history.map(h => h.soil_moisture || 0);
    
    // Charts aktualisieren
    updateChart('tempChart', labels, tempData);
    updateChart('humidityChart', labels, humData);
    updateChart('moistureChart', labels, moistData);
}

function updateChart(chartId, labels, data) {
    const chart = charts[chartId];
    if (chart) {
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.update();
        console.log(`📊 ${chartId} aktualisiert: ${data.length} Datenpunkte`);
    }
}

// ============================================
// STATISTIKEN AKTUALISIEREN
// ============================================

function updateStats(stats, count) {
    if (!stats || Object.keys(stats).length === 0) {
        document.getElementById('avgTemp').textContent = '--°C';
        document.getElementById('avgHumidity').textContent = '--%';
        document.getElementById('avgMoisture').textContent = '--%';
        document.getElementById('minTemp').textContent = '--°C';
        document.getElementById('maxTemp').textContent = '--°C';
        document.getElementById('dataPointCount').textContent = '0';
        return;
    }
    
    // Temperatur
    if (stats.temperature) {
        document.getElementById('avgTemp').textContent = `${stats.temperature.avg}°C`;
        document.getElementById('minTemp').textContent = `${stats.temperature.min}°C`;
        document.getElementById('maxTemp').textContent = `${stats.temperature.max}°C`;
    }
    
    // Luftfeuchtigkeit
    if (stats.humidity) {
        document.getElementById('avgHumidity').textContent = `${stats.humidity.avg}%`;
    }
    
    // Bodenfeuchte
    if (stats.soil_moisture) {
        document.getElementById('avgMoisture').textContent = `${stats.soil_moisture.avg}%`;
    }
    
    // Datenpunkte
    document.getElementById('dataPointCount').textContent = count || 0;
}

// ============================================
// TABELLE AKTUALISIEREN
// ============================================

function updateTable(history) {
    const tbody = document.getElementById('dataTableBody');
    
    if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="loading-text">Keine Daten verfügbar</td></tr>';
        return;
    }
    
    // Letzte 20 Einträge anzeigen (neueste zuerst)
    const displayData = history.slice(0, 20);
    
    tbody.innerHTML = displayData.map(row => {
        const timestamp = row.timestamp ? row.timestamp.replace('T', ' ').substring(0, 19) : '--';
        return `
            <tr>
                <td>${timestamp}</td>
                <td>${row.temperature || '--'}</td>
                <td>${row.humidity || '--'}</td>
                <td>${row.soil_moisture || '--'}</td>
            </tr>
        `;
    }).join('');
    
    console.log(`📋 Tabelle aktualisiert: ${displayData.length} Einträge`);
}

// ============================================
// REFRESH FUNKTION
// ============================================

function refreshData() {
    console.log('🔄 Manuelles Refresh...');
    loadData();
}

// ============================================
// AUTO-REFRESH
// ============================================

function startAutoRefresh() {
    if (refreshTimer) {
        clearInterval(refreshTimer);
    }
    refreshTimer = setInterval(loadData, REFRESH_INTERVAL);
    console.log(`⏰ Auto-Refresh gestartet (${REFRESH_INTERVAL/1000}s)`);
}

// ============================================
// INITIALISIERUNG
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Dashboard wird initialisiert...');
    console.log(`📡 API URL: ${API_URL}`);
    console.log(`🔑 Sensor ID: ${SENSOR_ID}`);
    
    // Charts initialisieren
    initCharts();
    
    // Erste Daten laden
    loadData();
    
    // Auto-Refresh starten
    startAutoRefresh();
});

// ============================================
// FEHLERBEHANDLUNG FÜR FETCH
// ============================================

// Globaler Fehler-Handler für Fetch
window.addEventListener('unhandledrejection', function(event) {
    console.error('❌ Unhandled Promise Rejection:', event.reason);
});