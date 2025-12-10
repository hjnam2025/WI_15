// ============================================================
//  script.js (FINAL FIXED VERSION)
//  - [FIXED] 이용가능 필터 토글 시 시군구 필터 사라짐 현상 해결 (로직 복구)
//  - SearchPanel 접기/펼치기 정상 작동
//  - 지도 이동 속도 개선 (setView)
//  - 리사이즈 핸들 위치 (검색:하단, 나머지:상단)
// ============================================================

// -------------------------------
// 1. 전역 변수
// -------------------------------
let map;
let markers = [];
let markerClusterGroup;
let usableClusterGroup;
let territorialLayer;
let portLayer;
let routeLayer;
let currentLayer;

let allIslands = [];
let allPorts = [];
let islandMarkers = new Map();
let portMarkers = new Map();
let regionPolygon = null;

let currentIslandListItems = [];
let currentViewportItems = [];

// 초기 필터 상태
let isTerritorialActive = true;
let isUsableActive = true;
let isPortActive = true;

// 경로 데이터
const ferryRoutes = [
    { island: "팔미도", port: "인천항 연안부두" },
    { island: "차귀도", port: "자구내포구" },
    { island: "소쿠리섬", port: "명동선착장" },
    { island: "소매물도 등대섬", port: "통영항" },
    { island: "질마도", port: "회진항" },
    { island: "옹도", port: "안흥외항" },
    { island: "할미도", port: "무한의 다리" },
    { island: "사승봉도", port: "승봉도 선착장" },
    { island: "시호도", port: "시호도원시체험의섬 선착장" },
    { island: "작약도", port: "구읍뱃터" },
    { island: "범섬(호도)", port: "서귀포항" },
    { island: "숲섬", port: "서귀포항" },
    { island: "문섬(문도)", port: "서귀포항" },
    { island: "제2문섬(새끼섬)", port: "서귀포항" },
    { island: "지귀도", port: "위미항" },
    { island: "형제도(형제섬)", port: "화순항" },
    { island: "제2형제도", port: "화순항" },
    { island: "십이동파도2", port: "군산항" },
    { island: "횡경도", port: "군산항" },
    { island: "소횡경도", port: "군산항" },
    { island: "십이동파도3(소금도)", port: "군산항" }
];

let islandCoords = {};
let portCoords = {};

const territorialIslands = [
    "호미곶", "1.5미이터암", "생도", "간여암", "하백도",
    "사수도", "절명서", "소국흘도", "고서", "직도",
    "서격렬비도", "소령도", "홍도"
];

const regionMapping = {
    '경기도': ['경기도', '인천광역시'],
    '충청도': ['충청북도', '충청남도', '세종특별자치시'],
    '전라남도': ['전라남도'],
    '전라북도': ['전라북도', '전북특별자치도'],
    '경상남도': ['경상남도', '부산광역시', '울산광역시'],
    '경상북도': ['경상북도', '대구광역시'],
    '강원도': ['강원특별자치도', '강원도'],
    '제주도': ['제주특별자치도', '제주도']
};

const mapStyles = {
    satellite: L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: '© Esri', maxZoom: 19 }
    ),
    mystyle: L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        { attribution: '© OpenStreetMap contributors © CARTO', maxZoom: 19 }
    ),
    dark: L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        { attribution: '© CARTO', maxZoom: 19 }
    )
};

// ------------------------------------------------------
// 2. 유틸 함수
// ------------------------------------------------------
function getSolidMarkerSvg(color, size) {
    return `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="${color}">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5" fill="rgba(0,0,0,0.2)"/>
        </svg>
    `;
}

function updatePortMarkers() {
    if (!map) return;
    const zoom = map.getZoom();
    let size = 20 + (zoom - 6) * 5;
    if (size < 15) size = 15;
    if (size > 60) size = 60;

    document.querySelectorAll('.port-marker-content').forEach(el => {
        el.style.fontSize = `${size}px`;
        el.style.lineHeight = `${size}px`;
        el.style.width = `${size}px`;
        el.style.height = `${size}px`;
    });
}

