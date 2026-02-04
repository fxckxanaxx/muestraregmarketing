let inventory = [];
let filteredInventory = [];
let editingId = null;
let currentOrder = {
    clientName: '',
    items: [],
    isActive: false
};

async function init() {
    console.log('Inicializando aplicación...');
    await loadData();
    await renderInventory();
    updateStats();
    setupEventListeners();
    setMinDate();
    showNotification('Sistema iniciado correctamente', 'success');

    const sizeSelect = document.getElementById('size');
    if (sizeSelect) {
        sizeSelect.addEventListener('change', toggleMixedSizes);
    }

    const sizeInputs = document.querySelectorAll('.size-input');
    sizeInputs.forEach(input => {
        input.addEventListener('input', updateMixedSizesTotal);
        input.addEventListener('change', updateMixedSizesTotal);
    });
}

async function loadData() {
    try {
        showNotification('Cargando datos...', 'info');
        inventory = await Database.getAllProducts();
        filteredInventory = [...inventory];
        console.log('Datos cargados:', inventory);
    } catch (error) {
        console.error('Error cargando datos:', error);
        showNotification('Error al cargar los datos', 'error');
    }
}

function setupEventListeners() {
    const form = document.getElementById('productForm');
    const searchInput = document.getElementById('searchInput');
    const productTypeSelect = document.getElementById('productType'); 

    
    if (form) {
        form.addEventListener('submit', addProduct);
        console.log('Event listener del formulario configurado');
    }
    
    if (searchInput) {
        searchInput.addEventListener('input', filterInventory);
    }

    if (productTypeSelect) {
        productTypeSelect.addEventListener('change', updateSizeOptions);
    }
}

function updateSizeOptions() {
    const productType = document.getElementById('productType').value;
    const sizeSelect = document.getElementById('size');
    
    sizeSelect.innerHTML = '<option value="">Seleccionar talla</option>';
    
    const clothingProducts = [
        'Camisetas de algodón estampadas',
        'Camisetas tipo polo bordadas', 
        'Camisetas sublimadas',
        'Camiseta Manga Larga',
        'Chaleco en drill',
        'Jean dotación',
        'Camisas Oxford',
        'Chaqueta',
        'Hoodie college',
        'Uniforme'
    ];
    
    let sizeOptions = [];
    
    if (productType.includes('Gorra')) {
        sizeOptions = [
            { value: 'Unitalla', text: 'Unitalla (ajustable 54-60cm)' }
        ];
    } else if (productType.includes('Tulas Deportivas')) {
        sizeOptions = [
            { value: 'Pequeña', text: 'Pequeña (10-15L)' },
            { value: 'Mediana', text: 'Mediana (15-18L)' },
            { value: 'Grande', text: 'Grande (18L+)' }
        ];
    } else if (productType.includes('Morrales')) {
        sizeOptions = [
            { value: 'Pequeño', text: 'Pequeño (38x28x14cm - 15L)' },
            { value: 'Mediano', text: 'Mediano (44x30x16cm - 20-25L)' },
            { value: 'Grande', text: 'Grande (48x32x18cm - 30L+)' }
        ];
    } else if (productType.includes('Tote Bags')) {
        sizeOptions = [
            { value: 'Pequeña', text: 'Pequeña (25x30cm)' },
            { value: 'Mediana', text: 'Mediana (35x40cm)' },
            { value: 'Grande', text: 'Grande (40x45cm+)' }
        ];
    } else if (clothingProducts.includes(productType)) {
        sizeOptions = [
            { value: 'XS', text: 'XS' },
            { value: 'S', text: 'S' },
            { value: 'M', text: 'M' },
            { value: 'L', text: 'L' },
            { value: 'XL', text: 'XL' },
            { value: 'XXL', text: 'XXL' },
            { value: 'MIXTAS', text: 'Tallas Mixtas (Especificar cantidad por talla)' }
        ];
    } else {
        sizeOptions = [
            { value: 'UNICA', text: 'Talla Única' }
        ];
    }
    
    sizeOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        sizeSelect.appendChild(optionElement);
    });
}

function setMinDate() {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const todayString = today.toISOString().split('T')[0];
    
    const dueDateInput = document.getElementById('dueDate');
    if (dueDateInput) {
        dueDateInput.min = todayString;
    }
}

async function addProduct(event) {
    event.preventDefault();
    console.log('Función addProduct ejecutada');
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
    submitBtn.disabled = true;
    
    try {
        const clientName = document.getElementById('clientName').value.trim();
        const productType = document.getElementById('productType').value;
        const quantity = parseInt(document.getElementById('quantity').value);
        const size = document.getElementById('size').value || 'No especificada';
        const color = document.getElementById('color').value.trim() || 'No especificado';
        const status = document.getElementById('status').value;
        const dueDate = document.getElementById('dueDate').value;
        const price = parseFloat(document.getElementById('price').value) || 0;
        const notes = document.getElementById('notes').value.trim() || '';

        let sizeDistribution = null;
        if (size === 'MIXTAS') {
            if (!validateMixedSizes()) {
                return;
            }
            sizeDistribution = getMixedSizesDistribution();
            if (Object.keys(sizeDistribution).length === 0) {
                showNotification('Debes especificar cantidades para las tallas mixtas', 'error');
                return;
            }
        } else if (!quantity || quantity <= 0) {
            showNotification('La cantidad debe ser mayor a 0', 'error');
            return;
        }

        if (!currentOrder.isActive) {
            currentOrder = {
                clientName: clientName,
                items: [],
                isActive: true,
                status: status,
                dueDate: dueDate
            };
        } else if (currentOrder.clientName !== clientName) {
            const shouldFinalize = await showAsyncConfirm(
                'Pedido en proceso',
                `Tienes un pedido en proceso para ${currentOrder.clientName}. ¿Quieres finalizarlo antes de crear uno para ${clientName}?`
            );
            
            if (shouldFinalize) {
                await finalizeCurrentOrder();
                currentOrder = {
                    clientName: clientName,
                    items: [],
                    isActive: true,
                    status: status,
                    dueDate: dueDate
                };
            } else {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                return;
            }
        }

        const newItem = {
            productType,
            quantity,
            size,
            sizeDistribution: sizeDistribution ? JSON.stringify(sizeDistribution) : null,
            color,
            price,
            notes,
            tempId: Date.now() + Math.random()
        };

        currentOrder.items.push(newItem);
        
        showCurrentOrder();
        
        clearProductForm();
        
        showNotification(`Producto agregado al pedido de ${clientName}`, 'success');
        
    } catch (error) {
        console.error('Error procesando producto:', error);
        showNotification('Error al procesar el producto', 'error');
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

function resetForm() {
    editingId = null;
    const submitBtn = document.querySelector('#productForm button[type="submit"]');
    if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-plus"></i> Agregar Producto';
        submitBtn.className = 'btn btn-primary';
    }
}

function updateStats() {
    const completed = inventory.filter(item => item.status === 'completed');
    const pending = inventory.filter(item => item.status === 'pending');
    const priority = inventory.filter(item => item.status === 'priority');
    
    const totalRevenue = inventory.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const completedQuantity = inventory.reduce((sum, item) => sum + item.quantity_completed, 0);
    const productionEfficiency = totalQuantity > 0 ? (completedQuantity / totalQuantity * 100) : 0;
    
    updateElement('totalRevenue', `$${totalRevenue.toLocaleString()}`);
    updateElement('productionEfficiency', `${Math.round(productionEfficiency)}%`);
    updateElement('totalOrders', inventory.length);
    
    const avgDeliveryTime = calculateAverageDeliveryTime();
    updateElement('avgDeliveryTime', avgDeliveryTime);
    
    updateTrends();
    
    updateProductionStatus();
    
    updateClientInsights();
    
    updateProductAnalytics();
}

function getCompletedBySizeSync(orderId, size) {
    return 0;
}

function calculateAverageDeliveryTime() {
    if (inventory.length === 0) return 0;
    
    const today = new Date();
    const totalDays = inventory.reduce((sum, item) => {
        const dueDate = new Date(item.due_date);
        const diffTime = dueDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return sum + Math.max(0, diffDays);
    }, 0);
    
    return Math.round(totalDays / inventory.length);
}

function updateTrends() {
    const trends = {
        revenue: Math.random() * 20 - 5,
        efficiency: Math.random() * 15 - 2, 
        orders: Math.random() * 10 - 3, 
        delivery: Math.random() * 5 - 2 
    };
    
    updateTrendElement('revenueTrend', trends.revenue, '%');
    updateTrendElement('efficiencyTrend', trends.efficiency, '%');
    updateTrendElement('ordersTrend', trends.orders, '%');
    updateTrendElement('deliveryTrend', trends.delivery, ' días', 'deliveryTrendIcon');
}

function updateTrendElement(id, value, suffix, iconId = null) {
    const element = document.getElementById(id);
    const iconElement = iconId ? document.getElementById(iconId) : element.parentElement;
    
    if (element) {
        const sign = value >= 0 ? '+' : '';
        element.textContent = `${sign}${value.toFixed(1)}${suffix}`;
        
        const parent = iconElement || element.parentElement;
        parent.className = parent.className.replace(/(positive|negative|neutral)/, '');
        
        if (value > 0) {
            parent.classList.add('positive');
            const icon = parent.querySelector('i');
            if (icon) icon.className = 'fas fa-arrow-up';
        } else if (value < 0) {
            parent.classList.add('negative');
            const icon = parent.querySelector('i');
            if (icon) icon.className = 'fas fa-arrow-down';
        } else {
            parent.classList.add('neutral');
            const icon = parent.querySelector('i');
            if (icon) icon.className = 'fas fa-minus';
        }
    }
}

function updateProductionStatus() {
    const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const completedQuantity = inventory.reduce((sum, item) => sum + item.quantity_completed, 0);
    const percentage = totalQuantity > 0 ? (completedQuantity / totalQuantity * 100) : 0;
    
    const ring = document.getElementById('completedRing');
    if (ring) {
        const degrees = (percentage / 100) * 360;
        ring.style.background = `conic-gradient(#4CAF50 ${degrees}deg, #E0E0E0 ${degrees}deg)`;
    }
    
    updateElement('completedPercentage', `${Math.round(percentage)}%`);
    
    const inProcess = inventory.filter(item => item.status !== 'completed' && item.quantity_completed > 0);
    const dueSoon = inventory.filter(item => {
        const dueDate = new Date(item.due_date);
        const today = new Date();
        const diffTime = dueDate - today;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays <= 7 && diffDays >= 0 && item.status !== 'completed';
    });
    
    updateElement('inProcessCount', inProcess.length);
    updateElement('priorityDetailCount', inventory.filter(item => item.status === 'priority').length);
    updateElement('dueSoonCount', dueSoon.length);
}

function updateClientInsights() {
    const clientStats = {};
    inventory.forEach(item => {
        if (!clientStats[item.client_name]) {
            clientStats[item.client_name] = {
                orders: 0,
                totalValue: 0,
                totalQuantity: 0
            };
        }
        clientStats[item.client_name].orders++;
        clientStats[item.client_name].totalValue += item.price * item.quantity;
        clientStats[item.client_name].totalQuantity += item.quantity;
    });
    
    const sortedClients = Object.entries(clientStats)
        .sort((a, b) => b[1].totalValue - a[1].totalValue)
        .slice(0, 5);
    
    if (sortedClients.length > 0) {
        const topClient = sortedClients[0];
        updateElement('topClientValue', `$${topClient[1].totalValue.toLocaleString()}`);
        updateElement('topClientName', topClient[0]);
    }
    
    const clientList = document.getElementById('clientRanking');
    if (clientList && sortedClients.length > 1) {
        clientList.innerHTML = sortedClients.slice(1, 4).map((client, index) => `
            <div class="client-item">
                <span class="client-name">#${index + 2} ${client[0]}</span>
                <span class="client-value">$${client[1].totalValue.toLocaleString()}</span>
            </div>
        `).join('');
    }
}

function updateProductAnalytics() {
    const productStats = {};
    inventory.forEach(item => {
        if (!productStats[item.product_type]) {
            productStats[item.product_type] = {
                orders: 0,
                totalQuantity: 0,
                completedQuantity: 0,
                totalValue: 0,
                avgPrice: 0
            };
        }
        productStats[item.product_type].orders++;
        productStats[item.product_type].totalQuantity += item.quantity;
        productStats[item.product_type].completedQuantity += item.quantity_completed;
        productStats[item.product_type].totalValue += item.price * item.quantity;
    });

    Object.keys(productStats).forEach(productType => {
        const stats = productStats[productType];
        stats.avgPrice = stats.totalValue / stats.totalQuantity;
    });

    const sortedProducts = Object.entries(productStats)
        .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity)
        .slice(0, 5);

    const productRanking = document.getElementById('productRanking');
    if (productRanking && sortedProducts.length > 0) {
        productRanking.innerHTML = sortedProducts.map((product, index) => {
            const [productType, stats] = product;
            const completionRate = (stats.completedQuantity / stats.totalQuantity * 100);
            
            return `
                <div class="product-item">
                    <div class="product-info">
                        <div class="product-name">#${index + 1} ${productType}</div>
                        <div class="product-orders">${stats.orders} órdenes • ${completionRate.toFixed(1)}% completado</div>
                    </div>
                    <div class="product-quantity">${stats.totalQuantity}</div>
                </div>
            `;
        }).join('');
    }

    if (sortedProducts.length > 0) {
        const topProduct = sortedProducts[0];
        updateElement('topProduct', topProduct[0]);

        const totalValue = inventory.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
        const averageTicket = totalQuantity > 0 ? totalValue / inventory.length : 0;
        updateElement('averageTicket', `$${averageTicket.toLocaleString()}`);
    } else {
        updateElement('topProduct', 'Sin datos');
        updateElement('averageTicket', '$0');
    }
}

