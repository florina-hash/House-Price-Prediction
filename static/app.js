// AeroPredict Application Core Logic

// State management
let appState = {
    theme: 'light',
    unit: 'sqft', // 'sqft' or 'sqm'
    currentSqft: 2500, // Always track the master value in sqft
    dataset: [],
    modelLine: [],
    r2: 0.0,
    mse: 0.0,
    slope: 0.0,
    intercept: 0.0,
    
    // Pagination & Search
    searchQuery: '',
    currentPage: 1,
    itemsPerPage: 8,
    sortField: 'sqft',
    sortAscending: true,

    // Prediction state
    lastPredictedPrice: 0
};

// Constants
const SQM_TO_SQFT_FACTOR = 10.7639;

// UI Selector Queries
const elements = {
    html: document.documentElement,
    themeToggle: document.getElementById('themeToggle'),
    
    // Navigation
    navBtns: document.querySelectorAll('.nav-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    pageTitle: document.getElementById('pageTitle'),
    pageSubtitle: document.getElementById('pageSubtitle'),
    
    // Dashboard / Input
    unitSqft: document.getElementById('unitSqft'),
    unitSqm: document.getElementById('unitSqm'),
    sqftInput: document.getElementById('sqftInput'),
    sqftSlider: document.getElementById('sqftSlider'),
    minRangeLabel: document.getElementById('minRangeLabel'),
    maxRangeLabel: document.getElementById('maxRangeLabel'),
    presetBtns: document.querySelectorAll('.preset-btn'),
    predictedPrice: document.getElementById('predictedPrice'),
    
    // Metrics
    r2Metric: document.getElementById('r2Metric'),
    mseMetric: document.getElementById('mseMetric'),
    modelEquation: document.getElementById('modelEquation'),
    headerSampleCount: document.getElementById('headerSampleCount'),
    headerR2: document.getElementById('headerR2'),
    
    // Dataset Management
    addDataForm: document.getElementById('addDataForm'),
    newSqft: document.getElementById('newSqft'),
    newPrice: document.getElementById('newPrice'),
    formAreaUnit: document.getElementById('formAreaUnit'),
    btnCsvExport: document.getElementById('btnCsvExport'),
    btnCsvImportTrigger: document.getElementById('btnCsvImportTrigger'),
    csvFileInput: document.getElementById('csvFileInput'),
    
    // Table Details
    tableSearch: document.getElementById('tableSearch'),
    datasetTableBody: document.getElementById('datasetTableBody'),
    tableSampleBadge: document.getElementById('tableSampleBadge'),
    tableEmptyState: document.getElementById('tableEmptyState'),
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    paginationInfo: document.getElementById('paginationInfo'),
    
    // Calculation Display
    calcSqft: document.getElementById('calcSqft'),
    calcSlope: document.getElementById('calcSlope'),
    calcIntercept: document.getElementById('calcIntercept'),
    calcResultPrice: document.getElementById('calcResultPrice'),
    calcMathSlope: document.getElementById('calcMathSlope'),
    calcMathSqft: document.getElementById('calcMathSqft'),
    calcMathIntercept: document.getElementById('calcMathIntercept')
};

// Chart.js Context
let chartInstance = null;

// Initialize app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    initUnitToggle();
    initPresets();
    initInputsSync();
    initCSVHandlers();
    initFormHandlers();
    initTableControls();
    
    // Load initial data
    loadModelDetails();
    
    // Compile Lucide Icons initially
    lucide.createIcons();
});

/* ==========================================================================
   1. Theme Management (Light / Dark Mode Switcher)
   ========================================================================== */
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        appState.theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        appState.theme = 'light';
    }
    
    applyTheme();
    
    elements.themeToggle.addEventListener('click', () => {
        appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', appState.theme);
        applyTheme();
        
        // Re-render chart elements to adjust to theme background colors
        if (chartInstance) {
            updateChartStyles();
        }
    });
}

function applyTheme() {
    elements.html.setAttribute('data-theme', appState.theme);
}

/* ==========================================================================
   2. Page Navigation (Sidebar Tabs Control)
   ========================================================================== */
