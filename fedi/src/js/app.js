/**
 * Fediverse Shorts - Main application logic.
 * Depends on: services.js (MUSIC_SERVICES), hashtags.js (MUSIC_HASHTAGS)
 */

// --- CONFIGURATION ---
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const SCOPES = 'read write';
const CLIENT_NAME = 'FediverseShortsWeb';
const PAGE_SIZE = 40;

// --- STATE ---
let currentInstance = 'mastodon.social';
let accessToken = localStorage.getItem('fediverse_token');
let currentAccount = null;
let currentFilter = 'all';
let currentFeedSource = 'local';
let filterNSFW = true;
let autoplayEnabled = true;

// Hashtag state (only relevant when currentFilter === 'music')
// 'freeform' means "scan public timeline for music embeds" (old behavior)
let currentHashtag = 'freeform';

// Advanced filters
let advancedFilters = { img: null, text: null };

// Video max length in minutes (null = unlimited)
let videoLenMax = null;

// Music service enabled states (default: all enabled)
let enabledMusicServices = new Set(MUSIC_SERVICES.map(s => s.id));

let allFetchedPosts = [];
let seenPostIds = new Set();
let maxId = null;
let isLoadingMore = false;
let reachedEnd = false;
let isSearchMode = false;

let videoObserver = null;
let activeVideo = null;
let scrollObserver = null;
let audioUnlocked = false;

// Reply modal state
let replyTargetPost = null;

// --- UI ELEMENTS ---
const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const feedContainer = document.getElementById('feed-container');
const searchInput = document.getElementById('search-query');
const nsfwCheckbox = document.getElementById('nsfw-toggle');
const autoplayCheckbox = document.getElementById('autoplay-toggle');
const statusMsg = document.getElementById('status-msg');
const advPanel = document.getElementById('advanced-filters-panel');
const replyModal = document.getElementById('reply-modal');
const replyText = document.getElementById('reply-text');
const replyContext = document.getElementById('reply-context');
const sendReplyBtn = document.getElementById('send-reply-btn');
const hashtagBar = document.getElementById('hashtag-bar');

// --- ICONS (inline SVG for crisp rendering) ---
const ICONS = {
    star: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    starFilled: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    boost: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>`,
    reply: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`
};

// --- AUDIO UNLOCK ---
function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    if (activeVideo) {
        activeVideo.muted = false;
        activeVideo.play().catch(() => {});
    }
    document.removeEventListener('click', unlockAudio);
    document.removeEventListener('touchstart', unlockAudio);
    document.removeEventListener('keydown', unlockAudio);
    document.removeEventListener('scroll', unlockAudio, true);
}
document.addEventListener('click', unlockAudio);
document.addEventListener('touchstart', unlockAudio);
document.addEventListener('keydown', unlockAudio);
document.addEventListener('scroll', unlockAudio, true);

// --- INITIALIZATION ---
function init() {
    buildMusicServiceCheckboxes();
    buildHashtagChips();

    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = urlParams.get('code');
    if (urlCode) {
        exchangeCodeForToken(urlCode);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }

    if (accessToken) {
        verifyTokenAndShowApp();
    } else {
        loginView.style.display = 'flex';
        appView.style.display = 'none';
    }

    const savedNsfw = localStorage.getItem('fediverse_nsfw');
    if (savedNsfw !== null) {
        filterNSFW = savedNsfw === 'true';
        nsfwCheckbox.checked = filterNSFW;
    }
    const savedAutoplay = localStorage.getItem('fediverse_autoplay');
    if (savedAutoplay !== null) {
        autoplayEnabled = savedAutoplay === 'true';
        autoplayCheckbox.checked = autoplayEnabled;
    }
    const savedFeed = localStorage.getItem('fediverse_feed_source');
    if (savedFeed && savedFeed !== 'all') {
        currentFeedSource = savedFeed;
        document.querySelectorAll('.feed-selector .filter-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.feed === savedFeed);
        });
    }

    const savedMusicServices = localStorage.getItem('fediverse_music_services');
    if (savedMusicServices) {
        try {
            const saved = JSON.parse(savedMusicServices);
            if (Array.isArray(saved)) {
                enabledMusicServices = new Set(saved);
                updateMusicServiceCheckboxes();
            }
        } catch (e) {}
    }

    const savedVidMax = localStorage.getItem('fediverse_vid_len_max');
    const vidMaxInput = document.getElementById('vid-len-max');
    if (savedVidMax) {
        videoLenMax = parseFloat(savedVidMax);
        if (vidMaxInput) vidMaxInput.value = savedVidMax;
    }

    const savedHashtag = localStorage.getItem('fediverse_hashtag');
    if (savedHashtag) {
        currentHashtag = savedHashtag;
        updateHashtagChips();
    }

    updateAutoplayToggleVisibility();
    updateHashtagBarVisibility();
}