function exportProductAnalytics() {
    if (inventory.length === 0) {
        showNotification('No hay datos para exportar', 'error');
        return;
    }

    const productStats = {};
    inventory.forEach(item => {
        if (!productStats[item.product_type]) {
            productStats[item.product_type] = {
                orders: 0,
                totalQuantity: 0,
                completedQuantity: 0,
                pendingQuantity: 0,
                totalValue: 0,
                avgPrice: 0,
                clients: new Set()
            };
        }
        const stats = productStats[item.product_type];
        stats.orders++;
        stats.totalQuantity += item.quantity;
        stats.completedQuantity += item.quantity_completed;
        stats.pendingQuantity += (item.quantity - item.quantity_completed);
        stats.totalValue += item.price * item.quantity;
        stats.clients.add(item.client_name);
    });

    Object.keys(productStats).forEach(productType => {
        const stats = productStats[productType];
        stats.avgPrice = stats.totalValue / stats.totalQuantity;
        stats.clientCount = stats.clients.size;
        stats.completionRate = (stats.completedQuantity / stats.totalQuantity * 100);
        stats.clientList = Array.from(stats.clients).join(', ');
        delete stats.clients; 
    });

    const report = {
        generatedAt: new Date().toISOString(),
        company: 'REG MARKETING S.A.S',
        reportType: 'Análisis de Productos',
        summary: {
            totalProducts: Object.keys(productStats).length,
            totalOrders: inventory.length,
            totalQuantity: inventory.reduce((sum, item) => sum + item.quantity, 0),
            totalValue: inventory.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            overallCompletionRate: inventory.reduce((sum, item) => sum + item.quantity_completed, 0) / 
                                 inventory.reduce((sum, item) => sum + item.quantity, 0) * 100
        },
        productAnalytics: Object.entries(productStats)
            .sort((a, b) => b[1].totalQuantity - a[1].totalQuantity)
            .map(([productType, stats], index) => ({
                rank: index + 1,
                productType,
                orders: stats.orders,
                totalQuantity: stats.totalQuantity,
                completedQuantity: stats.completedQuantity,
                pendingQuantity: stats.pendingQuantity,
                completionRate: Math.round(stats.completionRate * 100) / 100,
                totalValue: Math.round(stats.totalValue * 100) / 100,
                averagePrice: Math.round(stats.avgPrice * 100) / 100,
                uniqueClients: stats.clientCount,
                clientList: stats.clientList
            }))
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { 
        type: 'application/json;charset=utf-8;' 
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reg_marketing_analytics_${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    showNotification('Análisis de productos exportado exitosamente', 'success');
}

function toggleMetricView(metricType) {
    switch(metricType) {
        case 'production':
            const productionCard = document.querySelector('.production-status .metric-content');
            if (productionCard) {
                const currentView = productionCard.dataset.view || 'ring';
                if (currentView === 'ring') {
                    showProductionBarsView(productionCard);
                    productionCard.dataset.view = 'bars';
                } else {
                    showProductionRingView(productionCard);
                    productionCard.dataset.view = 'ring';
                }
            }
            break;
            
        case 'clients':
            showExpandedClientView();
            break;
    }
}

function showProductionBarsView(container) {
    const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const completedQuantity = inventory.reduce((sum, item) => sum + item.quantity_completed, 0);
    const pendingQuantity = totalQuantity - completedQuantity;
    const priorityItems = inventory.filter(item => item.status === 'priority');
    const priorityQuantity = priorityItems.reduce((sum, item) => sum + (item.quantity - item.quantity_completed), 0);

    container.innerHTML = `
        <div class="production-bars">
            <div class="bar-item">
                <div class="bar-info">
                    <span class="bar-label">Completado</span>
                    <span class="bar-value">${completedQuantity} / ${totalQuantity}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(completedQuantity/totalQuantity*100)}%; background: #4CAF50;"></div>
                </div>
            </div>
            <div class="bar-item">
                <div class="bar-info">
                    <span class="bar-label">Pendiente</span>
                    <span class="bar-value">${pendingQuantity}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(pendingQuantity/totalQuantity*100)}%; background: #FF9800;"></div>
                </div>
            </div>
            <div class="bar-item">
                <div class="bar-info">
                    <span class="bar-label">Prioritario</span>
                    <span class="bar-value">${priorityQuantity}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${totalQuantity > 0 ? (priorityQuantity/totalQuantity*100) : 0}%; background: #f44336;"></div>
                </div>
            </div>
        </div>
    `;
}

function showProductionRingView(container) {
    const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
    const completedQuantity = inventory.reduce((sum, item) => sum + item.quantity_completed, 0);
    const percentage = totalQuantity > 0 ? (completedQuantity / totalQuantity * 100) : 0;
    const degrees = (percentage / 100) * 360;

    container.innerHTML = `
        <div class="production-rings">
            <div class="production-ring" data-status="completed">
                <div class="ring-progress" id="completedRing" style="background: conic-gradient(#4CAF50 ${degrees}deg, #E0E0E0 ${degrees}deg);"></div>
                <div class="ring-center">
                    <span class="ring-value">${Math.round(percentage)}%</span>
                    <span class="ring-label">Completado</span>
                </div>
            </div>
            <div class="production-stats">
                <div class="prod-stat">
                    <span class="prod-label">En Proceso</span>
                    <span class="prod-value" id="inProcessCount">${inventory.filter(item => item.status !== 'completed' && item.quantity_completed > 0).length}</span>
                </div>
                <div class="prod-stat">
                    <span class="prod-label">Prioritarias</span>
                    <span class="prod-value priority" id="priorityDetailCount">${inventory.filter(item => item.status === 'priority').length}</span>
                </div>
                <div class="prod-stat">
                    <span class="prod-label">Próximas a Vencer</span>
                    <span class="prod-value warning" id="dueSoonCount">${inventory.filter(item => {
                        const dueDate = new Date(item.due_date);
                        const today = new Date();
                        const diffTime = dueDate - today;
                        const diffDays = diffTime / (1000 * 60 * 60 * 24);
                        return diffDays <= 7 && diffDays >= 0 && item.status !== 'completed';
                    }).length}</span>
                </div>
            </div>
        </div>
    `;
}

function showExpandedClientView() {
    const clientStats = {};
    inventory.forEach(item => {
        if (!clientStats[item.client_name]) {
            clientStats[item.client_name] = {
                orders: 0,
                totalValue: 0,
                totalQuantity: 0,
                completedQuantity: 0,
                products: new Set()
            };
        }
        const stats = clientStats[item.client_name];
        stats.orders++;
        stats.totalValue += item.price * item.quantity;
        stats.totalQuantity += item.quantity;
        stats.completedQuantity += item.quantity_completed;
        stats.products.add(item.product_type);
    });

    const sortedClients = Object.entries(clientStats)
        .sort((a, b) => b[1].totalValue - a[1].totalValue);

    let modalContent = `
        <div class="expanded-client-view">
            <h3>Análisis Detallado de Clientes</h3>
            <div class="client-detailed-list">
    `;

    sortedClients.forEach(([clientName, stats], index) => {
        const completionRate = (stats.completedQuantity / stats.totalQuantity * 100);
        modalContent += `
            <div class="client-detailed-item">
                <div class="client-rank">#${index + 1}</div>
                <div class="client-details">
                    <h4>${clientName}</h4>
                    <div class="client-metrics-grid">
                        <div class="metric">
                            <span class="metric-label">Órdenes</span>
                            <span class="metric-value">${stats.orders}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Valor Total</span>
                            <span class="metric-value">$${stats.totalValue.toLocaleString()}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Prendas</span>
                            <span class="metric-value">${stats.completedQuantity}/${stats.totalQuantity}</span>
                        </div>
                        <div class="metric">
                            <span class="metric-label">Progreso</span>
                            <span class="metric-value">${completionRate.toFixed(1)}%</span>
                        </div>
                    </div>
                    <div class="client-products">
                        <span class="products-label">Productos: </span>
                        <span class="products-list">${Array.from(stats.products).join(', ')}</span>
                    </div>
                </div>
            </div>
        `;
    });

    modalContent += `
            </div>
        </div>
    `;

    showInfoModal('Análisis de Clientes', modalContent);
}

function showInfoModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay info-modal';
    modal.innerHTML = `
        <div class="modal-content large">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

async function getCompletedForSize(orderId, size) {
    try {
        return await Database.getCompletedBySizeForOrder(orderId, size);
    } catch (error) {
        console.error('Error:', error);
        return 0;
    }
}

async function renderInventory() {
    const inventoryList = document.getElementById('inventoryList');

    const sizeProgressData = {};
    for (const item of filteredInventory) {
        if (item.size === 'MIXTAS' && item.size_distribution) {
            try {
                const distribution = JSON.parse(item.size_distribution);
                sizeProgressData[item.id] = {};
                for (const size of Object.keys(distribution)) {
                    sizeProgressData[item.id][size] = await Database.getCompletedBySizeForOrder(item.id, size);
                }
            } catch (e) {
                console.error('Error pre-cargando datos de talla:', e);
                sizeProgressData[item.id] = {};
            }
        }
    }
    
    if (!inventoryList) {
        console.error('Elemento inventoryList no encontrado');
        return;
    }
    
    if (filteredInventory.length === 0) {
        inventoryList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-boxes"></i>
                <h3>No hay productos en el inventario</h3>
                <p>Agrega el primer producto usando el formulario de arriba</p>
            </div>
        `;
        return;
    }

    const groupedByClient = {};
    filteredInventory.forEach(item => {
        if (!groupedByClient[item.client_name]) {
            groupedByClient[item.client_name] = [];
        }
        groupedByClient[item.client_name].push(item);
    });

    inventoryList.innerHTML = Object.entries(groupedByClient).map(([clientName, clientOrders]) => {
        const totalClientValue = clientOrders.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalClientQuantity = clientOrders.reduce((sum, item) => sum + item.quantity, 0);
        const totalClientCompleted = clientOrders.reduce((sum, item) => sum + item.quantity_completed, 0);
        const clientProgressPercentage = totalClientQuantity > 0 ? (totalClientCompleted / totalClientQuantity) * 100 : 0;
        
        const allCompleted = clientOrders.every(order => order.quantity_completed >= order.quantity);
        const hasUrgent = clientOrders.some(order => {
            const dueDate = new Date(order.due_date + 'T00:00:00');
            const today = new Date();
            const diffTime = dueDate - today;
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return daysRemaining <= 3 && daysRemaining >= 0;
        });
        const hasOverdue = clientOrders.some(order => {
            const dueDate = new Date(order.due_date + 'T00:00:00');
            const today = new Date();
            const diffTime = dueDate - today;
            const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return daysRemaining < 0;
        });

        const clientStatusClass = allCompleted ? 'client-completed' : 
                                hasOverdue ? 'client-overdue' : 
                                hasUrgent ? 'client-urgent' : 'client-normal';

        return `
            <div class="client-inventory-card ${clientStatusClass}">
                <!-- HEADER DEL CLIENTE -->
                <div class="client-header">
                    <div class="client-title">${clientName}</div>
                    <div class="client-header-right">
                        <div class="client-orders-count">${clientOrders.length} pedido${clientOrders.length > 1 ? 's' : ''}</div>
                        <div class="client-total">Total: $${totalClientValue.toLocaleString()}</div>
                        ${allCompleted ? '<div class="client-status completed">✅ Completado</div>' : ''}
                    </div>
                </div>

                <!-- PROGRESO GENERAL DEL CLIENTE -->
                <div class="client-progress-section">
                    <div class="client-progress-info">
                        <span><strong>Progreso General:</strong> ${totalClientCompleted}/${totalClientQuantity} prendas (${Math.round(clientProgressPercentage)}%)</span>
                        <span class="client-remaining"><strong>Restantes:</strong> ${totalClientQuantity - totalClientCompleted}</span>
                    </div>
                    <div class="client-progress-bar">
                        <div class="client-progress-fill" style="width: ${clientProgressPercentage}%"></div>
                    </div>
                </div>

                <!-- LISTA DE PEDIDOS DEL CLIENTE -->
                <div class="client-orders">
                    ${clientOrders.map(order => {
                        const remaining = order.quantity - order.quantity_completed;
                        const progressPercentage = order.size === 'MIXTAS' && order.size_distribution ? 
                            calculateMixedSizeProgress(order, sizeProgressData) : 
                            (order.quantity_completed / order.quantity) * 100;
                        const today = new Date();
                        const dueDate = new Date(order.due_date + 'T00:00:00');
                        const diffTime = dueDate - today;
                        const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const isOverdue = daysRemaining < 0;
                        const isUrgent = daysRemaining <= 3 && daysRemaining >= 0;
                        const isCompleted = remaining === 0;

                        return `
                            <div class="order-item ${isCompleted ? 'completed' : ''}">
                                <!-- BARRA DE PROGRESO DEL PEDIDO -->
                                <div class="order-progress-section">
                                    <div class="order-progress-info">
                                        <span><strong>${order.product_type}</strong> - ${order.quantity_completed}/${order.quantity} (${Math.round(progressPercentage)}%)</span>
                                        <span class="order-value">$${(order.price * order.quantity).toLocaleString()}</span>
                                    </div>
                                    <div class="order-progress-bar">
                                        <div class="order-progress-fill ${isCompleted ? 'completed' : ''}" style="width: ${progressPercentage}%"></div>
                                    </div>
                                </div>

                                <!-- DETALLES DEL PEDIDO -->
                                <div class="order-details">
                                    <div class="order-detail">
                                        <div class="order-detail-label">Cantidad</div>
                                        <div class="order-detail-value">${order.quantity}</div>
                                    </div>
                                    <div class="order-detail">
                                        <div class="order-detail-label">Talla</div>
                                        <div class="order-detail-value">${formatSizeDisplay(order)}</div>
                                    </div>
                                    <div class="order-detail">
                                        <div class="order-detail-label">Color</div>
                                        <div class="order-detail-value">${order.color}</div>
                                    </div>
                                    <div class="order-detail">
                                        <div class="order-detail-label">Estado</div>
                                        <div class="order-detail-value ${getStatusClass(order.status)}">${getStatusText(order.status)}</div>
                                    </div>
                                    <div class="order-detail">
                                        <div class="order-detail-label">Fecha Entrega</div>
                                        <div class="order-detail-value">${formatDate(order.due_date)}</div>
                                    </div>
                                    <div class="order-detail ${isOverdue ? 'overdue' : isUrgent ? 'urgent' : ''}">
                                        <div class="order-detail-label">Días Restantes</div>
                                        <div class="order-detail-value">
                                            ${isOverdue ? `${Math.abs(daysRemaining)} días vencido` : 
                                            daysRemaining === 0 ? ' ⚠ Vence hoy' : 
                                            `${daysRemaining} días`}
                                        </div>
                                    </div>
                                    <div class="order-detail">
                                        <div class="order-detail-label">Precio por unidad</div>
                                        <div class="order-detail-value">$${order.price.toLocaleString()}</div>
                                    </div>
                                    <div class="order-detail total-highlight">
                                        <div class="order-detail-label">Total Pedido</div>
                                        <div class="order-detail-value">$${(order.price * order.quantity).toLocaleString()}</div>
                                    </div>
                                </div>
                                
                                ${order.notes ? `<div class="order-notes"><strong>Notas:</strong> ${order.notes}</div>` : ''}
                                
                                <!-- SECCIÓN PARA AGREGAR PROGRESO (solo si no está completado) -->
                                ${remaining > 0 ? `
                                    <div class="add-progress-section">
                                        ${order.size === 'MIXTAS' && order.size_progress ? `
                                            <div class="mixed-sizes-progress">
                                                <h5>Agregar Progreso por Talla</h5>
                                                <div class="size-progress-grid">
                                                    ${Object.entries(JSON.parse(order.size_distribution || '{}')).map(([size, totalQty]) => {
                                                        const completedForSize = sizeProgressData[order.id]?.[size] || 0;
                                                        const remainingForSize = totalQty - completedForSize;
                                                        const progressPercent = Math.round((completedForSize / totalQty) * 100);
                                                        
                                                        return remainingForSize > 0 ? `
                                                            <div class="size-progress-item">
                                                                <div class="size-header">
                                                                    <label>Talla ${size}</label>
                                                                    <span class="size-progress-info">${completedForSize}/${totalQty} (${progressPercent}%)</span>
                                                                </div>
                                                                <div class="size-progress-bar">
                                                                    <div class="size-progress-fill" style="width: ${progressPercent}%; background: #4CAF50;"></div>
                                                                </div>
                                                                <div class="size-input-group">
                                                                    <input type="number" 
                                                                        id="progress-${order.id}-${size}" 
                                                                        min="1" 
                                                                        max="${remainingForSize}" 
                                                                        placeholder="Cantidad"
                                                                        class="progress-input size-specific">
                                                                    <button class="btn btn-success btn-small" onclick="addProgressBySize(${order.id}, '${size}')">
                                                                        <i class="fas fa-plus"></i> Agregar
                                                                    </button>
                                                                    <button class="btn btn-primary btn-small" onclick="completeSize(${order.id}, '${size}')">
                                                                        <i class="fas fa-check"></i> +${remainingForSize}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ` : `
                                                            <div class="size-progress-item completed">
                                                                <div class="size-header">
                                                                    <label>Talla ${size}</label>
                                                                    <span class="size-progress-info completed">✅ Completada (${totalQty}/${totalQty})</span>
                                                                </div>
                                                                <div class="size-progress-bar">
                                                                    <div class="size-progress-fill completed" style="width: 100%; background: #4CAF50;"></div>
                                                                </div>
                                                            </div>
                                                        `;
                                                    }).join('')}
                                                </div>
                                            </div>
                                        ` : `
                                            <div class="progress-input-group">
                                                <input type="number" 
                                                    id="progress-${order.id}" 
                                                    min="1" 
                                                    max="${remaining}" 
                                                    placeholder="Cantidad completada"
                                                    class="progress-input">
                                                <button class="btn btn-success btn-small" onclick="addProgress(${order.id})">
                                                    <i class="fas fa-plus"></i> Agregar Progreso
                                                </button>
                                            </div>
                                        `}
                                    </div>
                                ` : `<div class="completed-badge">✅ Pedido Completado</div>`}

                                <!-- ACCIONES DEL PEDIDO -->
                                <div class="order-actions">
                                    ${remaining > 0 ? `
                                        <button class="btn btn-success btn-small" onclick="completeProduct(${order.id})">
                                            <i class="fas fa-check"></i> Completar
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-primary btn-small" onclick="editProduct(${order.id})">
                                        <i class="fas fa-edit"></i> Editar
                                    </button>
                                    <button class="btn btn-danger btn-small" onclick="deleteProduct(${order.id})">
                                        <i class="fas fa-trash"></i> Eliminar
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>

                <!-- ACCIONES DEL CLIENTE (si tiene pedidos pendientes) -->
                ${!allCompleted ? `
                    <div class="client-actions-container">
                        <button class="btn btn-success btn-complete-client" onclick="completeAllClientOrders('${clientName}')">
                            <i class="fas fa-check-double"></i> Completar Todo el Cliente
                        </button>
                    </div>
                ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function addProgress(id) {
   const input = document.getElementById(`progress-${id}`);
   const quantity = parseInt(input.value);
   
   if (!quantity || quantity <= 0) {
       showNotification('Ingresa una cantidad válida', 'error');
       return;
   }
   
   const product = inventory.find(item => item.id === id);
   const remaining = product.quantity - product.quantity_completed;
   
   if (quantity > remaining) {
       showNotification(`Solo puedes agregar hasta ${remaining} unidades`, 'error');
       return;
   }
   
   try {
       await Database.updateProgress(id, quantity);
       showNotification(`Progreso agregado: +${quantity} unidades`, 'success');
       
       await loadData();
       
       const updatedProduct = inventory.find(item => item.id === id);
       if (updatedProduct && updatedProduct.quantity_completed >= updatedProduct.quantity) {
           const today = new Date().toISOString().split('T')[0];
           await Database.archiveProduct(id, 'completed', today);
           showNotification('Producto completado y archivado automáticamente', 'success');
           await loadData();
       }
       
       await renderInventory();
       updateStats();
       
   } catch (error) {
       console.error('Error agregando progreso:', error);
       showNotification('Error al agregar progreso', 'error');
   }
}

async function completeProduct(id) {
    const product = inventory.find(item => item.id === id);
    const remaining = product.quantity - product.quantity_completed;
    
    showConfirmModal(
        'Completar Producto',
        `¿Estás seguro de que deseas completar las ${remaining} unidades restantes de ${product.client_name}?`,
        async () => {
            try {
                console.log('Iniciando completar producto:', { id, remaining, product: product.client_name });
                
                await Database.updateProgress(id, remaining);
                console.log('Progreso actualizado correctamente');
                
                const today = new Date().toISOString().split('T')[0];
                await Database.archiveProduct(id, 'completed', today);
                console.log('Producto archivado correctamente');
                
                showNotification('Producto completado y archivado exitosamente', 'success');
                
                await loadData();
                await renderInventory();
                updateStats();
                
            } catch (error) {
                console.error('Error completando producto:', error);
                showNotification(`Error al completar producto: ${error.message}`, 'error');
            }
        }
    );
}

function getStatusClass(status) {
    const statusClasses = {
        'completed': 'status-completed',
        'pending': 'status-pending',
        'priority': 'status-priority'
    };
    return statusClasses[status] || 'status-pending';
}

function getStatusText(status) {
    const statusTexts = {
        'completed': 'Completado',
        'pending': 'Pendiente',
        'priority': 'Prioritario'
    };
    return statusTexts[status] || 'Pendiente';
}

function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00'); 
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function editProduct(id) {
    const product = inventory.find(item => item.id === id);
    if (product) {
        document.getElementById('clientName').value = product.client_name;
        document.getElementById('productType').value = product.product_type;
        document.getElementById('quantity').value = product.quantity;
        document.getElementById('size').value = product.size === 'No especificada' ? '' : product.size;
        toggleMixedSizes();
        if (product.size === 'MIXTAS' && product.size_distribution) {
            try {
                const distribution = JSON.parse(product.size_distribution);
                Object.entries(distribution).forEach(([size, qty]) => {
                    const input = document.getElementById(`size${size}`);
                    if (input) input.value = qty;
                });
                updateMixedSizesTotal();
            } catch (e) {
                console.error('Error cargando distribución de tallas:', e);
            }
        }
        document.getElementById('color').value = product.color === 'No especificado' ? '' : product.color;
        document.getElementById('status').value = product.status;
        document.getElementById('dueDate').value = product.due_date;
        document.getElementById('price').value = product.price;
        document.getElementById('notes').value = product.notes;
        
        editingId = id;
        const submitBtn = document.querySelector('#productForm button[type="submit"]');
        if (submitBtn) {
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar Producto';
            submitBtn.className = 'btn btn-success';
        }
        
        document.getElementById('productForm').scrollIntoView({ behavior: 'smooth' });
        
        showNotification('Producto cargado para edición', 'info');
    }
}

async function deleteProduct(id) {
    const product = inventory.find(item => item.id === id);
    
    showConfirmModal(
        'Eliminar Producto',
        `¿Estás seguro de que deseas eliminar el producto de ${product.client_name}? Esta acción no se puede deshacer.`,
        async () => {
            try {
                console.log('Iniciando eliminar producto:', { id, product: product.client_name });
                
                await Database.archiveProduct(id, 'deleted');
                console.log('Producto eliminado y archivado correctamente');
                
                showNotification('Producto eliminado y archivado exitosamente', 'success');
                
                await loadData();
                await renderInventory();
                updateStats();
                
            } catch (error) {
                console.error('Error eliminando producto:', error);
                showNotification(`Error al eliminar producto: ${error.message}`, 'error');
            }
        }
    );
}

async function filterInventory() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        filteredInventory = [...inventory];
    } else {
        filteredInventory = inventory.filter(item => 
            item.client_name.toLowerCase().includes(searchTerm) ||
            item.product_type.toLowerCase().includes(searchTerm) ||
            getStatusText(item.status).toLowerCase().includes(searchTerm) ||
            item.color.toLowerCase().includes(searchTerm) ||
            item.size.toLowerCase().includes(searchTerm)
        );
    }
    
    await renderInventory();
}

function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

async function exportToCSV() {
    if (inventory.length === 0) {
        showNotification('No hay datos para exportar', 'error');
        return;
    }
    
    const headers = ['ID', 'Cliente', 'Producto', 'Cantidad', 'Completadas', 'Restantes', 'Talla', 'Color', 'Estado', 'Fecha Entrega', 'Precio', 'Notas', 'Creado', 'Actualizado'];
    
    const csvContent = [
        headers.join(','),
        ...inventory.map(item => [
            item.id,
            `"${item.client_name}"`,
            `"${item.product_type}"`,
            item.quantity,
            item.quantity_completed,
            item.quantity - item.quantity_completed,
            `"${item.size}"`,
            `"${item.color}"`,
            `"${getStatusText(item.status)}"`,
            item.due_date,
            item.price,
            `"${item.notes.replace(/"/g, '""')}"`,
            new Date(item.created_at).toLocaleString(),
            new Date(item.updated_at).toLocaleString()
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reg_marketing_inventario_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    if (isMobileDevice()) {
        setTimeout(() => {
            showMobileDownloadInstructions('El archivo se ha preparado para descarga. Si no se descarga automáticamente, revisa tu carpeta de descargas o las notificaciones del navegador.');
        }, 1000);
}
    
    showNotification('Datos exportados exitosamente', 'success');
}

async function getCompletedBySizeForOrder(orderId, size) {
    try {
        return await Database.getCompletedBySizeForOrder(orderId, size);
    } catch (error) {
        console.error('Error obteniendo progreso por talla:', error);
        return 0;
    }
}

async function generateReport() {
    const stats = {
        total: inventory.length,
        completed: inventory.filter(item => item.status === 'completed').length,
        pending: inventory.filter(item => item.status === 'pending').length,
        priority: inventory.filter(item => item.status === 'priority').length,
        totalQuantity: inventory.reduce((sum, item) => sum + item.quantity, 0),
        completedQuantity: inventory.reduce((sum, item) => sum + item.quantity_completed, 0),
        pendingQuantity: inventory.reduce((sum, item) => sum + (item.quantity - item.quantity_completed), 0),
        totalValue: inventory.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };
    
    const report = `
=== REPORTE REG MARKETING S.A.S ===

Fecha: ${new Date().toLocaleString()}

ESTADÍSTICAS GENERALES:
- Total de órdenes: ${stats.total}
- Órdenes completadas: ${stats.completed}
- Órdenes pendientes: ${stats.pending}
- Órdenes prioritarias: ${stats.priority}
- Cantidad total solicitada: ${stats.totalQuantity}
- Cantidad completada: ${stats.completedQuantity}
- Cantidad pendiente: ${stats.pendingQuantity}
- Progreso general: ${((stats.completedQuantity / stats.totalQuantity) * 100).toFixed(1)}%
- Valor total del inventario: $${stats.totalValue.toLocaleString()}

PRODUCTOS POR CLIENTE:
${[...new Set(inventory.map(item => item.client_name))]
    .map(client => {
        const clientProducts = inventory.filter(item => item.client_name === client);
        const clientQuantity = clientProducts.reduce((sum, item) => sum + item.quantity, 0);
        const clientCompleted = clientProducts.reduce((sum, item) => sum + item.quantity_completed, 0);
        const clientValue = clientProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        return `- ${client}: ${clientProducts.length} órdenes, ${clientCompleted}/${clientQuantity} prendas, $${clientValue.toLocaleString()}`;
    }).join('\n')}

TIPOS DE PRODUCTO MÁS SOLICITADOS:
${Object.entries(
    inventory.reduce((acc, item) => {
        acc[item.product_type] = (acc[item.product_type] || 0) + item.quantity;
        return acc;
    }, {})
).sort((a, b) => b[1] - a[1])
.map(([product, quantity]) => `- ${product}: ${quantity} unidades`)
.join('\n')}
    `;
    
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reg_marketing_reporte_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    if (isMobileDevice()) {
        setTimeout(() => {
            showMobileDownloadInstructions('El archivo se ha preparado para descarga. Si no se descarga automáticamente, revisa tu carpeta de descargas o las notificaciones del navegador.');
        }, 1000);
}
    
    showNotification('Reporte generado exitosamente', 'success');
}

async function backupData() {
    if (inventory.length === 0) {
        showNotification('No hay datos para respaldar', 'error');
        return;
    }
    
    const backup = {
        inventory: inventory,
        exportDate: new Date().toISOString(),
        version: '2.0'
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reg_marketing_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    if (isMobileDevice()) {
        setTimeout(() => {
            showMobileDownloadInstructions('El archivo se ha preparado para descarga. Si no se descarga automáticamente, revisa tu carpeta de descargas o las notificaciones del navegador.');
        }, 1000);
}
    
    showNotification('Respaldo creado exitosamente', 'success');
}

function showConfirmModal(title, message, onConfirm, onCancel = null) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const cancelBtn = document.getElementById('confirmCancel');
    const acceptBtn = document.getElementById('confirmAccept');
    
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    modal.classList.add('active');
    
    const handleCancel = () => {
        modal.classList.remove('active');
        if (onCancel) onCancel();
        cleanup();
    };
    
    const handleConfirm = () => {
        modal.classList.remove('active');
        onConfirm();
        cleanup();
    };
    
    const handleClickOutside = (e) => {
        if (e.target === modal) {
            handleCancel();
        }
    };
    
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            handleCancel();
        }
    };
    
    const cleanup = () => {
        cancelBtn.removeEventListener('click', handleCancel);
        acceptBtn.removeEventListener('click', handleConfirm);
        modal.removeEventListener('click', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
    };
    
    cancelBtn.addEventListener('click', handleCancel);
    acceptBtn.addEventListener('click', handleConfirm);
    modal.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
}
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (navigator.maxTouchPoints > 0 && window.innerWidth < 768);
}

function showMobileDownloadInstructions(message) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay mobile-download-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-mobile-alt"></i> Descarga en Móvil</h3>
            </div>
            <div class="modal-body">
                <p>${message}</p>
                <div style="margin-top: 15px; padding: 15px; background: #E3F2FD; border-radius: 8px; border-left: 4px solid var(--primary-blue);">
                    <strong>💡 Consejos para móvil:</strong><br>
                    • Revisa la carpeta "Descargas" de tu dispositivo<br>
                    • Algunos navegadores muestran una notificación de descarga<br>
                    • En algunos casos, mantén presionado el enlace de descarga<br>
                    • Puedes compartir el archivo por WhatsApp o email
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-check"></i> Entendido
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}
async function generateMonthlyReport() {
    try {
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        
        console.log(`Generando reporte PDF para ${currentMonth}/${currentYear}`);
        
        showNotification('Generando reporte PDF...', 'info');
        
        const monthlyData = await Database.getMonthlyReport(currentYear, currentMonth);
        const currentData = inventory.map(item => ({
            ...item,
            action: item.status === 'completed' ? 'completed' : 'pending',
            total_value: item.price * item.quantity,
            client_name: item.client_name,
            product_type: item.product_type,
            quantity_completed: item.quantity_completed,
            quantity: item.quantity
        }));

        const filteredMonthlyData = (monthlyData || []).filter(item => item.action === 'completed');

        const allData = [...filteredMonthlyData, ...currentData];
        console.log('Datos mensuales obtenidos:', monthlyData);
        
        await createProfessionalPDF(allData, currentMonth, currentYear);    
        
    } catch (error) {
        console.error('Error generando reporte PDF:', error);
        showNotification('Error al generar reporte PDF: ' + error.message, 'error');
    }
}
function loadLogoImage() {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = function() {
            console.log('No se pudo cargar logo.png, usando logo por defecto');
            resolve(null);
        };
        img.src = 'logo.png';
    });
}

async function createProfessionalPDF(monthlyData, currentMonth, currentYear) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('portrait', 'mm', 'a4');
    
    const logoDataUrl = await loadLogoImage();
    
    const colors = {
        primary: [33, 150, 243],
        dark: [25, 118, 210],
        success: [76, 175, 80],
        warning: [255, 152, 0],
        danger: [244, 67, 54],
        gray: [117, 117, 117],
        lightGray: [245, 245, 245],
        white: [255, 255, 255],
        black: [33, 33, 33]
    };
    
    const pageWidth = 210;
    const margins = { left: 20, right: 20 };
    const contentWidth = pageWidth - margins.left - margins.right;
    
    createProfessionalHeader(doc, logoDataUrl, colors, currentMonth, currentYear);

    let currentY = 65;
    
    if (!monthlyData || (monthlyData.length === 0 && inventory.length === 0)) {
        await createCurrentDataReport(doc, currentY, colors, margins, contentWidth);
    } else {
        await createHistoricalReport(doc, monthlyData, currentY, colors, margins, contentWidth, currentMonth, currentYear);
    }
    
    addProfessionalFooter(doc, colors, pageWidth);
    
    const filename = `REG_Marketing_Reporte_${getMonthName(currentMonth)}_${currentYear}.pdf`;
    doc.save(filename);
    
    if (isMobileDevice()) {
        setTimeout(() => {
            showMobileDownloadInstructions('El reporte PDF se ha generado y está listo para descarga.');
        }, 1000);
    }
    
    showNotification('Reporte PDF generado exitosamente', 'success');
}