function dmsToDecimal(dms) {
    if (!dms || typeof dms !== "string") return null;
    let m = dms.match(/(\d+)[°]\s*(\d+)[′']\s*([\d.]+)[″"]\s*([NSEW])/);
    if (m) {
        let val = parseFloat(m[1]) + parseFloat(m[2]) / 60 + parseFloat(m[3]) / 3600;
        if (m[4] === "S" || m[4] === "W") val = -val;
        return val;
    }
    let d = dms.match(/(-?\d+\.?\d*)\s*([NSEW])?/);
    if (d) {
        let val = parseFloat(d[1]);
        if (d[2] === "S" || d[2] === "W") val = -val;
        return val;
    }
    return null;
}

function formatAddress(island) {
    const sido = island.Column3 || '';
    const sigungu = island.Column4 || '';
    let addr = [];
    if (sido && sigungu) {
        addr.push((sido.includes("광역시") || sido.includes("특별시")) ? `${sido} ${sigungu}` : sido, sigungu);
    } else if (sido) addr.push(sido);
    const parts = [island.Column5, island.Column6, island.Column7].filter(x => x && x.trim() !== '');
    return addr.concat(parts).join(" ") || "주소 정보 없음";
}

function checkIsTerritorial(island) {
    const name = island["무인도서 정보"];
    const code = island.Column2;
    const sido = island.Column3;
    if (code && code.includes("영해기점-")) return true;
    if (name === "홍도") return sido === "경상남도";
    return territorialIslands.includes(name);
}

function checkIsUsable(island) {
    const type = island.Column21 || '';
    return type.includes('이용가능') || type.includes('개발가능') || type.includes('준보전');
}

// ------------------------------------------------------
// 3. 컨텐츠 생성 (툴팁/상세정보)
// ------------------------------------------------------
function createTooltipContent(island) {
    const name = island['무인도서 정보'] || '이름 없음';
    const address = formatAddress(island);
    const isTerritorial = checkIsTerritorial(island);
    const isUsable = checkIsUsable(island);
    
    let html = `<div class="tooltip-title">
                    <span>${name}</span>
                    <div style="display:flex;">
                        ${isTerritorial ? '<span class="territorial-badge">영해기점</span>' : ''}
                        ${isUsable ? '<span class="usable-badge">이용가능</span>' : ''}
                    </div>
                </div>`;
    html += `<div class="tooltip-info"><strong>소재지:</strong> ${address}</div>`;
    html += `<div class="tooltip-info"><strong>관리유형:</strong> ${island.Column21 || '정보 없음'}</div>`;
    return html;
}

function createDetailContent(island) {
    const address = formatAddress(island);
    const name = island['무인도서 정보'] || '이름 없음';
    let isTerritorial = checkIsTerritorial(island);
    let territorialText = isTerritorial ? "영해기점" : (island.Column20 || "해당 없음");
    if (territorialText === '영해기점 없음') territorialText = "해당 없음";
    const territorialStyle = isTerritorial ? 'color: #e74c3c; font-weight: bold;' : '';
    
    const sigungu = island.Column4 || '';
    const searchQuery = encodeURIComponent(`${sigungu} ${name} 배편`);
    const searchUrl = `https://search.naver.com/search.naver?query=${searchQuery}`;

    return `
        <div class="sticky-info-header">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                <h3>${name}</h3>
                <button class="route-search-btn" onclick="window.open('${searchUrl}', '_blank')" style="font-family:GMarketSans; font-weight: 500; font-size: 1.2em; cursor: pointer; display: flex; align-items: center; gap: 4px; padding: 4px 15px;">
                    경로찾기 <img src="img/search.svg" alt="검색" style="width: 18px; height: 18px;">
                </button>
            </div>
        </div>
        <div class="info-row"><div class="info-label">소재지</div><div class="info-value">${address}</div></div>
        <div class="info-row"><div class="info-label">영해기점 유무</div><div class="info-value" style="${territorialStyle}">${territorialText}</div></div>
        <div class="info-row"><div class="info-label">관리유형</div><div class="info-value">${island.Column21 || '정보 없음'}</div></div>
        <div style="margin-top:15px;"></div>
        <div class="info-row"><div class="info-label">토지소유구분</div><div class="info-value">${island.Column9 || '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">관리번호</div><div class="info-value">${island.Column2 || '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">토지 소유자</div><div class="info-value">${island.Column10 || '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">토지 전체 면적(㎡)</div><div class="info-value">${island.Column11 ? island.Column11.toLocaleString() : '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">육지와의 거리(㎞)</div><div class="info-value">${island.Column16 !== undefined ? island.Column16 : '정보 없음'}</div></div>
        <div class="info-row horizontal">
            <div><div class="info-label">국유지</div><div class="info-value">${island.Column12 ? island.Column12.toLocaleString() : '-'}</div></div>
            <div><div class="info-label">공유지</div><div class="info-value">${island.Column13 ? island.Column13.toLocaleString() : '-'}</div></div>
            <div><div class="info-label">사유지</div><div class="info-value">${island.Column14 ? island.Column14.toLocaleString() : '-'}</div></div>
        </div>
        <div class="info-row"><div class="info-label">용도구분</div><div class="info-value">${island.Column18 || '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">지목</div><div class="info-value">${island.Column19 || '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">주변해역 관리유형</div><div class="info-value">${island.Column22 || '정보 없음'}</div></div>
        <div class="info-row"><div class="info-label">지정고시일</div><div class="info-value">${island.Column25 || '정보 없음'}</div></div>
    `;
}

// ------------------------------------------------------
// 4. 지도 초기화 및 데이터 로드
// ------------------------------------------------------
function initMap() {
    map = L.map('map', { zoomControl: false }).setView([36.5, 127.5], 7);
    currentLayer = mapStyles.satellite;
    currentLayer.addTo(map);

    markerClusterGroup = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50 });
    usableClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 50,
        iconCreateFunction: function (cluster) {
            const count = cluster.getChildCount();
            let c = 'marker-cluster-usable-';
            if (count < 10) c += 'small';
            else if (count < 100) c += 'medium';
            else c += 'large';
            return new L.DivIcon({
                html: `<div><span>${count}</span></div>`,
                className: `marker-cluster ${c}`,
                iconSize: new L.Point(40, 40)
            });
        }
    });

    map.addLayer(markerClusterGroup);
    map.addLayer(usableClusterGroup);

    territorialLayer = L.layerGroup();
    portLayer = L.layerGroup();
    routeLayer = L.layerGroup();

    if (isTerritorialActive) territorialLayer.addTo(map);
    if (isPortActive) {
        portLayer.addTo(map);
        routeLayer.addTo(map);
    }

    map.on("zoomend", updatePortMarkers);
}