function initNavigation() {
    elements.navBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.getAttribute('data-target');
            
            // Toggle active sidebar button
            elements.navBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Toggle active tab panel view
            elements.tabPanels.forEach(panel => {
                panel.classList.remove('active');
                if (panel.id === `tab-${targetTab}`) {
                    panel.classList.add('active');
                }
            });
            
            // Dynamically update titles
            updateHeaderTitles(targetTab);
        });
    });
}

function updateHeaderTitles(tabName) {
    if (tabName === 'dashboard') {
        elements.pageTitle.textContent = "Prediction Dashboard";
        elements.pageSubtitle.textContent = "Real-time linear regression modeling and estimation";
    } else if (tabName === 'dataset') {
        elements.pageTitle.textContent = "Dataset Manager";
        elements.pageSubtitle.textContent = "View, search, edit and build training points";
    } else if (tabName === 'analytics') {
        elements.pageTitle.textContent = "Analytics & Mathematical Visualizer";
        elements.pageSubtitle.textContent = "Interactive regression lines and step-by-step calculator";
        // Recalculate chart size in hidden panel to avoid layout glitches
        setTimeout(() => {
            if (chartInstance) {
                chartInstance.resize();
            }
        }, 150);
    }
}

/* ==========================================================================
   3. Unit Converter Controls (Sq Ft vs Sq M)
   ========================================================================== */
function initUnitToggle() {
    const handleUnitChange = (e) => {
        const previousUnit = appState.unit;
        appState.unit = e.target.value;
        
        // Update form unit badge
        elements.formAreaUnit.textContent = appState.unit === 'sqft' ? 'sq ft' : 'sq m';
        
        // Update table header labels
        document.querySelectorAll('.table-unit-label').forEach(lbl => {
            lbl.textContent = appState.unit === 'sqft' ? 'sq ft' : 'sq m';
        });

        // Convert ranges & bounds values
        adjustSliderAndInputs(previousUnit);
        
        // Re-populate Table and Chart to adapt coordinates labels
        renderTable();
        if (chartInstance) {
            chartInstance.destroy();
            chartInstance = null;
        }
        drawChart();
    };

    elements.unitSqft.addEventListener('change', handleUnitChange);
    elements.unitSqm.addEventListener('change', handleUnitChange);
}

function adjustSliderAndInputs(prevUnit) {
    if (appState.unit === 'sqft') {
        // From SqM to SqFt
        elements.sqftInput.min = 500;
        elements.sqftInput.max = 10000;
        elements.sqftSlider.min = 500;
        elements.sqftSlider.max = 10000;
        
        elements.minRangeLabel.textContent = "500 sq ft";
        elements.maxRangeLabel.textContent = "10,000 sq ft";
        
        // Restore exact sqft value
        const displayValue = Math.round(appState.currentSqft);
        elements.sqftInput.value = displayValue;
        elements.sqftSlider.value = displayValue;
    } else {
        // From SqFt to SqM
        const minSqm = Math.round(500 / SQM_TO_SQFT_FACTOR);
        const maxSqm = Math.round(10000 / SQM_TO_SQFT_FACTOR);
        
        elements.sqftInput.min = minSqm;
        elements.sqftInput.max = maxSqm;
        elements.sqftSlider.min = minSqm;
        elements.sqftSlider.max = maxSqm;
        
        elements.minRangeLabel.textContent = `${minSqm} sq m`;
        elements.maxRangeLabel.textContent = `${maxSqm} sq m`;
        
        // Convert input value display
        const sqmVal = Math.round(appState.currentSqft / SQM_TO_SQFT_FACTOR);
        elements.sqftInput.value = sqmVal;
        elements.sqftSlider.value = sqmVal;
    }
}

/* ==========================================================================
   4. Property Presets Badges Handler
   ========================================================================== */
function initPresets() {
    elements.presetBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sqftPresetVal = parseFloat(e.currentTarget.getAttribute('data-sqft'));
            appState.currentSqft = sqftPresetVal;
            
            // Sync values to display
            if (appState.unit === 'sqft') {
                elements.sqftInput.value = sqftPresetVal;
                elements.sqftSlider.value = sqftPresetVal;
            } else {
                elements.sqftInput.value = Math.round(sqftPresetVal / SQM_TO_SQFT_FACTOR);
                elements.sqftSlider.value = Math.round(sqftPresetVal / SQM_TO_SQFT_FACTOR);
            }
            
            getPrediction(appState.currentSqft);
            
            // Add subtle click bounce animation
            e.currentTarget.classList.add('preset-active');
            setTimeout(() => e.currentTarget.classList.remove('preset-active'), 200);
        });
    });
}