function buildMusicServiceCheckboxes() {
    const grid = document.getElementById('music-services-grid');
    grid.innerHTML = '';

    MUSIC_SERVICES.forEach(service => {
        const label = document.createElement('label');
        label.className = 'music-service-checkbox';
        label.dataset.serviceId = service.id;
        if (enabledMusicServices.has(service.id)) {
            label.classList.add('checked');
        }

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = enabledMusicServices.has(service.id);
        checkbox.onchange = () => toggleMusicService(service.id, checkbox.checked);

        const span = document.createElement('span');
        span.textContent = service.displayName + (service.isFediverse ? ' ⭐' : '');

        label.appendChild(checkbox);
        label.appendChild(span);
        grid.appendChild(label);
    });
}

function buildHashtagChips() {
    // The Firehose chip already exists in the HTML as the first child.
    // We append the MUSIC_HASHTAGS chips after it.
    MUSIC_HASHTAGS.forEach(entry => {
        const chip = document.createElement('button');
        chip.className = 'hashtag-chip';
        chip.dataset.hashtag = entry.tag;
        chip.textContent = entry.label;
        chip.onclick = () => setHashtag(chip);
        hashtagBar.appendChild(chip);
    });
    updateHashtagChips();
}

function updateHashtagChips() {
    hashtagBar.querySelectorAll('.hashtag-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.hashtag === currentHashtag);
    });
}

function toggleMusicService(serviceId, enabled) {
    if (enabled) {
        enabledMusicServices.add(serviceId);
    } else {
        enabledMusicServices.delete(serviceId);
    }

    const label = document.querySelector(`.music-service-checkbox[data-service-id="${serviceId}"]`);
    if (label) {
        label.classList.toggle('checked', enabled);
    }

    localStorage.setItem('fediverse_music_services', JSON.stringify([...enabledMusicServices]));
    applyFilters();
}

function updateMusicServiceCheckboxes() {
    document.querySelectorAll('.music-service-checkbox').forEach(label => {
        const serviceId = label.dataset.serviceId;
        const checkbox = label.querySelector('input');
        const enabled = enabledMusicServices.has(serviceId);
        checkbox.checked = enabled;
        label.classList.toggle('checked', enabled);
    });
}

// --- HASHTAG SELECTION ---
function setHashtag(chipOrElement) {
    currentHashtag = chipOrElement.dataset.hashtag;
    localStorage.setItem('fediverse_hashtag', currentHashtag);
    updateHashtagChips();
    // Reload the feed with the new hashtag
    reloadFeed();
}

function updateHashtagBarVisibility() {
    if (currentFilter === 'music') {
        hashtagBar.classList.add('visible');
        feedContainer.classList.add('with-hashtag-bar');
    } else {
        hashtagBar.classList.remove('visible');
        feedContainer.classList.remove('with-hashtag-bar');
    }
}

// --- AUTHENTICATION FLOW ---
async function startLogin() {
    let inputInstance = document.getElementById('instance-url').value.trim();
    if (!inputInstance) inputInstance = 'mastodon.social';

    inputInstance = inputInstance.replace(/^https?:\/\//, '').replace(/\/$/, '');
    currentInstance = inputInstance;

    showStatus('Registering app...');

    try {
        const regResponse = await fetch(`https://${currentInstance}/api/v1/apps`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_name: CLIENT_NAME,
                redirect_uris: REDIRECT_URI,
                scopes: SCOPES,
                website: window.location.origin || 'https://localhost'
            })
        });

        if (!regResponse.ok) throw new Error('Failed to register app on instance');
        const regData = await regResponse.json();

        sessionStorage.setItem('fediverse_client_id', regData.client_id);
        sessionStorage.setItem('fediverse_client_secret', regData.client_secret);
        sessionStorage.setItem('fediverse_instance', currentInstance);

        const authUrl = `https://${currentInstance}/oauth/authorize?` + new URLSearchParams({
            client_id: regData.client_id,
            scope: SCOPES,
            redirect_uri: REDIRECT_URI,
            response_type: 'code'
        }).toString();

        window.open(authUrl, '_blank');
        showCodeEntryUI();

    } catch (error) {
        console.error(error);
        showStatus('Registration failed: ' + error.message, true);
        hideStatusAfterDelay();
    }
}