function updateRegionCounts() {
    const regionSelect = document.getElementById('regionSelect');
    if (!regionSelect) return;
    const counts = {};
    for (const regionKey in regionMapping) {
        const subRegions = regionMapping[regionKey];
        const count = allIslands.filter(i => subRegions.some(r => (i.Column3 || '').includes(r))).length;
        counts[regionKey] = count;
    }
    const options = regionSelect.options;
    for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const regionKey = opt.value;
        if (regionKey && counts[regionKey] !== undefined) {
            let baseText = opt.textContent.replace(/\s*\(\d+\)$/, '');
            opt.textContent = `${baseText} (${counts[regionKey]})`;
        }
    }
}

async function loadIslands() {
    try {
        const response = await fetch('data00.json');
        const data = await response.json();
        allIslands = Array.isArray(data) ? data.filter(i => i['무인도서 정보'] !== '무인도서명' && i.Column23 && i.Column24) : [];
        updateRegionCounts();

        const normalMarkers = [], usableMarkers = [], allMarkersRef = [];
        const blueIconHtml = getSolidMarkerSvg('#89c1f5ff', '30px');
        const greenIconHtml = getSolidMarkerSvg('#27ae60', '30px');

        allIslands.forEach(island => {
            const lat = dmsToDecimal(island.Column23);
            const lng = dmsToDecimal(island.Column24);
            const iName = island['무인도서 정보'];
            const isUsable = checkIsUsable(island);

            if (lat && lng) {
                const sigungu = island.Column4 || "";
                const eupmyeondong = island.Column5 || "";
                const isJaeunHalmido = (iName === "할미도" && sigungu.includes("신안") && eupmyeondong.includes("자은"));
                
                if (iName === "질마도") { if (island.Column2 === "전남-완도-09-29") islandCoords[iName] = [lat, lng]; }
                else if (iName === "할미도") { if (isJaeunHalmido) islandCoords[iName] = [lat, lng]; }
                else islandCoords[iName] = [lat, lng];
            }

            if (lat && lng) {
                const isException = (iName === "할미도" || iName === "횡경도" || iName === "소횡경도");
                if (isUsableActive && !isUsable && !isException) return;

                const treatAsUsable = (isUsable && isUsableActive) || (isUsableActive && isException);
                const marker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: treatAsUsable ? 'usable-marker-icon' : 'custom-svg-marker',
                        html: treatAsUsable ? greenIconHtml : blueIconHtml,
                        iconSize: [30, 30], iconAnchor: [15, 30]
                    })
                });

                if (treatAsUsable) marker.on('add', function() { this.getElement().classList.add('usable-highlight'); });
                islandMarkers.set(marker, island);

                let tooltipHtml = createTooltipContent(island);
                const route = ferryRoutes.find(r => r.island === iName);
                if (route) tooltipHtml += `<div class="tooltip-info" style="color:#e67e22;"><strong>⛴ 출발:</strong> ${route.port}</div>`;
                
                marker.bindTooltip(tooltipHtml, { direction: 'top', className: 'island-tooltip' });
                marker.on('click', () => showIslandDetails(island));
                
                (treatAsUsable ? usableMarkers : normalMarkers).push(marker);
                allMarkersRef.push(marker);
            }
        });

        markers = allMarkersRef;
        markerClusterGroup.clearLayers();
        usableClusterGroup.clearLayers();
        markerClusterGroup.addLayers(normalMarkers);
        usableClusterGroup.addLayers(usableMarkers);

        if (isTerritorialActive) {
            updateTerritorialLayer();
            updateTerritorialListUI();
            document.getElementById('territorialListBox').classList.remove('hidden');
        }
        tryDrawRoutes();

        updateIslandList("");

    } catch (error) { console.error('Error:', error); }
}

