// SwingTrade AI - Interactive Stock Chart Renderer (HTML5 Canvas)

class StockChart {
    constructor(canvasId, legendId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.legend = document.getElementById(legendId);
        
        this.stock = null;
        this.hoverIndex = -1;
        this.visibleBars = 60; // Render last 60 trading days
        
        this.init();
    }

    init() {
        // Handle resizing and DPI scaling
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Event listeners for crosshair tracking
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        // Scale for high-DPI (Retina) displays
        const dpi = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpi;
        this.canvas.height = rect.height * dpi;
        this.ctx.scale(dpi, dpi);
        
        this.width = rect.width;
        this.height = rect.height;
        
        if (this.stock) {
            this.render();
        }
    }

    setStock(stockData) {
        this.stock = stockData;
        this.hoverIndex = -1;
        this.render();
    }

    handleMouseMove(e) {
        if (!this.stock) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate chart layout coordinates to check boundaries
        const margins = this.getLayoutMargins();
        const chartWidth = this.width - margins.left - margins.right;
        
        if (mouseX >= margins.left && mouseX <= this.width - margins.right) {
            const barWidth = chartWidth / this.visibleBars;
            const history = this.stock.history;
            const startIndex = Math.max(0, history.length - this.visibleBars);
            
            const relativeX = mouseX - margins.left;
            const barOffset = Math.floor(relativeX / barWidth);
            const index = Math.min(startIndex + barOffset, history.length - 1);
            
            if (this.hoverIndex !== index) {
                this.hoverIndex = index;
                this.render();
                this.updateLegend(index);
            }
        }
    }

    handleMouseLeave() {
        this.hoverIndex = -1;
        this.render();
        if (this.stock) {
            this.updateLegend(this.stock.history.length - 1);
        }
    }

    getLayoutMargins() {
        return {
            left: 20,
            right: 65,
            top: 25,
            bottom: 30
        };
    }

    updateLegend(index) {
        if (!this.legend || !this.stock || index < 0) return;
        
        const bar = this.stock.history[index];
        const tech = this.stock.indicatorsHistory;
        const curr = this.stock.currency;
        
        const sma20Val = tech.sma20[index] ? `${curr}${tech.sma20[index]}` : 'N/A';
        const sma50Val = tech.sma50[index] ? `${curr}${tech.sma50[index]}` : 'N/A';
        const sma200Val = tech.sma200[index] ? `${curr}${tech.sma200[index]}` : 'N/A';
        const rsiVal = tech.rsi[index] ? tech.rsi[index].toFixed(1) : 'N/A';
        const macdVal = tech.macd[index] ? tech.macd[index].toFixed(2) : 'N/A';
        const signalVal = tech.macdSignal[index] ? tech.macdSignal[index].toFixed(2) : 'N/A';
        
        const isBullish = bar.close >= bar.open;
        const changeVal = parseFloat((bar.close - bar.open).toFixed(2));
        const pctChangeVal = ((changeVal / bar.open) * 100).toFixed(2);
        const changeClass = isBullish ? 'text-green' : 'text-red';
        const changeSign = isBullish ? '+' : '';

        this.legend.innerHTML = `
            <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; font-weight: 600; color: #eceff1; padding: 4px 0;">
                <div>Date: <span style="color:#00b0ff;">${bar.date}</span></div>
                <div>O: <span>${curr}${bar.open}</span></div>
                <div>H: <span>${curr}${bar.high}</span></div>
                <div>L: <span>${curr}${bar.low}</span></div>
                <div>C: <span>${curr}${bar.close}</span></div>
                <div class="${changeClass}">Change: <span>${changeSign}${changeVal} (${changeSign}${pctChangeVal}%)</span></div>
                <div>Vol: <span>${(bar.volume / 100000).toFixed(1)}L</span></div>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 12px; font-size: 11px; color: #90a4ae; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-top: 2px;">
                <div><span style="color: #2196f3;">■</span> 20 DMA: <span>${sma20Val}</span></div>
                <div><span style="color: #ff9800;">■</span> 50 DMA: <span>${sma50Val}</span></div>
                <div><span style="color: #9c27b0;">■</span> 200 DMA: <span>${sma200Val}</span></div>
                <div><span style="color: #e040fb;">■</span> RSI: <span>${rsiVal}</span></div>
                <div><span style="color: #00e676;">■</span> MACD: <span style="color: ${tech.macd[index] > tech.macdSignal[index] ? '#00e676':'#ff1744'};">${macdVal}</span> Signal: <span>${signalVal}</span></div>
            </div>
        `;
    }

