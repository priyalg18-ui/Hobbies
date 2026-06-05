// SwingTrade AI - Application Router, State Manager & Portfolio Controller

document.addEventListener("DOMContentLoaded", () => {
    // -------------------------------------------------------------
    // 1. Initial State & Portfolio Storage
    // -------------------------------------------------------------
    let state = {
        watchlist: ["RELIANCE", "TATAMOTORS", "HDFCBANK", "TCS", "LT"],
        openPositions: [
            {
                id: "pos-1",
                ticker: "TATAMOTORS",
                name: "Tata Motors Ltd.",
                qty: 100,
                entryPrice: 380.00,
                target: 425.00,
                stopLoss: 365.00,
                currency: "₹"
            },
            {
                id: "pos-2",
                ticker: "WIPRO",
                name: "Wipro Ltd.",
                qty: 250,
                entryPrice: 195.00,
                target: 215.00,
                stopLoss: 188.00,
                currency: "₹"
            }
        ],
        closedTrades: [
            {
                ticker: "HDFCBANK",
                name: "HDFC Bank Ltd.",
                qty: 50,
                entryPrice: 720.00,
                exitPrice: 755.00,
                pl: 1750.00,
                status: "Profit",
                holdingDays: 8,
                currency: "₹"
            }
        ],
        alerts: [
            {
                id: "alert-1",
                time: new Date().toISOString().split("T")[0] + " 10:15",
                type: "breakout",
                msg: "RELIANCE broke above resistance level of ₹2,450 with 2.5x volume!"
            },
            {
                id: "alert-2",
                time: new Date().toISOString().split("T")[0] + " 14:30",
                type: "target",
                msg: "HDFCBANK achieved Target 1 of ₹1,610. Positions closed."
            }
        ]
    };

    // Load from localStorage if present
    if (localStorage.getItem("swingtrade_portfolio")) {
        try {
            state = JSON.parse(localStorage.getItem("swingtrade_portfolio"));
        } catch(e) {
            console.error("Error reading portfolio from local storage, using defaults", e);
        }
    }

    const saveState = () => {
        localStorage.setItem("swingtrade_portfolio", JSON.stringify(state));
    };

    // Initialize Charting Engine
    let activeChart = null;

    // -------------------------------------------------------------
    // 2. SPA Screen Routing
    // -------------------------------------------------------------
    const navItems = document.querySelectorAll(".nav-item");
    const screens = document.querySelectorAll(".screen");

    const switchScreen = (screenId) => {
        // Toggle Active nav state
        navItems.forEach(item => {
            if (item.getAttribute("data-screen") === screenId) {
                item.classList.add("active");
            } else {
                item.classList.remove("active");
            }
        });

        // Toggle Active screen element
        screens.forEach(screen => {
            if (screen.id === screenId) {
                screen.classList.add("active");
            } else {
                screen.classList.remove("active");
            }
        });

        // Custom chart redraw trigger when entering chart screen
        if (screenId === "screen-chart") {
            setTimeout(() => {
                if (activeChart) {
                    activeChart.resize();
                } else {
                    initChartTerminal();
                }
            }, 100);
        }
    };

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            switchScreen(item.getAttribute("data-screen"));
        });
    });

    // -------------------------------------------------------------
    // 3. UI Content Generators & Dashboard Populator
    // -------------------------------------------------------------
    const updateDashboardMetrics = () => {
        // Active Watchlist
        document.getElementById("dash-watchlist-count").innerText = state.watchlist.length;
        document.getElementById("port-watchlist-count").innerText = state.watchlist.length;

        // Portfolio P&L
        let totalPl = 0;
        let totalCost = 0;
        state.openPositions.forEach(pos => {
            const stock = window.SwingTradeDB.stocks[pos.ticker];
            if (stock) {
                const currentVal = stock.price * pos.qty;
                const costVal = pos.entryPrice * pos.qty;
                totalPl += (currentVal - costVal);
                totalCost += costVal;
            }
        });

        const plEl = document.getElementById("dash-portfolio-pl");
        const pctEl = document.getElementById("dash-portfolio-pct");
        const portPlEl = document.getElementById("port-total-pl");
        const portPctEl = document.getElementById("port-total-pct");
        
        let pctStr = "0.00%";
        if (totalCost > 0) {
            const pct = (totalPl / totalCost) * 100;
            pctStr = `${pct.toFixed(2)}%`;
        }

        const formattedPl = `₹${totalPl.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        plEl.innerText = formattedPl;
        portPlEl.innerText = formattedPl;
        pctEl.innerText = `${pctStr} Current Returns`;
        portPctEl.innerText = `${pctStr} Returns`;

        const card1 = document.getElementById("port-pl-card");
        if (totalPl >= 0) {
            plEl.style.color = "var(--accent-green)";
            portPlEl.style.color = "var(--accent-green)";
            if(card1) card1.className = "stats-card glass-panel green";
        } else {
            plEl.style.color = "var(--accent-red)";
            portPlEl.style.color = "var(--accent-red)";
            if(card1) card1.className = "stats-card glass-panel red";
        }

        // Win Rate
        const wins = state.closedTrades.filter(t => t.status === "Profit").length;
        const totalClosed = state.closedTrades.length;
        const winRate = totalClosed > 0 ? Math.round((wins / totalClosed) * 100) : 0;
        
        document.getElementById("dash-winrate").innerText = `${winRate}%`;
        document.getElementById("port-winrate").innerText = `${winRate}%`;
        document.getElementById("dash-closed-trades").innerText = `${totalClosed} trade${totalClosed !== 1 ? 's':''} closed`;
        document.getElementById("port-total-trades").innerText = `${totalClosed} trade${totalClosed !== 1 ? 's':''} closed`;

        // Highest rated Swing setup
        let highestScore = 0;
        let highestTicker = "--";
        Object.values(window.SwingTradeDB.stocks).forEach(s => {
            if (s.swingScore > highestScore) {
                highestScore = s.swingScore;
                highestTicker = s.ticker;
            }
        });
        document.getElementById("dash-highest-score").innerText = highestScore > 0 ? `${highestScore}/100` : "--";
        document.getElementById("dash-highest-ticker").innerText = highestScore > 0 ? `${highestTicker} is top rated` : "No setups";
    };

    const loadSectorHeatmap = () => {
        const sectorContainer = document.getElementById("sectorList");
        sectorContainer.innerHTML = "";
        
        Object.values(window.SwingTradeDB.sectors).forEach(sec => {
            const isBullish = sec.momentum >= 70;
            const statusClass = isBullish ? 'green' : 'orange';
            const statusText = isBullish ? 'Strong Momentum' : 'Consolidating';
            
            const div = document.createElement("div");
            div.className = "ticker-item";
            div.style.display = "flex";
            div.style.justifyContent = "space-between";
            div.style.alignItems = "center";
            div.style.padding = "10px 14px";
            div.style.margin = "0";
            div.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="font-weight:600; font-size:13.5px;">${sec.name}</span>
                    <span style="font-size:11px; color:var(--text-muted);">${statusText}</span>
                </div>
                <span class="score-badge" style="background: ${isBullish ? 'rgba(0, 230, 118, 0.1)':'rgba(255, 145, 0, 0.1)'}; border-color: ${isBullish ? 'var(--accent-green)':'var(--accent-orange)'}; color: ${isBullish ? 'var(--accent-green)':'var(--accent-orange)'};">
                    <i class="fa-solid fa-arrow-trend-up"></i> ${sec.momentum}
                </span>
            `;
            sectorContainer.appendChild(div);
        });
    };

    const loadDashboardTable = () => {
        const tbody = document.getElementById("topRatedTableBody");
        tbody.innerHTML = "";

        const topPicks = Object.values(window.SwingTradeDB.stocks)
            .filter(s => s.swingScore >= 75)
            .sort((a,b)=> b.swingScore - a.swingScore);

        topPicks.forEach(stock => {
            const tr = document.createElement("tr");
            const changeClass = stock.pctChange >= 0 ? "text-green" : "text-red";
            const changeSign = stock.pctChange >= 0 ? "+" : "";
            
            tr.innerHTML = `
                <td style="font-weight:700; color:var(--accent-blue);">${stock.ticker}</td>
                <td style="color:var(--text-secondary); font-size:13px;">${stock.name}</td>
                <td style="font-weight:600;">${stock.currency}${stock.price}</td>
                <td class="${changeClass}">${changeSign}${stock.pctChange}%</td>
                <td>
                    <span class="score-badge">
                        <i class="fa-solid fa-shield-halved"></i> ${stock.swingScore}
                    </span>
                </td>
                <td style="color:var(--accent-orange); font-weight:600;">${stock.tradingSetup.riskReward}</td>
                <td>
                    <div class="action-btn-group">
                        <button class="btn-small btn-buy btn-view-chart-trigger" data-ticker="${stock.ticker}"><i class="fa-solid fa-chart-area"></i> Chart</button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add visual link trigger to row buttons
        document.querySelectorAll(".btn-view-chart-trigger").forEach(btn => {
            btn.addEventListener("click", () => {
                const ticker = btn.getAttribute("data-ticker");
                loadTickerIntoChart(ticker);
            });
        });
    };

    // -------------------------------------------------------------
    // 4. Recommendation Cards Loader (Weekly/Monthly)
    // -------------------------------------------------------------
    const loadRecommendationsList = (holdingType, containerId) => {
        const container = document.getElementById(containerId);
        container.innerHTML = "";

        const picks = window.SwingTradeDB.getRecommendations(holdingType);

        picks.forEach(rec => {
            const card = document.createElement("div");
            card.className = "rec-card glass-panel";
            card.style.marginBottom = "20px";
            
            card.innerHTML = `
                <div class="rec-card-header">
                    <div class="stock-info-block">
                        <div class="rank-badge">#${rec.rank}</div>
                        <div class="stock-names">
                            <h4>${rec.name} (${rec.ticker})</h4>
                            <span>Sector: ${window.SwingTradeDB.stocks[rec.ticker].sector.name}</span>
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span class="score-badge">
                            <i class="fa-solid fa-robot"></i> Swing Score: ${rec.swingScore}
                        </span>
                        <button class="btn-small btn-buy btn-view-chart-trigger" data-ticker="${rec.ticker}">
                            <i class="fa-solid fa-chart-column"></i> Chart Terminal
                        </button>
                    </div>
                </div>
                
                <div class="rec-grid">
                    <div class="rec-metric">
                        <span class="metric-label">Current Price</span>
                        <span class="metric-val">${rec.currency}${rec.price}</span>
                    </div>
                    <div class="rec-metric">
                        <span class="metric-label">Entry Zone</span>
                        <span class="metric-val blue">${rec.entryZone}</span>
                    </div>
                    <div class="rec-metric">
                        <span class="metric-label">Targets</span>
                        <span class="metric-val green">${rec.currency}${rec.target1} | ${rec.currency}${rec.target2}</span>
                    </div>
                    <div class="rec-metric">
                        <span class="metric-label">Stop Loss</span>
                        <span class="metric-val red">${rec.currency}${rec.stopLoss}</span>
                    </div>
                </div>
                
                <div class="rec-grid" style="border-top: 1px solid var(--border-color); padding-top: 14px; margin-bottom: 12px;">
                    <div class="rec-metric">
                        <span class="metric-label">Expected Holding</span>
                        <span class="metric-val" style="color:#ffffff;">${rec.expectedHolding}</span>
                    </div>
                    <div class="rec-metric">
                        <span class="metric-label">Potential Upside</span>
                        <span class="metric-val green">+${rec.potentialUpside}%</span>
                    </div>
                    <div class="rec-metric">
                        <span class="metric-label">Risk Reward</span>
                        <span class="metric-val" style="color:var(--accent-orange);">${rec.riskReward}</span>
                    </div>
                    <div class="rec-metric">
                        <span class="metric-label">Market Focus</span>
                        <span class="metric-val" style="font-size:12px; color:var(--text-secondary);">Indian NSE/BSE</span>
                    </div>
                </div>

                <div class="ai-reasoning-box">
                    ${formatMarkdown(rec.reason)}
                </div>
            `;
            container.appendChild(card);
        });

        // Setup event listener to jump to chart
        container.querySelectorAll(".btn-view-chart-trigger").forEach(btn => {
            btn.addEventListener("click", () => {
                const ticker = btn.getAttribute("data-ticker");
                loadTickerIntoChart(ticker);
            });
        });
    };

    // Helper to format simple markdown bold tags in explanation
    function formatMarkdown(text) {
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/- \*\*(.*?)\*\*:/g, '<li><strong>$1</strong>:')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
    }

    // -------------------------------------------------------------
    // 5. Chart Screen Terminal Loader
    // -------------------------------------------------------------
    const initChartTerminal = () => {
        const select = document.getElementById("chartStockSelect");
        select.innerHTML = "";
        
        // Load options
        Object.keys(window.SwingTradeDB.stocks).forEach(ticker => {
            const opt = document.createElement("option");
            opt.value = ticker;
            opt.innerText = `${ticker} - ${window.SwingTradeDB.stocks[ticker].name}`;
            select.appendChild(opt);
        });

        // Initialize Canvas chart object
        activeChart = new window.StockChartRenderer("stockCanvas", "chartLegend");

        // Event listener on selection drop change
        select.addEventListener("change", (e) => {
            loadTickerIntoChart(e.target.value, false);
        });

        // Select first stock
        loadTickerIntoChart("RELIANCE", false);
    };

    const loadTickerIntoChart = (ticker, navigate = true) => {
        const stock = window.SwingTradeDB.stocks[ticker];
        if (!stock) return;

        if (navigate) {
            switchScreen("screen-chart");
            // Set select index
            const select = document.getElementById("chartStockSelect");
            if (select) select.value = ticker;
        }

        // Draw stock into Canvas
        if (activeChart) {
            activeChart.setStock(stock);
        }

        // Update Price Ticker Label
        const priceLabel = document.getElementById("chartPriceLabel");
        const isBullish = stock.pctChange >= 0;
        priceLabel.innerHTML = `
            <span style="color:#ffffff; font-size:18px;">${stock.currency}${stock.price}</span>
            <span style="color:${isBullish ? 'var(--accent-green)':'var(--accent-red)'}; font-size:13px; margin-left:8px;">
                ${isBullish ? '+':''}${stock.pctChange}%
            </span>
        `;

        // Update indicator stats on right panel
        document.getElementById("tech-rsi-val").innerText = stock.technicalAnalysis.rsi.toFixed(1);
        const rsiColor = stock.technicalAnalysis.rsi > 70 ? 'var(--accent-red)' : (stock.technicalAnalysis.rsi < 30 ? 'var(--accent-green)' : '#ffffff');
        document.getElementById("tech-rsi-val").style.color = rsiColor;

        const isMacdBullish = stock.technicalAnalysis.macd > stock.technicalAnalysis.macdSignal;
        document.getElementById("tech-macd-val").innerText = isMacdBullish ? "Bullish" : "Bearish";
        document.getElementById("tech-macd-val").style.color = isMacdBullish ? "var(--accent-green)" : "var(--accent-red)";

        const isAboveDma = stock.price > stock.technicalAnalysis.sma50;
        document.getElementById("tech-dma-val").innerText = isAboveDma ? "Above 50 DMA" : "Below 50 DMA";
        document.getElementById("tech-dma-val").style.color = isAboveDma ? "var(--accent-green)" : "var(--accent-orange)";

        document.getElementById("tech-volume-val").innerText = `${stock.volumeSurge}x`;
        document.getElementById("tech-volume-val").style.color = stock.volumeSurge > 1.5 ? "var(--accent-blue)" : "#ffffff";

        // Update AI details text panel
        const detailsBox = document.getElementById("chartExplanationBox");
        
        let explanationText = stock.aiExplanation;
        
        // Inject specific visual references matching chart lines
        let annotatedIntro = `**Chart Key Indicators:**\n`;
        annotatedIntro += `- Moving Averages: **20 DMA (Blue)**, **50 DMA (Orange)**, **200 DMA (Purple)** are drawn.\n`;
        annotatedIntro += `- Support Levels: Marked in **Green zones** around ${stock.currency}${stock.technicalAnalysis.supportLevels.join(', ')}.\n`;
        annotatedIntro += `- Resistance Levels: Marked in **Red zones** around ${stock.currency}${stock.technicalAnalysis.resistanceLevels.join(', ')}.\n`;
        
        if (stock.ticker === "RELIANCE" || stock.ticker === "LT") {
            annotatedIntro += `- **Breakout Confirmation Level**: A horizontal blue-dashed breakout line is visible at ${stock.currency}${stock.technicalAnalysis.resistanceLevels[0]}.\n`;
        }
        if (stock.ticker === "TATAMOTORS" || stock.ticker === "RELIANCE") {
            annotatedIntro += `- **Trendlines**: An upward yellow trendline is drawn connecting local troughs.\n`;
        }
        
        detailsBox.innerHTML = formatMarkdown(annotatedIntro + "\n" + explanationText);
    };

    // -------------------------------------------------------------
    // 6. Portfolio & Watchlist Controllers
    // -------------------------------------------------------------
    const loadPortfolioAndWatchlist = () => {
        // Watchlist
        const watchlistTbody = document.getElementById("watchlistTableBody");
        watchlistTbody.innerHTML = "";
        
        state.watchlist.forEach(ticker => {
            const stock = window.SwingTradeDB.stocks[ticker];
            if (stock) {
                const tr = document.createElement("tr");
                const changeClass = stock.pctChange >= 0 ? "text-green" : "text-red";
                const changeSign = stock.pctChange >= 0 ? "+" : "";
                tr.innerHTML = `
                    <td style="font-weight:700; color:var(--accent-blue);">${stock.ticker}</td>
                    <td style="font-weight:600;">${stock.currency}${stock.price}</td>
                    <td class="${changeClass}">${changeSign}${stock.pctChange}%</td>
                    <td>
                        <div style="display:flex; gap:6px;">
                            <button class="btn-small btn-buy btn-watchlist-view" data-ticker="${stock.ticker}"><i class="fa-solid fa-chart-column"></i></button>
                            <button class="btn-small btn-sell btn-watchlist-remove" data-ticker="${stock.ticker}"><i class="fa-solid fa-trash-can"></i></button>
                        </div>
                    </td>
                `;
                watchlistTbody.appendChild(tr);
            }
        });

        // Watchlist button bindings
        document.querySelectorAll(".btn-watchlist-view").forEach(btn => {
            btn.addEventListener("click", () => {
                loadTickerIntoChart(btn.getAttribute("data-ticker"));
            });
        });
        document.querySelectorAll(".btn-watchlist-remove").forEach(btn => {
            btn.addEventListener("click", () => {
                const ticker = btn.getAttribute("data-ticker");
                state.watchlist = state.watchlist.filter(t => t !== ticker);
                saveState();
                loadPortfolioAndWatchlist();
                updateDashboardMetrics();
                showToast("info", "Watchlist Update", `${ticker} removed from watchlist.`);
            });
        });

        // Open Positions
        const openTbody = document.getElementById("openPositionsTableBody");
        openTbody.innerHTML = "";

        if (state.openPositions.length === 0) {
            openTbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding:24px;">
                        No open positions. Use the "Record Swing Entry" button to add a position.
                    </td>
                </tr>
            `;
        } else {
            state.openPositions.forEach(pos => {
                const stock = window.SwingTradeDB.stocks[pos.ticker];
                const tr = document.createElement("tr");
                
                let currentPrice = pos.entryPrice;
                let returnsStr = "₹0.00 (0.00%)";
                let plColor = "#ffffff";
                
                if (stock) {
                    currentPrice = stock.price;
                    const pl = (currentPrice - pos.entryPrice) * pos.qty;
                    const pct = ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
                    returnsStr = `${pl >= 0 ? '+':''}${pos.currency}${pl.toLocaleString('en-IN', {maximumFractionDigits:2})} (${pct.toFixed(2)}%)`;
                    plColor = pl >= 0 ? "var(--accent-green)" : "var(--accent-red)";
                }

                tr.innerHTML = `
                    <td style="font-weight:700; color:var(--accent-blue);">${pos.ticker}</td>
                    <td>${pos.qty}</td>
                    <td>${pos.currency}${pos.entryPrice}</td>
                    <td style="font-weight:600;">${pos.currency}${currentPrice}</td>
                    <td style="color:var(--accent-green); font-weight:600;">${pos.currency}${pos.target}</td>
                    <td style="color:var(--accent-red); font-weight:600;">${pos.currency}${pos.stopLoss}</td>
                    <td style="color:${plColor}; font-weight:700;">${returnsStr}</td>
                    <td>
                        <button class="btn-small btn-sell btn-exit-position" data-id="${pos.id}">Exit Position</button>
                    </td>
                `;
                openTbody.appendChild(tr);
            });

            // Bind exit button clicks
            document.querySelectorAll(".btn-exit-position").forEach(btn => {
                btn.addEventListener("click", () => {
                    const id = btn.getAttribute("data-id");
                    exitPosition(id);
                });
            });
        }

        // Closed Positions History
        const closedTbody = document.getElementById("closedTradesTableBody");
        closedTbody.innerHTML = "";

        if (state.closedTrades.length === 0) {
            closedTbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted);">No closed trades yet.</td>
                </tr>
            `;
        } else {
            state.closedTrades.forEach(t => {
                const tr = document.createElement("tr");
                const plColor = t.pl >= 0 ? "var(--accent-green)" : "var(--accent-red)";
                const badgeStyle = t.status === "Profit" 
                    ? "background:rgba(0, 230, 118, 0.1); color:var(--accent-green); border:1px solid rgba(0, 230, 118, 0.2);"
                    : "background:rgba(255, 23, 68, 0.1); color:var(--accent-red); border:1px solid rgba(255, 23, 68, 0.2);";

                tr.innerHTML = `
                    <td style="font-weight:700; color:var(--accent-blue);">${t.ticker}</td>
                    <td>${t.qty}</td>
                    <td>${t.currency}${t.entryPrice}</td>
                    <td>${t.currency}${t.exitPrice}</td>
                    <td style="color:${plColor}; font-weight:700;">${t.pl >= 0 ? '+':''}${t.currency}${t.pl.toLocaleString('en-IN')}</td>
                    <td><span class="alert-tag" style="${badgeStyle}">${t.status}</span></td>
                    <td>${t.holdingDays} days</td>
                `;
                closedTbody.appendChild(tr);
            });
        }
    };

    const recordEntryPosition = (ticker, qty, entryPrice, target, stopLoss) => {
        const stock = window.SwingTradeDB.stocks[ticker];
        if (!stock) return;

        const newPos = {
            id: `pos-${Date.now()}`,
            ticker: ticker,
            name: stock.name,
            qty: parseInt(qty),
            entryPrice: parseFloat(entryPrice),
            target: parseFloat(target),
            stopLoss: parseFloat(stopLoss),
            currency: stock.currency
        };

        state.openPositions.push(newPos);
        saveState();
        loadPortfolioAndWatchlist();
        updateDashboardMetrics();
        showToast("indicator", "Trade Logged", `Logged buying of ${qty} shares of ${ticker} at ${stock.currency}${entryPrice}`);
    };

    const exitPosition = (posId) => {
        const idx = state.openPositions.findIndex(p => p.id === posId);
        if (idx === -1) return;

        const pos = state.openPositions[idx];
        const stock = window.SwingTradeDB.stocks[pos.ticker];
        if (!stock) return;

        const exitPrice = stock.price;
        const pl = (exitPrice - pos.entryPrice) * pos.qty;
        const status = pl >= 0 ? "Profit" : "Loss";
        const holdingDays = Math.round(5 + Math.random() * 15); // simulate holding days

        const closedTrade = {
            ticker: pos.ticker,
            name: pos.name,
            qty: pos.qty,
            entryPrice: pos.entryPrice,
            exitPrice: exitPrice,
            pl: pl,
            status: status,
            holdingDays: holdingDays,
            currency: pos.currency
        };

        // Remove from open, add to closed
        state.openPositions.splice(idx, 1);
        state.closedTrades.push(closedTrade);
        saveState();
        loadPortfolioAndWatchlist();
        updateDashboardMetrics();
        
        const toastType = status === "Profit" ? "target" : "stoploss";
        showToast(toastType, "Position Closed", `Sold ${pos.qty} shares of ${pos.ticker} at ${pos.currency}${exitPrice}. P&L: ${pl >= 0 ? '+':''}${pos.currency}${pl.toFixed(2)}`);
    };

    // Modal Control Bindings
    const addModal = document.getElementById("addPositionModal");
    
    document.getElementById("btnOpenAddPosition").addEventListener("click", () => {
        const select = document.getElementById("posStockSelect");
        select.innerHTML = "";
        
        // Populate stocks dropdown
        Object.keys(window.SwingTradeDB.stocks).forEach(ticker => {
            const s = window.SwingTradeDB.stocks[ticker];
            const opt = document.createElement("option");
            opt.value = ticker;
            opt.innerText = `${ticker} (${s.name}) - ${s.currency}${s.price}`;
            select.appendChild(opt);
        });

        // Trigger default calculations when stock changes inside entry modal
        const setFormDefaults = (ticker) => {
            const stock = window.SwingTradeDB.stocks[ticker];
            document.getElementById("posEntryPrice").value = stock.price;
            document.getElementById("posTarget").value = stock.tradingSetup.target1;
            document.getElementById("posStopLoss").value = stock.tradingSetup.stopLoss;
        };

        select.addEventListener("change", (e) => setFormDefaults(e.target.value));
        setFormDefaults(select.value);

        addModal.style.display = "flex";
    });

    document.getElementById("btnCloseAddPosition").addEventListener("click", () => {
        addModal.style.display = "none";
    });

    document.getElementById("addPositionForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const ticker = document.getElementById("posStockSelect").value;
        const qty = document.getElementById("posQty").value;
        const entry = document.getElementById("posEntryPrice").value;
        const target = document.getElementById("posTarget").value;
        const sl = document.getElementById("posStopLoss").value;

        recordEntryPosition(ticker, qty, entry, target, sl);
        addModal.style.display = "none";
    });

    // -------------------------------------------------------------
    // 7. AI Chatbot / Query Processors
    // -------------------------------------------------------------
    const chatHistoryBox = document.getElementById("chatHistoryBox");
    const chatInput = document.getElementById("chatInput");
    const btnSend = document.getElementById("btnChatSend");

    const addChatBubble = (sender, content) => {
        const bubble = document.createElement("div");
        bubble.className = `chat-bubble ${sender}`;
        bubble.innerHTML = content;
        chatHistoryBox.appendChild(bubble);
        chatHistoryBox.scrollTop = chatHistoryBox.scrollHeight;
    };

    const processChatQuery = (queryText) => {
        addChatBubble("user", queryText);

        setTimeout(() => {
            const responseObj = window.SwingTradeDB.queryStocks(queryText);
            
            let bubbleHtml = `<p><strong>SwingTrade AI:</strong> ${responseObj.message}</p>`;

            if (responseObj.type === "recommendation") {
                // Top 5 Recommendations Card Output
                bubbleHtml += `<div class="chat-bubble-recs">`;
                responseObj.results.forEach((rec) => {
                    bubbleHtml += `
                        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 10px; padding: 12px; margin-top:8px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:6px; margin-bottom:6px;">
                                <strong>Rank #${rec.rank}: ${rec.ticker}</strong>
                                <span class="score-badge" style="padding: 2px 8px; font-size:11px;">Score: ${rec.swingScore}</span>
                            </div>
                            <div style="font-size:12px; color:var(--text-secondary); display:grid; grid-template-columns: 1fr 1fr; gap:6px;">
                                <div>Price: ${rec.currency}${rec.price}</div>
                                <div>Entry: <span class="text-blue">${rec.entryZone}</span></div>
                                <div>Stop Loss: <span style="color:var(--accent-red);">${rec.currency}${rec.stopLoss}</span></div>
                                <div>Target 1: <span style="color:var(--accent-green);">${rec.currency}${rec.target1}</span></div>
                                <div>Holding: <span>${rec.expectedHolding}</span></div>
                                <div>R:R: <span style="color:var(--accent-orange);">${rec.riskReward}</span></div>
                            </div>
                            <button class="btn-small btn-buy btn-view-chart-trigger" data-ticker="${rec.ticker}" style="width:100%; margin-top:8px; height:28px;">
                                <i class="fa-solid fa-chart-line"></i> View Interactive Chart
                            </button>
                        </div>
                    `;
                });
                bubbleHtml += `</div>`;
            } else {
                // Generic query stock listing outputs
                bubbleHtml += `
                    <div style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
                `;
                responseObj.results.forEach((stock) => {
                    const isBullish = stock.pctChange >= 0;
                    bubbleHtml += `
                        <div style="display:flex; justify-content:space-between; align-items:center; background: rgba(0,0,0,0.1); border-radius: 8px; padding: 8px 12px; font-size:13px;">
                            <span style="font-weight:700; color:var(--accent-blue); min-width:80px;">${stock.ticker}</span>
                            <span style="color:var(--text-secondary); flex-grow:1; margin:0 8px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${stock.name}</span>
                            <span style="font-weight:600; min-width:80px; text-align:right;">${stock.currency}${stock.price}</span>
                            <span style="font-weight:600; min-width:70px; text-align:right; color: ${isBullish ? 'var(--accent-green)':'var(--accent-red)'}">${isBullish ? '+':''}${stock.pctChange}%</span>
                            <button class="btn-small btn-buy btn-view-chart-trigger" data-ticker="${stock.ticker}" style="margin-left:12px; padding:4px 8px; font-size:11px;">Chart</button>
                        </div>
                    `;
                });
                bubbleHtml += `</div>`;
            }

            bubbleHtml += `
                <div style="background: rgba(255,23,68,0.03); border:1px solid rgba(255,23,68,0.1); font-size:10px; color:#ff8a80; padding:6px; border-radius:6px; margin-top:10px;">
                    *AI generated setup. Markets carry risks. Confirm DMA and support bounds on chart before trade entry.
                </div>
            `;

            addChatBubble("assistant", bubbleHtml);

            // Hook up newly generated chart buttons
            chatHistoryBox.querySelectorAll(".btn-view-chart-trigger").forEach(btn => {
                btn.addEventListener("click", () => {
                    const ticker = btn.getAttribute("data-ticker");
                    loadTickerIntoChart(ticker);
                });
            });
        }, 600);
    };

    // Chat events
    btnSend.addEventListener("click", () => {
        if (chatInput.value.trim() !== "") {
            processChatQuery(chatInput.value);
            chatInput.value = "";
        }
    });

    chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && chatInput.value.trim() !== "") {
            processChatQuery(chatInput.value);
            chatInput.value = "";
        }
    });

    // Chat chips quick action bindings
    document.querySelectorAll(".query-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            processChatQuery(chip.getAttribute("data-query"));
        });
    });

    // -------------------------------------------------------------
    // 8. Alerts Timelines & Toast Simulator
    // -------------------------------------------------------------
    const loadAlertsHistory = () => {
        const list = document.getElementById("alertsHistoryList");
        const emptyMsg = document.getElementById("emptyAlertsMsg");
        
        // Remove existing items that aren't emptyMsg
        const items = list.querySelectorAll(".alert-item-card");
        items.forEach(el => el.remove());

        if (state.alerts.length === 0) {
            if (emptyMsg) emptyMsg.style.display = "block";
        } else {
            if (emptyMsg) emptyMsg.style.display = "none";
            
            // Loop alert arrays in reverse order to see newest first
            [...state.alerts].reverse().forEach(alert => {
                const card = document.createElement("div");
                card.className = `alert-item-card glass-panel ${alert.type}`;
                
                let title = "Swing Alert";
                if (alert.type === "breakout") title = "Breakout Confirmed";
                if (alert.type === "target") title = "Target Achieved";
                if (alert.type === "stoploss") title = "Stop Loss Hit";
                if (alert.type === "indicator") title = "Threshold Crossed";
                
                card.innerHTML = `
                    <div class="alert-meta">
                        <span class="alert-time">${alert.time}</span>
                        <h4 style="font-size:14px; font-weight:700;">${title}</h4>
                        <p class="alert-msg" style="color:var(--text-secondary); margin-top:2px;">${alert.msg}</p>
                    </div>
                    <span class="alert-tag ${alert.type}">${alert.type}</span>
                `;
                list.appendChild(card);
            });
        }
    };

    const showToast = (type, title, body) => {
        const container = document.getElementById("toastContainer");
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;
        
        let iconHtml = '<i class="fa-solid fa-triangle-exclamation toast-icon"></i>';
        if (type === "breakout") iconHtml = '<i class="fa-solid fa-bolt toast-icon"></i>';
        if (type === "target") iconHtml = '<i class="fa-solid fa-circle-check toast-icon"></i>';
        if (type === "stoploss") iconHtml = '<i class="fa-solid fa-circle-xmark toast-icon"></i>';
        if (type === "indicator") iconHtml = '<i class="fa-solid fa-wave-square toast-icon"></i>';

        toast.innerHTML = `
            ${iconHtml}
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-body">${body}</div>
            </div>
        `;
        container.appendChild(toast);
        
        // Auto remove toast after 4.5 seconds
        setTimeout(() => {
            toast.style.animation = "slideInLeft 0.3s reverse forwards";
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4500);
    };

    const triggerSimulatedAlert = (simType) => {
        const activeTickers = Object.keys(window.SwingTradeDB.stocks);
        const randomTicker = activeTickers[Math.floor(Math.random() * activeTickers.length)];
        const stock = window.SwingTradeDB.stocks[randomTicker];
        
        const now = new Date();
        const timeStr = now.toISOString().split("T")[0] + " " + now.toTimeString().split(" ")[0].slice(0, 5);

        let msg = "";
        let toastTitle = "";
        let toastBody = "";

        switch(simType) {
            case "breakout":
                msg = `${stock.ticker} has broken above its primary resistance level of ${stock.currency}${stock.technicalAnalysis.resistanceLevels[0]} with a massive ${stock.volumeSurge}x daily volume surge!`;
                toastTitle = "🚨 Breakout Confirmation";
                toastBody = `${stock.ticker} broke resistance at ${stock.currency}${stock.technicalAnalysis.resistanceLevels[0]}! Vol surge: ${stock.volumeSurge}x.`;
                break;
            case "top5":
                msg = `${stock.ticker} has scored a Swing Score of ${stock.swingScore} and entered the Top 5 Swing recommendations for this week.`;
                toastTitle = "🏆 Top 5 Recommendation Update";
                toastBody = `${stock.ticker} entered Top 5 Weekly picks with a Swing Score of ${stock.swingScore}!`;
                break;
            case "target":
                msg = `${stock.ticker} has reached Target 1 (${stock.currency}${stock.tradingSetup.target1}) yielding an upside of +${stock.tradingSetup.potentialUpside}%.`;
                toastTitle = "🎯 Target Achieved";
                toastBody = `${stock.ticker} achieved Target 1 of ${stock.currency}${stock.tradingSetup.target1}.`;
                break;
            case "stoploss":
                msg = `${stock.ticker} dropped below key support and hit the Stop Loss of ${stock.currency}${stock.tradingSetup.stopLoss}. Position invalidated.`;
                toastTitle = "⚠️ Stop Loss Triggered";
                toastBody = `${stock.ticker} hit Stop Loss at ${stock.currency}${stock.tradingSetup.stopLoss}.`;
                break;
            case "volspike":
                msg = `High-volume institutional block buying detected on ${stock.ticker}. Volume is current 3.2x of the 20-day daily average.`;
                toastTitle = "📈 Volume surge alert";
                toastBody = `${stock.ticker} volume is 320% of 20-day average. Buy pressure rising.`;
                break;
            case "rsi":
                msg = `${stock.ticker} Daily RSI crossed the 65 threshold (currently at ${stock.technicalAnalysis.rsi.toFixed(1)}), confirming bullish momentum.`;
                toastTitle = "⚡ Momentum Shift (RSI)";
                toastBody = `${stock.ticker} RSI crossed 65 boundary. Current RSI is ${stock.technicalAnalysis.rsi.toFixed(1)}.`;
                break;
        }

        // Add to alert list, cap at 10 alerts
        state.alerts.unshift({
            id: `alert-${Date.now()}`,
            time: timeStr,
            type: simType,
            msg: msg
        });
        if (state.alerts.length > 10) state.alerts.pop();

        saveState();
        loadAlertsHistory();
        updateDashboardMetrics();
        showToast(simType, toastTitle, toastBody);
    };

    // Simulated alerts bindings
    document.querySelectorAll(".btn-sim-trigger").forEach(btn => {
        btn.addEventListener("click", () => {
            triggerSimulatedAlert(btn.getAttribute("data-sim"));
        });
    });

    document.getElementById("btnClearAlerts").addEventListener("click", () => {
        state.alerts = [];
        saveState();
        loadAlertsHistory();
        updateDashboardMetrics();
        showToast("info", "Alerts Cleared", "Notification history has been cleared.");
    });

    // -------------------------------------------------------------
    // 9. Global Search Parser
    // -------------------------------------------------------------
    const globalSearch = document.getElementById("globalSearch");
    globalSearch.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && globalSearch.value.trim() !== "") {
            const queryText = globalSearch.value;
            globalSearch.value = "";
            
            // Switch to Chat Assistant screen and submit
            switchScreen("screen-chatbot");
            processChatQuery(queryText);
        }
    });

    // -------------------------------------------------------------
    // 10. Device Mobile Simulator Toggles
    // -------------------------------------------------------------
    const container = document.getElementById("appContainer");
    const btnSim = document.getElementById("toggleSimulator");
    const btnExit = document.getElementById("exitSimulator");

    const toggleSimMode = () => {
        container.classList.toggle("simulator-mode");
        // Trigger resize events so Canvas elements scale correctly
        setTimeout(() => {
            if (activeChart) {
                activeChart.resize();
            }
        }, 150);
    };

    btnSim.addEventListener("click", toggleSimMode);
    btnExit.addEventListener("click", toggleSimMode);

    // -------------------------------------------------------------
    // 11. Direct Live Market Connection (Yahoo Quote API)
    // -------------------------------------------------------------
    const fetchLiveQuotes = async () => {
        const statusText = document.getElementById("connectionStatusText");
        const statusDot = document.getElementById("connectionStatusDot");
        
        // Yahoo Finance symbols mapping to our local keys
        const symbolsMap = {
            "RELIANCE.NS": "RELIANCE", "TCS.NS": "TCS", "INFY.NS": "INFY", 
            "HDFCBANK.NS": "HDFCBANK", "ICICIBANK.NS": "ICICIBANK", 
            "TATAMOTORS.NS": "TATAMOTORS", "SBIN.NS": "SBIN", 
            "BHARTIAIRTEL.NS": "BHARTIAIRTEL", "ITC.NS": "ITC", "LTIM.NS": "LTIM", 
            "SUNPHARMA.NS": "SUNPHARMA", "MARUTI.NS": "MARUTI", "TITAN.NS": "TITAN", 
            "WIPRO.NS": "WIPRO", "AXISBANK.NS": "AXISBANK", "ZOMATO.NS": "ZOMATO", 
            "NYKAA.NS": "NYKAA", "LT.NS": "LT", "HINDUNILVR.NS": "HINDUNILVR", 
            "ADANIENT.NS": "ADANIENT", "KOTAKBANK.NS": "KOTAKBANK", 
            "COALINDIA.NS": "COALINDIA", "NTPC.NS": "NTPC", "M&M.NS": "M&M", 
            "BAJFINANCE.NS": "BAJFINANCE", "^NSEI": "nifty50", "^BSESN": "sensex", 
            "^NSEBANK": "niftybank"
        };
        
        const symbolsList = Object.keys(symbolsMap).join(",");
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbolsList}`;
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("Proxy error");
            const json = await response.json();
            const rawData = JSON.parse(json.contents);
            
            if (!rawData || !rawData.quoteResponse || !rawData.quoteResponse.result) {
                throw new Error("Invalid response format");
            }
            
            const results = rawData.quoteResponse.result;
            
            results.forEach(item => {
                const key = symbolsMap[item.symbol];
                if (!key) return;
                
                const price = parseFloat(item.regularMarketPrice.toFixed(2));
                const change = parseFloat(item.regularMarketChange.toFixed(2));
                const pct = parseFloat(item.regularMarketChangePercent.toFixed(2));
                
                // 1. If it's a market index
                if (key === "nifty50" || key === "sensex" || key === "niftybank") {
                    const idxObj = window.SwingTradeDB.marketIndex[key];
                    if (idxObj) {
                        idxObj.price = price;
                        idxObj.change = change;
                        idxObj.pctChange = pct;
                        
                        // Update Header DOM elements
                        const valEl = document.getElementById(`ticker-${key === "nifty50" ? "nifty" : (key === "sensex" ? "sensex" : "niftybank")}`);
                        const pctEl = document.getElementById(`pct-${key === "nifty50" ? "nifty" : (key === "sensex" ? "sensex" : "niftybank")}`);
                        
                        if (valEl && pctEl) {
                            valEl.innerText = price.toLocaleString('en-IN', {minimumFractionDigits: 2});
                            pctEl.innerText = `${pct >= 0 ? '+' : ''}${pct}%`;
                            pctEl.className = pct >= 0 ? "ticker-pct bullish" : "ticker-pct bearish";
                        }
                    }
                } 
                // 2. If it's a stock
                else {
                    const stock = window.SwingTradeDB.stocks[key];
                    if (stock) {
                        stock.price = price;
                        stock.change = change;
                        stock.pctChange = pct;
                        stock.volume = item.regularMarketVolume || stock.volume;
                        
                        // Update last bar in historical sequence
                        const history = stock.history;
                        if (history.length > 0) {
                            const lastBar = history[history.length - 1];
                            lastBar.close = price;
                            lastBar.high = Math.max(lastBar.high, item.regularMarketDayHigh || price);
                            lastBar.low = Math.min(lastBar.low, item.regularMarketDayLow || price);
                            lastBar.volume = item.regularMarketVolume || lastBar.volume;
                        }
                        
                        // Recalculate indicators & explanations
                        stock.swingScore = window.SwingTradeDB.calculateSwingScore(stock);
                        stock.aiExplanation = window.SwingTradeDB.generateAIExplanation(stock);
                    }
                }
            });
            
            // Success indicator feedback
            if (statusText && statusDot) {
                statusText.innerText = "Live Market Connected";
                statusDot.style.background = "var(--accent-green)";
                statusDot.style.boxShadow = "0 0 8px var(--accent-green)";
            }
            
            // Refresh relevant layout views with new prices
            updateDashboardMetrics();
            loadDashboardTable();
            loadPortfolioAndWatchlist();
            
            // Redraw active chart if currently visible
            const activeScreen = document.querySelector(".screen.active");
            if (activeScreen && activeScreen.id === "screen-chart" && activeChart && activeChart.stock) {
                const currentTicker = activeChart.stock.ticker;
                activeChart.setStock(window.SwingTradeDB.stocks[currentTicker]);
            }
            
        } catch (e) {
            console.error("Live quote fetch error:", e);
            if (statusText && statusDot) {
                statusText.innerText = "Reconnecting...";
                statusDot.style.background = "var(--accent-orange)";
                statusDot.style.boxShadow = "0 0 8px var(--accent-orange)";
            }
        }
    };

    // -------------------------------------------------------------
    // 12. Initial Application Load Orchestrator
    // -------------------------------------------------------------
    const initApp = () => {
        // Load initial lists
        updateDashboardMetrics();
        loadSectorHeatmap();
        loadDashboardTable();
        loadRecommendationsList("weekly", "weeklyRecommendationsList");
        loadRecommendationsList("monthly", "monthlyRecommendationsList");
        loadPortfolioAndWatchlist();
        loadAlertsHistory();

        // Load Chart dropdowns
        initChartTerminal();

        // Start live polling loop
        fetchLiveQuotes();
        setInterval(fetchLiveQuotes, 8000);
    };

    initApp();
});
