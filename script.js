// State
let isDataSmartEnabled = false;
let autoSwitchEnabled = false;
let sessionHasNudged = false;
let dataMeterInterval;
let usedData = 0;
const TOTAL_DATA_ESTIMATE = 150;
const DATA_RATE = 1.2;

// Video
const matchVideo = document.getElementById('match-video');
matchVideo.muted = false; // Start unmuted — audio on by default

// DOM Elements
const screens = document.querySelectorAll('.screen');
const nudgeOverlay = document.getElementById('nudge-overlay');
const qualityOverlay = document.getElementById('quality-overlay');
const dataSaverPill = document.getElementById('data-saver-pill');
const dataMeter = document.getElementById('data-meter');
const autoSwitchCb = document.getElementById('auto-switch-cb');
const toast = document.getElementById('toast');

// Navigation
function navTo(screenId) {
    screens.forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    // Toggle bottom nav visibility
    const bottomNav = document.querySelector('.bottom-nav');
    const hideNavScreens = ['screen-player', 'screen-match', 'screen-summary', 'screen-sport-detail'];
    if (hideNavScreens.includes(screenId)) {
        bottomNav.classList.add('hidden');
    } else {
        bottomNav.classList.remove('hidden');
    }

    // Stop video if leaving player
    if (screenId !== 'screen-player') {
        if (matchVideo && !matchVideo.paused) matchVideo.pause();
        stopDataMeter();
    }
}

// Event Listeners
document.getElementById('live-match-banner').addEventListener('click', () => {
    navTo('screen-match');
});

document.getElementById('btn-watch-live').addEventListener('click', () => {
    navTo('screen-player');
    // Play is called directly in the click handler so browser allows audio
    matchVideo.currentTime = 0;
    matchVideo.muted = false;
    matchVideo.play().catch(() => {
        // Fallback: browser blocked audio, but video still plays
        matchVideo.muted = true;
    });
    updateMuteIcon();
    initPlayer();
});

document.getElementById('btn-turn-on').addEventListener('click', () => {
    enableDataSmartMode();
    nudgeOverlay.classList.add('hidden');
    sessionHasNudged = true;
    startDataMeter();
});

document.getElementById('btn-skip').addEventListener('click', () => {
    nudgeOverlay.classList.add('hidden');
    sessionHasNudged = true;
});

document.getElementById('settings-icon').addEventListener('click', () => {
    qualityOverlay.classList.remove('hidden');
});

document.getElementById('close-quality').addEventListener('click', () => {
    qualityOverlay.classList.add('hidden');
});

document.querySelectorAll('.q-option').forEach(option => {
    option.addEventListener('click', (e) => {
        document.querySelectorAll('.q-option').forEach(o => {
            o.classList.remove('active');
            o.classList.remove('gradient-border');
        });
        const target = e.currentTarget;
        target.classList.add('active');
        
        if (target.dataset.quality === 'data-smart') {
            target.classList.add('gradient-border');
            enableDataSmartMode();
        } else {
            disableDataSmartMode();
        }
        
        setTimeout(() => qualityOverlay.classList.add('hidden'), 300);
    });
});

autoSwitchCb.addEventListener('change', (e) => {
    autoSwitchEnabled = e.target.checked;
});

dataSaverPill.addEventListener('click', () => {
    qualityOverlay.classList.remove('hidden');
});

// Bottom Nav Interactivity
document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.bottom-nav .nav-item').forEach(nav => nav.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        const text = e.currentTarget.querySelector('span').innerText.toLowerCase();
        navTo('screen-' + text);
    });
});

// Search Logic
const searchInput = document.getElementById('search-input');
const searchSuggestions = document.getElementById('search-suggestions');
const searchResults = document.getElementById('search-results');

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        if (e.target.value.length > 0) {
            searchSuggestions.classList.add('hidden');
            searchResults.classList.remove('hidden');
        } else {
            searchSuggestions.classList.remove('hidden');
            searchResults.classList.add('hidden');
        }
    });
}

function navToSport(name) {
    document.getElementById('sport-detail-title').innerText = name;
    navTo('screen-sport-detail');
}

document.querySelectorAll('.match-tabs .tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
        // Update tab buttons
        document.querySelectorAll('.match-tabs .tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');

        // Switch content interfaces
        const targetTab = e.currentTarget.dataset.tab;
        document.querySelectorAll('.match-details-content .tab-content').forEach(content => {
            content.classList.add('hidden');
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById('tab-' + targetTab);
        if (activeContent) {
            activeContent.classList.remove('hidden');
            activeContent.classList.add('active');
        }
    });
});

// Trending Horizontal Scroll
const trendingScroll = document.getElementById('trending-scroll');
const scrollLeftBtn = document.getElementById('scroll-left-btn');
const scrollRightBtn = document.getElementById('scroll-right-btn');

if (trendingScroll && scrollLeftBtn && scrollRightBtn) {
    scrollRightBtn.addEventListener('click', () => {
        trendingScroll.scrollBy({ left: 160, behavior: 'smooth' });
    });

    scrollLeftBtn.addEventListener('click', () => {
        trendingScroll.scrollBy({ left: -160, behavior: 'smooth' });
    });

    trendingScroll.addEventListener('scroll', () => {
        if (trendingScroll.scrollLeft > 0) {
            scrollLeftBtn.classList.remove('hidden');
        } else {
            scrollLeftBtn.classList.add('hidden');
        }
    });
}

// Mute button
const muteBtn = document.getElementById('mute-btn');
if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        matchVideo.muted = !matchVideo.muted;
        updateMuteIcon();
    });
}