    render() {
        if (!this.stock) return;
        
        const ctx = this.ctx;
        const width = this.width;
        const height = this.height;
        
        // Clear canvas
        ctx.fillStyle = '#141722';
        ctx.fillRect(0, 0, width, height);

        const margins = this.getLayoutMargins();
        const availableHeight = height - margins.top - margins.bottom;
        
        // Split chart heights
        // 1. Price Chart + Overlaid Volume: 60%
        // 2. RSI Panel: 18%
        // 3. MACD Panel: 22%
        const priceHeight = Math.round(availableHeight * 0.58);
        const rsiHeight = Math.round(availableHeight * 0.18);
        const macdHeight = Math.round(availableHeight * 0.24);
        
        const priceTop = margins.top;
        const rsiTop = priceTop + priceHeight + 10;
        const macdTop = rsiTop + rsiHeight + 10;
        
        const chartWidth = width - margins.left - margins.right;

        // Slice visibility array
        const history = this.stock.history;
        const startIndex = Math.max(0, history.length - this.visibleBars);
        const endIndex = history.length - 1;
        const activeBarsCount = history.length - startIndex;
        
        const visiblePrices = history.slice(startIndex);
        const sma20 = this.stock.indicatorsHistory.sma20.slice(startIndex);
        const sma50 = this.stock.indicatorsHistory.sma50.slice(startIndex);
        const sma200 = this.stock.indicatorsHistory.sma200.slice(startIndex);
        
        // Determine min and max for price chart scaling
        let maxVal = Math.max(...visiblePrices.map(b => b.high));
        let minVal = Math.min(...visiblePrices.map(b => b.low));
        
        // Include moving averages and S/R levels inside scaling if they are defined
        const validSmas = [...sma20, ...sma50, ...sma200].filter(v => v !== null);
        if (validSmas.length > 0) {
            maxVal = Math.max(maxVal, ...validSmas);
            minVal = Math.min(minVal, ...validSmas);
        }

        // Include Support and Resistance zones in price grid
        const techAnalysis = this.stock.technicalAnalysis;
        const supports = techAnalysis.supportLevels;
        const resistances = techAnalysis.resistanceLevels;
        
        supports.forEach(s => minVal = Math.min(minVal, s * 0.98));
        resistances.forEach(r => maxVal = Math.max(maxVal, r * 1.02));

        // Padding around max/min
        const priceRange = maxVal - minVal;
        maxVal += priceRange * 0.05;
        minVal -= priceRange * 0.05;
        
        // Horizontal grid scaling helper
        const getX = (idx) => margins.left + (idx * (chartWidth / this.visibleBars)) + (chartWidth / this.visibleBars / 2);
        
        // Vertical price scaling helper
        const getPriceY = (val) => priceTop + (1 - (val - minVal) / (maxVal - minVal)) * priceHeight;

        // Draw panels grid frames
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 1;
        
        // Gridlines for price chart
        for (let i = 0; i <= 4; i++) {
            let priceVal = minVal + (maxVal - minVal) * (i / 4);
            let y = getPriceY(priceVal);
            ctx.beginPath();
            ctx.moveTo(margins.left, y);
            ctx.lineTo(width - margins.right, y);
            ctx.stroke();
            
            // Labels on the right side
            ctx.fillStyle = '#607d8b';
            ctx.font = '10px Outfit';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${this.stock.currency}${priceVal.toFixed(1)}`, width - margins.right + 5, y);
        }

        // Draw Support Zones (Green rectangles)
        supports.forEach(support => {
            let y1 = getPriceY(support * 0.992);
            let y2 = getPriceY(support * 1.008);
            ctx.fillStyle = 'rgba(0, 230, 118, 0.05)';
            ctx.fillRect(margins.left, y1, chartWidth, y2 - y1);
            
            // Draw a subtle line in the middle
            ctx.strokeStyle = 'rgba(0, 230, 118, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(margins.left, getPriceY(support));
            ctx.lineTo(width - margins.right, getPriceY(support));
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = 'rgba(0, 230, 118, 0.8)';
            ctx.fillText('Support Zone', margins.left + 5, getPriceY(support) - 8);
        });

        // Draw Resistance Zones (Red rectangles)
        resistances.forEach(resistance => {
            let y1 = getPriceY(resistance * 0.992);
            let y2 = getPriceY(resistance * 1.008);
            ctx.fillStyle = 'rgba(255, 23, 68, 0.05)';
            ctx.fillRect(margins.left, y1, chartWidth, y2 - y1);
            
            // Draw a subtle line in the middle
            ctx.strokeStyle = 'rgba(255, 23, 68, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(margins.left, getPriceY(resistance));
            ctx.lineTo(width - margins.right, getPriceY(resistance));
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = 'rgba(255, 23, 68, 0.8)';
            ctx.fillText('Resistance Zone', margins.left + 5, getPriceY(resistance) - 8);
        });

        // Specific Draw: Breakout lines (Reliance and Nvidia)
        if (this.stock.ticker === "RELIANCE" || this.stock.ticker === "NVDA") {
            let breakoutPrice = resistances[0];
            ctx.strokeStyle = '#00b0ff';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 3]);
            ctx.beginPath();
            ctx.moveTo(margins.left, getPriceY(breakoutPrice));
            ctx.lineTo(width - margins.right, getPriceY(breakoutPrice));
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = '#00b0ff';
            ctx.fillText('CONFIRMED BREAKOUT LEVEL', margins.left + 15, getPriceY(breakoutPrice) + 12);
        }

        // Draw Trendlines
        // For HDFCBANK or TATAMOTORS, connect troughs to visualize trendlines
        if (this.stock.ticker === "TATAMOTORS" || this.stock.ticker === "RELIANCE") {
            // Trendline connecting two major troughs (e.g. at index 5 and index 45 of visible window)
            const pt1Idx = 8;
            const pt2Idx = 48;
            let val1 = visiblePrices[pt1Idx].low * 0.995;
            let val2 = visiblePrices[pt2Idx].low * 0.995;
            
            ctx.strokeStyle = '#ffb300';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(getX(pt1Idx), getPriceY(val1));
            ctx.lineTo(getX(pt2Idx), getPriceY(val2));
            // Extend the line to current close index
            let slope = (getPriceY(val2) - getPriceY(val1)) / (getX(pt2Idx) - getX(pt1Idx));
            let currentX = getX(activeBarsCount - 1);
            let currentY = getPriceY(val2) + slope * (currentX - getX(pt2Idx));
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
            
            ctx.fillStyle = '#ffb300';
            ctx.font = '9px Outfit';
            ctx.fillText('Upward Trendline', getX(pt1Idx) + 15, getPriceY(val1) - 10);
        }

        // Overlaid Volume bars (bottom of Price chart)
        const volMax = Math.max(...visiblePrices.map(b => b.volume));
        const volMin = Math.min(...visiblePrices.map(b => b.volume));
        const barWidth = chartWidth / this.visibleBars;
        
        visiblePrices.forEach((bar, idx) => {
            const x = margins.left + (idx * barWidth);
            const isBullish = bar.close >= bar.open;
            const volHeight = (bar.volume / volMax) * (priceHeight * 0.2); // cap volume at 20% of price chart height
            const y = priceTop + priceHeight - volHeight;
            
            // Color volumes (bright blue/purple on volume spikes)
            if (bar.volume > this.stock.avgVolume20 * 1.8) {
                ctx.fillStyle = 'rgba(0, 176, 255, 0.45)'; // Heavy Volume spike
            } else {
                ctx.fillStyle = isBullish ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 23, 68, 0.15)';
            }
            
            ctx.fillRect(x + 1, y, barWidth - 2, volHeight);
        });

        // Draw Candlesticks
        visiblePrices.forEach((bar, idx) => {
            const x = margins.left + (idx * barWidth) + (barWidth / 2);
            const bodyLeft = margins.left + (idx * barWidth) + 2;
            const bodyWidth = barWidth - 4;
            
            const isBullish = bar.close >= bar.open;
            ctx.strokeStyle = isBullish ? '#00e676' : '#ff1744';
            ctx.fillStyle = isBullish ? '#00e676' : '#ff1744';
            ctx.lineWidth = 1.2;
            
            // Wick
            ctx.beginPath();
            ctx.moveTo(x, getPriceY(bar.high));
            ctx.lineTo(x, getPriceY(bar.low));
            ctx.stroke();
            
            // Body
            const yOpen = getPriceY(bar.open);
            const yClose = getPriceY(bar.close);
            const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
            ctx.fillRect(bodyLeft, Math.min(yOpen, yClose), bodyWidth, bodyHeight);
        });

        // Draw Moving Averages (Lines)
        const drawSmaLine = (dataSlice, color) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            let firstPoint = true;
            dataSlice.forEach((val, idx) => {
                if (val !== null) {
                    let x = getX(idx);
                    let y = getPriceY(val);
                    if (firstPoint) {
                        ctx.moveTo(x, y);
                        firstPoint = false;
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            });
            ctx.stroke();
        };
        
        drawSmaLine(sma20, '#2196f3'); // Blue
        drawSmaLine(sma50, '#ff9800'); // Orange
        drawSmaLine(sma200, '#9c27b0'); // Purple

        // 2. RSI PANEL DRAWING
        ctx.fillStyle = '#1c1f2e';
        ctx.fillRect(margins.left, rsiTop, chartWidth, rsiHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.strokeRect(margins.left, rsiTop, chartWidth, rsiHeight);

        // RSI vertical scale helper
        const getRsiY = (val) => rsiTop + (1 - val / 100) * rsiHeight;
        
        // Draw 30 / 70 Oversold/Overbought boundaries
        ctx.strokeStyle = 'rgba(255, 23, 68, 0.25)'; // Oversold boundary 30
        ctx.beginPath();
        ctx.moveTo(margins.left, getRsiY(30));
        ctx.lineTo(width - margins.right, getRsiY(30));
        ctx.stroke();
        
        ctx.strokeStyle = 'rgba(0, 230, 118, 0.25)'; // Overbought boundary 70
        ctx.beginPath();
        ctx.moveTo(margins.left, getRsiY(70));
        ctx.lineTo(width - margins.right, getRsiY(70));
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#607d8b';
        ctx.fillText('70', width - margins.right + 5, getRsiY(70));
        ctx.fillText('30', width - margins.right + 5, getRsiY(30));
        ctx.fillText('RSI (14)', margins.left + 5, rsiTop + 12);

        // Draw RSI line
        const rsiData = this.stock.indicatorsHistory.rsi.slice(startIndex);
        ctx.strokeStyle = '#e040fb'; // Neon pink/purple for RSI
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        let firstRsi = true;
        rsiData.forEach((val, idx) => {
            if (val !== null) {
                let x = getX(idx);
                let y = getRsiY(val);
                if (firstRsi) {
                    ctx.moveTo(x, y);
                    firstRsi = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        });
        ctx.stroke();

        // 3. MACD PANEL DRAWING
        ctx.fillStyle = '#1c1f2e';
        ctx.fillRect(margins.left, macdTop, chartWidth, macdHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.strokeRect(margins.left, macdTop, chartWidth, macdHeight);

        const macdData = this.stock.indicatorsHistory.macd.slice(startIndex);
        const signalData = this.stock.indicatorsHistory.macdSignal.slice(startIndex);
        const histData = this.stock.indicatorsHistory.macdHist.slice(startIndex);

        // Scaling helper
        let maxMacd = Math.max(
            ...macdData.filter(v => v !== null).map(Math.abs),
            ...signalData.filter(v => v !== null).map(Math.abs),
            ...histData.filter(v => v !== null).map(Math.abs),
            0.1 // avoid division by zero
        );
        maxMacd *= 1.1; // padding
        
        const getMacdY = (val) => {
            let centerY = macdTop + macdHeight / 2;
            return centerY - (val / maxMacd) * (macdHeight / 2);
        };

        // Draw zero line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(margins.left, getMacdY(0));
        ctx.lineTo(width - margins.right, getMacdY(0));
        ctx.stroke();

        ctx.fillStyle = '#607d8b';
        ctx.fillText('MACD (12, 26, 9)', margins.left + 5, macdTop + 12);

        // Draw Histogram
        histData.forEach((val, idx) => {
            if (val !== null) {
                let x = margins.left + (idx * barWidth);
                let yZero = getMacdY(0);
                let yVal = getMacdY(val);
                
                ctx.fillStyle = val >= 0 ? 'rgba(0, 230, 118, 0.4)' : 'rgba(255, 23, 68, 0.4)';
                ctx.fillRect(x + 1, Math.min(yZero, yVal), barWidth - 2, Math.abs(yVal - yZero));
            }
        });

        // Draw MACD Line (blue)
        ctx.strokeStyle = '#2196f3';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        let firstMacd = true;
        macdData.forEach((val, idx) => {
            if (val !== null) {
                let x = getX(idx);
                let y = getMacdY(val);
                if (firstMacd) {
                    ctx.moveTo(x, y);
                    firstMacd = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        });
        ctx.stroke();

        // Draw Signal Line (orange)
        ctx.strokeStyle = '#ff9800';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        let firstSignal = true;
        signalData.forEach((val, idx) => {
            if (val !== null) {
                let x = getX(idx);
                let y = getMacdY(val);
                if (firstSignal) {
                    ctx.moveTo(x, y);
                    firstSignal = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
        });
        ctx.stroke();

        // Draw Date markers on X axis (Bottom panel margin)
        visiblePrices.forEach((bar, idx) => {
            if (idx % 12 === 0) { // Render date every 12 bars (~2.5 weeks)
                let x = getX(idx);
                ctx.fillStyle = '#607d8b';
                ctx.font = '9px Outfit';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.fillText(bar.date, x, height - margins.bottom + 8);
                
                // Vertical grid lines extending up
                ctx.strokeStyle = 'rgba(255,255,255,0.02)';
                ctx.beginPath();
                ctx.moveTo(x, priceTop);
                ctx.lineTo(x, height - margins.bottom);
                ctx.stroke();
            }
        });

        // Draw Crosshair (if cursor is hovering)
        if (this.hoverIndex >= startIndex && this.hoverIndex <= endIndex) {
            const hoverOffset = this.hoverIndex - startIndex;
            const x = getX(hoverOffset);
            
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            
            // Vertical cursor line
            ctx.beginPath();
            ctx.moveTo(x, priceTop);
            ctx.lineTo(x, height - margins.bottom);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw a small circle overlay on close price of hovered candle
            let valClose = visiblePrices[hoverOffset].close;
            let yClose = getPriceY(valClose);
            
            ctx.fillStyle = '#00b0ff';
            ctx.beginPath();
            ctx.arc(x, yClose, 4, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    }
}

window.StockChartRenderer = StockChart;