async function createCurrentDataReport(doc, startY, colors, margins, contentWidth) {
    let currentY = startY;
    
    doc.setFillColor(...colors.warning);
    doc.roundedRect(margins.left, currentY, contentWidth, 15, 3, 3, 'F');
    doc.setTextColor(...colors.white);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('DATOS ACTUALES DEL SISTEMA', margins.left + 8, currentY + 10);
    
    currentY += 25;
    doc.setTextColor(...colors.black);
    
    const currentStats = {
        totalOrdenes: inventory.length,
        totalIngresos: inventory.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        totalPrendas: inventory.reduce((sum, item) => sum + item.quantity, 0),
        prendasCompletadas: inventory.reduce((sum, item) => sum + item.quantity_completed, 0),
        clientesActivos: [...new Set(inventory.map(item => item.client_name))].length
    };
    
    const kpis = [
        { 
            label: 'Valor Total en Ordenes', 
            value: `$${currentStats.totalIngresos.toLocaleString()}`, 
            color: colors.success
        },
        { 
            label: 'Ordenes Activas', 
            value: currentStats.totalOrdenes.toString(), 
            color: colors.primary
        },
        { 
            label: 'Prendas en Proceso', 
            value: `${currentStats.prendasCompletadas}/${currentStats.totalPrendas}`, 
            color: colors.warning
        },
        { 
            label: 'Clientes Activos', 
            value: currentStats.clientesActivos.toString(), 
            color: colors.danger
        }
    ];
    
    const cardWidth = (contentWidth - 15) / 2;
    const cardHeight = 30; 
    
    for (let i = 0; i < kpis.length; i++) {
        const kpi = kpis[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = margins.left + col * (cardWidth + 5);
        const y = currentY + row * (cardHeight + 8);
        
        doc.setFillColor(220, 220, 220);
        doc.roundedRect(x + 2, y + 2, cardWidth, cardHeight, 5, 5, 'F');
        
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, cardWidth, cardHeight, 5, 5, 'F');
        
        
        doc.setFillColor(...kpi.color);
        doc.roundedRect(x, y, cardWidth, 5, 5, 5, 'F');
        doc.rect(x, y + 3, cardWidth, 2, 'F');
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...kpi.color);
        doc.text(kpi.value, x + 8, y + 16);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.gray);
        doc.text(kpi.label, x + 8, y + 24);
    }
    
    currentY += 75;
    
    if (inventory.length > 0) {
        doc.setFillColor(...colors.primary);
        doc.roundedRect(margins.left, currentY, contentWidth, 12, 3, 3, 'F');
        doc.setTextColor(...colors.white);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('ORDENES ACTUALES EN SISTEMA', margins.left + 8, currentY + 8);
        
        currentY += 20;
        
        for (let index = 0; index < Math.min(inventory.length, 12); index++) {
            const item = inventory[index];
            if (currentY > 240) {
                doc.addPage();
                createProfessionalHeader(doc, await loadLogoImage(), colors, currentMonth, currentYear);
                currentY = 70;
            }
            
            const progress = `${item.quantity_completed}/${item.quantity}`;
            const progressPercent = Math.round((item.quantity_completed / item.quantity) * 100);
            const value = `$${(item.price * item.quantity).toLocaleString()}`;
            
            if (index % 2 === 0) {
                doc.setFillColor(248, 249, 250);
                doc.roundedRect(margins.left, currentY - 2, contentWidth, 12, 2, 2, 'F');
            }
            
            const statusColor = item.status === 'completed' ? colors.success : 
                              item.status === 'priority' ? colors.danger : colors.warning;
            doc.setFillColor(...statusColor);
            doc.circle(margins.left + 4, currentY + 4, 2, 'F');
            
            doc.setTextColor(...colors.black);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(`${item.client_name}`, margins.left + 10, currentY + 3);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...colors.gray);
            doc.setFontSize(8);
            doc.text(`${item.product_type} - ${progress} (${progressPercent}%) - ${value}`, margins.left + 10, currentY + 8);
            
            currentY += 14;
        };
        
        if (inventory.length > 12) {
            doc.setTextColor(...colors.gray);
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.text(`... y ${inventory.length - 12} ordenes mas en el sistema`, margins.left + 10, currentY + 5);
            currentY += 15;
        }
    }
    
    currentY += 10;
    doc.setFillColor(255, 248, 225);
    doc.roundedRect(margins.left, currentY, contentWidth, 25, 5, 5, 'F');
    
    doc.setFillColor(...colors.warning);
    doc.roundedRect(margins.left, currentY, 4, 25, 5, 5, 'F');
    
    doc.setTextColor(...colors.black);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('NOTA IMPORTANTE', margins.left + 10, currentY + 8);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...colors.gray);
    const noteText = 'Este reporte muestra datos actuales del sistema. Para generar reportes con historial de ventas reales, complete algunos pedidos y vuelva a generar el reporte mensual.';
    const splitNote = doc.splitTextToSize(noteText, contentWidth - 20);
    doc.text(splitNote, margins.left + 10, currentY + 15);
}