async function loadPorts() {
    try {
        const response = await fetch('port.json');
        const ports = await response.json();
        allPorts = ports;
        ports.forEach(port => {
            const coords = port.경위도.split(',').map(c => parseFloat(c.trim()));
            if (coords[0] && coords[1]) {
                portCoords[port.이름] = [coords[0], coords[1]];
                const marker = L.marker(coords, {
                    icon: L.divIcon({ html: '<div class="port-marker-content">⛴</div>', className: 'port-marker-icon', iconSize: [30, 30] })
                });
                portMarkers.set(port.이름, marker);
                marker.bindTooltip(`<b>${port.이름}</b><br>${port.주소}`, { direction: 'top', className: 'island-tooltip' });
                portLayer.addLayer(marker);
            }
        });
        tryDrawRoutes();
        if(isPortActive) updatePortListUI();
    } catch (error) { console.error('Error loading ports:', error); }
}

function updateTerritorialLayer() {
    territorialLayer.clearLayers();
    const tIconHtml = getSolidMarkerSvg('#e74c3c', '30px');
    allIslands.forEach(island => {
        if (checkIsTerritorial(island)) {
            const lat = dmsToDecimal(island.Column23), lng = dmsToDecimal(island.Column24);
            if (lat && lng) {
                const marker = L.marker([lat, lng], { icon: L.divIcon({ className: 'territorial-marker-icon', html: tIconHtml, iconSize: [30, 30] }) });
                marker.on('add', function() { this.getElement().classList.add('territorial-highlight'); });
                marker.bindTooltip(createTooltipContent(island), { direction: 'top', className: 'island-tooltip' });
                marker.on('click', () => showIslandDetails(island));
                territorialLayer.addLayer(marker);
            }
        }
    });
}

function tryDrawRoutes() {
    routeLayer.clearLayers();
    if (Object.keys(islandCoords).length === 0 || Object.keys(portCoords).length === 0) return;
    ferryRoutes.forEach(route => {
        const iLoc = islandCoords[route.island];
        const pLoc = portCoords[route.port];
        if (iLoc && pLoc) {
            L.polyline([iLoc, pLoc], { color: '#ff4032ff', weight: 4, opacity: 0.95, dashArray: '5, 10' }).addTo(routeLayer);
        }
    });
}

// ------------------------------------------------------
// 5. UI 업데이트 및 필터 로직
// ------------------------------------------------------
function updatePortListUI() {
    const listContent = document.getElementById('portListContent');
    if (!listContent) return;
    let html = '';
    allPorts.forEach(port => {
        const dest = ferryRoutes.filter(r => r.port === port.이름).map(r => r.island).join(', ');
        const destHtml = dest ? `<div class="t-dest" style="color:#27ae60; font-size:0.85rem; margin-top:2px;">↳ 운항: ${dest}</div>` : '';
        html += `<div class="t-list-item" data-port-name="${port.이름}"><div class="t-name">${port.이름}</div><div class="t-addr">${port.주소}</div>${destHtml}</div>`;
    });
    listContent.innerHTML = html;
    listContent.querySelectorAll('.t-list-item').forEach(item => {
        item.addEventListener('click', function() {
            const portName = this.dataset.portName;
            const coords = portCoords[portName];
            if (coords) {
                map.setView(coords, 15, { animate: true });
                const marker = portMarkers.get(portName);
                if (marker) marker.openTooltip();
            }
        });
    });
}

