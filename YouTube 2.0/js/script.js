// ============================================
// YOUTUBE 2.0 — ПОЛНАЯ ЛОГИКА ПРИЛОЖЕНИЯ
// ============================================

// ---------- 1. ИНИЦИАЛИЗАЦИЯ ХРАНИЛИЩА (localStorage) ----------
const STORAGE_KEYS = {
    USERS: 'yt2_users',
    VIDEOS: 'yt2_videos',
    CURRENT_USER: 'yt2_currentUser'
};

let users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];
let videos = JSON.parse(localStorage.getItem(STORAGE_KEYS.VIDEOS)) || [];
let currentUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER)) || null;

// Функции сохранения
function saveUsers() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
}
function saveVideos() {
    localStorage.setItem(STORAGE_KEYS.VIDEOS, JSON.stringify(videos));
}
function saveCurrentUser() {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
}

// ---------- 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ----------
function generateId() {
    return Date.now() + Math.random().toString(36).substr(2, 9);
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ---------- 3. РАБОТА С ПОЛЬЗОВАТЕЛЯМИ ----------
function findUserByUsername(username) {
    return users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

/**
 * Регистрация нового пользователя.
 * При успехе автоматически скачивается .txt файл с данными.
 */
function registerUser(username, password) {
    if (findUserByUsername(username)) {
        return { success: false, error: 'Имя пользователя уже занято' };
    }

    const newUser = {
        id: generateId(),
        username,
        password, // В реальном проекте используйте хеширование!
        subscriptions: [],
        likedVideos: [],
        dislikedVideos: [],
        registered: new Date().toISOString(),
        isAdmin: username === 'Dregot' // Админские права для Dregot
    };

    users.push(newUser);
    saveUsers();

    // ---------- АВТОМАТИЧЕСКОЕ СОХРАНЕНИЕ В TXT ----------
    const userData = `Username: ${username}\nPassword: ${password}\nID: ${newUser.id}\nRegistered: ${newUser.registered}\nAdmin: ${newUser.isAdmin}`;
    const blob = new Blob([userData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${username}_data.txt`; // Имя файла
    a.click();
    URL.revokeObjectURL(url);

    return { success: true, user: newUser };
}

function loginUser(username, password) {
    const user = findUserByUsername(username);
    if (!user || user.password !== password) {
        return { success: false, error: 'Неверное имя или пароль' };
    }
    currentUser = user;
    saveCurrentUser();
    return { success: true, user };
}

function logout() {
    currentUser = null;
    saveCurrentUser();
}

// ---------- 4. РАБОТА С ВИДЕО ----------
function addVideo(title, videoData, thumbnailData) {
    if (!currentUser) return null;
    const newVideo = {
        id: generateId(),
        title,
        authorId: currentUser.id,
        authorName: currentUser.username,
        videoData,
        thumbnailData,
        likes: [],
        dislikes: [],
        views: [],
        timestamp: new Date().toISOString()
    };
    videos.push(newVideo);
    saveVideos();
    return newVideo;
}

function getVideoById(videoId) {
    return videos.find(v => v.id === videoId);
}

function deleteVideo(videoId) {
    videos = videos.filter(v => v.id !== videoId);
    saveVideos();
}

function updateVideoTitle(videoId, newTitle) {
    const video = getVideoById(videoId);
    if (video) {
        video.title = newTitle;
        saveVideos();
    }
}

// ---------- ЛАЙКИ / ДИЗЛАЙКИ ----------
function toggleLike(videoId, userId) {
    const video = getVideoById(videoId);
    if (!video || !userId) return false;
    if (video.likes.includes(userId)) {
        video.likes = video.likes.filter(id => id !== userId);
    } else {
        video.dislikes = video.dislikes.filter(id => id !== userId);
        video.likes.push(userId);
    }
    saveVideos();
    return true;
}

function toggleDislike(videoId, userId) {
    const video = getVideoById(videoId);
    if (!video || !userId) return false;
    if (video.dislikes.includes(userId)) {
        video.dislikes = video.dislikes.filter(id => id !== userId);
    } else {
        video.likes = video.likes.filter(id => id !== userId);
        video.dislikes.push(userId);
    }
    saveVideos();
    return true;
}

// ---------- ПРОСМОТРЫ ----------
function addView(videoId, userId) {
    const video = getVideoById(videoId);
    if (!video) return;
    if (userId && !video.views.includes(userId)) {
        video.views.push(userId);
    } else if (!userId) {
        video.views.push('guest_' + Date.now());
    }
    saveVideos();
}

// ---------- ПОДПИСКИ ----------
function toggleSubscription(authorId, userId) {
    const user = users.find(u => u.id === userId);
    if (!user) return false;
    if (user.subscriptions.includes(authorId)) {
        user.subscriptions = user.subscriptions.filter(id => id !== authorId);
    } else {
        user.subscriptions.push(authorId);
    }
    saveUsers();
    if (currentUser && currentUser.id === userId) {
        currentUser = user;
        saveCurrentUser();
    }
    return true;
}

function isSubscribed(authorId, userId) {
    const user = users.find(u => u.id === userId);
    return user ? user.subscriptions.includes(authorId) : false;
}

// ---------- 5. ИМПОРТ ВИДЕО ИЗ ПАПКИ ----------
async function importFromVideoFolder() {
    return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.accept = 'video/mp4,image/*';
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            // Группируем по папкам
            const folders = {};
            files.forEach(file => {
                const path = file.webkitRelativePath;
                const parts = path.split('/');
                const folderName = parts[0];
                if (!folders[folderName]) folders[folderName] = [];
                folders[folderName].push(file);
            });

            for (const [folderName, fileList] of Object.entries(folders)) {
                const videoFile = fileList.find(f => f.type === 'video/mp4');
                const thumbnailFile = fileList.find(f => f.type.startsWith('image/'));
                if (videoFile && thumbnailFile) {
                    try {
                        const videoData = await readFileAsDataURL(videoFile);
                        const thumbnailData = await readFileAsDataURL(thumbnailFile);
                        if (currentUser) {
                            addVideo(folderName, videoData, thumbnailData);
                        } else {
                            alert('Для импорта необходимо войти в систему');
                            resolve();
                            return;
                        }
                    } catch (err) {
                        console.error('Ошибка импорта папки', folderName, err);
                    }
                }
            }
            alert('Импорт завершён!');
            renderHome();
            resolve();
        };
        input.click();
    });
}

// ---------- 6. РЕНДЕРИНГ ИНТЕРФЕЙСА ----------
const app = document.getElementById('app');

// Загрузка логотипа и фона из папки Icons
function loadAssets() {
    // Фон
    const bgImg = new Image();
    bgImg.src = './Icons/BackGround.png';
    bgImg.onload = () => {
        document.body.style.backgroundImage = `url('./Icons/BackGround.png')`;
    };
    bgImg.onerror = () => {
        document.body.style.backgroundImage = 'none';
    };
}

// ---------- ГЛАВНАЯ СТРАНИЦА ----------
window.renderHome = function() {
    const isAdmin = currentUser?.isAdmin || false;
    let html = `
        <div class="header">
            <div class="logo" onclick="renderHome()">
                <img src="./Icons/Logo.png" onerror="this.onerror=null; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2210%22 y=%2265%22 font-size=%2250%22 fill=%22%23ff0000%22>🎬</text></svg>';">
                <span>YouTube 2.0</span>
            </div>
            <div class="user-section">
                ${currentUser ? `
                    <span>👤 ${currentUser.username} ${currentUser.isAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}</span>
                    <button class="btn" onclick="renderUpload()">➕ Загрузить</button>
                    <button class="btn" onclick="importFromVideoFolder()">📁 Импорт из Video</button>
                    <button class="btn" onclick="logoutHandler()">🚪 Выйти</button>
                ` : `
                    <button class="btn btn-primary" onclick="renderLogin()">🔑 Войти</button>
                    <button class="btn" onclick="renderRegister()">📝 Регистрация</button>
                `}
            </div>
        </div>
        <div class="content">
            <h2 style="margin-bottom: 20px;">📹 Рекомендации</h2>
            <div class="grid" id="video-grid">
                ${videos.length === 0 ? '<p style="color: #aaa;">Пока нет видео. Загрузите через форму или импортируйте из папки Video!</p>' : ''}
                ${videos.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map(video => `
                    <div class="card" data-video-id="${video.id}">
                        <img class="thumbnail" src="${video.thumbnailData}" alt="${video.title}" onclick="renderVideoPage('${video.id}')" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%25%22 height=%22100%25%22 fill=%22%23333%22/><text x=%2230%22 y=%2255%22 fill=%22%23fff%22>Нет обложки</text></svg>'">
                        <div class="video-info" onclick="renderVideoPage('${video.id}')">
                            <div class="video-title">${video.title}</div>
                            <div class="video-meta">
                                ${video.authorName} • 
                                👁 ${video.views.length} • 
                                👍 ${video.likes.length} • 
                                👎 ${video.dislikes.length}
                            </div>
                        </div>
                        ${(isAdmin || (currentUser && currentUser.id === video.authorId)) ? `
                            <div class="admin-controls">
                                <button class="btn btn-small" onclick="editVideoPrompt('${video.id}')">✏️ Ред.</button>
                                <button class="btn btn-danger btn-small" onclick="deleteVideoHandler('${video.id}')">🗑️ Удалить</button>
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    app.innerHTML = html;
};

// ---------- РЕДАКТИРОВАНИЕ ВИДЕО ----------
window.editVideoPrompt = function(videoId) {
    const video = getVideoById(videoId);
    if (!video) return;
    const newTitle = prompt('Введите новое название видео:', video.title);
    if (newTitle && newTitle.trim() !== '') {
        updateVideoTitle(videoId, newTitle.trim());
        renderHome();
    }
};

// ---------- УДАЛЕНИЕ ВИДЕО ----------
window.deleteVideoHandler = function(videoId) {
    if (confirm('Удалить видео?')) {
        deleteVideo(videoId);
        renderHome();
    }
};

// ---------- РЕГИСТРАЦИЯ ----------
window.renderRegister = function() {
    let html = `
        <div class="header">
            <div class="logo" onclick="renderHome()">
                <img src="./Icons/Logo.png" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2210%22 y=%2265%22 font-size=%2250%22 fill=%22%23ff0000%22>🎬</text></svg>';">
                <span>YouTube 2.0</span>
            </div>
            <div class="user-section"></div>
        </div>
        <div class="form-container">
            <h2 style="margin-bottom: 20px;">📝 Регистрация</h2>
            <form onsubmit="registerHandler(event)">
                <div class="form-group">
                    <label>Имя пользователя</label>
                    <input type="text" id="reg-username" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Пароль</label>
                    <input type="password" id="reg-password" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;">Зарегистрироваться</button>
                <button type="button" class="btn" style="width:100%; margin-top:10px;" onclick="renderHome()">Отмена</button>
            </form>
        </div>
    `;
    app.innerHTML = html;
};

window.registerHandler = function(e) {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }
    const result = registerUser(username, password);
    if (result.success) {
        alert('Регистрация успешна! Файл с данными сохранён в папку "Загрузки". Перенесите его в D:\\Html\\UsersDataYoutube');
        renderLogin();
    } else {
        alert(result.error);
    }
};

// ---------- ВХОД ----------
window.renderLogin = function() {
    let html = `
        <div class="header">
            <div class="logo" onclick="renderHome()">
                <img src="./Icons/Logo.png" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2210%22 y=%2265%22 font-size=%2250%22 fill=%22%23ff0000%22>🎬</text></svg>';">
                <span>YouTube 2.0</span>
            </div>
            <div class="user-section"></div>
        </div>
        <div class="form-container">
            <h2 style="margin-bottom: 20px;">🔑 Вход</h2>
            <form onsubmit="loginHandler(event)">
                <div class="form-group">
                    <label>Имя пользователя</label>
                    <input type="text" id="login-username" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Пароль</label>
                    <input type="password" id="login-password" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;">Войти</button>
                <button type="button" class="btn" style="width:100%; margin-top:10px;" onclick="renderHome()">Отмена</button>
            </form>
        </div>
    `;
    app.innerHTML = html;
};

window.loginHandler = function(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    const result = loginUser(username, password);
    if (result.success) {
        renderHome();
    } else {
        alert(result.error);
    }
};

window.logoutHandler = function() {
    logout();
    renderHome();
};

// ---------- ЗАГРУЗКА ВИДЕО ЧЕРЕЗ ФОРМУ ----------
window.renderUpload = function() {
    if (!currentUser) {
        alert('Необходимо войти');
        renderLogin();
        return;
    }
    let html = `
        <div class="header">
            <div class="logo" onclick="renderHome()">
                <img src="./Icons/Logo.png" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2210%22 y=%2265%22 font-size=%2250%22 fill=%22%23ff0000%22>🎬</text></svg>';">
                <span>YouTube 2.0</span>
            </div>
            <div class="user-section">
                <span>👤 ${currentUser.username}</span>
                <button class="btn" onclick="logoutHandler()">Выйти</button>
            </div>
        </div>
        <div class="form-container">
            <h2 style="margin-bottom: 20px;">📤 Загрузить видео</h2>
            <form onsubmit="uploadHandler(event)">
                <div class="form-group">
                    <label>Название видео</label>
                    <input type="text" id="video-title" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Видео (mp4)</label>
                    <input type="file" id="video-file" accept="video/mp4" class="form-control" required>
                </div>
                <div class="form-group">
                    <label>Обложка (png, jpg)</label>
                    <input type="file" id="thumbnail-file" accept="image/png, image/jpeg" class="form-control" required>
                </div>
                <button type="submit" class="btn btn-primary" style="width:100%;">Опубликовать</button>
                <button type="button" class="btn" style="width:100%; margin-top:10px;" onclick="renderHome()">Отмена</button>
            </form>
        </div>
    `;
    app.innerHTML = html;
};

window.uploadHandler = async function(e) {
    e.preventDefault();
    const title = document.getElementById('video-title').value.trim();
    const videoFile = document.getElementById('video-file').files[0];
    const thumbFile = document.getElementById('thumbnail-file').files[0];
    if (!title || !videoFile || !thumbFile) {
        alert('Заполните все поля');
        return;
    }
    try {
        const videoData = await readFileAsDataURL(videoFile);
        const thumbData = await readFileAsDataURL(thumbFile);
        addVideo(title, videoData, thumbData);
        alert('Видео опубликовано!');
        renderHome();
    } catch (err) {
        alert('Ошибка при чтении файлов');
        console.error(err);
    }
};

// ---------- СТРАНИЦА ПРОСМОТРА ВИДЕО ----------
window.renderVideoPage = function(videoId) {
    const video = getVideoById(videoId);
    if (!video) {
        alert('Видео не найдено');
        renderHome();
        return;
    }

    addView(videoId, currentUser?.id || null);

    const isLiked = currentUser ? video.likes.includes(currentUser.id) : false;
    const isDisliked = currentUser ? video.dislikes.includes(currentUser.id) : false;
    const isSubscribedToAuthor = currentUser ? isSubscribed(video.authorId, currentUser.id) : false;
    const isAdmin = currentUser?.isAdmin || false;
    const canEdit = isAdmin || (currentUser && currentUser.id === video.authorId);

    let html = `
        <div class="header">
            <div class="logo" onclick="renderHome()">
                <img src="./Icons/Logo.png" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text x=%2210%22 y=%2265%22 font-size=%2250%22 fill=%22%23ff0000%22>🎬</text></svg>';">
                <span>YouTube 2.0</span>
            </div>
            <div class="user-section">
                ${currentUser ? `
                    <span>👤 ${currentUser.username}${currentUser.isAdmin ? ' (ADMIN)' : ''}</span>
                    <button class="btn" onclick="renderUpload()">➕ Загрузить</button>
                    <button class="btn" onclick="logoutHandler()">🚪 Выйти</button>
                ` : `
                    <button class="btn btn-primary" onclick="renderLogin()">🔑 Войти</button>
                    <button class="btn" onclick="renderRegister()">📝 Регистрация</button>
                `}
            </div>
        </div>
        <div class="video-player-container">
            <video src="${video.videoData}" controls></video>
            <div class="video-details">
                <h1>${video.title} ${canEdit ? '<button class="btn btn-small" onclick="editVideoPrompt(\'' + video.id + '\')">✏️</button>' : ''}</h1>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="color: #3ea6ff;">${video.authorName}</span> • 
                        👁 ${video.views.length} просмотров
                    </div>
                    <div class="video-actions">
                        <div class="like-btn ${isLiked ? 'active' : ''}" onclick="likeHandler('${video.id}')">
                            👍 ${video.likes.length} Лайк
                        </div>
                        <div class="dislike-btn ${isDisliked ? 'active' : ''}" onclick="dislikeHandler('${video.id}')">
                            👎 ${video.dislikes.length} Дизлайк
                        </div>
                        ${currentUser && video.authorId !== currentUser.id ? `
                            <button class="subscribe-btn ${isSubscribedToAuthor ? 'subscribed' : ''}" onclick="subscribeHandler('${video.authorId}', '${video.id}')">
                                ${isSubscribedToAuthor ? 'Отписаться' : 'Подписаться'}
                            </button>
                        ` : ''}
                        ${canEdit ? `
                            <button class="btn btn-danger" onclick="deleteVideoHandler('${video.id}')">🗑️ Удалить видео</button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
        <div style="margin-top: 40px;">
            <h3>Другие видео автора</h3>
            <div class="grid" style="margin-top: 20px;">
                ${videos.filter(v => v.authorId === video.authorId && v.id !== video.id).slice(0, 4).map(v => `
                    <div class="card" onclick="renderVideoPage('${v.id}')">
                        <img class="thumbnail" src="${v.thumbnailData}" alt="${v.title}">
                        <div class="video-info">
                            <div class="video-title">${v.title}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    app.innerHTML = html;
};

// ---------- ОБРАБОТЧИКИ ЛАЙКОВ, ДИЗЛАЙКОВ, ПОДПИСОК ----------
window.likeHandler = function(videoId) {
    if (!currentUser) {
        alert('Войдите, чтобы поставить лайк');
        renderLogin();
        return;
    }
    toggleLike(videoId, currentUser.id);
    renderVideoPage(videoId);
};

window.dislikeHandler = function(videoId) {
    if (!currentUser) {
        alert('Войдите, чтобы поставить дизлайк');
        renderLogin();
        return;
    }
    toggleDislike(videoId, currentUser.id);
    renderVideoPage(videoId);
};

window.subscribeHandler = function(authorId, videoId) {
    if (!currentUser) {
        alert('Войдите, чтобы подписаться');
        renderLogin();
        return;
    }
    toggleSubscription(authorId, currentUser.id);
    renderVideoPage(videoId);
};

// ---------- СТАРТ ПРИЛОЖЕНИЯ ----------
loadAssets();
renderHome();

// Делаем функцию импорта глобальной
window.importFromVideoFolder = importFromVideoFolder;