function showCodeEntryUI() {
    loginView.innerHTML = `
        <h2 style="margin-bottom: 12px;">Authorize the App</h2>
        <p style="color: #aaa; font-size: 14px; max-width: 340px; margin-bottom: 16px;">
            A new tab has opened. Log in if needed, click <strong>Authorize</strong>,
            then copy the code shown on that page and paste it below.
        </p>
        <input type="text" id="auth-code-input" placeholder="Paste authorization code here"
            style="padding: 12px; font-size: 16px; border-radius: 8px; border: 1px solid #333;
                    background: #222; color: white; width: 80%; max-width: 340px; margin-bottom: 12px;">
        <button onclick="submitAuthCode()">Complete Login</button>
        <button onclick="location.reload()"
                style="background: #333; margin-top: 10px;">Cancel</button>
    `;
}

async function submitAuthCode() {
    const codeInput = document.getElementById('auth-code-input');
    const code = codeInput ? codeInput.value.trim() : '';

    if (!code) {
        showStatus('Please paste the authorization code.', true);
        hideStatusAfterDelay();
        return;
    }

    await exchangeCodeForToken(code);
}

async function exchangeCodeForToken(code) {
    const clientId = sessionStorage.getItem('fediverse_client_id');
    const clientSecret = sessionStorage.getItem('fediverse_client_secret');
    const instance = sessionStorage.getItem('fediverse_instance') || currentInstance;

    if (!clientId) {
        showStatus('Session expired. Please try logging in again.', true);
        return;
    }

    showStatus('Exchanging code for token...');

    try {
        const tokenResponse = await fetch(`https://${instance}/oauth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: REDIRECT_URI,
                grant_type: 'authorization_code',
                code: code,
                scope: SCOPES
            })
        });

        if (!tokenResponse.ok) throw new Error('Token exchange failed');
        const tokenData = await tokenResponse.json();

        accessToken = tokenData.access_token;
        currentInstance = instance;

        localStorage.setItem('fediverse_token', accessToken);
        localStorage.setItem('fediverse_instance', currentInstance);

        sessionStorage.clear();

        showStatus('Login successful!');
        verifyTokenAndShowApp();
        hideStatusAfterDelay();

    } catch (error) {
        console.error(error);
        showStatus('Login error: ' + error.message, true);
        hideStatusAfterDelay();
    }
}

async function verifyTokenAndShowApp() {
    try {
        const savedInstance = localStorage.getItem('fediverse_instance');
        if (savedInstance) currentInstance = savedInstance;

        const response = await fetch(`https://${currentInstance}/api/v1/accounts/verify_credentials`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (response.ok) {
            currentAccount = await response.json();
            loginView.style.display = 'none';
            appView.style.display = 'flex';
            reloadFeed();
            showStatus('Connected to ' + currentInstance);
            hideStatusAfterDelay();
        } else {
            throw new Error('Token invalid');
        }
    } catch (error) {
        console.error(error);
        localStorage.removeItem('fediverse_token');
        accessToken = null;
        loginView.style.display = 'flex';
        appView.style.display = 'none';
        showStatus('Session expired. Please log in again.', true);
        hideStatusAfterDelay();
    }
}

