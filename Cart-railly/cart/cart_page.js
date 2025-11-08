// Cart state
let selectedItemId = null;
let cartData = {
    1: { quantity: 0, price: 20, date: '30 SEP 2024', departure: '08 October 2024, 15:10 - Krung Thep Aphiwat Central Terminal Station', arrival: '08 October 2024, 15:41 - Ayutthaya Station' },
    2: { quantity: 0, price: 20, date: '02 OCT 2024', departure: '02 October 2024, 06:00 - Krung Thep Aphiwat Central Terminal Station', arrival: '02 October 2024, 08:00 - Ayutthaya Station' },
    3: { quantity: 0, price: 20, date: '10 OCT 2024', departure: '10 October 2024, 09:00 - Krung Thep Aphiwat Central Terminal Station', arrival: '10 October 2024, 11:00 - Ayutthaya Station' },
    4: { quantity: 0, price: 20, date: '01 NOV 2024', departure: '01 November 2024, 17:00 - Krung Thep Aphiwat Central Terminal Station', arrival: '01 November 2024, 19:00 - Ayutthaya Station' },
    5: { quantity: 0, price: 20, date: '02 NOV 2024', departure: '02 November 2024, 19:00 - Krung Thep Aphiwat Central Terminal Station', arrival: '02 November 2024, 21:00 - Ayutthaya Station' },
    6: { quantity: 0, price: 20, date: '03 NOV 2024', departure: '03 November 2024, 19:00 - Krung Thep Aphiwat Central Terminal Station', arrival: '03 November 2024, 21:00 - Ayutthaya Station' },
    7: { quantity: 0, price: 20, date: '02 NOV 2024', departure: '02 November 2024, 19:00 - Krung Thep Aphiwat Central Terminal Station', arrival: '02 November 2024, 21:00 - Ayutthaya Station' },
    8: { quantity: 0, price: 20, date: '02 NOV 2024', departure: '02 November 2024, 19:00 - Krung Thep Aphiwat Central Terminal Station', arrival: '02 November 2024, 21:00 - Ayutthaya Station' }
};

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    updateSummary();
});

function setupEventListeners() {
    // Cart item selection
    document.querySelectorAll('.cart-item').forEach(item => {
        item.addEventListener('click', function(e) {
        
            if (e.target.classList.contains('qty-btn')) return;
            
            const itemId = this.dataset.id;
            selectItem(itemId);
        });
    });

    // Quantity buttons
    document.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const itemId = this.dataset.id;
            const action = this.classList.contains('plus') ? 'add' : 'subtract';
            updateQuantity(itemId, action);
        });
    });

    // Purchase button
    document.querySelector('.purchase-btn').addEventListener('click', function() {
        if (selectedItemId && cartData[selectedItemId].quantity > 0) {
            alert(`Proceeding to payment for ${cartData[selectedItemId].quantity} ticket(s) - Total: ${calculateTotal()} Baht`);
        } else {
            alert('Please select an item and add tickets to proceed');
        }
    });
}

function selectItem(itemId) {
    // Remove previous selection
    document.querySelectorAll('.cart-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Add new selection
    const selectedItem = document.querySelector(`.cart-item[data-id="${itemId}"]`);
    selectedItem.classList.add('selected');
    selectedItemId = itemId;

    updateSummary();
}

function updateQuantity(itemId, action) {
    // Select the item if not already selected
    if (selectedItemId !== itemId) {
        selectItem(itemId);
    }

    // Update quantity
    if (action === 'add') {
        cartData[itemId].quantity++;
    } else if (action === 'subtract' && cartData[itemId].quantity > 0) {
        cartData[itemId].quantity--;
    }

    // Update display
    const qtyDisplay = document.querySelector(`.qty-display[data-id="${itemId}"]`);
    qtyDisplay.textContent = cartData[itemId].quantity;

    // Update item total
    const itemTotal = cartData[itemId].quantity * cartData[itemId].price;
    const totalDisplay = document.querySelector(`.total-amount[data-id="${itemId}"]`);
    totalDisplay.textContent = itemTotal.toFixed(2);

    updateSummary();
}

function calculateTotal() {
    if (!selectedItemId) return 0;
    return cartData[selectedItemId].quantity * cartData[selectedItemId].price;
}

function updateSummary() {
    if (!selectedItemId || cartData[selectedItemId].quantity === 0) {
        document.getElementById('departure-info').textContent = '-';
        document.getElementById('arrival-info').textContent = '-';
        document.getElementById('ticket-quantity').textContent = '0';
        document.getElementById('grand-total').textContent = '0';
        return;
    }

    const selectedData = cartData[selectedItemId];
    
    document.getElementById('departure-info').textContent = selectedData.departure;
    document.getElementById('arrival-info').textContent = selectedData.arrival;
    document.getElementById('ticket-quantity').textContent = selectedData.quantity;
    document.getElementById('grand-total').textContent = calculateTotal();
}