function updateTerritorialListUI() {
    const listContent = document.getElementById('territorialListContent');
    if (!listContent) return;
    const tIslands = allIslands.filter(i => checkIsTerritorial(i));
    let html = '';
    tIslands.forEach(island => {
        html += `<div class="t-list-item" data-island-id="${island.Column2}"><div class="t-name">${island['무인도서 정보']}</div><div class="t-addr">${formatAddress(island)}</div></div>`;
    });
    listContent.innerHTML = html;
    listContent.querySelectorAll('.t-list-item').forEach(item => {
        item.addEventListener('click', function() {
            const islandId = this.dataset.islandId;
            const island = allIslands.find(i => i.Column2 === islandId);
            if (island) {
                showIslandDetails(island);
                const lat = dmsToDecimal(island.Column23), lng = dmsToDecimal(island.Column24);
                if (lat && lng) map.setView([lat, lng], 15, { animate: true });
            }
        });
    });
}

function updateViewportList() {
    const box = document.getElementById('viewportListBox');
    const listContent = document.getElementById('viewportListContent');
    if (box.classList.contains('hidden') || !listContent) return;
    
    if (map.getZoom() < 10) {
        listContent.innerHTML = '<p style="padding:10px; color:#999;">지도를 더 확대하세요.</p>';
        document.getElementById('viewportCount').textContent = '현재 화면의 섬 (-)';
        return;
    }
    
    const bounds = map.getBounds();
    let visibleIslands = allIslands.filter(island => {
        if (isUsableActive && !checkIsUsable(island)) {
            if (!checkIsTerritorial(island)) return false;
        }
        const lat = dmsToDecimal(island.Column23), lng = dmsToDecimal(island.Column24);
        if (lat && lng) return bounds.contains([lat, lng]);
        return false;
    });
    
    document.getElementById('viewportCount').textContent = `현재 화면의 섬 (${visibleIslands.length})`;
    let html = '';
    if (visibleIslands.length === 0) html = '<p style="padding:10px; color:#999;">화면 내 섬이 없습니다.</p>';
    else {
        visibleIslands.forEach(island => {
            html += `<div class="t-list-item" data-island-id="${island.Column2}"><div class="t-name">${island['무인도서 정보']}</div><div class="t-addr">${formatAddress(island)}</div></div>`;
        });
    }
    listContent.innerHTML = html;
    listContent.querySelectorAll('.t-list-item').forEach(item => {
        item.addEventListener('click', function() {
            const island = allIslands.find(i => i.Column2 === this.dataset.islandId);
            if (island) {
                showIslandDetails(island);
                const lat = dmsToDecimal(island.Column23), lng = dmsToDecimal(island.Column24);
                if(lat && lng) map.setView([lat, lng], 15, { animate: true });
            }
        });
    });
}

function showIslandDetails(island) {
    const panel = document.getElementById('detailPanel');
    const container = document.getElementById('detailContainer');
    container.innerHTML = createDetailContent(island);
    panel.classList.remove('hidden');
    container.scrollTop = 0;
}

function getIslandsByRegion(regionName) {
    if (!regionName) return allIslands;
    const regions = regionMapping[regionName] || [];
    return allIslands.filter(i => regions.some(r => (i.Column3 || '').includes(r)));
}

function updateSigunguSelect(islands) {
    const sel = document.getElementById('sigunguSelect');
    const map = new Map();
    islands.forEach(i => {
        if (i.Column4) {
            let full = i.Column4;
            if ((i.Column3 || '').match(/(광역시|특별시)/)) full = `${i.Column3} ${i.Column4}`;
            if (!map.has(i.Column4)) map.set(i.Column4, { short: i.Column4, full, sido: i.Column3 });
        }
    });
    const list = Array.from(map.values()).sort((a, b) => a.sido !== b.sido ? a.sido.localeCompare(b.sido) : a.short.localeCompare(b.short));
    
    if (!list.length) { sel.style.display = 'none'; sel.value = ''; return; }
    sel.style.display = 'block';
    sel.innerHTML = '<option value="">전체</option>' + list.map(s => `<option value="${s.short}">${s.full}</option>`).join('');
}