/* ==========================================================================
   5. Interactive Numerical inputs Synchronizer
   ========================================================================== */
function initInputsSync() {
    // Range slider input
    elements.sqftSlider.addEventListener('input', (e) => {
        const sliderVal = parseFloat(e.target.value);
        elements.sqftInput.value = sliderVal;
        
        if (appState.unit === 'sqft') {
            appState.currentSqft = sliderVal;
        } else {
            appState.currentSqft = sliderVal * SQM_TO_SQFT_FACTOR;
        }
        
        getPrediction(appState.currentSqft);
    });

    // Numerical text box input
    elements.sqftInput.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value);
        const minVal = parseFloat(e.target.min);
        const maxVal = parseFloat(e.target.max);
        
        if (isNaN(val) || val < minVal) val = minVal;
        if (val > maxVal) val = maxVal;
        
        e.target.value = val;
        elements.sqftSlider.value = val;
        
        if (appState.unit === 'sqft') {
            appState.currentSqft = val;
        } else {
            appState.currentSqft = val * SQM_TO_SQFT_FACTOR;
        }
        
        getPrediction(appState.currentSqft);
    });
}

/* ==========================================================================
   6. API Core Methods (Model details loading, prediction and insert)
   ========================================================================== */
async function loadModelDetails() {
    try {
        const response = await fetch('/api/model');
        const data = await response.json();
        
        if (response.ok) {
            appState.dataset = data.dataset;
            appState.modelLine = data.line;
            appState.r2 = data.r2;
            appState.mse = data.mse;
            appState.slope = data.slope;
            appState.intercept = data.intercept;
            
            // Update global stats
            elements.r2Metric.textContent = appState.r2.toFixed(4);
            elements.mseMetric.textContent = appState.mse.toLocaleString(undefined, { maximumFractionDigits: 0 });
            elements.headerR2.textContent = `R²: ${appState.r2.toFixed(3)}`;
            
            const pointsLabel = appState.dataset.length === 1 ? '1 point' : `${appState.dataset.length} points`;
            elements.headerSampleCount.textContent = pointsLabel;
            elements.tableSampleBadge.textContent = pointsLabel;
            
            // Equation formatting
            const sign = appState.intercept >= 0 ? '+' : '-';
            const absIntercept = Math.abs(appState.intercept).toLocaleString(undefined, { maximumFractionDigits: 2 });
            const slopeFormatted = appState.slope.toLocaleString(undefined, { maximumFractionDigits: 2 });
            elements.modelEquation.textContent = `Price = ${slopeFormatted} * Area ${sign} ${absIntercept}`;
            
            // Update UI elements
            renderTable();
            drawChart();
            getPrediction(appState.currentSqft);
        }
    } catch (error) {
        console.error("Error fetching model parameters:", error);
        showToast("Error loading model parameters.", "error");
    }
}

let predictionDebounceTimeout;
function getPrediction(sqftVal) {
    clearTimeout(predictionDebounceTimeout);
    
    predictionDebounceTimeout = setTimeout(async () => {
        if (isNaN(sqftVal) || sqftVal <= 0) return;
        
        try {
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sqft: sqftVal })
            });
            const data = await response.json();
            
            if (response.ok) {
                const targetPrice = Math.round(data.predicted_price);
                
                // Animate valuation count-up price display
                animatePriceValuation(targetPrice);
                
                // Draw live prediction crosshairs on chart
                if (chartInstance) {
                    const xCoord = appState.unit === 'sqft' ? sqftVal : sqftVal / SQM_TO_SQFT_FACTOR;
                    chartInstance.data.datasets[2].data = [{ x: xCoord, y: targetPrice }];
                    chartInstance.update('none'); // Update smoothly without reset transitions
                }
                
                // Update Math Walkthrough variables
                updateMathWalkthrough(sqftVal, targetPrice);
            }
        } catch (error) {
            console.error("Prediction failed:", error);
        }
    }, 50);
}