async function createHistoricalReport(doc, allData, startY, colors, margins, contentWidth, currentMonth, currentYear) {
    let currentY = startY;
    
    const totalIngresos = allData.reduce((sum, item) => sum + (item.total_value || 0), 0);
    const totalPrendas = allData.reduce((sum, item) => sum + (item.quantity_completed || 0), 0);
    const totalClientes = [...new Set(allData.map(item => item.client_name))].length;
    const completedOrders = allData.filter(item => item.action === 'completed').length;
    const pendingOrders = allData.filter(item => item.action === 'pending').length;
    const deletedOrders = allData.filter(item => item.action === 'deleted').length;
    
    doc.setFillColor(...colors.success);
    doc.roundedRect(margins.left, currentY, contentWidth, 15, 3, 3, 'F');
    doc.setTextColor(...colors.white);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN FINANCIERO DEL MES', margins.left + 8, currentY + 10);
    
    currentY += 25;
    
    const financialKPIs = [
        { 
            label: 'Ingresos Totales', 
            value: `$${totalIngresos.toLocaleString()}`, 
            color: colors.success
        },
        { 
            label: 'Prendas Completadas', 
            value: totalPrendas.toString(), 
            color: colors.primary
        },
        { 
            label: 'Clientes Atendidos', 
            value: totalClientes.toString(), 
            color: colors.warning
        },
        { 
            label: 'Ingreso Promedio por Cliente', 
            value: `$${totalClientes > 0 ? Math.round(totalIngresos/totalClientes).toLocaleString() : 0}`, 
            color: colors.danger
        }
    ];
    
    createKPICards(doc, financialKPIs, currentY, colors, margins, contentWidth);
    currentY += 75;
    
    doc.setFillColor(...colors.primary);
    doc.roundedRect(margins.left, currentY, contentWidth, 12, 3, 3, 'F');
    doc.setTextColor(...colors.white);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('ACTIVIDAD DEL MES', margins.left + 8, currentY + 8);
    
    currentY += 20;
    
    const activityStats = [
        { label: 'Ordenes Completadas', value: completedOrders, color: colors.success },
        { label: 'Ordenes Pendientes', value: pendingOrders, color: colors.danger },
        { label: 'Ordenes Eliminadas', value: deletedOrders, color: colors.warning },
        { label: 'Total en Sistema', value: allData.length, color: colors.primary }
    ];
    
    activityStats.forEach((stat, index) => {
        const y = currentY + (index * 15);
        
        doc.setFillColor(248, 249, 250);
        doc.roundedRect(margins.left, y, contentWidth, 12, 2, 2, 'F');
        
        doc.setFillColor(...stat.color);
        doc.roundedRect(margins.left, y, 4, 12, 2, 2, 'F');
        
        doc.setTextColor(...colors.black);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`${stat.label}:`, margins.left + 10, y + 8);
        
        doc.setTextColor(...stat.color);
        doc.setFont('helvetica', 'bold');
        doc.text(stat.value.toString(), margins.left + 80, y + 8);
    });
    
    currentY += 55;
    
    const clienteStats = allData.reduce((acc, item) => {
        if (!acc[item.client_name]) {
            acc[item.client_name] = { value: 0, quantity: 0, orders: 0 };
        }
        acc[item.client_name].value += item.total_value || 0;
        acc[item.client_name].quantity += item.quantity_completed || 0;
        acc[item.client_name].orders += 1;
        return acc;
    }, {});
    
    const topClientes = Object.entries(clienteStats)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 8);
    
    if (topClientes.length > 0) {
        const requiredSpace = 32 + (topClientes.length * 12); 
        if (currentY + requiredSpace > 250) {
            doc.addPage();
            createProfessionalHeader(doc, await loadLogoImage(), colors, currentMonth, currentYear);
            currentY = 70;
        }
        
        doc.setFillColor(...colors.warning);
        doc.roundedRect(margins.left, currentY, contentWidth, 12, 3, 3, 'F');
        doc.setTextColor(...colors.white);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENTES DEL MES', margins.left + 8, currentY + 8);
        
        currentY += 20;
        
        for (let index = 0; index < topClientes.length; index++) {
            const cliente = topClientes[index];
            if (currentY > 250) {
                doc.addPage();
                createProfessionalHeader(doc, await loadLogoImage(), colors, new Date().getMonth() + 1, new Date().getFullYear());
                currentY = 70;
            }
            
            const [nombre, stats] = cliente;
            const y = currentY + (index * 12);
            
            const clienteCompletado = allData.filter(item => 
                item.client_name === nombre && item.action === 'completed'
            ).length > 0;
            const clientePendiente = allData.filter(item => 
                item.client_name === nombre && item.action === 'pending'
            ).length > 0;

            const circleColor = clienteCompletado && !clientePendiente ? colors.success : 
                            clientePendiente ? colors.danger : colors.primary;

            doc.setFillColor(...circleColor);
            doc.circle(margins.left + 5, y + 4, 3, 'F');
            doc.setTextColor(...colors.white);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');

            const rankNumber = `${index + 1}`;
            const numberWidth = doc.getTextWidth(rankNumber);
            doc.text(rankNumber, margins.left + 5 - (numberWidth / 2), y + 5.2);
            
            doc.setTextColor(...colors.black);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(nombre, margins.left + 15, y + 4);
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...colors.gray);
            doc.text(`$${stats.value.toLocaleString()} - ${stats.quantity} prendas - ${stats.orders} ordenes`, margins.left + 15, y + 8);
        };
        
        currentY += (topClientes.length * 12) + 10;

        const hasPendingClients = allData.some(item => item.action === 'pending');

        if (hasPendingClients) {
            currentY += 10;
            doc.setFillColor(255, 248, 225);
            doc.roundedRect(margins.left, currentY, contentWidth, 25, 5, 5, 'F');
            
            doc.setFillColor(...colors.warning);
            doc.roundedRect(margins.left, currentY, 4, 25, 5, 5, 'F');
            
            doc.setTextColor(...colors.black);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('NOTA IMPORTANTE', margins.left + 10, currentY + 8);
            
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(...colors.gray);
            const noteText = 'Hay clientes con ordenes pendientes marcados en rojo. Complete estos pedidos para actualizar el estado en futuros reportes.';
            const splitNote = doc.splitTextToSize(noteText, contentWidth - 20);
            doc.text(splitNote, margins.left + 10, currentY + 15);
        }
        }
}