// --- FEED SOURCE ---
function setFeedSource(btn) {
    document.querySelectorAll('.feed-selector .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFeedSource = btn.dataset.feed;
    localStorage.setItem('fediverse_feed_source', currentFeedSource);

    isSearchMode = false;
    searchInput.value = '';

    reloadFeed();
}

// --- TIMELINE / HASHTAG LOADING ---
function reloadFeed() {
    if (!accessToken) return;

    allFetchedPosts = [];
    seenPostIds = new Set();
    maxId = null;
    reachedEnd = false;
    isLoadingMore = false;
    isSearchMode = false;

    // Show a context-appropriate loading message
    let loadingText = 'Loading timeline...';
    if (currentFilter === 'music' && currentHashtag !== 'freeform') {
        loadingText = `Loading #${currentHashtag}...`;
    }
    feedContainer.innerHTML = `<div class="loading">${loadingText}</div>`;

    if (videoObserver) { videoObserver.disconnect(); videoObserver = null; }
    if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
    activeVideo = null;

    loadMorePosts();
}

async function loadMorePosts() {
    if (isLoadingMore || reachedEnd || !accessToken) return;
    isLoadingMore = true;

    let loadingEl = feedContainer.querySelector('.loading-more');
    if (!loadingEl) {
        loadingEl = document.createElement('div');
        loadingEl.className = 'loading loading-more';
        loadingEl.textContent = 'Loading more...';
        feedContainer.appendChild(loadingEl);
    } else {
        loadingEl.style.display = 'block';
        loadingEl.textContent = 'Loading more...';
    }

    try {
        let data;

        if (isSearchMode) {
            loadingEl.textContent = 'End of search results.';
            reachedEnd = true;
            isLoadingMore = false;
            return;
        }

        // Determine if we're doing a hashtag search or a timeline fetch
        const usingHashtagSearch = (currentFilter === 'music' && currentHashtag !== 'freeform');

        if (usingHashtagSearch) {
            // Hashtag search mode — paginate with max_id
            const params = new URLSearchParams({
                q: `#${currentHashtag}`,
                type: 'statuses',
                limit: PAGE_SIZE,
                resolve: true
            });
            if (maxId) {
                params.append('max_id', maxId);
            }

            const response = await fetch(`https://${currentInstance}/api/v2/search?${params}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) throw new Error('Failed to load hashtag feed');
            const searchData = await response.json();
            data = searchData.statuses || [];

        } else {
            // Timeline mode (original behavior)
            let endpoint;
            if (currentFeedSource === 'local') {
                endpoint = `/api/v1/timelines/public?local=true`;
            } else {
                endpoint = `/api/v1/timelines/public?local=false`;
            }

            const params = new URLSearchParams({ limit: PAGE_SIZE });

            if (currentFilter === 'video' || currentFilter === 'image') {
                params.append('only_media', 'true');
            }
            if (maxId) {
                params.append('max_id', maxId);
            }

            const response = await fetch(`https://${currentInstance}${endpoint}&${params}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) throw new Error('Failed to load timeline');
            data = await response.json();
        }

        if (!data || data.length === 0) {
            reachedEnd = true;
            loadingEl.textContent = usingHashtagSearch
                ? `No more posts for #${currentHashtag}.`
                : 'You have reached the end of the timeline.';
            isLoadingMore = false;
            return;
        }

        const newPosts = data.filter(post => !seenPostIds.has(post.id));
        newPosts.forEach(post => seenPostIds.add(post.id));

        if (newPosts.length === 0) {
            maxId = data[data.length - 1].id;
            isLoadingMore = false;
            loadMorePosts();
            return;
        }

        maxId = data[data.length - 1].id;
        allFetchedPosts = allFetchedPosts.concat(newPosts);

        renderNewPosts(newPosts);

        loadingEl.style.display = 'none';
        isLoadingMore = false;

    } catch (error) {
        console.error(error);
        if (loadingEl) {
            loadingEl.textContent = 'Error loading more: ' + error.message;
            loadingEl.classList.add('error');
        }
        isLoadingMore = false;
    }
}

// --- SEARCH ---
function handleSearchKey(event) {
    if (event.key === 'Enter') performSearch();
}

async function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        showStatus('Please enter a search term.', true);
        hideStatusAfterDelay();
        return;
    }

    allFetchedPosts = [];
    seenPostIds = new Set();
    maxId = null;
    reachedEnd = true;
    isSearchMode = true;

    feedContainer.innerHTML = '<div class="loading">Searching...</div>';

    if (videoObserver) { videoObserver.disconnect(); videoObserver = null; }
    if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
    activeVideo = null;

    try {
        let fullQuery = query;
        if (currentFilter === 'video') fullQuery += ' has:video';
        else if (currentFilter === 'image') fullQuery += ' has:image';
        else if (currentFilter === 'text') fullQuery += ' -has:media';
        else if (currentFilter === 'music') fullQuery += ' has:card';

        const params = new URLSearchParams({
            q: fullQuery,
            type: 'statuses',
            limit: 40,
            resolve: true
        });

        const response = await fetch(`https://${currentInstance}/api/v2/search?${params}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) throw new Error('Search failed');
        const data = await response.json();

        if (!data.statuses || data.statuses.length === 0) {
            feedContainer.innerHTML = '<div class="error">No results found. Try a different term or filter.</div>';
            return;
        }

        allFetchedPosts = data.statuses;
        data.statuses.forEach(p => seenPostIds.add(p.id));
        renderFeed();

    } catch (error) {
        console.error(error);
        feedContainer.innerHTML = `<div class="error">Error: ${error.message}</div>`;
    }
}

// --- FILTERS ---
function setFilter(btn) {
    document.querySelectorAll('.filter-btn[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;

    updateAutoplayToggleVisibility();
    updateHashtagBarVisibility();

    if (isSearchMode) {
        performSearch();
    } else {
        reloadFeed();
    }
}

function updateAutoplayToggleVisibility() {
    const label = document.getElementById('autoplay-toggle-label');
    if (!label) return;
    if (currentFilter === 'video') {
        label.classList.remove('hidden');
    } else {
        label.classList.add('hidden');
        if (activeVideo) {
            activeVideo.pause();
            activeVideo = null;
        }
    }
}

function toggleAdvancedFilters() {
    advPanel.style.display = advPanel.style.display === 'flex' ? 'none' : 'flex';
}

function setAdvFilter(btn, key) {
    const val = btn.dataset[key];

    if (advancedFilters[key] === val) {
        advancedFilters[key] = null;
        btn.classList.remove('active');
    } else {
        advancedFilters[key] = val;
        btn.parentElement.querySelectorAll('.adv-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    applyFilters();
}

function toggleAutoplay() {
    autoplayEnabled = autoplayCheckbox.checked;
    localStorage.setItem('fediverse_autoplay', autoplayEnabled);

    if (!autoplayEnabled && activeVideo) {
        activeVideo.pause();
        activeVideo = null;
    } else if (autoplayEnabled && currentFilter === 'video') {
        if (videoObserver) {
            videoObserver.disconnect();
            setupVideoObserver();
        }
    }
}

function applyFilters() {
    filterNSFW = nsfwCheckbox.checked;
    localStorage.setItem('fediverse_nsfw', filterNSFW);

    const vidMaxInput = document.getElementById('vid-len-max');
    if (vidMaxInput) {
        const v = vidMaxInput.value.trim();
        videoLenMax = v === '' ? null : Math.max(0, parseFloat(v));
        if (videoLenMax !== null && !isNaN(videoLenMax)) {
            localStorage.setItem('fediverse_vid_len_max', videoLenMax);
        } else {
            videoLenMax = null;
            localStorage.removeItem('fediverse_vid_len_max');
        }
    }

    renderFeed();
}

// --- MUSIC SERVICE DETECTION ---
function detectMusicEmbed(post) {
    if (post.card && post.card.url) {
        for (const svc of MUSIC_SERVICES) {
            if (!enabledMusicServices.has(svc.id)) continue;
            if (svc.match.test(post.card.url)) {
                const embed = svc.buildEmbed(post.card.url);
                if (embed) return { service: svc, url: post.card.url, embed };
            }
        }
    }

    if (post.content) {
        const urlRegex = /https?:\/\/[^\s"'<>]+/g;
        const urls = post.content.match(urlRegex) || [];
        for (const url of urls) {
            for (const svc of MUSIC_SERVICES) {
                if (!enabledMusicServices.has(svc.id)) continue;
                if (svc.match.test(url)) {
                    const embed = svc.buildEmbed(url);
                    if (embed) return { service: svc, url, embed };
                }
            }
        }
    }

    return null;
}

// --- POST ACTIONS ---
async function favouritePost(postId, buttonEl) {
    if (!accessToken) return;

    buttonEl.disabled = true;
    const isFavourited = buttonEl.classList.contains('favourited');

    try {
        const action = isFavourited ? 'unfavourite' : 'favourite';
        const response = await fetch(`https://${currentInstance}/api/v1/statuses/${postId}/${action}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) throw new Error('Failed to ' + action);
        const updatedPost = await response.json();

        buttonEl.classList.toggle('favourited', !isFavourited);
        const countEl = buttonEl.querySelector('.action-count');
        if (countEl) {
            countEl.textContent = updatedPost.favourites_count;
        }

        const storedPost = allFetchedPosts.find(p => p.id === postId);
        if (storedPost) {
            storedPost.favourites_count = updatedPost.favourites_count;
            storedPost.favourited = updatedPost.favourited;
        }

    } catch (error) {
        console.error(error);
        showStatus('Error: ' + error.message, true);
        hideStatusAfterDelay();
    } finally {
        buttonEl.disabled = false;
    }
}

async function reblogPost(postId, buttonEl) {
    if (!accessToken) return;

    buttonEl.disabled = true;
    const isReblogged = buttonEl.classList.contains('reblogged');

    try {
        const action = isReblogged ? 'unreblog' : 'reblog';
        const response = await fetch(`https://${currentInstance}/api/v1/statuses/${postId}/${action}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) throw new Error('Failed to ' + action);

        buttonEl.classList.toggle('reblogged', !isReblogged);

        let count = 0;
        if (!isReblogged) {
            const wrapper = await response.json();
            const storedPost = allFetchedPosts.find(p => p.id === postId);
            if (storedPost) {
                storedPost.reblogs_count = (storedPost.reblogs_count || 0) + 1;
                storedPost.reblogged = true;
                count = storedPost.reblogs_count;
            }
        } else {
            const original = await response.json();
            count = original.reblogs_count;
            const storedPost = allFetchedPosts.find(p => p.id === postId);
            if (storedPost) {
                storedPost.reblogs_count = original.reblogs_count;
                storedPost.reblogged = false;
            }
        }

        const countEl = buttonEl.querySelector('.action-count');
        if (countEl) {
            countEl.textContent = count;
        }

    } catch (error) {
        console.error(error);
        showStatus('Error: ' + error.message, true);
        hideStatusAfterDelay();
    } finally {
        buttonEl.disabled = false;
    }
}

function openReplyModal(post) {
    replyTargetPost = post;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = post.content;
    const text = tempDiv.textContent || '';
    replyContext.textContent = text.substring(0, 200) + (text.length > 200 ? '...' : '');
    replyText.value = '';
    replyModal.style.display = 'flex';
    replyText.focus();
}

function closeReplyModal() {
    replyModal.style.display = 'none';
    replyTargetPost = null;
}

async function sendReply() {
    if (!replyTargetPost || !accessToken) return;

    const content = replyText.value.trim();
    if (!content) {
        showStatus('Please write a reply.', true);
        hideStatusAfterDelay();
        return;
    }

    sendReplyBtn.disabled = true;
    sendReplyBtn.textContent = 'Sending...';

    try {
        const response = await fetch(`https://${currentInstance}/api/v1/statuses`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: content,
                in_reply_to_id: replyTargetPost.id
            })
        });

        if (!response.ok) throw new Error('Failed to send reply');

        showStatus('Reply sent!');
        hideStatusAfterDelay();
        closeReplyModal();

    } catch (error) {
        console.error(error);
        showStatus('Error: ' + error.message, true);
        hideStatusAfterDelay();
    } finally {
        sendReplyBtn.disabled = false;
        sendReplyBtn.textContent = 'Send Reply';
    }
}