function animatePriceValuation(targetPrice) {
    const startVal = appState.lastPredictedPrice;
    const duration = 350;
    const startTime = performance.now();
    
    function animate(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing: easeOutQuad
        const easeVal = progress * (2 - progress);
        const currentVal = Math.round(startVal + (targetPrice - startVal) * easeVal);
        
        elements.predictedPrice.textContent = currentVal.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            appState.lastPredictedPrice = targetPrice;
            elements.predictedPrice.textContent = targetPrice.toLocaleString();
        }
    }
    
    requestAnimationFrame(animate);
}

function updateMathWalkthrough(sqftVal, targetPrice) {
    // Sizes
    const sizeDisplayVal = appState.unit === 'sqft' ? sqftVal : sqftVal / SQM_TO_SQFT_FACTOR;
    elements.calcSqft.textContent = Math.round(sizeDisplayVal).toLocaleString();
    elements.calcMathSqft.textContent = Math.round(sizeDisplayVal).toLocaleString();
    
    // Equations parameters display
    elements.calcSlope.textContent = appState.slope.toFixed(2);
    elements.calcMathSlope.textContent = appState.slope.toFixed(2);
    
    elements.calcIntercept.textContent = appState.intercept.toLocaleString(undefined, { maximumFractionDigits: 2 });
    elements.calcMathIntercept.textContent = appState.intercept.toLocaleString(undefined, { maximumFractionDigits: 2 });
    
    elements.calcResultPrice.textContent = targetPrice.toLocaleString();
}

/* ==========================================================================
   7. Form Submissions (Add / Remove Points)
   ========================================================================== */
function initFormHandlers() {
    elements.addDataForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let areaVal = parseFloat(elements.newSqft.value);
        const priceVal = parseFloat(elements.newPrice.value);
        
        if (isNaN(areaVal) || isNaN(priceVal)) {
            showToast("Inputs must be numeric parameters.", "error");
            return;
        }
        
        // Convert to sqft if form is filled in sq meters
        if (appState.unit === 'sqm') {
            areaVal = areaVal * SQM_TO_SQFT_FACTOR;
        }
        
        // Retrain layout status badge toggle
        toggleRetrainingStatus(true);
        
        try {
            const response = await fetch('/api/dataset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sqft: areaVal, price: priceVal })
            });
            const data = await response.json();
            
            if (response.ok) {
                showToast(`Point added: ${elements.newSqft.value} ${appState.unit === 'sqft' ? 'sq ft' : 'sq m'}, $${priceVal.toLocaleString()}`, "success");
                
                // Clear input elements
                elements.newSqft.value = '';
                elements.newPrice.value = '';
                
                // Confetti blast on successful training insertion!
                confetti({
                    particleCount: 50,
                    spread: 60,
                    origin: { y: 0.8 }
                });
                
                // Reload system variables
                await loadModelDetails();
            } else {
                showToast(data.error || "Failed to save record.", "error");
            }
        } catch (error) {
            console.error("Error adding point:", error);
            showToast("Network connection error.", "error");
        } finally {
            toggleRetrainingStatus(false);
        }
    });
}

async function deleteRecordPoint(sqft, price) {
    toggleRetrainingStatus(true);
    
    try {
        const response = await fetch('/api/dataset/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sqft, price })
        });
        const data = await response.json();
        
        if (response.ok) {
            const sqftDisplay = appState.unit === 'sqft' ? sqft : sqft / SQM_TO_SQFT_FACTOR;
            showToast(`Point deleted: ${Math.round(sqftDisplay).toLocaleString()} ${appState.unit === 'sqft' ? 'sq ft' : 'sq m'}`, "info");
            
            await loadModelDetails();
        } else {
            showToast(data.error || "Could not delete record.", "error");
        }
    } catch (error) {
        console.error("Error deleting point:", error);
        showToast("Error communicating deletion.", "error");
    } finally {
        toggleRetrainingStatus(false);
    }
}

