// ============================================
// CONFIGURATION
// ============================================

let SELECTED_CLUSTERS = [];
let CLUSTER_ANALYSES = {};

// ============================================
// APP STATE
// ============================================

let clusterData = null;
let currentTab = 'selected';
let currentModalCluster = null;

// ============================================
// CONFIGURATION LOADING
// ============================================

async function loadConfig() {
    try {
        const response = await fetch('selected_clusters.json');
        const config = await response.json();
        SELECTED_CLUSTERS = config.SELECTED_CLUSTERS || [];
        CLUSTER_ANALYSES = config.CLUSTER_ANALYSES || {};
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// ============================================
// NAVIGATION
// ============================================

function enterApp() {
    document.getElementById('landing').style.display = 'none';
    document.getElementById('app').classList.add('active');
}

function showLanding() {
    document.getElementById('landing').style.display = 'flex';
    document.getElementById('app').classList.remove('active');
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    
    document.getElementById('selected-description').style.display = tab === 'selected' ? 'block' : 'none';
    document.getElementById('all-description').style.display = tab === 'all' ? 'block' : 'none';
    
    renderClusterGrid();
}

function switchModalTab(tab) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-modal-tab="${tab}"]`).classList.add('active');
    
    document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`modal-tab-${tab}`).classList.add('active');
    
    if (tab === 'all-images' && currentModalCluster) {
        renderAllImages();
    }
}

// ============================================
// DATA LOADING
// ============================================

async function loadData() {
    try {
        await loadConfig();
        
        const response = await fetch('cluster_data.json');
        clusterData = await response.json();
        document.getElementById('total-clusters').textContent = clusterData.total_clusters;
        document.getElementById('total-frames').textContent = clusterData.total_frames.toLocaleString();
        document.getElementById('selected-count').textContent = `(${SELECTED_CLUSTERS.length})`;
        document.getElementById('all-count').textContent = `(${clusterData.cluster_order.length})`;
        renderClusterGrid();
        document.getElementById('loading').style.display = 'none';
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('loading').innerHTML = '<p style="color: var(--accent-secondary);">Error loading data.</p>';
    }
}

// ============================================
// RENDERING
// ============================================

function renderClusterGrid() {
    const grid = document.getElementById('cluster-grid');
    const emptyState = document.getElementById('empty-state');
    grid.innerHTML = '';
    
    let clusterIds = currentTab === 'selected' 
        ? SELECTED_CLUSTERS.filter(id => clusterData.clusters[id])
        : clusterData.cluster_order;
    
    if (currentTab === 'selected' && clusterIds.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    emptyState.style.display = 'none';
    
    for (const id of clusterIds) {
        const cluster = clusterData.clusters[id];
        if (cluster) grid.appendChild(createClusterCard(cluster));
    }
}

function createClusterCard(cluster) {
    const card = document.createElement('div');
    card.className = 'cluster-card';
    card.onclick = () => openModal(cluster);
    const keywords = Array.isArray(cluster.keywords) ? cluster.keywords.slice(0, 5).join(', ') : cluster.keywords;
    const hasAnalysis = CLUSTER_ANALYSES[cluster.id];
    card.innerHTML = `
        ${hasAnalysis ? '<div class="analysis-badge">Analyzed</div>' : ''}
        ${cluster.audio ? '<div class="audio-indicator"><svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg></div>' : ''}
        <img class="card-image" src="composites/${cluster.composite}" alt="Cluster ${cluster.id}" loading="lazy">
        <div class="card-content">
            <div class="card-header">
                <span class="cluster-id">Sign ${cluster.id}</span>
                <span class="cluster-size">${cluster.size} frames</span>
            </div>
            <div class="card-label">Keywords</div>
            <div class="card-text">${keywords || 'No keywords'}</div>
            <div class="card-genre">${cluster.genre || 'Unknown'}</div>
        </div>`;
    return card;
}

function renderAllImages() {
    if (!currentModalCluster || !currentModalCluster.all_images) {
        document.getElementById('all-images-count').textContent = 'No images available';
        document.getElementById('all-images-grid').innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">All images data not available.</p>';
        return;
    }
    
    const grid = document.getElementById('all-images-grid');
    const sortOrder = document.getElementById('all-images-sort').value;
    
    let images = [...currentModalCluster.all_images];
    
    if (sortOrder === 'distance-asc') {
        images.sort((a, b) => a.distance - b.distance);
    } else if (sortOrder === 'distance-desc') {
        images.sort((a, b) => b.distance - a.distance);
    }
    
    grid.innerHTML = '';
    
    for (const img of images) {
        const imgEl = document.createElement('img');
        imgEl.src = `all_images/${img.filename}`;
        imgEl.alt = `Distance: ${img.distance.toFixed(3)}`;
        imgEl.title = `Distance: ${img.distance.toFixed(3)}`;
        imgEl.onclick = () => openLightbox(`all_images/${img.filename}`);
        imgEl.loading = 'lazy';
        grid.appendChild(imgEl);
    }
    
    document.getElementById('all-images-count').textContent = `${images.length} images`;
}

// ============================================
// MODAL
// ============================================

function openModal(cluster) {
    currentModalCluster = cluster;
    
    switchModalTab('overview');
    
    document.getElementById('modal-composite').src = `composites/${cluster.composite}`;
    document.getElementById('modal-cluster-id').textContent = cluster.id;
    document.getElementById('modal-size').textContent = cluster.size;
    document.getElementById('modal-mean-dist').textContent = cluster.stats.mean_distance.toFixed(3);
    document.getElementById('modal-spread').textContent = `${cluster.stats.min_distance.toFixed(3)} - ${cluster.stats.max_distance.toFixed(3)}`;
    
    const analysis = CLUSTER_ANALYSES[cluster.id];
    const analysisSection = document.getElementById('analysis-section');
    if (analysis) {
        analysisSection.style.display = 'block';
        document.getElementById('analysis-title').textContent = analysis.title || '';
        document.getElementById('analysis-text').innerHTML = analysis.text || '';
        const themesContainer = document.getElementById('analysis-themes');
        themesContainer.innerHTML = '';
        if (analysis.themes?.length) {
            document.getElementById('analysis-themes-container').style.display = 'block';
            analysis.themes.forEach(t => {
                const el = document.createElement('span');
                el.className = 'analysis-theme';
                el.textContent = t;
                themesContainer.appendChild(el);
            });
        } else {
            document.getElementById('analysis-themes-container').style.display = 'none';
        }
        if (analysis.notes) {
            document.getElementById('analysis-notes-container').style.display = 'block';
            document.getElementById('analysis-notes').innerHTML = analysis.notes;
        } else {
            document.getElementById('analysis-notes-container').style.display = 'none';
        }
    } else {
        analysisSection.style.display = 'none';
    }
    
    const keywords = Array.isArray(cluster.keywords) ? cluster.keywords.join(', ') : cluster.keywords;
    document.getElementById('modal-keywords').textContent = keywords || 'No keywords';
    document.getElementById('modal-comments').textContent = cluster.comments || 'No comments';
    document.getElementById('modal-genre').textContent = cluster.genre || 'Unknown';
    
    const audioPlayer = document.getElementById('audio-player');
    const audioSource = document.getElementById('audio-source');
    if (cluster.audio) {
        audioPlayer.src = `audio/${cluster.audio}`;
        audioSource.textContent = `Source: ${cluster.audio_video || 'Unknown'}`;
        audioPlayer.style.display = 'block';
        audioSource.style.display = 'block';
    } else {
        audioPlayer.style.display = 'none';
        audioSource.innerHTML = '<span class="no-audio">No audio available</span>';
    }
    
    const rangeGrid = document.getElementById('range-grid');
    rangeGrid.innerHTML = '';
    const ranges = [
        { key: 'min', label: 'Most Typical', labelClass: 'typical' },
        { key: 'q25', label: '25th %ile', labelClass: '' },
        { key: 'median', label: 'Median', labelClass: '' },
        { key: 'q75', label: '75th %ile', labelClass: '' },
        { key: 'max', label: 'Most Atypical', labelClass: 'atypical' }
    ];
    for (const r of ranges) {
        const imgs = cluster.range_images[r.key];
        if (imgs?.length) {
            const item = document.createElement('div');
            item.className = 'range-item';
            const src = `images/${imgs[0].filename}`;
            item.innerHTML = `
                <div class="range-label ${r.labelClass}">${r.label}</div>
                <img class="range-image" src="${src}" alt="${r.label}" onclick="openLightbox('${src}')">
                <div class="range-distance">d = ${imgs[0].distance.toFixed(3)}</div>`;
            rangeGrid.appendChild(item);
        }
    }
    
    document.getElementById('modal-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.getElementById('audio-player').pause();
    document.body.style.overflow = '';
    currentModalCluster = null;
}

// ============================================
// LIGHTBOX
// ============================================

function openLightbox(src) {
    event.stopPropagation();
    document.getElementById('lightbox-img').src = src;
    document.getElementById('lightbox').classList.add('active');
}

function closeLightbox() {
    document.getElementById('lightbox').classList.remove('active');
}

// ============================================
// EVENT LISTENERS
// ============================================

document.getElementById('modal-close').onclick = closeModal;
document.getElementById('modal-overlay').onclick = (e) => { if (e.target === e.currentTarget) closeModal(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeLightbox(); closeModal(); } });

// ============================================
// INIT
// ============================================

loadData();