function createKPICards(doc, kpis, startY, colors, margins, contentWidth) {
    const cardWidth = (contentWidth - 15) / 2;
    const cardHeight = 25;
    
    for (let i = 0; i < kpis.length; i++) {
        const kpi = kpis[i];
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = margins.left + col * (cardWidth + 5);
        const y = startY + row * (cardHeight + 5);
        
        doc.setFillColor(200, 200, 200);
        doc.roundedRect(x + 1, y + 1, cardWidth, cardHeight, 3, 3, 'F');
        
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');
        
        doc.setFillColor(...kpi.color);
        doc.roundedRect(x, y, cardWidth, 4, 3, 3, 'F');
        doc.rect(x, y + 2, cardWidth, 2, 'F');
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...kpi.color);
        doc.text(kpi.value, x + 8, y + 14);
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.gray);
        doc.text(kpi.label, x + 8, y + 20);
    }
}

function createProfessionalHeader(doc, logoDataUrl, colors, currentMonth, currentYear) {
    doc.setFillColor(248, 249, 250); 
    doc.rect(0, 0, 210, 55, 'F');
    
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, 210, 3, 'F');
    
    const logoX = 15;
    const logoY = 12;
    const logoSize = 30;
    
    doc.setFillColor(200, 200, 200); 
    doc.circle(logoX + logoSize/2 + 1, logoY + logoSize/2 + 1, logoSize/2 + 2, 'F');
    
    doc.setFillColor(255, 255, 255); 
    doc.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 2, 'F');
    
    if (logoDataUrl) {
        try {
            doc.addImage(logoDataUrl, 'PNG', logoX + 3, logoY + 3, logoSize - 6, logoSize - 6);
        } catch (error) {
            console.log('Error agregando logo:', error);
            doc.setTextColor(...colors.primary);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            const textWidth = doc.getTextWidth('REG');
            doc.text('REG', logoX + logoSize/2 - textWidth/2, logoY + logoSize/2 + 3);
        }
    } else {
        doc.setTextColor(...colors.primary);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const textWidth = doc.getTextWidth('REG');
        doc.text('REG', logoX + logoSize/2 - textWidth/2, logoY + logoSize/2 + 3);
    }
    
    const companyX = logoX + logoSize + 12; 
    
    doc.setTextColor(...colors.black);
    doc.setFontSize(18); 
    doc.setFont('helvetica', 'bold');
    doc.text('REG MARKETING', companyX, logoY + 10);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...colors.gray);
    doc.text('S.A.S', companyX, logoY + 18);
    
    doc.setFontSize(9);
    doc.setTextColor(...colors.gray);
    doc.text('Sistema Profesional de Gestion Textil', companyX, logoY + 26);
    
    const reportX = 130;
    
    doc.setFillColor(...colors.primary);
    doc.roundedRect(reportX, logoY, 65, 20, 3, 3, 'F');
    
    doc.setTextColor(...colors.white);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const reportTitle = `REPORTE MENSUAL`;
    const titleWidth = doc.getTextWidth(reportTitle);
    doc.text(reportTitle, reportX + (65 - titleWidth)/2, logoY + 8);
    
    doc.setFontSize(11);
    const monthYear = `${getMonthName(currentMonth)} ${currentYear}`;
    const monthWidth = doc.getTextWidth(monthYear);
    doc.text(monthYear, reportX + (65 - monthWidth)/2, logoY + 16);
    
    doc.setTextColor(...colors.gray);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const generateDate = `Generado: ${new Date().toLocaleDateString('es-ES')}`;
    doc.text(generateDate, reportX, logoY + 26);
    
    doc.setDrawColor(...colors.lightGray);
    doc.setLineWidth(0.5);
    doc.line(15, 52, 195, 52);
}

