const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

export async function openRazorpayCheckout({ order, profile, onSuccess, onFailure }) {
  await ensureRazorpayScript();

  if (!window.Razorpay) {
    throw new Error('Razorpay checkout could not be loaded.');
  }

  return new Promise((resolve, reject) => {
    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'Nexus Chat',
      description: order.product?.title || 'Nexus premium access',
      order_id: order.orderId,
      config: order.checkoutConfigId ? { display: { config_id: order.checkoutConfigId } } : undefined,
      prefill: {
        name: profile?.displayName || 'NexusUser',
      },
      notes: {
        productId: order.product?.productId || '',
      },
      theme: {
        color: '#b98852',
      },
      retry: {
        enabled: true,
        max_count: 2,
      },
      handler(response) {
        onSuccess?.(response);
        resolve(response);
      },
      modal: {
        ondismiss() {
          onFailure?.(new Error('Payment window closed.'));
          reject(new Error('Payment window closed.'));
        },
      },
    });

    checkout.open();
  });
}

function ensureRazorpayScript() {
  if (window.Razorpay) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`);

    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Razorpay checkout script failed to load.'));
    document.head.appendChild(script);
  });
}