function toggleRetrainingStatus(isActive) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.querySelector('.status-text');
    
    if (isActive) {
        statusDot.style.backgroundColor = '#eab308';
        statusDot.style.boxShadow = '0 0 10px #eab308';
        statusText.textContent = "Retraining Fit...";
    } else {
        setTimeout(() => {
            statusDot.style.backgroundColor = 'var(--success)';
            statusDot.style.boxShadow = '0 0 10px var(--success)';
            statusText.textContent = "Model Active";
        }, 600);
    }
}

/* ==========================================================================
   8. Table Operations (Filtering, Sorting, Pagination)
   ========================================================================== */
function initTableControls() {
    elements.tableSearch.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value.trim().toLowerCase();
        appState.currentPage = 1;
        renderTable();
    });
    
    document.querySelectorAll('.premium-table th.sortable').forEach(th => {
        th.addEventListener('click', (e) => {
            const field = e.currentTarget.getAttribute('data-sort');
            
            if (appState.sortField === field) {
                appState.sortAscending = !appState.sortAscending;
            } else {
                appState.sortField = field;
                appState.sortAscending = true;
            }
            
            // Adjust header chevron indicators
            document.querySelectorAll('.premium-table th svg').forEach(svg => {
                svg.style.transform = 'none';
            });
            
            renderTable();
        });
    });
    
    elements.btnPrevPage.addEventListener('click', () => {
        if (appState.currentPage > 1) {
            appState.currentPage--;
            renderTable();
        }
    });
    
    elements.btnNextPage.addEventListener('click', () => {
        const totalFiltered = getFilteredDataset().length;
        const totalPages = Math.ceil(totalFiltered / appState.itemsPerPage);
        
        if (appState.currentPage < totalPages) {
            appState.currentPage++;
            renderTable();
        }
    });
}

function getFilteredDataset() {
    return appState.dataset.filter(item => {
        const sqmArea = item.sqft / SQM_TO_SQFT_FACTOR;
        const areaLabel = appState.unit === 'sqft' ? item.sqft : sqmArea;
        
        const areaStr = Math.round(areaLabel).toString();
        const priceStr = item.price.toString();
        
        return areaStr.includes(appState.searchQuery) || priceStr.includes(appState.searchQuery);
    });
}

function renderTable() {
    const filtered = getFilteredDataset();
    
    // Sort array
    filtered.sort((a, b) => {
        let valA = a[appState.sortField];
        let valB = b[appState.sortField];
        
        return appState.sortAscending ? (valA - valB) : (valB - valA);
    });
    
    // Paginate array
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / appState.itemsPerPage) || 1;
    
    if (appState.currentPage > totalPages) {
        appState.currentPage = totalPages;
    }
    
    const startIndex = (appState.currentPage - 1) * appState.itemsPerPage;
    const paginatedItems = filtered.slice(startIndex, startIndex + appState.itemsPerPage);
    
    elements.datasetTableBody.innerHTML = '';
    
    if (totalItems === 0) {
        elements.tableEmptyState.style.display = 'flex';
        elements.paginationInfo.textContent = 'Page 0 of 0';
        elements.btnPrevPage.disabled = true;
        elements.btnNextPage.disabled = true;
        return;
    } else {
        elements.tableEmptyState.style.display = 'none';
    }
    
    // Build table rows
    paginatedItems.forEach(item => {
        const row = document.createElement('tr');
        
        const unitArea = appState.unit === 'sqft' ? item.sqft : item.sqft / SQM_TO_SQFT_FACTOR;
        
        row.innerHTML = `
            <td>${Math.round(unitArea).toLocaleString()}</td>
            <td>$${item.price.toLocaleString()}</td>
            <td class="action-column">
                <button class="btn-row-action danger btn-delete-row" title="Delete record" data-sqft="${item.sqft}" data-price="${item.price}">
                    <i data-lucide="trash-2"></i>
                </button>
            </td>
        `;
        
        const delBtn = row.querySelector('.btn-delete-row');
        delBtn.addEventListener('click', (e) => {
            const sqft = parseFloat(delBtn.getAttribute('data-sqft'));
            const price = parseFloat(delBtn.getAttribute('data-price'));
            deleteRecordPoint(sqft, price);
        });
        
        elements.datasetTableBody.appendChild(row);
    });
    
    // Refresh Icons for newly injected table buttons
    lucide.createIcons();
    
    // Pagination Controls state
    elements.paginationInfo.textContent = `Page ${appState.currentPage} of ${totalPages}`;
    elements.btnPrevPage.disabled = appState.currentPage === 1;
    elements.btnNextPage.disabled = appState.currentPage === totalPages;
}