function updateIslandList(regionName, sigungu = '') {
    const header = document.querySelector('.island-list-header h4');
    let islands = getIslandsByRegion(regionName);
    
    // 자동 펼치기
    const list = document.getElementById('islandList');
    const toggleBtn = document.getElementById('toggleIslandList');
    const searchPanel = document.getElementById('searchPanel');
    const resizeHandle = searchPanel ? searchPanel.querySelector('.resize-handle') : null;
    
    if (list) {
        list.style.display = 'block';
        if(toggleBtn) toggleBtn.textContent = '접기 ▲';
        if(resizeHandle) resizeHandle.style.display = 'flex';
        if(searchPanel.classList.contains('collapsed')) {
            searchPanel.classList.remove('collapsed');
            searchPanel.style.height = '60vh'; 
        } else {
             if(searchPanel.offsetHeight < 300) {
                searchPanel.style.height = '60vh';
            }
        }
    }

    if (isUsableActive) {
        islands = islands.filter(i => {
            const name = i['무인도서 정보'];
            const isException = (name === "할미도" || name === "횡경도" || name === "소횡경도");
            return checkIsUsable(i) || isException;
        });
    }
    if (sigungu) islands = islands.filter(i => i.Column4 === sigungu);
    currentIslandListItems = islands;

    if (!regionName) {
        document.getElementById('sigunguSelect').style.display = 'none';
        if (header) header.textContent = '섬 목록';
        if(regionPolygon) map.removeLayer(regionPolygon);
        renderIslandList();
        return;
    }
    
    if (header) header.textContent = sigungu ? `섬 목록 - ${sigungu}` : '섬 목록 - 전체';
    renderIslandList();
    
    if(regionPolygon) map.removeLayer(regionPolygon);
    const coords = [];
    islands.forEach(i => {
        const lat = dmsToDecimal(i.Column23), lng = dmsToDecimal(i.Column24);
        if(lat && lng) coords.push([lat, lng]);
    });
    if(coords.length) {
        const bounds = L.latLngBounds(coords);
        map.fitBounds(bounds.pad(0.2));
        try {
            regionPolygon = L.polygon([
                bounds.getNorthWest(), bounds.getNorthEast(), 
                bounds.getSouthEast(), bounds.getSouthWest()
            ], { color: '#ffffff', weight: 2, opacity: 1, fill: false, className: 'region-highlight-polygon' }).addTo(map);
        } catch(e) {}
    }
}

function renderIslandList() {
    const list = document.getElementById('islandList');
    if (!list) return;
    if (currentIslandListItems.length === 0) {
        list.innerHTML = '<p style="padding:10px; color:#666; text-align:center;">결과 없음</p>';
        return;
    }
    list.innerHTML = currentIslandListItems.map(i => 
        `<div class="island-list-item" data-island-id="${i.Column2}">
            <div class="island-name">${i['무인도서 정보']}</div>
            <div class="island-address">${formatAddress(i)}</div>
        </div>`
    ).join('');
    
    list.querySelectorAll('.island-list-item').forEach(item => {
        item.addEventListener('click', function() {
            const island = allIslands.find(i => i.Column2 === this.dataset.islandId);
            if (island) {
                showIslandDetails(island);
                const lat = dmsToDecimal(island.Column23), lng = dmsToDecimal(island.Column24);
                if(lat && lng) map.setView([lat, lng], 15, { animate: true });
            }
        });
    });
}

function toggleSearchPanel() {
    const searchPanel = document.getElementById('searchPanel'); const openBtn = document.getElementById('openSearchPanelBtn');
    if (searchPanel.classList.contains('hidden')) { searchPanel.classList.remove('hidden'); openBtn.classList.add('hidden'); } else { searchPanel.classList.add('hidden'); openBtn.classList.remove('hidden'); }
}

