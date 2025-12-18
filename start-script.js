document.addEventListener('DOMContentLoaded', () => {

    // ============================================================
    // 1. [사용자 데이터] 배경 이미지 및 섬 이름 설정
    // ============================================================
    const islandBackgrounds = [
        { url: './img/daehwa.jpg', name: '대화도' },
        { url: './img/jak.jpg', name: '작도' },
        { url: './img/noroo.jpg', name: '노루섬' },
        { url: './img/onefive.jpg', name: '1.5미이터암' },
        { url: './img/sangsa.jpg', name: '상사치도' },   
        { url: './img/seomsaeng.jpg', name: '섬생이' },
        { url: './img/sosam.jpg', name: '소삼부도' },
        { url: './img/yoond.jpg', name: '윤돌도' },
    ];

    // ============================================================
    // 3. 네비게이션, 배경, 프로그레스 바, 스크롤 로직
    // ============================================================
    const navItems = document.querySelectorAll('.nav-item[data-index]');
    const sections = document.querySelectorAll('.content-section');
    const progressBar = document.getElementById('progressBar');
    const bgDiv = document.getElementById('bg-image');
    const nameTags = document.querySelectorAll('.bg-location-name');
    
    let currentIndex = 0;
    let isScrolling = false; 

    function updateProgress(index) {
        if(progressBar) {
            const progress = ((parseInt(index) + 1) / 5) * 100;
            progressBar.style.width = `${progress}%`;
        }
    }

    function updateBackground(index) {
        const dataIndex = index % islandBackgrounds.length;
        const selected = islandBackgrounds[dataIndex];

        if (selected && bgDiv) {
            bgDiv.style.backgroundImage = `url('${selected.url}')`;
            nameTags.forEach(tag => {
                tag.textContent = `⛱ ${selected.name}`;
            });
        }
    }

    function activateSection(index) {
        if (index < 0 || index >= sections.length) return;
        currentIndex = index;

        navItems.forEach(n => n.classList.remove('active'));
        if(navItems[index]) navItems[index].classList.add('active');

        sections.forEach(s => s.classList.remove('active'));
        if(sections[index]) sections[index].classList.add('active');

        updateBackground(index);
        updateProgress(index);
    }

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.getAttribute('data-index'));
            activateSection(index);
        });
    });

    window.addEventListener('wheel', (e) => {
        const activeSection = sections[currentIndex];
        const cardRight = activeSection ? activeSection.querySelector('.card-right') : null;
        
        let hasScroll = false;
        let isAtBottom = false;
        let isAtTop = false;

        if (cardRight) {
            if (cardRight.scrollHeight > cardRight.clientHeight) {
                hasScroll = true;
                if (cardRight.scrollTop <= 0) isAtTop = true;
                if (Math.abs(cardRight.scrollHeight - cardRight.clientHeight - cardRight.scrollTop) <= 1) {
                    isAtBottom = true;
                }
            }
        }

        if (isScrolling) return;

        if (e.deltaY > 0) {
            if (hasScroll && !isAtBottom) return; 
            if (currentIndex < sections.length - 1) {
                isScrolling = true;
                activateSection(currentIndex + 1);
                setTimeout(() => { isScrolling = false; }, 800);
            }
        } else {
            if (hasScroll && !isAtTop) return;
            if (currentIndex > 0) {
                isScrolling = true;
                activateSection(currentIndex - 1);
                setTimeout(() => { isScrolling = false; }, 800);
            }
        }
    }, { passive: false });

    activateSection(0);

    // ============================================================
    // 4. 차트 설정 (Chart.js)
    // ============================================================
    try {
        const chartData = {
            total: [2910, 480],
            sido: [1741, 475, 248, 152, 105, 59, 41, 37, 29, 19, 4],
            area: [908, 624, 682, 182, 153],
            distance: [1219, 680, 569, 319, 123]
        };

        const theme = {
            colors: ['#1d5ae8ff', '#5380e9', '#73b4f6ff', '#aae9faff', '#def7faff'],
            borderColor: '#ffffff06',
            gridColor: '#e0e0e0',
            textColor: '#333',
            font: 'GMarketSans',
            borderRadius: 8,
            borderWidth: 2
        };

        function getCommonOptions(type) {
            return {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            font: { family: theme.font, size: 12 },
                            color: theme.textColor,
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 15
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#333',
                        bodyColor: '#666',
                        borderColor: '#ddd',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: true,
                        titleFont: { family: theme.font },
                        bodyFont: { family: theme.font }
                    }
                },
                scales: type === 'doughnut' || type === 'pie' ? {} : {
                    x: {
                        grid: { display: false },
                        ticks: { color: theme.textColor, font: { family: theme.font } }
                    },
                    y: {
                        grid: { color: theme.gridColor, borderDash: [5, 5] },
                        ticks: { display: false },
                        border: { display: false }
                    }
                },
                layout: { padding: 5 },
                animation: { duration: 1500, easing: 'easeOutQuart' }
            };
        }

        if(document.getElementById('totalChart')) {
            new Chart(document.getElementById('totalChart').getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['무인도서', '유인도서'],
                    datasets: [{
                        data: chartData.total,
                        backgroundColor: [theme.colors[0], theme.colors[2]],
                        borderColor: theme.borderColor,
                        borderWidth: theme.borderWidth,
                        hoverOffset: 10
                    }]
                },
                options: { ...getCommonOptions('doughnut'), cutout: '65%', plugins: { ...getCommonOptions('doughnut').plugins, title: { display: false } } }
            });
        }

        if(document.getElementById('sidoChart')) {
            new Chart(document.getElementById('sidoChart').getContext('2d'), {
                type: 'bar',
                data: {
                    labels: ['전남', '경남', '충남', '인천', '전북', '제주', '부산', '경기', '강원', '경북', '울산',],
                    datasets: [{
                        label: '도서 수',
                        data: chartData.sido,
                        backgroundColor: theme.colors[1],
                        borderRadius: theme.borderRadius,
                        barThickness: 20
                    }]
                },
                options: getCommonOptions('bar')
            });
        }

        if(document.getElementById('areaChart')) {
            new Chart(document.getElementById('areaChart').getContext('2d'), {
                type: 'pie',
                data: {
                    labels: ['3,000 m²미만', '3,000~10,000 m²', '10,000~50,000 m²', '50,000~100,000 m²',  '100,000m²',],
                    datasets: [{
                        data: chartData.area,
                        backgroundColor: theme.colors,
                        borderColor: theme.borderColor,
                        borderWidth: theme.borderWidth
                    }]
                },
                options: getCommonOptions('pie')
            });
        }

        if(document.getElementById('distanceChart')) {
            new Chart(document.getElementById('distanceChart').getContext('2d'), {
                type: 'line',
                data: {
                    labels: ['1km미만', '1~5km', '5~20km', '20~80km', '80km이상'],
                    datasets: [{
                        label: '분포',
                        data: chartData.distance,
                        borderColor: theme.colors[0],
                        backgroundColor: 'rgba(83, 128, 233, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: '#fff',
                        pointBorderColor: theme.colors[0],
                        pointBorderWidth: 2
                    }]
                },
                options: getCommonOptions('line')
            });
        }

    } catch (e) {
        console.error("차트 로드 실패:", e);
    }
});

