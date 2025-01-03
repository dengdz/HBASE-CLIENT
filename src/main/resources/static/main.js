document.addEventListener('DOMContentLoaded', function() {
    // 获取DOM元素
    const addDataSourceBtn = document.getElementById('addDataSourceBtn');
    const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');
    const dataSourceModal = document.getElementById('dataSourceModal');
    const closeButton = dataSourceModal.querySelector('.close-button');
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    const saveDataSourceBtn = document.getElementById('saveDataSourceBtn');
    const dataSourcesList = document.getElementById('dataSourcesList');
    const emptyState = document.getElementById('emptyState');
    const queryInterface = document.getElementById('queryInterface');

    // 数据源列表
    let dataSources = [];
    let activeDataSource = null;

    // 从localStorage加载保存的数据源
    function loadDataSources() {
        const saved = localStorage.getItem('hbaseDataSources');
        if (saved) {
            dataSources = JSON.parse(saved);
            renderDataSources();
        }
        updateEmptyState();
    }

    // 保存数据源到localStorage
    function saveDataSources() {
        localStorage.setItem('hbaseDataSources', JSON.stringify(dataSources));
        updateEmptyState();
    }

    // 渲染数据源列表
    function renderDataSources() {
        dataSourcesList.innerHTML = '';
        dataSources.forEach(ds => {
            const item = document.createElement('div');
            item.className = `data-source-item ${ds === activeDataSource ? 'active' : ''}`;
            item.innerHTML = `
                <div class="data-source-info">
                    <i class="mdi mdi-database"></i>
                    <span>${ds.name}</span>
                </div>
                <div class="data-source-actions">
                    <button class="icon-button" title="删除数据源">
                        <i class="mdi mdi-delete"></i>
                    </button>
                </div>
            `;
            
            // 添加点击事件
            item.querySelector('.data-source-info').addEventListener('click', () => selectDataSource(ds));
            
            // 添加删除按钮点击事件
            item.querySelector('.data-source-actions .icon-button').addEventListener('click', (e) => {
                e.stopPropagation(); // 阻止事件冒泡
                deleteDataSource(ds);
            });
            
            dataSourcesList.appendChild(item);
        });
    }

    // 更新空状态显示
    function updateEmptyState() {
        if (dataSources.length === 0) {
            emptyState.style.display = 'flex';
            queryInterface.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            if (activeDataSource) {
                queryInterface.style.display = 'block';
            }
        }
    }

    // 显示添加数据源模态框
    function showModal() {
        dataSourceModal.classList.add('show');
        // 清空表单
        document.getElementById('dataSourceName').value = '';
        document.getElementById('zkQuorum').value = '';
        document.getElementById('coreSiteFile').value = '';
        document.getElementById('hbaseSiteFile').value = '';
        updateFileNames();
    }

    // 隐藏模态框
    function hideModal() {
        dataSourceModal.classList.remove('show');
    }

    // 更新文件名显示
    function updateFileNames() {
        const coreSiteFile = document.getElementById('coreSiteFile');
        const hbaseSiteFile = document.getElementById('hbaseSiteFile');
        
        coreSiteFile.parentElement.querySelector('.file-name span').textContent = 
            coreSiteFile.files[0]?.name || '未选择文件';
        hbaseSiteFile.parentElement.querySelector('.file-name span').textContent = 
            hbaseSiteFile.files[0]?.name || '未选择文件';
    }

    // 添加设置按钮加载状态的辅助函数
    function setButtonLoading(button, loading) {
        if (loading) {
            button.classList.add('button-loading');
            button.disabled = true;
        } else {
            button.classList.remove('button-loading');
            button.disabled = false;
        }
    }

    // 测试连接
    async function testConnection(dataSource) {
        const testButton = document.getElementById('testConnectionBtn');
        setButtonLoading(testButton, true);
        
        try {
            const formData = new FormData();
            formData.append('core-site', dataSource.coreSiteFile);
            formData.append('hbase-site', dataSource.hbaseSiteFile);

            const testId = 'test-' + Date.now();
            
            const uploadResponse = await fetch(`/api/datasource/${testId}/upload-config`, {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                throw new Error('配置文件上传失败');
            }

            const connectResponse = await fetch(`/api/datasource/${testId}/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ host: dataSource.zkQuorum })
            });

            if (!connectResponse.ok) {
                throw new Error('连接失败');
            }

            showMessage('连接测试成功', 'success');
            return true;
        } catch (error) {
            console.error('连接测试失败:', error);
            showMessage('连接测试失败: ' + error.message, 'error');
            return false;
        } finally {
            setButtonLoading(testButton, false);
        }
    }

    // 保存数据源
    async function saveDataSource() {
        const saveButton = document.getElementById('saveDataSourceBtn');
        setButtonLoading(saveButton, true);
        
        try {
            const name = document.getElementById('dataSourceName').value.trim();
            const zkQuorum = document.getElementById('zkQuorum').value.trim();
            const coreSiteFile = document.getElementById('coreSiteFile').files[0];
            const hbaseSiteFile = document.getElementById('hbaseSiteFile').files[0];

            if (!name || !zkQuorum || !coreSiteFile || !hbaseSiteFile) {
                showMessage('请填写所有必填项', 'error');
                return;
            }

            const newDataSource = {
                id: Date.now().toString(),
                name: name,
                zkQuorum: zkQuorum,
                configured: true
            };

            const formData = new FormData();
            formData.append('core-site', coreSiteFile);
            formData.append('hbase-site', hbaseSiteFile);

            const uploadResponse = await fetch(`/api/datasource/${newDataSource.id}/upload-config`, {
                method: 'POST',
                body: formData
            });

            if (!uploadResponse.ok) {
                const errorData = await uploadResponse.json();
                throw new Error(errorData.error || '配置文件上传失败');
            }

            const connectResponse = await fetch(`/api/datasource/${newDataSource.id}/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ host: zkQuorum })
            });

            if (!connectResponse.ok) {
                const errorData = await connectResponse.json();
                throw new Error(errorData.error || '连接失败');
            }

            const data = await connectResponse.json();

            dataSources.push(newDataSource);
            localStorage.setItem('hbaseDataSources', JSON.stringify(dataSources));
            renderDataSources();
            hideModal();
            
            selectDataSource(newDataSource);
            showMessage('数据源创建成功', 'success');
        } catch (error) {
            console.error('保存数据源失败:', error);
            showMessage(error.message, 'error');
        } finally {
            setButtonLoading(saveButton, false);
        }
    }

    // 选择数据源
    async function selectDataSource(dataSource) {
        try {
            // 使用新的API路径
            const response = await fetch(`/api/datasource/${dataSource.id}/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ host: dataSource.zkQuorum })
            });

            if (!response.ok) {
                throw new Error('连接失败');
            }

            const data = await response.json();
            activeDataSource = dataSource;
            renderDataSources();
            
            // 显示查询界面
            emptyState.style.display = 'none';
            queryInterface.style.display = 'flex';
            
            // 更新表下拉框
            const tableSelect = document.getElementById('tableSelect');
            tableSelect.innerHTML = '<option value="">选择表</option>';
            data.tables.forEach(table => {
                const option = document.createElement('option');
                option.value = table;
                option.textContent = table;
                tableSelect.appendChild(option);
            });

            // 清空之前的查询结果
            document.getElementById('rowkeyList').innerHTML = '';
            document.getElementById('dataDetail').innerHTML = '';

            // 添加表选择事件
            tableSelect.addEventListener('change', () => {
                if (tableSelect.value) {
                    loadRowKeys(tableSelect.value);
                }
            });
        } catch (error) {
            console.error('选择数据源失败:', error);
            showMessage('连接失败: ' + error.message, 'error');
        }
    }

    // 修改加载 RowKey 列表的函数
    async function loadRowKeys(tableName, searchKey = '') {
        try {
            let url = `/api/datasource/${activeDataSource.id}/list-rows?table=${encodeURIComponent(tableName)}`;
            
            // 如果有搜索关键字，添加到请求参数中
            if (searchKey) {
                url += `&rowkey=${encodeURIComponent(searchKey)}`;
            } else {
                url += '&limit=100'; // 只有在没有搜索关键字时才使用limit参数
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('加载 RowKey 列表失败');
            }

            const data = await response.json();
            const rowkeyList = document.getElementById('rowkeyList');
            rowkeyList.innerHTML = '';

            // 更新行数显示
            const rowCount = document.querySelector('.row-count');
            if (searchKey) {
                rowCount.textContent = `搜索结果: ${data.rowkeys.length}条`;
                // 只展示匹配的rowkey
                if (data.rowkeys.length > 0) {
                    const exactMatch = data.rowkeys[0]; // 假设返回的第一个就是匹配的
                    renderRowKeyItem(exactMatch);
                    loadRowData(tableName, exactMatch); // 自动加载该rowkey的数据
                }
            } else {
                rowCount.textContent = '前100条';
                // 显示所有结果
                data.rowkeys.forEach(rowkey => renderRowKeyItem(rowkey));
            }
        } catch (error) {
            console.error('加载 RowKey 列表失败:', error);
            showMessage('加载 RowKey 列表失败: ' + error.message, 'error');
        }

        // 辅助函数：渲染单个 RowKey 项
        function renderRowKeyItem(rowkey) {
            const item = document.createElement('div');
            item.className = 'rowkey-item';
            item.innerHTML = `
                <i class="mdi mdi-key"></i>
                <span>${rowkey}</span>
            `;
            item.addEventListener('click', (event) => {
                loadRowData(tableName, rowkey); // 直接调用 loadRowData
            });
            rowkeyList.appendChild(item);
        }
    }

    // 加载行数据
    async function loadRowData(tableName, rowkey) {
        try {
            // 更新选中的 rowkey 显示
            document.getElementById('selectedRowkey').textContent = rowkey;

            const response = await fetch(`/api/datasource/${activeDataSource.id}/query?table=${encodeURIComponent(tableName)}&rowkey=${encodeURIComponent(rowkey)}`);
            if (!response.ok) {
                throw new Error('加载数据失败');
            }

            const data = await response.json();
            const dataDetail = document.getElementById('dataDetail');
            dataDetail.innerHTML = '';

            // 渲染数据
            Object.entries(data).forEach(([family, columns]) => {
                const familyDiv = document.createElement('div');
                familyDiv.className = 'column-family';
                familyDiv.innerHTML = `
                    <div class="column-family-header">
                        <i class="mdi mdi-folder"></i>
                        ${family}
                    </div>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>列名</th>
                                <th>值</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(columns).map(([column, value]) => `
                                <tr>
                                    <td>${column}</td>
                                    <td>${value}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                dataDetail.appendChild(familyDiv);
            });
        } catch (error) {
            console.error('加载数据失败:', error);
            showMessage('加载数据失败: ' + error.message, 'error');
        }
    }

    // 添加搜索功能
    document.getElementById('searchBtn').addEventListener('click', () => {
        const tableName = document.getElementById('tableSelect').value;
        const rowkey = document.getElementById('rowkeySearch').value.trim();
        
        if (!tableName) {
            showMessage('请选择表', 'error');
            return;
        }

        loadRowKeys(tableName, rowkey);
    });

    // 添加搜索框的回车事件处理
    document.getElementById('rowkeySearch').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('searchBtn').click();
        }
    });

    // 修改表选择事件
    document.getElementById('tableSelect').addEventListener('change', () => {
        const tableSelect = document.getElementById('tableSelect');
        if (tableSelect.value) {
            // 清空搜索框
            document.getElementById('rowkeySearch').value = '';
            // 清空数据详情
            document.getElementById('dataDetail').innerHTML = '';
            document.getElementById('selectedRowkey').textContent = '';
            // 加载前100条数据
            loadRowKeys(tableSelect.value);
        }
    });

    // 显示右键菜单
    function showContextMenu(event, dataSource) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item">
                <i class="mdi mdi-refresh"></i>
                <span>重新连接</span>
            </div>
            <div class="context-menu-item">
                <i class="mdi mdi-delete"></i>
                <span>删除</span>
            </div>
        `;

        // 定位菜单
        menu.style.position = 'fixed';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';

        // 添加菜单项点击事件
        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                if (item.textContent.includes('删除')) {
                    deleteDataSource(dataSource);
                } else if (item.textContent.includes('重新连接')) {
                    reconnectDataSource(dataSource);
                }
                document.body.removeChild(menu);
            });
        });

        // 添加到页面
        document.body.appendChild(menu);

        // 点击其他地方关闭菜单
        function closeMenu(e) {
            if (!menu.contains(e.target)) {
                document.body.removeChild(menu);
                document.removeEventListener('click', closeMenu);
            }
        }
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    // 删除数据源
    async function deleteDataSource(dataSource) {
        if (!confirm(`确定要删除数据源 "${dataSource.name}" 吗？`)) {
            return;
        }

        try {
            const response = await fetch(`/api/datasource/${dataSource.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('删除失败');
            }

            // 如果删除的是当前活动的数据源，清空查询界面
            if (activeDataSource?.id === dataSource.id) {
                activeDataSource = null;
                document.getElementById('queryInterface').style.display = 'none';
                document.getElementById('emptyState').style.display = 'flex';
            }

            // 从列表中移除
            dataSources = dataSources.filter(ds => ds.id !== dataSource.id);
            saveDataSources();
            renderDataSources();
            
            // 显示成功消息
            showMessage('数据源已删除', 'success');
        } catch (error) {
            console.error('删除失败:', error);
            showMessage('删除失败: ' + error.message, 'error');
        }
    }

    // 添加重连功能
    async function reconnectDataSource(dataSource) {
        try {
            const response = await fetch(`/api/datasource/${dataSource.id}/reconnect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ host: dataSource.zkQuorum })
            });

            if (!response.ok) {
                throw new Error('重连失败');
            }

            const data = await response.json();
            alert('重连成功');
            selectDataSource(dataSource);
        } catch (error) {
            console.error('重连失败:', error);
            alert('重连失败: ' + error.message);
        }
    }

    // 事件监听
    addDataSourceBtn.addEventListener('click', showModal);
    emptyStateAddBtn.addEventListener('click', showModal);
    closeButton.addEventListener('click', hideModal);
    testConnectionBtn.addEventListener('click', () => {
        const testDs = {
            zkQuorum: document.getElementById('zkQuorum').value.trim(),
            coreSiteFile: document.getElementById('coreSiteFile').files[0],
            hbaseSiteFile: document.getElementById('hbaseSiteFile').files[0]
        };

        if (!testDs.zkQuorum || !testDs.coreSiteFile || !testDs.hbaseSiteFile) {
            showMessage('请填写所有必填项', 'error');
            return;
        }

        testConnection(testDs);
    });
    saveDataSourceBtn.addEventListener('click', saveDataSource);

    // 文件选择事件
    document.getElementById('coreSiteFile').addEventListener('change', updateFileNames);
    document.getElementById('hbaseSiteFile').addEventListener('change', updateFileNames);

    // 点击模态框外部关闭
    dataSourceModal.addEventListener('click', (e) => {
        if (e.target === dataSourceModal) {
            hideModal();
        }
    });

    // 初始化加载
    loadDataSources();
});

// 添加消息提示函数
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast ${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);

    // 3秒后自动消失
    setTimeout(() => {
        messageDiv.classList.add('fade-out');
        setTimeout(() => document.body.removeChild(messageDiv), 300);
    }, 3000);
} 