function setupCollapseButtons() {
    const panels = [
        { btnId: 'toggleIslandList', panelId: 'searchPanel' },
        { btnId: 'toggleTerritorialInfo', panelId: 'territorialInfoPanel' },
        { btnId: 'toggleDetailPanel', panelId: 'detailPanel' },
        { btnId: 'togglePortList', panelId: 'portListBox' },
        { btnId: 'toggleTerritorialList', panelId: 'territorialListBox' },
        { btnId: 'toggleViewportList', panelId: 'viewportListBox' }
    ];

    panels.forEach(p => {
        const btn = document.getElementById(p.btnId);
        const panel = document.getElementById(p.panelId);
        
        if (btn && panel) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                
                if(p.panelId === 'searchPanel') {
                    const list = document.getElementById('islandList');
                    const handle = panel.querySelector('.resize-handle');
                    
                    if(list.style.display === 'none') {
                        list.style.display = 'block';
                        btn.textContent = '접기 ▲';
                        if(handle) handle.style.display = 'flex';
                        panel.style.height = '60vh'; 
                    } else {
                        list.style.display = 'none';
                        btn.textContent = '펼치기 ▼';
                        if(handle) handle.style.display = 'none';
                        panel.style.height = 'auto';
                    }
                } else {
                    panel.classList.toggle('collapsed');
                    if (panel.classList.contains('collapsed')) {
                        btn.textContent = '+';
                    } else {
                        btn.textContent = '−';
                    }
                }
            });
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const tBtn = document.getElementById('territorialToggleBtn');
    const uBtn = document.getElementById('usableToggleBtn');
    const pBtn = document.getElementById('portToggleBtn');
    if(isTerritorialActive) tBtn.classList.add('active');
    if(isUsableActive) uBtn.classList.add('active');
    if(isPortActive) pBtn.classList.add('active');

    initMap();
    loadIslands();
    loadPorts();
    setupCollapseButtons();

    if(isTerritorialActive) {
        document.getElementById('territorialInfoPanel').classList.remove('hidden');
        document.getElementById('territorialListBox').classList.remove('hidden');
    }
    if(isPortActive) document.getElementById('portListBox').classList.remove('hidden');

    document.getElementById('custom-zoom-in').onclick = (e) => { e.preventDefault(); map.zoomIn(); };
    document.getElementById('custom-zoom-out').onclick = (e) => { e.preventDefault(); map.zoomOut(); };
    document.getElementById('custom-zoom-korea').onclick = (e) => { 
        e.preventDefault(); 
        map.setView([36.5, 127.5], 7, { animate: true });
        if(regionPolygon) map.removeLayer(regionPolygon);
        document.getElementById('regionSelect').value = "";
        document.getElementById('sigunguSelect').style.display = 'none';
        updateIslandList("");
    };

    document.querySelectorAll('.style-btn').forEach(btn => {
        btn.onclick = function() {
            document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const s = mapStyles[this.dataset.style];
            if(s) { map.removeLayer(currentLayer); currentLayer = s; currentLayer.addTo(map); }
        };
    });

    const toggleSearch = () => {
        const p = document.getElementById('searchPanel');
        const b = document.getElementById('openSearchPanelBtn');
        if(p.classList.contains('hidden')) { p.classList.remove('hidden'); b.classList.add('hidden'); }
        else { p.classList.add('hidden'); b.classList.remove('hidden'); }
    };
    document.getElementById('toggleSearchPanelBtn').onclick = toggleSearch;
    document.getElementById('openSearchPanelBtn').onclick = toggleSearch;

    const rSel = document.getElementById('regionSelect');
    const sSel = document.getElementById('sigunguSelect');
    rSel.onchange = function() {
        let islands = getIslandsByRegion(this.value);
        if (isUsableActive) islands = islands.filter(i => {
            const name = i['무인도서 정보'];
            const isException = (name === "할미도" || name === "횡경도" || name === "소횡경도");
            return checkIsUsable(i) || isException;
        });
        updateSigunguSelect(islands);
        updateIslandList(this.value, '');
    };
    sSel.onchange = function() { updateIslandList(rSel.value, this.value); };

    const searchBtn = document.getElementById('searchBtn');
    const keywordInput = document.getElementById('keywordInput');
    const performSearch = () => {
        const k = keywordInput.value.trim();
        if(!k) { updateIslandList(rSel.value, sSel.value); return; }
        
        const matches = allIslands.filter(i => i['무인도서 정보'].includes(k));
        currentIslandListItems = matches;
        renderIslandList();
        
        const list = document.getElementById('islandList');
        const tBtn = document.getElementById('toggleIslandList');
        const searchPanel = document.getElementById('searchPanel');
        const handle = searchPanel.querySelector('.resize-handle');
        
        if(list.style.display === 'none') {
            list.style.display = 'block';
            tBtn.textContent = '접기 ▲';
            if(handle) handle.style.display = 'flex';
            searchPanel.style.height = '60vh';
        }
    };
    
    if(searchBtn) {
        searchBtn.onclick = performSearch;
        keywordInput.onkeypress = (e) => { if(e.key==='Enter') performSearch(); };
    }

    document.getElementById('closeDetailPanel').onclick = () => document.getElementById('detailPanel').classList.add('hidden');
    document.getElementById('closeTerritorialList').onclick = () => document.getElementById('territorialListBox').classList.add('hidden');
    document.getElementById('closeTerritorialInfo').onclick = () => document.getElementById('territorialInfoPanel').classList.add('hidden');
    document.getElementById('closePortList').onclick = () => document.getElementById('portListBox').classList.add('hidden');
    document.getElementById('closeViewportList').onclick = () => { 
        const vp = document.getElementById('viewportListBox');
        vp.classList.add('hidden'); vp.classList.add('closed-by-user');
    };

    tBtn.onclick = function() {
        isTerritorialActive = !isTerritorialActive;
        this.classList.toggle('active');
        if(isTerritorialActive) {
            updateTerritorialListUI();
            document.getElementById('territorialListBox').classList.remove('hidden');
            document.getElementById('territorialInfoPanel').classList.remove('hidden');
            updateTerritorialLayer();
        } else {
            document.getElementById('territorialListBox').classList.add('hidden');
            document.getElementById('territorialInfoPanel').classList.add('hidden');
            territorialLayer.clearLayers();
        }
    };

    // [FIX] 이용가능 필터 로직 복구 (시군구 필터 유지)
    uBtn.onclick = function() {
    isUsableActive = !isUsableActive;
    this.classList.toggle('active');

    loadIslands();

    // ✔ 시군구 필터 유지용 로직 복구!
    let islands = getIslandsByRegion(rSel.value);
    if (isUsableActive) {
        islands = islands.filter(i => {
            const name = i['무인도서 정보'];
            const isException = (name === "할미도" || name === "횡경도" || name === "소횡경도");
            return checkIsUsable(i) || isException;
        });
    }
    updateSigunguSelect(islands);  // ← ★ 이 한 줄이 핵심!

    updateIslandList(rSel.value, sSel.value);
    updateViewportList();
};


    pBtn.onclick = function() {
        isPortActive = !isPortActive;
        this.classList.toggle('active');
        const pb = document.getElementById('portListBox');
        if(isPortActive) {
            map.addLayer(portLayer); map.addLayer(routeLayer);
            updatePortMarkers();
            updatePortListUI();
            pb.classList.remove('hidden');
        } else {
            map.removeLayer(portLayer); map.removeLayer(routeLayer);
            pb.classList.add('hidden');
        }
    };

    map.on('moveend', () => {
        const vp = document.getElementById('viewportListBox');
        if(map.getZoom() >= 10 && !vp.classList.contains('closed-by-user')) {
            vp.classList.remove('hidden');
            updateViewportList();
        } else {
            vp.classList.add('hidden');
        }
    });

    const bgmAudio = document.getElementById('bgmAudio');
    const bgmBtn = document.getElementById('bgmBtn');
    if(bgmAudio && bgmBtn) {
        bgmAudio.volume = 0.5;
        bgmBtn.onclick = () => {
            const icon = bgmBtn.querySelector('img');
            if(bgmAudio.paused) {
                bgmAudio.play();
                if(icon) icon.src = 'img/pause.svg';
                bgmBtn.classList.add('playing');
            } else {
                bgmAudio.pause();
                if(icon) icon.src = 'img/play.svg';
                bgmBtn.classList.remove('playing');
            }
        };
    }
    const backBtn = document.getElementById('backBtn');
    if(backBtn) {
        const img = backBtn.querySelector('img');
        backBtn.onmouseenter = () => { if(img) img.src = 'img/home-fill.svg'; };
        backBtn.onmouseleave = () => { if(img) img.src = 'img/home.svg'; };
    }

    function makeResizable(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        
        let handle = panel.querySelector(".resize-handle");
        let isHeaderDrag = false;

        if (!handle) {
            handle = panel.querySelector(".panel-header") || panel.querySelector(".t-list-header");
            isHeaderDrag = true;
        }
        if (!handle) return;

        let startY = 0;
        let startH = 0;
        let resizing = false;

        function isButton(el) {
            return el.closest(".header-controls") || el.tagName === "BUTTON" || el.closest("button");
        }

        handle.addEventListener("mousedown", e => {
            if (isHeaderDrag) {
                if (e.button !== 0) return;
                if (isButton(e.target)) return;
            } else {
                e.preventDefault();
            }

            resizing = true;
            startY = e.clientY;
            startH = panel.getBoundingClientRect().height;
            document.body.style.cursor = "ns-resize";
            panel.style.transition = "none";
        });

        document.addEventListener("mousemove", e => {
            if (!resizing) return;
            let dy = e.clientY - startY;
            let h;

            if (panelId === 'searchPanel') {
                h = startH + dy;
            } else {
                h = startH - dy;
            }
            
            const minH = panelId === 'searchPanel' ? 250 : 100;
            const maxH = window.innerHeight - 50;
            if (h < minH) h = minH;
            if (h > maxH) h = maxH;
            panel.style.height = `${h}px`;
        });

        document.addEventListener("mouseup", () => {
            if (!resizing) return;
            resizing = false;
            document.body.style.cursor = "";
            panel.style.transition = "height .2s ease";
        });
    }

    makeResizable("searchPanel"); 
    makeResizable("detailPanel");
    makeResizable("portListBox");
    makeResizable("territorialListBox");
    makeResizable("viewportListBox");

});