// --- RENDERING ---
function renderFeed() {
    if (allFetchedPosts.length === 0) return;

    if (videoObserver) { videoObserver.disconnect(); videoObserver = null; }
    activeVideo = null;

    feedContainer.innerHTML = '';

    const filtered = getFilteredPosts();

    if (filtered.length === 0) {
        let msg = 'No posts match the current filters.';
        if (currentFilter === 'music' && currentHashtag !== 'freeform') {
            msg = `No posts found for #${currentHashtag} that match the current filters.`;
        }
        feedContainer.innerHTML = `<div class="error">${msg}</div>`;
        return;
    }

    filtered.forEach(post => {
        feedContainer.appendChild(createPostCard(post));
    });

    if (!isSearchMode) setupInfiniteScroll();
    if (autoplayEnabled && currentFilter === 'video') setupVideoObserver();

    if (reachedEnd && !isSearchMode) {
        const endEl = document.createElement('div');
        endEl.className = 'end-message';
        endEl.textContent = (currentFilter === 'music' && currentHashtag !== 'freeform')
            ? `No more posts for #${currentHashtag}.`
            : 'You have reached the end of the timeline.';
        feedContainer.appendChild(endEl);
    }
}

function renderNewPosts(newPosts) {
    // Remove any initial loading message (but not the "loading more" indicator)
    const initialLoading = feedContainer.querySelector('.loading:not(.loading-more)');
    if (initialLoading) initialLoading.remove();

    const oldEnd = feedContainer.querySelector('.end-message');
    if (oldEnd) oldEnd.remove();
    const oldLoading = feedContainer.querySelector('.loading-more');
    if (oldLoading) oldLoading.remove();

    const filtered = filterPosts(newPosts);

    filtered.forEach(post => {
        feedContainer.appendChild(createPostCard(post));
    });

    if (autoplayEnabled && currentFilter === 'video') setupVideoObserver();
    setupInfiniteScroll();

    if (reachedEnd && !isSearchMode) {
        const endEl = document.createElement('div');
        endEl.className = 'end-message';
        endEl.textContent = (currentFilter === 'music' && currentHashtag !== 'freeform')
        ? `No more posts for #${currentHashtag}.`
        : 'You have reached the end of the timeline.';
        feedContainer.appendChild(endEl);
    }
}

