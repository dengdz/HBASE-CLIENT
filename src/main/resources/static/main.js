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
        dataSources.forEach((ds, index) => {
            const item = document.createElement('div');
            item.className = `data-source-item ${ds === activeDataSource ? 'active' : ''}`;
            item.innerHTML = `
                <div class="data-source-info">
                    <i class="mdi mdi-database"></i>
                    <span>${ds.name}</span>
                </div>
                <div class="data-source-actions">
                    <button class="icon-button" title="删除数据源">
                        <i class="mdi mdi-delete-outline"></i>
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
            
            // 仅在新添加数据源时应用动画
            if (ds.isNew) {
                item.classList.add('animate');
                // 强制重绘
                item.offsetHeight;
                item.classList.add('show');
                // 移除新添加标记
                delete ds.isNew;
            }
        });
        updateEmptyState();
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

            // 先创建数据源对象
            const newDataSource = {
                id: Date.now().toString(),
                name: name,
                zkQuorum: zkQuorum,
                configured: true,
                isNew: true
            };

            // 1. 先上传配置文件
            const formData = new FormData();
            formData.append('core-site', coreSiteFile);
            formData.append('hbase-site', hbaseSiteFile);

            try {
                const uploadResponse = await fetch(`/api/datasource/${newDataSource.id}/upload-config`, {
                    method: 'POST',
                    body: formData
                });

                if (!uploadResponse.ok) {
                    const errorData = await uploadResponse.json();
                    throw new Error(errorData.error || '配置文件上传失败');
                }

                // 2. 等待一小段时间确保文件已经保存
                await new Promise(resolve => setTimeout(resolve, 500));

                // 3. 尝试连接
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

                // 4. 如果连接成功，保存数据源
                dataSources.push(newDataSource);
                localStorage.setItem('hbaseDataSources', JSON.stringify(dataSources));
                renderDataSources();
                hideModal();
                
                // 5. 选择新创建的数据源
                selectDataSource(newDataSource);
                showMessage('数据源创建成功', 'success');
            } catch (error) {
                // 如果出错，清理已上传的配置文件
                await fetch(`/api/datasource/${newDataSource.id}`, { method: 'DELETE' });
                throw error;
            }
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
            
            // 使用新的更新表下拉框函数
            updateTableSelect(data.tables);

            // 清空之前的查询结果
            document.getElementById('rowkeyList').innerHTML = '';
            document.getElementById('dataDetail').innerHTML = '';
        } catch (error) {
            console.error('选择数据源失败:', error);
            showMessage('连接失败: ' + error.message, 'error');
        }
    }

    // 加载 RowKey 列表
    async function loadRowKeys(tableName, searchKey = '') {
        try {
            const response = await fetch(`/api/datasource/${activeDataSource.id}/list-rows?table=${encodeURIComponent(tableName)}${searchKey ? '&rowkey=' + encodeURIComponent(searchKey) : ''}`);
            if (!response.ok) {
                throw new Error('加载RowKey列表失败');
            }

            const data = await response.json();
            const rowkeyList = document.getElementById('rowkeyList');
            rowkeyList.innerHTML = '';

            data.rowkeys.forEach((rowkey, index) => {
                const item = document.createElement('div');
                item.className = 'rowkey-item';
                item.innerHTML = `
                    <div class="rowkey-content">
                        <i class="mdi mdi-key-variant"></i>
                        <span data-rowkey="${rowkey}">${rowkey}</span>
                    </div>
                    <div class="rowkey-actions">
                        <button class="icon-button delete-btn" title="删除">
                            <i class="mdi mdi-delete-outline"></i>
                        </button>
                    </div>
                `;

                // 添加悬停显示功能
                const rowkeySpan = item.querySelector('.rowkey-content span');
                rowkeySpan.addEventListener('mouseenter', (e) => {
                    if (e.target.offsetWidth < e.target.scrollWidth) {
                        const tooltip = document.createElement('div');
                        tooltip.className = 'rowkey-tooltip';
                        tooltip.textContent = rowkey;
                        document.body.appendChild(tooltip);
                        
                        const updateTooltipPosition = (event) => {
                            tooltip.style.left = `${event.pageX + 10}px`;
                            tooltip.style.top = `${event.pageY + 10}px`;
                        };
                        
                        updateTooltipPosition(e);
                        // 强制重绘
                        tooltip.offsetHeight;
                        tooltip.classList.add('show');
                        
                        rowkeySpan.addEventListener('mousemove', updateTooltipPosition);
                        
                        rowkeySpan.addEventListener('mouseleave', () => {
                            tooltip.remove();
                            rowkeySpan.removeEventListener('mousemove', updateTooltipPosition);
                        });
                    }
                });

                // 点击 RowKey 加载数据
                item.querySelector('.rowkey-content').addEventListener('click', () => {
                    // 移除其他项的活动状态
                    rowkeyList.querySelectorAll('.rowkey-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    loadRowData(tableName, rowkey);
                });

                // 点击删除按钮
                item.querySelector('.delete-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); // 阻止事件冒泡
                    if (confirm(`确定要删除 RowKey "${rowkey}" 吗？`)) {
                        deleteRowKey(tableName, rowkey);
                    }
                });

                rowkeyList.appendChild(item);
                
                // 添加延迟动画效果
                setTimeout(() => {
                    item.classList.add('show');
                }, index * 50); // 每项延迟 50ms
            });
        } catch (error) {
            console.error('加载RowKey列表失败:', error);
            showMessage('加载RowKey列表失败: ' + error.message, 'error');
        }
    }

    // 删除 RowKey
    async function deleteRowKey(tableName, rowKey) {
        try {
            const response = await fetch(`/api/datasource/${activeDataSource.id}/delete-data`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    table: tableName,
                    rowKey: rowKey
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '删除失败');
            }

            showMessage('删除成功', 'success');
            // 重新加载 RowKey 列表
            loadRowKeys(tableName);
            // 清空数据详情
            document.getElementById('dataDetail').innerHTML = '';
            document.getElementById('selectedRowkey').textContent = '';
        } catch (error) {
            console.error('删除失败:', error);
            showMessage(error.message, 'error');
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

    // 搜索按钮事件 - 这个可以工作
    document.getElementById('searchBtn').addEventListener('click', () => {
        const tableName = document.getElementById('tableSelect').value;
        if (!tableName) {
            showMessage('请先选择表', 'error');
            return;
        }
        const rowkey = document.getElementById('rowkeySearch').value.trim();
        loadRowKeys(tableName, rowkey);
    });

    // 新增按钮事件 - 按照相同的逻辑编写
    document.getElementById('addDataBtn').addEventListener('click', () => {
        const tableName = document.getElementById('tableSelect').value;
        if (!tableName) {
            showMessage('请先选择操作表', 'error');
            return;
        }
        showAddDataModal();
    });

    // 新增数据相关函数
    function showAddDataModal() {
        const modal = document.getElementById('addDataModal');
        modal.style.display = 'block';
        // 强制重绘
        modal.offsetHeight;
        modal.classList.add('show');
        // 清空表单
        document.getElementById('newRowKey').value = '';
        document.getElementById('newColumnFamily').value = '';
        document.getElementById('newColumn').value = '';
        document.getElementById('newValue').value = '';
        
        // 聚焦到 RowKey 输入框
        document.getElementById('newRowKey').focus();
    }

    function hideAddDataModal() {
        const modal = document.getElementById('addDataModal');
        modal.classList.remove('show');
        // 等待动画完成后隐藏
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }

    // 模态框按钮事件
    document.querySelector('#addDataModal .close-button').addEventListener('click', hideAddDataModal);
    document.getElementById('cancelAddData').addEventListener('click', hideAddDataModal);
    document.getElementById('confirmAddData').addEventListener('click', saveData);

    // 保存数据函数
    async function saveData() {
        const tableSelect = document.getElementById('tableSelect');
        const rowKey = document.getElementById('newRowKey').value.trim();
        const columnFamily = document.getElementById('newColumnFamily').value.trim();
        const column = document.getElementById('newColumn').value.trim();
        const value = document.getElementById('newValue').value.trim();

        if (!rowKey || !columnFamily || !column || !value) {
            showMessage('请填写所有必填字段', 'error');
            return;
        }

        try {
            // 添加保存按钮的加载状态
            const saveButton = document.getElementById('confirmAddData');
            setButtonLoading(saveButton, true);

            const response = await fetch(`/api/datasource/${activeDataSource.id}/add-data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    table: tableSelect.value,
                    rowKey: rowKey,
                    columnFamily: columnFamily,
                    column: column,
                    value: value
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '添加数据失败');
            }

            showMessage('数据添加成功', 'success');
            hideAddDataModal();
            
            // 刷新当前数据列表
            loadRowKeys(tableSelect.value);
        } catch (error) {
            console.error('添加数据失败:', error);
            showMessage(error.message, 'error');
        } finally {
            // 恢复保存按钮状态
            const saveButton = document.getElementById('confirmAddData');
            setButtonLoading(saveButton, false);
        }
    }

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

    // 更新表下拉框
    function updateTableSelect(tables) {
        const tableSelect = document.getElementById('tableSelect');
        // 只添加一个空选项，不添加"选择表"文字
        tableSelect.innerHTML = '<option value=""></option>';
        tables.forEach(table => {
            const option = document.createElement('option');
            option.value = table;
            option.textContent = table;
            tableSelect.appendChild(option);
        });
    }

    // 获取添加列簇相关的DOM元素
    const addFamilyBtn = document.getElementById('addFamilyBtn');
    const addFamilyModal = document.getElementById('addFamilyModal');
    const cancelAddFamily = document.getElementById('cancelAddFamily');
    const confirmAddFamily = document.getElementById('confirmAddFamily');

    // 显示添加列簇对话框
    function showAddFamilyModal() {
        // 获取当前所有表并填充下拉框
        const familyTableSelect = document.getElementById('familyTableSelect');
        familyTableSelect.innerHTML = '<option value="">请选择表</option>';
        
        // 从主界面的表选择框获取所有表选项
        const mainTableSelect = document.getElementById('tableSelect');
        Array.from(mainTableSelect.options).forEach(option => {
            if (option.value) { // 跳过空选项
                const newOption = document.createElement('option');
                newOption.value = option.value;
                newOption.textContent = option.textContent;
                familyTableSelect.appendChild(newOption);
            }
        });
        
        // 如果主界面已选择了表，则默认选中该表
        if (mainTableSelect.value) {
            familyTableSelect.value = mainTableSelect.value;
        }
        
        addFamilyModal.style.display = 'block';
        // 强制重绘
        addFamilyModal.offsetHeight;
        addFamilyModal.classList.add('show');
        // 清空输入框
        document.getElementById('newFamilyName').value = '';
    }

    // 隐藏添加列簇对话框
    function hideAddFamilyModal() {
        addFamilyModal.classList.remove('show');
        setTimeout(() => {
            addFamilyModal.style.display = 'none';
        }, 300);
    }

    // 修改添加列簇函数
    async function addColumnFamily() {
        const tableSelect = document.getElementById('familyTableSelect');
        const familyName = document.getElementById('newFamilyName').value.trim();
        
        if (!tableSelect.value) {
            showMessage('请选择表', 'error');
            return;
        }
        
        if (!familyName) {
            showMessage('请输入列簇名称', 'error');
            return;
        }
        
        try {
            const saveButton = document.getElementById('confirmAddFamily');
            setButtonLoading(saveButton, true);
            
            const response = await fetch(`/api/datasource/${activeDataSource.id}/add-family`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    table: tableSelect.value,
                    familyName: familyName
                })
            });
            
            const result = await response.json();
            if (response.ok) {
                showMessage('添加列簇成功', 'success');
                hideAddFamilyModal();
                // 如果需要刷新列簇列表，可以在这里添加刷新逻辑
            } else {
                showMessage(result.error || '添加列簇失败', 'error');
            }
        } catch (error) {
            console.error('添加列簇失败:', error);
            showMessage('添加列簇失败', 'error');
        } finally {
            const saveButton = document.getElementById('confirmAddFamily');
            setButtonLoading(saveButton, false);
        }
    }

    // 添加事件监听
    addFamilyBtn.addEventListener('click', showAddFamilyModal);
    addFamilyModal.querySelector('.close-button').addEventListener('click', hideAddFamilyModal);
    cancelAddFamily.addEventListener('click', hideAddFamilyModal);
    confirmAddFamily.addEventListener('click', addColumnFamily);

    // 点击模态框外部关闭
    addFamilyModal.addEventListener('click', (e) => {
        if (e.target === addFamilyModal) {
            hideAddFamilyModal();
        }
    });
});

// 添加消息提示函数
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast ${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    
    // 强制重绘
    messageDiv.offsetHeight;
    messageDiv.classList.add('show');

    setTimeout(() => {
        messageDiv.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 300);
    }, 3000);
} 