/* ==========================================================================
   9. CSV Import / Export Functionality
   ========================================================================== */
function initCSVHandlers() {
    // Export CSV
    elements.btnCsvExport.addEventListener('click', () => {
        if (appState.dataset.length === 0) {
            showToast("No data to export.", "error");
            return;
        }
        
        let csvContent = "data:text/csv;charset=utf-8,sqft,price\n";
        appState.dataset.forEach(item => {
            csvContent += `${item.sqft},${item.price}\n`;
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `aeropredict_dataset_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast("Dataset exported as CSV file.", "success");
    });
    
    // Trigger CSV Hidden Import File input click
    elements.btnCsvImportTrigger.addEventListener('click', () => {
        elements.csvFileInput.click();
    });
    
    // Read and import CSV file
    elements.csvFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split('\n');
            const dataToUpload = [];
            
            // Basic simple parser
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const sqft = parseFloat(parts[0]);
                    const price = parseFloat(parts[1]);
                    
                    if (!isNaN(sqft) && !isNaN(price)) {
                        dataToUpload.push({ sqft, price });
                    }
                }
            }
            
            if (dataToUpload.length === 0) {
                showToast("Invalid CSV layout format.", "error");
                return;
            }
            
            // Upload points sequentially to avoid race condition retrains
            toggleRetrainingStatus(true);
            showToast(`Uploading ${dataToUpload.length} points...`, "info");
            
            let uploadedCount = 0;
            for (const pt of dataToUpload) {
                try {
                    await fetch('/api/dataset', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(pt)
                    });
                    uploadedCount++;
                } catch (err) {
                    console.error("Bulk upload item failed:", pt, err);
                }
            }
            
            showToast(`Success: imported ${uploadedCount} points.`, "success");
            elements.csvFileInput.value = ''; // clear input
            await loadModelDetails();
            toggleRetrainingStatus(false);
        };
        
        reader.readAsText(file);
    });
}

/* ==========================================================================
   10. Chart.js Custom Visuals Design
   ========================================================================== */
function drawChart() {
    const ctx = document.getElementById('regressionChart').getContext('2d');
    
    // Convert coordinate points data units
    const scatterPoints = appState.dataset.map(p => {
        const areaVal = appState.unit === 'sqft' ? p.sqft : p.sqft / SQM_TO_SQFT_FACTOR;
        return { x: areaVal, y: p.price };
    });
    
    const lineCoords = appState.modelLine.map(p => {
        const areaVal = appState.unit === 'sqft' ? p.sqft : p.sqft / SQM_TO_SQFT_FACTOR;
        return { x: areaVal, y: p.price };
    });

    const themeColors = getThemeChartColors();

    if (chartInstance) {
        chartInstance.data.datasets[0].data = scatterPoints;
        chartInstance.data.datasets[1].data = lineCoords;
        chartInstance.options.scales.x.grid.color = themeColors.gridColor;
        chartInstance.options.scales.y.grid.color = themeColors.gridColor;
        chartInstance.options.scales.x.title.text = appState.unit === 'sqft' ? 'Area (Sq Ft)' : 'Area (Sq Meters)';
        chartInstance.update();
        return;
    }

    // Build chart configuration
    chartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Actual Data Records',
                    data: scatterPoints,
                    backgroundColor: themeColors.scatterBg,
                    borderColor: themeColors.scatterBorder,
                    borderWidth: 1.5,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    showLine: false
                },
                {
                    label: 'Calculated Regression Line',
                    data: lineCoords,
                    borderColor: themeColors.lineColor,
                    borderWidth: 3,
                    pointRadius: 0,
                    showLine: true,
                    fill: false,
                    tension: 0
                },
                {
                    label: 'Selected Est Point',
                    data: [],
                    backgroundColor: themeColors.activePointBg,
                    borderColor: '#ffffff',
                    borderWidth: 2.5,
                    pointRadius: 9,
                    pointHoverRadius: 11,
                    showLine: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: themeColors.textColor,
                        font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' }
                    }
                },
                tooltip: {
                    backgroundColor: themeColors.tooltipBg,
                    titleColor: themeColors.tooltipTitle,
                    bodyColor: themeColors.tooltipBody,
                    borderColor: themeColors.tooltipBorder,
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            let prefix = 'Data Point';
                            if (context.datasetIndex === 1) prefix = 'Regression Fit';
                            if (context.datasetIndex === 2) prefix = 'Valuation Selected';
                            const unitLabel = appState.unit === 'sqft' ? 'sqft' : 'sqm';
                            return `${prefix}: ${Math.round(context.parsed.x).toLocaleString()} ${unitLabel}, $${Math.round(context.parsed.y).toLocaleString()}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: appState.unit === 'sqft' ? 'Area (Sq Ft)' : 'Area (Sq Meters)',
                        color: themeColors.textColor,
                        font: { family: 'Plus Jakarta Sans', size: 12, weight: '700' }
                    },
                    grid: { color: themeColors.gridColor },
                    ticks: { color: themeColors.tickColor, font: { family: 'monospace' } }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Valuation Price (USD)',
                        color: themeColors.textColor,
                        font: { family: 'Plus Jakarta Sans', size: 12, weight: '700' }
                    },
                    grid: { color: themeColors.gridColor },
                    ticks: {
                        color: themeColors.tickColor,
                        font: { family: 'monospace' },
                        callback: function(value) { return '$' + value.toLocaleString(); }
                    }
                }
            }
        }
    });
}