function getFilteredPosts() {
    return filterPosts(allFetchedPosts);
}

function filterPosts(posts) {
    let result = posts;

    if (currentFilter !== 'all') {
        result = result.filter(post => {
            if (currentFilter === 'video') {
                return post.media_attachments?.some(m => m.type === 'video');
            }
            if (currentFilter === 'image') {
                return post.media_attachments?.some(m => m.type === 'image' || m.type === 'gifv');
            }
            if (currentFilter === 'music') {
                // In hashtag mode, everything from the search result is fair game.
                // In freeform mode, require a detected embed.
                if (currentHashtag === 'freeform') {
                    return detectMusicEmbed(post) !== null;
                }
                // Hashtag mode: still prefer posts with embeds, but allow native
                // audio/video attachments too
                if (detectMusicEmbed(post) !== null) return true;
                if (post.media_attachments?.some(m => m.type === 'audio' || m.type === 'video')) {
                    return true;
                }
                return false;
            }
            if (currentFilter === 'text') {
                return !post.media_attachments || post.media_attachments.length === 0;
            }
            return true;
        });
    }

    if (filterNSFW) {
        result = result.filter(post => !post.sensitive);
    }

    if ((currentFilter === 'video' || currentFilter === 'all') && videoLenMax !== null) {
        result = result.filter(post => {
            const media = post.media_attachments?.find(m => m.type === 'video');
            if (!media) return false;
            const durationSec = media.meta?.original?.duration || media.meta?.duration || 0;
            const durationMin = durationSec / 60;
            if (durationMin > videoLenMax) return false;
            return true;
        });
    }

    if ((currentFilter === 'image' || currentFilter === 'all') && advancedFilters.img) {
        result = result.filter(post => {
            const imgMedia = post.media_attachments?.filter(m => m.type === 'image' || m.type === 'gifv');
            if (!imgMedia || imgMedia.length === 0) return false;
            const hasAlt = imgMedia.some(m => m.description && m.description.trim().length > 0);
            if (advancedFilters.img === 'has-alt') return hasAlt;
            if (advancedFilters.img === 'no-alt') return !hasAlt;
            return true;
        });
    }

    if ((currentFilter === 'text' || currentFilter === 'all') && advancedFilters.text) {
        result = result.filter(post => {
            if (advancedFilters.text === 'has-media') {
                return post.media_attachments && post.media_attachments.length > 0;
            }
            if (advancedFilters.text === 'long') {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = post.content;
                const text = tempDiv.textContent || '';
                return text.length > 280;
            }
            return true;
        });
    }

    return result;
}

function createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.postId = post.id;

    const header = document.createElement('div');
    header.className = 'post-header';
    const avatarUrl = post.account.avatar_static || post.account.avatar || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    header.innerHTML = `
        <img src="${avatarUrl}" class="avatar" alt="">
        <div class="user-info">
            <span class="username">${escapeHtml(post.account.display_name || post.account.username)}</span>
            <span class="handle">@${escapeHtml(post.account.acct)}</span>
        </div>
    `;
    card.appendChild(header);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'post-content';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = post.content;
    contentDiv.textContent = tempDiv.textContent || tempDiv.innerText;
    card.appendChild(contentDiv);

    if (post.media_attachments && post.media_attachments.length > 0) {
        const media = post.media_attachments[0];

        if (media.type === 'video') {
            const videoEl = document.createElement('video');
            videoEl.src = media.url;
            videoEl.controls = true;
            videoEl.preload = 'metadata';
            videoEl.poster = media.preview_url || '';
            videoEl.className = 'post-media';
            videoEl.muted = !audioUnlocked;
            videoEl.loop = true;
            videoEl.playsInline = true;
            card.appendChild(videoEl);
        } else if (media.type === 'image' || media.type === 'gifv') {
            const imgEl = document.createElement('img');
            imgEl.src = media.url;
            imgEl.alt = media.description || '';
            imgEl.className = 'post-media';
            imgEl.loading = 'lazy';
            card.appendChild(imgEl);
        } else if (media.type === 'audio') {
            const audioEl = document.createElement('audio');
            audioEl.src = media.url;
            audioEl.controls = true;
            audioEl.className = 'post-media';
            audioEl.style.width = '100%';
            card.appendChild(audioEl);
        }
    } else {
        const musicEmbed = detectMusicEmbed(post);
        if (musicEmbed) {
            const container = document.createElement('div');
            container.className = `music-embed-container ${musicEmbed.embed.type}-embed`;

            const iframe = document.createElement('iframe');
            iframe.src = musicEmbed.embed.src;
            iframe.setAttribute('allow', 'autoplay; encrypted-media; picture-in-picture; fullscreen');
            iframe.setAttribute('loading', 'lazy');
            iframe.setAttribute('frameborder', '0');
            iframe.setAttribute('scrolling', 'no');
            container.appendChild(iframe);
            card.appendChild(container);

            const fallback = document.createElement('a');
            fallback.href = musicEmbed.url;
            fallback.target = '_blank';
            fallback.rel = 'noopener';
            fallback.className = 'music-fallback-link';
            fallback.textContent = musicEmbed.service.label + ' ↗';
            card.appendChild(fallback);
        } else if (post.card && post.card.url) {
            const linkEl = document.createElement('a');
            linkEl.href = post.card.url;
            linkEl.target = '_blank';
            linkEl.rel = 'noopener';
            linkEl.className = 'external-link';
            linkEl.textContent = `🔗 ${post.card.title || post.card.description || post.card.url}`;
            card.appendChild(linkEl);
        }
    }

    const actions = document.createElement('div');
    actions.className = 'post-actions';

    const favBtn = document.createElement('button');
    favBtn.className = 'action-btn' + (post.favourited ? ' favourited' : '');
    favBtn.innerHTML = `<span class="action-icon">${post.favourited ? ICONS.starFilled : ICONS.star}</span><span class="action-count">${post.favourites_count || 0}</span>`;
    favBtn.onclick = () => favouritePost(post.id, favBtn);
    actions.appendChild(favBtn);

    const boostBtn = document.createElement('button');
    boostBtn.className = 'action-btn' + (post.reblogged ? ' reblogged' : '');
    boostBtn.innerHTML = `<span class="action-icon">${ICONS.boost}</span><span class="action-count">${post.reblogs_count || 0}</span>`;
    boostBtn.onclick = () => reblogPost(post.id, boostBtn);
    actions.appendChild(boostBtn);

    const replyBtn = document.createElement('button');
    replyBtn.className = 'action-btn';
    replyBtn.innerHTML = `<span class="action-icon">${ICONS.reply}</span><span class="action-count">${post.replies_count || 0}</span>`;
    replyBtn.onclick = () => openReplyModal(post);
    actions.appendChild(replyBtn);

    card.appendChild(actions);

    return card;
}

