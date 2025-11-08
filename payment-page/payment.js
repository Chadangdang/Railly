// Get cart data from localStorage or use sample data
function getCartData() {
    const stored = localStorage.getItem('selectedCartItem');
    if (stored) {
        return JSON.parse(stored);
    }
    
    // Default data if nothing in localStorage
    return {
        quantity: 1,
        price: 20,
        date: '08 OCT 2024',
        departure: '08 October 2024, 15:10 - Krung Thep Aphiwat Central Terminal Station',
        arrival: '08 October 2024, 15:41 - Ayutthaya Station'
    };
}

// Initialize page with cart data
function initializePage() {
    const cartData = getCartData();
    const total = cartData.quantity * cartData.price;
    
    // Update departure info
    document.getElementById('departure-info').textContent = cartData.departure;
    
    // Update arrival info
    document.getElementById('arrival-info').textContent = cartData.arrival;
    
    // Update ticket info (quantity is shown in total-amount initially)
    document.getElementById('total-amount').textContent = `${cartData.quantity > 1 ? cartData.quantity + ' tickets' : '1 ticket'}`;
    
    // Update total
    document.getElementById('grand-total').textContent = `${total} BTH`;
    
    // Store total for later use
    window.paymentTotal = total;
}

// Handle payment method selection
function setupPaymentMethods() {
    const paymentOptions = document.querySelectorAll('.payment-option');
    
    paymentOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Remove checked from all
            document.querySelectorAll('input[name="payment"]').forEach(radio => {
                radio.checked = false;
            });
            
            // Check this one
            const radio = this.querySelector('input[name="payment"]');
            radio.checked = true;
            
            // Update info box based on payment method
            updatePaymentInfo(radio.value);
        });
    });
}

// Update payment info box based on selected method
function updatePaymentInfo(method) {
    const infoBox = document.querySelector('.payment-info-box');
    const title = infoBox.querySelector('h3');
    const description = infoBox.querySelector('p');
    
    switch(method) {
        case 'qr':
            title.textContent = 'Payment via PromptPay';
            description.textContent = 'You will be redirected to PromptPay to complete the payment';
            break;
        case 'card':
            title.textContent = 'Payment via Credit/Debit Card';
            description.textContent = 'You will be redirected to secure card payment gateway';
            break;
        case 'truemoney':
            title.textContent = 'Payment via TrueMoney';
            description.textContent = 'You will be redirected to TrueMoney to complete the payment';
            break;
    }
}

// Process payment (simulate transaction)
function processPayment() {
    const selectedMethod = document.querySelector('input[name="payment"]:checked');
    
    if (!selectedMethod) {
        alert('Please select a payment method');
        return;
    }
    
    // Show loading state
    const continueBtn = document.getElementById('continue-btn');
    const originalText = continueBtn.textContent;
    continueBtn.textContent = 'PROCESSING...';
    continueBtn.disabled = true;
    
    // Simulate payment processing (70% success rate)
    setTimeout(() => {
        continueBtn.textContent = originalText;
        continueBtn.disabled = false;
        
        const success = Math.random() > 0.3; // 70% success rate
        
        if (success) {
            showSuccessModal();
        } else {
            showFailedModal();
        }
    }, 2000);
}

// Show success modal
function showSuccessModal() {
    const modal = document.getElementById('success-modal');
    const paidAmount = document.getElementById('paid-amount');
    
    paidAmount.textContent = `${window.paymentTotal.toFixed(2)} BTH`;
    modal.classList.add('active');
}

// Show failed modal
function showFailedModal() {
    const modal = document.getElementById('failed-modal');
    modal.classList.add('active');
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
}

// Handle success - go to ticket page or home
function handleSuccess() {
    closeModal('success-modal');
    // Clear cart data
    localStorage.removeItem('selectedCartItem');
    // Redirect to my ticket page or home
    alert('Redirecting to My Tickets page...');
    // window.location.href = 'my-ticket.html';
}

// Go back to cart
function goToCart() {
    closeModal('failed-modal');
    // window.location.href = 'cart.html';
    alert('Redirecting to Cart page...');
}

// Retry payment
function retryPayment() {
    closeModal('failed-modal');
    processPayment();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializePage();
    setupPaymentMethods();
    
    // Set default payment method
    document.getElementById('qr-payment').checked = true;
    
    // Continue button handler
    document.getElementById('continue-btn').addEventListener('click', processPayment);
    
    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
});