function addProfessionalFooter(doc, colors, pageWidth) {
    const footerY = 285; 
    
    doc.setFillColor(...colors.primary);
    doc.rect(20, footerY, 170, 1, 'F');
    
    doc.setTextColor(...colors.gray);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('REG MARKETING S.A.S - Sistema Profesional de Gestion Textil', 20, footerY + 8);
    doc.text('Generado automaticamente por el sistema de gestion', 20, footerY + 13);
    
    const currentDate = new Date().toLocaleString('es-ES');
    const dateWidth = doc.getTextWidth(`Fecha: ${currentDate}`);
    doc.text(`Fecha: ${currentDate}`, pageWidth - 20 - dateWidth, footerY + 8);
    
    const pageText = 'Pagina 1';
    const pageWidth2 = doc.getTextWidth(pageText);
    doc.text(pageText, pageWidth - 20 - pageWidth2, footerY + 13);
}

function getMonthName(monthNumber) {
    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[monthNumber - 1];
}
function downloadReport(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    
    if (isMobileDevice()) {
        setTimeout(() => {
            showMobileDownloadInstructions('El reporte se ha preparado para descarga.');
        }, 1000);
    }
}

async function showSalesHistory() {
    try {
        console.log('Cargando historial de ventas...');
        
        const history = await Database.getSalesHistory(50);
        console.log('Historial obtenido:', history);
        
        if (!history || history.length === 0) {
            showNotification('No hay historial de ventas aún. Completa algunos pedidos para ver el historial.', 'info');
            return;
        }
        
        let historyContent = `
            <div class="sales-history">
                <h3>Historial de Ventas (Últimas ${history.length})</h3>
                <div style="margin-bottom: 15px; padding: 10px; background: #E3F2FD; border-radius: 8px; font-size: 0.9rem;">
                    📊 <strong>Resumen:</strong> ${history.filter(h => h.action === 'completed').length} completadas, 
                    ${history.filter(h => h.action === 'deleted').length} eliminadas
                </div>
                <div class="history-list" style="max-height: 60vh; overflow-y: auto;">
        `;
        
        history.forEach(item => {
            const fechaArchivado = new Date(item.archived_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const accion = item.action === 'completed' ? 'Completado' : 'Eliminado';
            const color = item.action === 'completed' ? '#4CAF50' : '#f44336';
            const icon = item.action === 'completed' ? '✅' : '❌';
            
            historyContent += `
                <div style="padding: 15px; margin-bottom: 10px; background: #F8F9FA; border-radius: 10px; border-left: 4px solid ${color};">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <strong>${item.client_name}</strong>
                        <span style="color: ${color}; font-weight: 600;">${icon} ${accion}</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; font-size: 0.9rem; color: #666;">
                        <div><strong>Producto:</strong> ${item.product_type}</div>
                        <div><strong>Cantidad:</strong> ${item.quantity_completed}/${item.quantity}</div>
                        <div><strong>Valor:</strong> $${(item.total_value || 0).toLocaleString()}</div>
                        <div><strong>Archivado:</strong> ${fechaArchivado}</div>
                    </div>
                    ${item.completed_date ? `
                        <div style="margin-top: 8px; font-size: 0.8rem; color: #888;">
                            Completado: ${new Date(item.completed_date).toLocaleDateString('es-ES')}
                        </div>
                    ` : ''}
                </div>
            `;
        });
        
        historyContent += `
                </div>
                <div style="margin-top: 15px; padding: 10px; background: #FFF3E0; border-radius: 8px; font-size: 0.9rem; text-align: center;">
                    💡 <strong>Tip:</strong> Este historial se actualiza automáticamente cuando completas o eliminas pedidos
                </div>
            </div>
        `;
        
        showInfoModal('Historial de Ventas', historyContent);
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        showNotification('Error al cargar historial: ' + error.message, 'error');
    }
}

async function clearHistory() {
    showConfirmModal(
        'Limpiar Historial',
        '⚠️ ¿Estás seguro de que deseas eliminar TODO el historial de ventas? Esta acción NO se puede deshacer.',
        async () => {
            try {
                await Database.clearAllHistory();
                showNotification('Historial eliminado completamente', 'success');
            } catch (error) {
                console.error('Error limpiando historial:', error);
                showNotification('Error al limpiar historial', 'error');
            }
        }
    );
}

function toggleMixedSizes() {
    const sizeSelect = document.getElementById('size');
    const mixedSizesSection = document.getElementById('mixedSizesSection');
    const quantityInput = document.getElementById('quantity');
    
    if (sizeSelect.value === 'MIXTAS') {
        mixedSizesSection.style.display = 'block';
        mixedSizesSection.classList.add('show');
        
        quantityInput.readOnly = true;
        quantityInput.style.background = '#F5F5F5';
        quantityInput.style.cursor = 'not-allowed';
        quantityInput.placeholder = 'Se calcula automáticamente';
        
        updateMixedSizesTotal();
    } else {
        mixedSizesSection.style.display = 'none';
        mixedSizesSection.classList.remove('show');
        
        quantityInput.readOnly = false;
        quantityInput.style.background = '';
        quantityInput.style.cursor = '';
        quantityInput.placeholder = 'Cantidad de productos';
        
        clearMixedSizeInputs();
    }
}

function updateMixedSizesTotal() {
    const sizeInputs = document.querySelectorAll('.size-input');
    let total = 0;
    
    sizeInputs.forEach(input => {
        const value = parseInt(input.value) || 0;
        total += value;
    });
    
    document.getElementById('sizesTotalDisplay').textContent = total;
    document.getElementById('quantity').value = total;
    
    return total;
}

function clearMixedSizeInputs() {
    const sizeInputs = document.querySelectorAll('.size-input');
    sizeInputs.forEach(input => {
        input.value = 0;
    });
    document.getElementById('sizesTotalDisplay').textContent = '0';
}

function getMixedSizesDistribution() {
    const sizes = {};
    const sizeInputs = document.querySelectorAll('.size-input');
    
    sizeInputs.forEach(input => {
        const sizeType = input.id.replace('size', '');
        const quantity = parseInt(input.value) || 0;
        if (quantity > 0) {
            sizes[sizeType] = quantity;
        }
    });
    
    return sizes;
}

function validateMixedSizes() {
    const sizeSelect = document.getElementById('size');
    
    if (sizeSelect.value === 'MIXTAS') {
        const total = updateMixedSizesTotal();
        if (total === 0) {
            showNotification('Debes especificar al menos una cantidad para las tallas mixtas', 'error');
            return false;
        }
    }
    
    return true;
}

function formatSizeDisplay(item) {
    if (item.size === 'MIXTAS' && item.size_distribution) {
        try {
            const distribution = JSON.parse(item.size_distribution);
            if (Object.keys(distribution).length > 0) {
                const sizeBreakdown = Object.entries(distribution)
                    .filter(([size, qty]) => qty > 0)
                    .map(([size, qty]) => `${size}: ${qty}`)
                    .join(', ');
                return `Tallas Mixtas (${sizeBreakdown})`;
            }
        } catch (e) {
            console.error('Error parsing size distribution:', e);
        }
    }
    return item.size || 'No especificada';
}

async function addProgressBySize(orderId, size) {
    console.log('=== DEBUG addProgressBySize ===');
    console.log('OrderId:', orderId, 'Size:', size);
    
    const input = document.getElementById(`progress-${orderId}-${size}`);
    console.log('Input encontrado:', input);
    
    if (!input) {
        console.error('Input no encontrado');
        showNotification('Error: Campo de entrada no encontrado', 'error');
        return;
    }
    
    const quantity = parseInt(input.value);
    console.log('Quantity:', quantity);
    
    if (!quantity || quantity <= 0) {
        showNotification('Ingresa una cantidad válida', 'error');
        return;
    }

    const order = inventory.find(item => item.id === orderId);
    try {
        const sizeDistribution = JSON.parse(order.size_distribution || '{}');
        const totalForSize = sizeDistribution[size] || 0;
        const completedForSize = await Database.getCompletedBySizeForOrder(orderId, size);
        const remainingForSize = totalForSize - completedForSize;
        
        if (quantity > remainingForSize) {
            showNotification(`Solo puedes agregar hasta ${remainingForSize} unidades para talla ${size}`, 'error');
            return;
        }
    } catch (error) {
        console.error('Error validando límite:', error);
        showNotification('Error al validar límite de talla', 'error');
        return;
    }
    
    try {
        console.log('Llamando a Database.updateProgressBySize...');
        await Database.updateProgressBySize(orderId, size, quantity);
        
        showNotification(`Progreso agregado: +${quantity} unidades talla ${size}`, 'success');
        input.value = '';
        
        await loadData();
        await renderInventory();
        updateStats();
        await checkAndCompleteOrder(orderId);
        
    } catch (error) {
        console.error('Error completo:', error);
        showNotification('Error al agregar progreso: ' + error.message, 'error');
    }
}

async function completeSize(orderId, size) {
    const order = inventory.find(item => item.id === orderId);
    if (!order || order.size !== 'MIXTAS') {
        showNotification('Error: Pedido no encontrado o no es de tallas mixtas', 'error');
        return;
    }
    
    try {
        const sizeDistribution = JSON.parse(order.size_distribution || '{}');
        const totalForSize = sizeDistribution[size] || 0;
        const completedForSize = await Database.getCompletedBySizeForOrder(orderId, size);
        const remainingForSize = totalForSize - completedForSize;
        
        if (remainingForSize <= 0) {
            showNotification(`La talla ${size} ya está completada`, 'info');
            return;
        }
        
        showConfirmModal(
            'Completar Talla',
            `¿Completar las ${remainingForSize} unidades restantes de talla ${size}?`,
            async () => {
                try {
                    await Database.updateProgressBySize(orderId, size, remainingForSize);
                    showNotification(`Talla ${size} completada: +${remainingForSize} unidades`, 'success');
                    
                    await loadData();
                    await renderInventory();
                    updateStats();
                    await checkAndCompleteOrder(orderId);
                } catch (error) {
                    console.error('Error completando talla:', error);
                    showNotification('Error al completar talla', 'error');
                }
            }
        );
        
    } catch (error) {
        console.error('Error completando talla:', error);
        showNotification('Error al completar talla', 'error');
    }
}

async function checkAndCompleteOrder(orderId) {
    try {
        const order = inventory.find(item => item.id === orderId);
        if (!order || order.size !== 'MIXTAS') return;
        
        const sizeDistribution = JSON.parse(order.size_distribution || '{}');
        
        let totalCompleted = 0;
        let totalRequired = 0;
        
        for (const [size, requiredQty] of Object.entries(sizeDistribution)) {
            const completedForSize = await Database.getCompletedBySizeForOrder(orderId, size);
            totalCompleted += completedForSize;
            totalRequired += requiredQty;
        }
        
        if (totalCompleted >= totalRequired) {
            console.log(`Pedido ${orderId} completado al 100%, archivando...`);
            
            if (order.quantity_completed < order.quantity) {
                const remaining = order.quantity - order.quantity_completed;
                await Database.updateProgress(orderId, remaining);
            }
            
            const today = new Date().toISOString().split('T')[0];
            await Database.archiveProduct(orderId, 'completed', today);
            
            showNotification('Pedido completado automáticamente y movido al historial', 'success');
            
            await loadData();
            await renderInventory();
            updateStats();
        }
        
    } catch (error) {
        console.error('Error verificando completitud del pedido:', error);
    }
}

function calculateMixedSizeProgress(order, sizeProgressData) {
    try {
        const sizeDistribution = JSON.parse(order.size_distribution);
        let totalCompleted = 0;
        let totalRequired = 0;
        
        for (const [size, requiredQty] of Object.entries(sizeDistribution)) {
            const completedForSize = sizeProgressData[order.id]?.[size] || 0;
            totalCompleted += completedForSize;
            totalRequired += requiredQty;
        }
        
        return totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;
    } catch (error) {
        console.error('Error calculando progreso:', error);
        return (order.quantity_completed / order.quantity) * 100;
    }
}


function showAsyncConfirm(title, message) {
    return new Promise((resolve) => {
        showConfirmModal(title, message, 
            () => resolve(true),
            () => resolve(false)
        );
    });
}

function showCurrentOrder() {
    const section = document.getElementById('currentOrderSection');
    const clientNameSpan = document.getElementById('currentClientName');
    const itemsContainer = document.getElementById('currentOrderItems');
    
    if (!currentOrder.isActive || currentOrder.items.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    clientNameSpan.textContent = currentOrder.clientName;
    
    const totalValue = currentOrder.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalItems = currentOrder.items.reduce((sum, item) => sum + item.quantity, 0);
    
    itemsContainer.innerHTML = `
        <div class="order-summary">
            <div class="order-stats">
                <span><strong>Total productos:</strong> ${currentOrder.items.length}</span>
                <span><strong>Total prendas:</strong> ${totalItems}</span>
                <span><strong>Valor total:</strong> $${totalValue.toLocaleString()}</span>
            </div>
        </div>
        <div class="order-items-list">
            ${currentOrder.items.map((item, index) => `
                <div class="order-item">
                    <div class="item-info">
                        <strong>${item.productType}</strong>
                        <div class="item-details">
                            Cantidad: ${item.quantity} | 
                            Talla: ${formatOrderItemSize(item)} | 
                            Color: ${item.color} | 
                            Precio: $${item.price.toLocaleString()} | 
                            Total: $${(item.price * item.quantity).toLocaleString()}
                        </div>
                        ${item.notes ? `<div class="item-notes">Notas: ${item.notes}</div>` : ''}
                    </div>
                    <button class="btn btn-danger btn-small" onclick="removeOrderItem(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `).join('')}
        </div>
    `;
}

function formatOrderItemSize(item) {
    if (item.size === 'MIXTAS' && item.sizeDistribution) {
        try {
            const distribution = JSON.parse(item.sizeDistribution);
            const sizeBreakdown = Object.entries(distribution)
                .filter(([size, qty]) => qty > 0)
                .map(([size, qty]) => `${size}: ${qty}`)
                .join(', ');
            return `Mixtas (${sizeBreakdown})`;
        } catch (e) {
            return item.size;
        }
    }
    return item.size;
}

function removeOrderItem(index) {
    currentOrder.items.splice(index, 1);
    showCurrentOrder();
    showNotification('Producto eliminado del pedido', 'info');
}

async function finalizeOrder() {
    if (!currentOrder.isActive || currentOrder.items.length === 0) {
        showNotification('No hay productos en el pedido actual', 'error');
        return;
    }

    try {
        showNotification('Finalizando pedido...', 'info');
        
        for (const item of currentOrder.items) {
            const productData = {
                clientName: currentOrder.clientName,
                productType: item.productType,
                quantity: item.quantity,
                size: item.size,
                sizeDistribution: item.sizeDistribution,
                color: item.color,
                status: currentOrder.status,
                dueDate: currentOrder.dueDate,
                price: item.price,
                notes: item.notes
            };

            await Database.addProduct(productData);
        }

        currentOrder = {
            clientName: '',
            items: [],
            isActive: false
        };

        showCurrentOrder();
        clearProductForm();
        await loadData();
        renderInventory();
        updateStats();

        showNotification(`Pedido finalizado exitosamente con ${currentOrder.items.length} productos`, 'success');
        
    } catch (error) {
        console.error('Error finalizando pedido:', error);
        showNotification('Error al finalizar pedido', 'error');
    }
}

async function finalizeCurrentOrder() {
    await finalizeOrder();
}

function cancelOrder() {
    if (!currentOrder.isActive) return;
    
    showConfirmModal(
        'Cancelar Pedido',
        `¿Estás seguro de que deseas cancelar el pedido de ${currentOrder.clientName} con ${currentOrder.items.length} productos?`,
        () => {
            currentOrder = {
                clientName: '',
                items: [],
                isActive: false
            };
            showCurrentOrder();
            clearProductForm();
            showNotification('Pedido cancelado', 'info');
        }
    );
}

function clearProductForm() {
    if (!currentOrder.isActive) {
        document.getElementById('clientName').value = '';
    }
    
    document.getElementById('productType').value = '';
    document.getElementById('quantity').value = '';
    document.getElementById('size').value = '';
    document.getElementById('color').value = '';
    document.getElementById('notes').value = '';
    document.getElementById('price').value = '';
    
    toggleMixedSizes();
}

async function completeAllClientOrders(clientName) {
    const clientOrders = inventory.filter(item => 
        item.client_name === clientName && 
        item.quantity_completed < item.quantity
    );
    
    if (clientOrders.length === 0) {
        showNotification('No hay pedidos pendientes para este cliente', 'info');
        return;
    }

    const totalPending = clientOrders.reduce((sum, order) => 
        sum + (order.quantity - order.quantity_completed), 0
    );

    showConfirmModal(
        'Completar Todo el Cliente',
        `¿Estás seguro de que deseas completar todos los pedidos pendientes de ${clientName}? Se completarán ${totalPending} prendas en ${clientOrders.length} pedidos.`,
        async () => {
            try {
                showNotification(`Completando todos los pedidos de ${clientName}...`, 'info');
                
                for (const order of clientOrders) {
                    const remaining = order.quantity - order.quantity_completed;
                    if (remaining > 0) {
                        await Database.updateProgress(order.id, remaining);
                        
                        const today = new Date().toISOString().split('T')[0];
                        await Database.archiveProduct(order.id, 'completed', today);
                    }
                }

                showNotification(`Todos los pedidos de ${clientName} completados exitosamente`, 'success');
                
                await loadData();
                renderInventory();
                updateStats();
                
            } catch (error) {
                console.error('Error completando pedidos del cliente:', error);
                showNotification(`Error al completar pedidos: ${error.message}`, 'error');
            }
        }
    );
}

document.addEventListener('DOMContentLoaded', init);