// --- INFINITE SCROLL ---
function setupInfiniteScroll() {
    if (scrollObserver) scrollObserver.disconnect();
    if (isSearchMode) return;

    let sentinel = feedContainer.querySelector('.scroll-sentinel');
    if (!sentinel) {
        sentinel = document.createElement('div');
        sentinel.className = 'scroll-sentinel';
        sentinel.style.height = '1px';
        sentinel.style.width = '100%';
        feedContainer.appendChild(sentinel);
    } else {
        feedContainer.appendChild(sentinel);
    }

    scrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoadingMore && !reachedEnd && !isSearchMode) {
                loadMorePosts();
            }
        });
    }, {
        root: feedContainer,
        rootMargin: '400px',
        threshold: 0
    });

    scrollObserver.observe(sentinel);
}

// --- VIDEO AUTOPLAY ---
function setupVideoObserver() {
    const videos = feedContainer.querySelectorAll('video');
    if (videos.length === 0) return;

    if (videoObserver) videoObserver.disconnect();

    const observerOptions = {
        root: feedContainer,
        threshold: 0.6
    };

    videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;

            if (entry.isIntersecting) {
                if (activeVideo && activeVideo !== video) activeVideo.pause();
                video.muted = !audioUnlocked;
                video.play().catch(() => {});
                activeVideo = video;
            } else {
                if (video === activeVideo) {
                    video.pause();
                    activeVideo = null;
                }
            }
        });
    }, observerOptions);

    videos.forEach(video => {
        if (!video.dataset.observed) {
            videoObserver.observe(video);
            video.dataset.observed = 'true';
        }
    });
}

// --- UTILITIES ---
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function showStatus(msg, isError = false) {
    statusMsg.textContent = msg;
    statusMsg.style.display = 'block';
    statusMsg.style.background = isError ? '#d32f2f' : '#333';
}

function hideStatusAfterDelay() {
    setTimeout(() => {
        statusMsg.style.display = 'none';
    }, 3000);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && replyModal.style.display === 'flex') {
        closeReplyModal();
    }
});

replyModal.addEventListener('click', (e) => {
    if (e.target === replyModal) {
        closeReplyModal();
    }
});

// --- START ---
init();