const scrollPopup = document.getElementById('scrollInfoPopup');
    
    if (scrollPopup) {
        scrollPopup.addEventListener('click', () => {
            // 투명하게 만들고 0.3초 뒤에 공간 삭제
            scrollPopup.style.opacity = '0';
            setTimeout(() => {
                scrollPopup.style.display = 'none';
            }, 300);
        });
        setTimeout(() => {
            scrollPopup.style.opacity = '0';
            setTimeout(() => {
                scrollPopup.style.display = 'none';
            }, 300); // CSS transition 시간(0.3s) 대기 후 삭제
        }, 3000);
    }

    // ==========================================
    // [추가] 파도 소리 BGM 제어 로직
    // ==========================================
    const bgmAudio = document.getElementById('bgmAudio');
    const bgmBtn = document.getElementById('bgmBtn');
    const bgmIcon = bgmBtn ? bgmBtn.querySelector('img') : null;

    if (bgmAudio && bgmBtn && bgmIcon) {
        // 초기 볼륨 설정 (너무 크지 않게)
        bgmAudio.volume = 0.5;

        bgmBtn.addEventListener('click', () => {
            if (bgmAudio.paused) {
                // 재생 시도
                bgmAudio.play().then(() => {
                    bgmIcon.src = 'img/pause.svg';
                    bgmIcon.alt = '일시정지';
                    bgmBtn.classList.add('playing'); // 스타일 필요시 사용
                }).catch(error => {
                    console.error("오디오 재생 실패:", error);
                });
            } else {
                // 일시정지
                bgmAudio.pause();
                bgmIcon.src = 'img/play.svg';
                bgmIcon.alt = '재생';
                bgmBtn.classList.remove('playing');
            }
        });
    }
