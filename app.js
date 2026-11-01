const SUPABASE_URL = 'https://ojicappgbibfkmzhiqzl.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_NnAyNTCh17cOogf_k80rKg_XoAkrTdS'; 

let currentToken = SUPABASE_KEY;
let isLoggedIn = false;
let currentSort = 'asc';
let currentSubTab = 'sub-books'; // 记录当前在哪个子tab
let currentDesignType = '封面';

async function supabaseFetch(endpoint, options = {}) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${currentToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
        ...options.headers
    };
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '请求失败');
    }
    const text = await response.text();
    return text ? JSON.parse(text) : {};
}

// ===== 图片压缩工具函数 =====
async function compressImage(file, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', quality);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

document.addEventListener('DOMContentLoaded', () => {
           // ===== Tab 切换逻辑 =====
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // 标题与副标题的映射
        // 标题与副标题/引言映射
    const tabConfig = {
        'tab-me': { title: '关于我', sub: 'PROFILE', quote: '「语言是社会文化的镜子。」' },
        'tab-hobbies': { title: '喜好', sub: 'PREFERENCES', quote: '「收集一些微小的快乐。」' },
        'tab-showcase': { title: '展示', sub: 'SHOWCASE', quote: '「存放我的小世界。」' }
    };

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            
            // 这里明确定义 targetId
            const targetId = btn.dataset.target;
            document.getElementById(targetId).classList.add('active');
            
                        // 更新顶部标题、英文和右侧引言
            const config = tabConfig[targetId];
            if(config) {
                document.getElementById('top-bar-title').textContent = config.title;
                document.getElementById('top-bar-subtitle').textContent = config.sub;
                document.getElementById('top-bar-quote').textContent = config.quote;
            }
            
            // 切换 Tab 时自动回到顶部
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            if(typeof checkFabVisibility === 'function') checkFabVisibility();
        });
    });

    const subTabBtns = document.querySelectorAll('.sub-tab-btn');
    const subTabContents = document.querySelectorAll('.sub-tab-content');
    subTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            subTabBtns.forEach(b => b.classList.remove('active'));
            subTabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
            currentSubTab = btn.dataset.target;
             // 如果切换到短篇，强制隐藏
            if (currentSubTab === 'sub-story') {
                document.getElementById('fab-container').style.display = 'none';
            }
            
            checkFabVisibility();
            
            if(currentSubTab === 'sub-books') loadBooks();
            if(currentSubTab === 'sub-design') loadDesigns();
        });
    });

    // ===== 登录逻辑 =====
    const adminBtn = document.getElementById('admin-btn');
    const loginModal = document.getElementById('login-modal');
    const fabContainer = document.getElementById('fab-container');
    const fabAdd = document.getElementById('fab-add');

            function updateAuthUI() {
        adminBtn.style.display = 'block';
        if (isLoggedIn) {
            adminBtn.textContent = '退出';
            adminBtn.classList.add('logged-in');
        } else {
            adminBtn.textContent = '登录';
            adminBtn.classList.remove('logged-in');
        }
        
        checkFabVisibility(); // 重新检查加号显示状态
        
        // 刷新当前视图
        if(currentSubTab === 'sub-books') loadBooks();
        if(currentSubTab === 'sub-design') loadDesigns();
    }

               // 判断是否显示加号
    function checkFabVisibility() {
        // 如果没有登录，无论在哪，统统隐藏！
        if (!isLoggedIn) {
            fabContainer.style.display = 'none';
            return;
        }

        const isShowcaseActive = document.getElementById('tab-showcase').classList.contains('active');
        const isBookOrDesign = (currentSubTab === 'sub-books' || currentSubTab === 'sub-design');
        
        if (isShowcaseActive && isBookOrDesign) {
            fabContainer.style.display = 'block';
        } else {
            fabContainer.style.display = 'none';
        }
    }

    adminBtn.addEventListener('click', () => {
        if (isLoggedIn) {
            localStorage.removeItem('supabase_token');
            isLoggedIn = false;
            currentToken = SUPABASE_KEY;
            updateAuthUI();
        } else {
            loginModal.classList.add('active');
        }
    });

    document.getElementById('login-cancel').addEventListener('click', () => loginModal.classList.remove('active'));
    document.getElementById('login-submit').addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = document.getElementById('login-submit');
        btn.textContent = '登录中...';
        try {
            const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
                method: 'POST',
                headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error_description || '密码错误');
            localStorage.setItem('supabase_token', data.access_token);
            currentToken = data.access_token;
            isLoggedIn = true;
            updateAuthUI();
            loginModal.classList.remove('active');
        } catch (error) {
            alert('登录失败: ' + error.message);
        } finally {
            btn.textContent = '登录';
        }
    });

    const savedToken = localStorage.getItem('supabase_token');
    if (savedToken) {
        currentToken = savedToken;
        isLoggedIn = true;
    }
    updateAuthUI();

        // ===== 1. 书架模块 (重构版) =====
    async function loadBooks() {
        const container = document.getElementById('books-container');
        const filterStatus = document.getElementById('filter-status').value;
        const filterCategory = document.getElementById('filter-category').value;

        try {
            // 构建查询条件 (Supabase 的 REST 语法)
            let query = 'books?select=*&order=id.asc';
            if (filterStatus !== '全部') query += `&status=eq.${filterStatus}`;
            if (filterCategory !== '全部') query += `&category=eq.${filterCategory}`;
            
            const books = await supabaseFetch(query);
            
            if (!books || books.length === 0) {
                container.innerHTML = '<div class="card"><p>没有符合条件的书籍。</p></div>';
                return;
            }

            // 将书籍按四个书架分组
            const groups = {
                '云中书': { icon: '☁️', books: [] },
                '朱砂册': { icon: '❤️', books: [] },
                '清简集': { icon: '📖', books: [] },
                '衍生卷': { icon: '🌀', books: [] }
            };

            books.forEach(book => {
                let groupName = '清简集';
                if (book.status === '追连载') groupName = '云中书';
                if (book.status === '已看完' && book.rating >= 4) groupName = '朱砂册';
                if (book.note && book.note.includes('同人')) groupName = '衍生卷'; // 如果你在同人书备注里写了“同人”，归入衍生卷
                
                groups[groupName].books.push(book);
            });

            let html = '';
            // 遍历渲染四个书架
            for (const [groupName, groupData] of Object.entries(groups)) {
                if (groupData.books.length === 0) continue; // 如果没书就不显示这个书架

                html += `
                    <div class="shelf-group" data-group="${groupName}">
                        <div class="shelf-group-title">${groupData.icon} ${groupName} <span style="font-size:0.7rem; font-weight:normal; color:var(--color-text-muted); margin-left: auto;">${groupData.books.length} 本</span></div>
                        <div class="book-grid">
                `;

                groupData.books.forEach(book => {
                    const stars = '★'.repeat(book.rating || 0) + '☆'.repeat(5 - (book.rating || 0));
                    html += `
                        <div class="book-card" onclick="showBookDetail(${book.id})">
                            <div class="book-card-left">
                                <div class="book-card-title">《${book.title}》</div>
                                <div class="book-card-author">${book.author || '未知作者'}</div>
                            </div>
                            <div class="book-card-right">
                                <div class="book-card-rating">${stars}</div>
                                <div class="tag cat-tag" style="font-size:0.6rem;">${book.category}</div>
                            </div>
                        </div>
                    `;
                });
                html += `</div></div>`;
            }
            container.innerHTML = html;

        } catch (e) {
            container.innerHTML = `<div class="card"><p style="color:red;">加载失败: ${e.message}</p></div>`;
        }
    }

    // 绑定筛选事件
    document.getElementById('filter-status').addEventListener('change', loadBooks);
    document.getElementById('filter-category').addEventListener('change', loadBooks);

    // ===== 书籍详情弹窗逻辑 =====
    const detailModal = document.getElementById('book-detail-modal');
    let currentBookId = null;

    window.showBookDetail = async (id) => {
        try {
            const bookData = await supabaseFetch(`books?id=eq.${id}&select=*`);
            if (bookData.length === 0) return;
            const book = bookData[0];
            currentBookId = book.id;

            // 填充数据
            document.getElementById('detail-title').textContent = `《${book.title}》`;
            document.getElementById('detail-author').textContent = book.author || '未知';
            document.getElementById('detail-category').textContent = book.category || '未分类';
            document.getElementById('detail-status').textContent = book.status || '待看';
            
            const stars = '★'.repeat(book.rating || 0) + '☆'.repeat(5 - (book.rating || 0));
            document.getElementById('detail-rating').textContent = stars;
            
            // 处理标签
            const tagsBox = document.getElementById('detail-tags');
            if (book.tags && book.tags.length > 0) {
                tagsBox.innerHTML = book.tags.map(t => `<span class="mini-tag" style="font-size:0.75rem; padding:0.1rem 0.5rem;">${t}</span>`).join('');
            } else {
                tagsBox.innerHTML = '<span style="color:var(--color-text-muted); font-size:0.8rem;">无标签</span>';
            }

            // 处理备注
            document.getElementById('detail-note').textContent = book.note || '暂无备注...';

            // 判断是否显示管理员操作按钮
            const adminActions = document.getElementById('admin-actions');
            if (isLoggedIn) {
                adminActions.style.display = 'flex';
            } else {
                adminActions.style.display = 'none';
            }

            detailModal.classList.add('active');
        } catch (e) {
            alert('获取详情失败: ' + e.message);
        }
    };

    document.getElementById('detail-close').addEventListener('click', () => {
        detailModal.classList.remove('active');
    });

    // 详情弹窗里的 编辑/删除 按钮
    document.getElementById('detail-edit').addEventListener('click', () => {
        detailModal.classList.remove('active');
        editBook(currentBookId);
    });

    document.getElementById('detail-delete').addEventListener('click', () => {
        detailModal.classList.remove('active');
        openDelete('books', currentBookId);
    });
    function bindSortEvent() {
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                currentSort = e.target.value;
                loadBooks();
            });
        }
    }

        // 2. 设计模块渲染
    async function loadDesigns() {
        const container = document.getElementById('design-grid-container');
        try {
            // 按类型获取
            const designs = await supabaseFetch(`designs?type=eq.${currentDesignType}&select=*&order=created_at.desc`);
            
            if (!designs || designs.length === 0) {
                container.innerHTML = `<p style="color: var(--color-text-muted); text-align: center; padding: 2rem 0;">暂无${currentDesignType}作品</p>`;
                return;
            }
            let html = '<div class="design-grid">';
            designs.forEach(item => {
                const actionBtns = isLoggedIn ? `
                    <div class="design-actions">
                        <button class="btn-small" onclick="editDesign(${item.id})">改</button>
                        <button class="btn-small delete" onclick="openDelete('designs', ${item.id})">删</button>
                    </div>` : '';
                
                // 根据尺寸加不同的 class
                let ratioClass = 'ratio-34';
                if(item.ratio === '1:1') ratioClass = 'ratio-11';
                if(item.ratio === '5:7') ratioClass = 'ratio-57';
                if(item.ratio === '16:9') ratioClass = 'ratio-169';

                html += `
                    <div class="design-item">
                        <div class="design-img-box ${ratioClass}">
                            <img src="${item.image_url}" alt="${item.title}" loading="lazy">
                        </div>
                        ${actionBtns}
                        <div class="design-info">
                            <span>${item.title || '未命名'}</span>
                            <span style="color:var(--color-text-muted); font-size:0.65rem;">${item.ratio}</span>
                        </div>
                    </div>`;
            });
            html += '</div>';
            container.innerHTML = html;
        } catch (e) {
            container.innerHTML = `<p style="color:red;">加载失败: ${e.message}</p>`;
        }
    }

    // 绑定设计二级分类点击
    document.querySelectorAll('.design-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.design-cat-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentDesignType = e.target.dataset.type;
            loadDesigns();
        });
    });

    // ===== 悬浮按钮点击路由 =====
    fabAdd.addEventListener('click', () => {
        if (currentSubTab === 'sub-books') {
            openBookModal();
        } else if (currentSubTab === 'sub-design') {
            openDesignModal();
        }
    });

    // ===== 书架表单逻辑 =====
    const bookModal = document.getElementById('book-modal');
    window.openBookModal = () => {
        document.getElementById('book-modal-title').textContent = '添加书籍';
        document.getElementById('book-id').value = '';
        document.getElementById('book-title').value = '';
        document.getElementById('book-author').value = '';
        document.getElementById('book-tags').value = '';
        document.getElementById('book-note').value = '';
        bookModal.classList.add('active');
    };

    window.editBook = async (id) => {
        try {
            const book = await supabaseFetch(`books?id=eq.${id}&select=*`);
            if (book.length === 0) return;
            const b = book[0];
            document.getElementById('book-modal-title').textContent = '编辑书籍';
            document.getElementById('book-id').value = b.id;
            document.getElementById('book-title').value = b.title;
            document.getElementById('book-author').value = b.author || '';
            document.getElementById('book-category').value = b.category || '古风';
            document.getElementById('book-tags').value = b.tags ? b.tags.join(', ') : '';
            document.getElementById('book-status').value = b.status || '已看完';
            document.getElementById('book-rating').value = b.rating || 5;
            document.getElementById('book-note').value = b.note || '';
            bookModal.classList.add('active');
        } catch (e) { alert('获取数据失败: ' + e.message); }
    };

    document.getElementById('book-cancel').addEventListener('click', () => bookModal.classList.remove('active'));
    document.getElementById('book-save').addEventListener('click', async () => {
        const id = document.getElementById('book-id').value;
        const title = document.getElementById('book-title').value.trim();
        if (!title) return alert('书名不能为空！');

        const tagsStr = document.getElementById('book-tags').value.trim();
        const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()) : [];

        const payload = {
            title: title,
            author: document.getElementById('book-author').value.trim(),
            category: document.getElementById('book-category').value,
            tags: tags,
            status: document.getElementById('book-status').value,
            rating: parseInt(document.getElementById('book-rating').value),
            note: document.getElementById('book-note').value.trim()
        };

        try {
            if (id) {
                await supabaseFetch(`books?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
            } else {
                await supabaseFetch('books', { method: 'POST', body: JSON.stringify(payload) });
            }
            bookModal.classList.remove('active');
            loadBooks();
        } catch (e) { alert('保存失败: ' + e.message); }
    });

    // ===== 设计表单逻辑 =====
    const designModal = document.getElementById('design-modal');
    const designFile = document.getElementById('design-file');
    const designPreview = document.getElementById('design-preview');
    const designPreviewImg = document.getElementById('design-preview-img');
    let selectedFile = null;

    window.openDesignModal = () => {
        document.getElementById('design-modal-title').textContent = '上传设计';
        document.getElementById('design-id').value = '';
        document.getElementById('design-old-img').value = '';
        document.getElementById('design-title').value = '';
        document.getElementById('design-note').value = '';
        selectedFile = null;
        designPreview.style.display = 'none';
        designFile.value = '';
        designModal.classList.add('active');
    };

    window.editDesign = async (id) => {
        try {
            const design = await supabaseFetch(`designs?id=eq.${id}&select=*`);
            if (design.length === 0) return;
            const d = design[0];
            document.getElementById('design-modal-title').textContent = '编辑设计';
            document.getElementById('design-id').value = d.id;
            document.getElementById('design-old-img').value = d.image_url;
            document.getElementById('design-title').value = d.title || '';
            document.getElementById('design-type').value = d.type || '封面';
            document.getElementById('design-note').value = d.note || '';
            
            selectedFile = null;
            designFile.value = '';
            designPreviewImg.src = d.image_url;
            designPreview.style.display = 'block';
            
            designModal.classList.add('active');
        } catch (e) { alert('获取数据失败: ' + e.message); }
    };

    // 选择图片预览
    document.getElementById('design-file-btn').addEventListener('click', () => designFile.click());
    designFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            selectedFile = file;
            const objUrl = URL.createObjectURL(file);
            designPreviewImg.src = objUrl;
            designPreview.style.display = 'block';
        }
    });

    document.getElementById('design-cancel').addEventListener('click', () => designModal.classList.remove('active'));
    
    // 保存设计 (包含图片上传)
    document.getElementById('design-save').addEventListener('click', async () => {
        const id = document.getElementById('design-id').value;
        const oldImg = document.getElementById('design-old-img').value;
        const title = document.getElementById('design-title').value.trim();
        
        // ===== 这里增加了获取 尺寸(ratio) 的代码 =====
        const type = document.getElementById('design-type').value;
        const ratio = document.getElementById('design-ratio').value; 
        
        const note = document.getElementById('design-note').value.trim();
        const btn = document.getElementById('design-save');

        if (!id && !selectedFile) {
            return alert('请选择要上传的图片！');
        }

        btn.textContent = '处理中...';
        btn.disabled = true;

        try {
            let imageUrl = oldImg;

            // 如果选了新图片，先压缩再上传
            if (selectedFile) {
                // 1. 压缩图片 (宽度800，质量0.8)
                const compressedBlob = await compressImage(selectedFile, 800, 0.8);
                
                // 2. 生成唯一文件名
                const fileExt = 'jpg'; 
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${fileName}`;

                // 3. 上传到 Supabase Storage
                const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/designs/${filePath}`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${currentToken}`,
                        'Content-Type': 'image/jpeg'
                    },
                    body: compressedBlob
                });

                if (!uploadRes.ok) throw new Error('图片上传失败');
                
                // 4. 获取公开访问 URL
                imageUrl = `${SUPABASE_URL}/storage/v1/object/public/designs/${filePath}`;
            }

            // 5. 保存数据到 designs 表
            // ===== 这里把 ratio 加到了 payload 里面 =====
            const payload = { 
                title: title, 
                type: type, 
                ratio: ratio, 
                note: note, 
                image_url: imageUrl 
            };
            
            if (id) {
                // 如果有 id，说明是编辑，用 PATCH
                await supabaseFetch(`designs?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
            } else {
                // 如果没有 id，说明是新增，用 POST
                await supabaseFetch('designs', { method: 'POST', body: JSON.stringify(payload) });
            }

            designModal.classList.remove('active');
            loadDesigns(); // 刷新展示

        } catch (e) {
            alert('保存失败: ' + e.message);
        } finally {
            btn.textContent = '保存';
            btn.disabled = false;
        }
    });

    // ===== 删除逻辑 (共用) =====
    const deleteModal = document.getElementById('delete-modal');
    
    window.openDelete = (type, id) => {
        document.getElementById('delete-id').value = id;
        document.getElementById('delete-type').value = type;
        deleteModal.classList.add('active');
    };

    document.getElementById('delete-cancel').addEventListener('click', () => deleteModal.classList.remove('active'));
    document.getElementById('delete-confirm').addEventListener('click', async () => {
        const type = document.getElementById('delete-type').value;
        const id = document.getElementById('delete-id').value;
        try {
            // 如果是删除设计，最好把云端的图片也删了（这里为了简单直接删记录，图片会留下）
            // 完整版应该先获取 image_url，去 Storage 删文件，再删表记录
            await supabaseFetch(`${type}?id=eq.${id}`, { method: 'DELETE' });
            deleteModal.classList.remove('active');
            
            if (type === 'books') loadBooks();
            if (type === 'designs') loadDesigns();
        } catch (e) { alert('删除失败: ' + e.message); }
    });

    // 启动加载
    loadBooks();
});

            // ===== 短篇视图切换与智能滚动控制 =====
    const coverView = document.getElementById('story-cover-view');
    const readView = document.getElementById('story-read-view');
    const enterBtn = document.getElementById('enter-story-btn');
    const backBtn = document.getElementById('back-to-cover');
    const smartScrollBtn = document.getElementById('smart-scroll-btn');
    
    const subTabsContainer = document.querySelector('#tab-showcase .sub-tabs');
    const scrollContainer = document.querySelector('.app-container');

    if (enterBtn) {
        let lastScrollTop = 0; // 记录上一次滚动的位置
        let hideTimeout; // 用于防抖隐藏

        // 进入正文
        enterBtn.addEventListener('click', () => {
            coverView.style.display = 'none';
            readView.style.display = 'block';
            subTabsContainer.style.display = 'none'; 
            scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
            smartScrollBtn.style.opacity = '0'; // 刚进正文时隐藏
        });

        // 返回简介
        backBtn.addEventListener('click', () => {
            readView.style.display = 'none';
            coverView.style.display = 'flex';
            subTabsContainer.style.display = 'flex'; 
            scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // 点击智能按钮
        smartScrollBtn.addEventListener('click', () => {
            if (smartScrollBtn.textContent === '↑') {
                scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
            }
        });

        // 监听滚动，实现智能显示和箭头方向
        scrollContainer.addEventListener('scroll', () => {
            // 如果不在正文阅读页，就不处理
            if (readView.style.display === 'none') return;

            const currentScrollTop = scrollContainer.scrollTop;
            const scrollHeight = scrollContainer.scrollHeight;
            const clientHeight = scrollContainer.clientHeight;

            // 如果很接近顶部（小于50px），或者很接近底部，直接显示
            if (currentScrollTop <= 50) {
                // 在最顶部时，不需要任何操作，隐藏按钮
                smartScrollBtn.style.opacity = '0';
                lastScrollTop = currentScrollTop;
                return;
            }

            // 判断滚动方向
            if (currentScrollTop > lastScrollTop) {
                // 往下滑 -> 显示向下箭头 ↓
                smartScrollBtn.textContent = '↓';
                smartScrollBtn.style.opacity = '1';
            } else {
                // 往上滑 -> 显示向上箭头 ↑
                smartScrollBtn.textContent = '↑';
                smartScrollBtn.style.opacity = '1';
            }

            // 处理滚动停止后的自动隐藏（停留 1.5 秒后变半透明）
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
                if (currentScrollTop > 50) {
                    smartScrollBtn.style.opacity = '0.3';
                }
            }, 1500);

            lastScrollTop = currentScrollTop;
        });
    }