function getThemeChartColors() {
    const isDark = appState.theme === 'dark';
    
    return {
        textColor: isDark ? '#9ca3af' : '#475569',
        tickColor: isDark ? '#6b7280' : '#94a3b8',
        gridColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)',
        scatterBg: isDark ? 'rgba(99, 102, 241, 0.7)' : 'rgba(79, 70, 229, 0.7)',
        scatterBorder: isDark ? '#818cf8' : '#4f46e5',
        lineColor: '#10b981', // green fit line looks beautiful and clean
        activePointBg: '#a855f7', // purple active points
        
        // Tooltips
        tooltipBg: isDark ? '#1f2937' : '#ffffff',
        tooltipBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
        tooltipTitle: isDark ? '#ffffff' : '#0f172a',
        tooltipBody: isDark ? '#9ca3af' : '#475569'
    };
}

function updateChartStyles() {
    const colors = getThemeChartColors();
    
    chartInstance.options.plugins.legend.labels.color = colors.textColor;
    chartInstance.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
    chartInstance.options.plugins.tooltip.titleColor = colors.tooltipTitle;
    chartInstance.options.plugins.tooltip.bodyColor = colors.tooltipBody;
    chartInstance.options.plugins.tooltip.borderColor = colors.tooltipBorder;
    
    chartInstance.options.scales.x.title.color = colors.textColor;
    chartInstance.options.scales.x.grid.color = colors.gridColor;
    chartInstance.options.scales.x.ticks.color = colors.tickColor;
    
    chartInstance.options.scales.y.title.color = colors.textColor;
    chartInstance.options.scales.y.grid.color = colors.gridColor;
    chartInstance.options.scales.y.ticks.color = colors.tickColor;
    
    chartInstance.data.datasets[0].backgroundColor = colors.scatterBg;
    chartInstance.data.datasets[0].borderColor = colors.scatterBorder;
    
    chartInstance.update();
}

/* ==========================================================================
   11. Helper Toast Notification Panel System
   ========================================================================== */
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Dynamic Icon Selection
    let iconName = 'check-circle';
    if (type === 'error') {
        iconName = 'alert-triangle';
    } else if (type === 'info') {
        iconName = 'info';
    }
    
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <div class="toast-content">${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Draw Lucide icons within created element
    lucide.createIcons({
        attrs: {
            class: 'toast-icon'
        },
        nameAttr: 'data-lucide'
    });
    
    // Remove element automatically
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 4000);
}