function updateMuteIcon() {
    if (!muteBtn) return;
    if (matchVideo.muted) {
        muteBtn.classList.add('fa-volume-mute');
        muteBtn.classList.remove('fa-volume-up');
    } else {
        muteBtn.classList.remove('fa-volume-mute');
        muteBtn.classList.add('fa-volume-up');
    }
}

// Play/Pause
const playPauseBtn = document.getElementById('play-pause-btn');
if (playPauseBtn) {
    playPauseBtn.addEventListener('click', () => {
        if (matchVideo.paused) {
            matchVideo.play();
            playPauseBtn.classList.replace('fa-play', 'fa-pause');
        } else {
            matchVideo.pause();
            playPauseBtn.classList.replace('fa-pause', 'fa-play');
        }
    });
}

// Progress Bar — sync with video + click to seek
const progressContainer = document.getElementById('progress-container');
const progressFill = document.getElementById('progress-fill');
const timeDisplay = document.getElementById('time-display');

matchVideo.addEventListener('timeupdate', () => {
    if (!matchVideo.duration) return;
    const pct = (matchVideo.currentTime / matchVideo.duration) * 100;
    progressFill.style.width = pct + '%';
    timeDisplay.textContent = formatTime(matchVideo.currentTime) + ' / ' + formatTime(matchVideo.duration);
});

progressContainer.addEventListener('click', (e) => {
    const rect = progressContainer.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    matchVideo.currentTime = ratio * matchVideo.duration;
});

// Touch drag support for mobile
progressContainer.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = progressContainer.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, touchX / rect.width));
    matchVideo.currentTime = ratio * matchVideo.duration;
}, { passive: false });

function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

const expandBtn = document.querySelector('.right-controls .fa-expand');
if(expandBtn) {
    expandBtn.addEventListener('click', (e) => {
        if(e.target.classList.contains('fa-expand')) {
            e.target.classList.replace('fa-expand', 'fa-compress');
        } else {
            e.target.classList.replace('fa-compress', 'fa-expand');
        }
    });
}

// Logic
function initPlayer() {
    usedData = 0;
    updateDataMeterUI();
    // Video play is already triggered in the click handler above
    updateMuteIcon();

    if (autoSwitchEnabled) {
        enableDataSmartMode();
        showToast('Data-Smart Mode auto-enabled.');
        startDataMeter();
        return;
    }

    // Step 3: Nudge
    if (!sessionHasNudged) {
        setTimeout(() => {
            nudgeOverlay.classList.remove('hidden');
        }, 1000);
    } else {
        startDataMeter();
    }
}

function enableDataSmartMode() {
    isDataSmartEnabled = true;
    dataSaverPill.classList.remove('hidden');
    dataSaverPill.classList.add('active');
    dataMeter.classList.remove('hidden');
    
    // Ensure quality menu reflects state
    document.querySelectorAll('.q-option').forEach(o => {
        o.classList.remove('active', 'gradient-border');
        if(o.dataset.quality === 'data-smart') {
            o.classList.add('active', 'gradient-border');
        }
    });
}

function disableDataSmartMode() {
    isDataSmartEnabled = false;
    dataSaverPill.classList.add('hidden');
    dataSaverPill.classList.remove('active');
    dataMeter.classList.add('hidden');
}

function startDataMeter() {
    stopDataMeter();
    dataMeterInterval = setInterval(() => {
        // In reality this would be driven by actual stream data. 
        // Here we simulate it based on mode.
        let rate = isDataSmartEnabled ? (DATA_RATE * 0.2) : DATA_RATE;
        usedData += rate;
        updateDataMeterUI();
    }, 2000); // Update every 2 seconds for demo
}

function stopDataMeter() {
    if (dataMeterInterval) clearInterval(dataMeterInterval);
}

function updateDataMeterUI() {
    if(!isDataSmartEnabled) return;
    
    const used = Math.round(usedData);
    const remaining = Math.max(0, Math.round(TOTAL_DATA_ESTIMATE - used));
    const pct = Math.min(100, (used / TOTAL_DATA_ESTIMATE) * 100);
    
    document.querySelector('.meter-text .used').innerText = `${used} MB used`;
    document.querySelector('.meter-text .remaining').innerText = `~${remaining} MB to end`;
    document.querySelector('.meter-fill').style.width = `${pct}%`;
}

function showToast(msg) {
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showExitSummary() {
    stopDataMeter();
    // Simulate some logic for exit summary
    document.querySelector('.stat-row:nth-child(1) .highlight').innerText = `${Math.round(usedData + 42)} MB`; // Adding some base amount for realism
    
    const saved = isDataSmartEnabled ? Math.round((usedData + 42) * 4) : 0;
    
    if (saved > 0) {
        document.querySelector('.stat-row:nth-child(2)').classList.remove('hidden');
        document.querySelector('.stat-row:nth-child(2) .highlight').innerText = `~${saved} MB`;
        document.querySelector('.stat-note').innerText = "Thanks to Data-Smart Mode";
    } else {
        document.querySelector('.stat-row:nth-child(2)').classList.add('hidden');
        document.querySelector('.stat-note').innerText = "Data-Smart Mode was disabled";
    }

    navTo('screen-summary');
}

// Initial time update
setInterval(() => {
    const d = new Date();
    document.querySelector('.time').innerText = d.getHours() + ':' + d.getMinutes().toString().padStart(2, '0');
}, 60000);
const d = new Date();
document.querySelector('.time').innerText = d.getHours() + ':' + d.getMinutes().toString().padStart(2, '0');
