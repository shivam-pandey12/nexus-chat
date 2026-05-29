import crypto from 'node:crypto';

import Razorpay from 'razorpay';

import { getProduct, listPublicProducts } from '../../shared/billingCatalog.js';
import { sanitizeReportDetails } from './safetyService.js';

const INR_TO_PAISE = 100;

export function createBillingService({ repositories = {}, entitlementService }) {
  const billingRepository = repositories.billingRepository || {};
  const razorpay = createRazorpayClient();

  function getStatus() {
    const enabled = isBillingEnabled();
    const configured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

    return {
      enabled: enabled && configured,
      provider: 'razorpay',
      state: enabled && configured ? 'ready' : enabled ? 'missing_env' : 'disabled',
      testMode: isTestMode(),
      checkoutConfigId: process.env.RAZORPAY_CHECKOUT_CONFIG_ID || '',
    };
  }

  function getPublicCatalog() {
    return {
      billing: getStatus(),
      products: listPublicProducts(),
      keyId: getStatus().enabled ? process.env.RAZORPAY_KEY_ID : '',
    };
  }

  async function createOrder(user, productId) {
    requireBillingReady();
    requireUser(user);

    const product = requireProduct(productId);
    const now = new Date().toISOString();
    const amount = Math.round(Number(product.priceINR) * INR_TO_PAISE);
    const currency = 'INR';
    const paymentId = createId('payment');
    const receipt = `nexus_${paymentId}`.slice(0, 40);
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt,
      notes: {
        paymentId,
        productId: product.productId,
        userId: user.userId,
      },
    });

    const payment = {
      paymentId,
      orderId: paymentId,
      userId: user.userId,
      amount,
      currency,
      productId: product.productId,
      status: 'order_created',
      razorpayPaymentId: '',
      razorpayOrderId: order.id,
      razorpaySignatureVerified: false,
      createdAt: now,
      updatedAt: now,
      rawEventRef: '',
      metadata: {
        productTitle: product.title,
        testMode: isTestMode(),
      },
    };

    await billingRepository.savePayment?.(payment);
    await saveBillingEvent({
      eventId: `order_created_${paymentId}`,
      type: 'order.created',
      userId: user.userId,
      paymentId,
      orderId: order.id,
      productId: product.productId,
      status: 'processed',
      source: 'server',
      metadata: { amount, currency },
    });

    return {
      orderId: order.id,
      paymentId,
      amount,
      currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      checkoutConfigId: process.env.RAZORPAY_CHECKOUT_CONFIG_ID || '',
      product: publicProduct(product),
      testMode: isTestMode(),
    };
  }

  async function verifyPayment(user, payload = {}) {
    requireBillingReady();
    requireUser(user);

    const orderId = String(payload.razorpay_order_id || '').trim();
    const razorpayPaymentId = String(payload.razorpay_payment_id || '').trim();
    const signature = String(payload.razorpay_signature || '').trim();

    if (!orderId || !razorpayPaymentId || !signature) {
      throw new Error('Payment verification payload is incomplete.');
    }

    const payment = await billingRepository.findPaymentByOrderId?.(orderId);

    if (!payment || payment.userId !== user.userId) {
      throw new Error('Payment order was not found for this user.');
    }

    if (!verifyCheckoutSignature({ orderId, paymentId: razorpayPaymentId, signature })) {
      await billingRepository.updatePayment?.(payment.userId, payment.paymentId, {
        status: 'signature_failed',
        razorpayPaymentId,
        updatedAt: new Date().toISOString(),
      });
      throw new Error('Payment signature could not be verified.');
    }

    const entitlement = await grantEntitlementForPayment(payment, {
      razorpayPaymentId,
      rawEventRef: `checkout_${razorpayPaymentId}`,
      source: 'razorpay',
      status: 'captured',
    });

    await saveBillingEvent({
      eventId: `payment_verified_${razorpayPaymentId}`,
      type: 'payment.verified',
      userId: user.userId,
      paymentId: payment.paymentId,
      orderId,
      productId: payment.productId,
      status: 'processed',
      source: 'checkout',
      metadata: { entitlementId: entitlement.entitlementId },
    });

    return {
      entitlement,
      summary: await entitlementService.getSummary(user.userId),
      payment: sanitizePayment({ ...payment, razorpayPaymentId, status: 'captured', razorpaySignatureVerified: true }),
    };
  }

  async function handleWebhook(rawBody, signature) {
    requireBillingReady();

    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      throw new Error('Razorpay webhook secret is not configured.');
    }

    const rawText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody || '');

    if (!verifyWebhookSignature(rawText, signature)) {
      throw new Error('Webhook signature could not be verified.');
    }

    const event = JSON.parse(rawText || '{}');
    const eventId = String(event.id || `webhook_${sha256(rawText)}`).slice(0, 160);
    const existing = await billingRepository.getBillingEvent?.(eventId);

    if (existing?.status === 'processed') {
      return { ok: true, duplicate: true };
    }

    await saveBillingEvent({
      eventId,
      type: event.event || 'unknown',
      status: 'received',
      source: 'webhook',
      metadata: safeWebhookMetadata(event),
    });

    const result = await processWebhookEvent(event, eventId);
    await saveBillingEvent({
      eventId,
      type: event.event || 'unknown',
      status: 'processed',
      source: 'webhook',
      metadata: { ...safeWebhookMetadata(event), result },
    });

    return { ok: true, result };
  }

  async function getBillingSummary(userId) {
    const [summary, payments] = await Promise.all([
      entitlementService.getSummary(userId),
      billingRepository.listPayments?.(userId, 100),
    ]);

    return {
      billing: getStatus(),
      ...summary,
      payments: (payments || []).map(sanitizePayment),
    };
  }

  async function getBillingHistory(userId) {
    const payments = await billingRepository.listPayments?.(userId, 100);
    return { payments: (payments || []).map(sanitizePayment) };
  }

  async function getAdminBillingOverview() {
    const [events, entitlements, payments] = await Promise.all([
      billingRepository.listBillingEvents?.(100),
      billingRepository.listRecentEntitlements?.(100),
      billingRepository.listRecentPayments?.(100),
    ]);

    return {
      billing: getStatus(),
      events: (events || []).map(sanitizeBillingEvent),
      entitlements: (entitlements || []).map(sanitizeEntitlement),
      payments: (payments || []).map(sanitizePayment),
    };
  }

  async function grantTestEntitlement({ admin, userId, productId, reason = '' }) {
    const product = requireProduct(productId);
    const entitlement = await entitlementService.grantProduct({
      userId,
      productId: product.productId,
      source: 'admin',
      sourceRef: `admin_${product.productId}_${Date.now()}`,
      metadata: {
        reason: sanitizeReportDetails(reason),
        actorSessionId: admin?.sessionId || 'admin',
        actorUserId: admin?.userId || null,
      },
    });

    await saveBillingEvent({
      eventId: `admin_grant_${entitlement.entitlementId}`,
      type: 'admin.entitlement.grant',
      userId,
      productId: product.productId,
      status: 'processed',
      source: 'admin',
      metadata: {
        entitlementId: entitlement.entitlementId,
        reason: sanitizeReportDetails(reason),
        actorName: admin?.displayName || 'Admin',
      },
    });

    return entitlement;
  }

  async function revokeTestEntitlement({ admin, userId, entitlementId, reason = '' }) {
    const result = await entitlementService.revokeEntitlement({
      userId,
      entitlementId,
      actor: admin?.displayName || 'Admin',
      reason,
    });

    await saveBillingEvent({
      eventId: `admin_revoke_${entitlementId}_${Date.now()}`,
      type: 'admin.entitlement.revoke',
      userId,
      status: 'processed',
      source: 'admin',
      metadata: {
        entitlementId,
        reason: sanitizeReportDetails(reason),
        actorName: admin?.displayName || 'Admin',
      },
    });

    return result;
  }

  async function processWebhookEvent(event, eventId) {
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;
    const eventName = event.event || 'unknown';

    if (eventName === 'payment.captured' && paymentEntity?.order_id) {
      const payment = await billingRepository.findPaymentByOrderId?.(paymentEntity.order_id);

      if (!payment) {
        return { ignored: true, reason: 'order_not_found' };
      }

      const entitlement = await grantEntitlementForPayment(payment, {
        razorpayPaymentId: paymentEntity.id,
        rawEventRef: eventId,
        source: 'razorpay',
        status: 'captured',
      });
      return { granted: true, entitlementId: entitlement.entitlementId };
    }

    if (eventName === 'order.paid' && orderEntity?.id) {
      const payment = await billingRepository.findPaymentByOrderId?.(orderEntity.id);

      if (!payment) {
        return { ignored: true, reason: 'order_not_found' };
      }

      const entitlement = await grantEntitlementForPayment(payment, {
        razorpayPaymentId: payment.razorpayPaymentId || orderEntity.id,
        rawEventRef: eventId,
        source: 'razorpay',
        status: 'captured',
      });
      return { granted: true, entitlementId: entitlement.entitlementId };
    }

    if (eventName === 'payment.failed' && paymentEntity?.order_id) {
      const payment = await billingRepository.findPaymentByOrderId?.(paymentEntity.order_id);

      if (payment) {
        await billingRepository.updatePayment?.(payment.userId, payment.paymentId, {
          status: 'failed',
          razorpayPaymentId: paymentEntity.id || '',
          rawEventRef: eventId,
          updatedAt: new Date().toISOString(),
        });
      }

      return { failed: true };
    }

    return { ignored: true, reason: 'event_not_handled' };
  }

  async function grantEntitlementForPayment(payment, { razorpayPaymentId, rawEventRef, source, status }) {
    const now = new Date().toISOString();
    const entitlement = await entitlementService.grantProduct({
      userId: payment.userId,
      productId: payment.productId,
      source,
      // Checkout verification and Razorpay webhook events can arrive in any order.
      // Keep every successful payment path on one stable server-owned entitlement key.
      sourceRef: payment.paymentId,
      metadata: {
        paymentId: payment.paymentId,
        razorpayOrderId: payment.razorpayOrderId,
        razorpayPaymentId,
      },
    });

    await billingRepository.updatePayment?.(payment.userId, payment.paymentId, {
      status,
      razorpayPaymentId,
      razorpaySignatureVerified: true,
      rawEventRef,
      updatedAt: now,
    });

    return entitlement;
  }

  async function saveBillingEvent(event) {
    const now = new Date().toISOString();
    const safeEvent = {
      eventId: event.eventId,
      type: event.type || 'unknown',
      userId: event.userId || '',
      paymentId: event.paymentId || '',
      orderId: event.orderId || '',
      productId: event.productId || '',
      status: event.status || 'received',
      source: event.source || 'server',
      createdAt: event.createdAt || now,
      updatedAt: now,
      metadata: event.metadata || {},
    };
    await billingRepository.saveBillingEvent?.(safeEvent);
    return safeEvent;
  }

  return {
    createOrder,
    getAdminBillingOverview,
    getBillingHistory,
    getBillingSummary,
    getPublicCatalog,
    getStatus,
    grantTestEntitlement,
    handleWebhook,
    revokeTestEntitlement,
    verifyPayment,
  };
}

function createRazorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

function requireBillingReady() {
  if (!isBillingEnabled()) {
    throw new Error('Billing is disabled. Free chat remains available.');
  }

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Billing is not configured yet.');
  }
}

function requireUser(user) {
  if (!user?.userId) {
    throw new Error('Account login is required for purchases.');
  }
}

function requireProduct(productId) {
  const product = getProduct(productId);

  if (!product) {
    throw new Error('Product was not found.');
  }

  return product;
}

function verifyCheckoutSignature({ orderId, paymentId, signature }) {
  const expected = hmac(`${orderId}|${paymentId}`, process.env.RAZORPAY_KEY_SECRET);
  return timingSafeEqual(expected, signature);
}

function verifyWebhookSignature(rawText, signature) {
  const expected = hmac(rawText, process.env.RAZORPAY_WEBHOOK_SECRET);
  return timingSafeEqual(expected, String(signature || ''));
}

function hmac(value, secret) {
  return crypto.createHmac('sha256', secret || '').update(value).digest('hex');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function isBillingEnabled() {
  return String(process.env.BILLING_ENABLED || '').toLowerCase() === 'true';
}

function isTestMode() {
  return String(process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_test_');
}

function publicProduct(product) {
  return {
    productId: product.productId,
    title: product.title,
    description: product.description,
    type: product.type,
    planTier: product.planTier || null,
    priceINR: product.priceINR,
    durationDays: product.durationDays,
  };
}

function sanitizePayment(payment = {}) {
  return {
    paymentId: payment.paymentId,
    orderId: payment.orderId,
    userId: payment.userId,
    amount: payment.amount,
    currency: payment.currency,
    productId: payment.productId,
    status: payment.status,
    razorpayPaymentId: payment.razorpayPaymentId || '',
    razorpayOrderId: payment.razorpayOrderId || '',
    razorpaySignatureVerified: Boolean(payment.razorpaySignatureVerified),
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    rawEventRef: payment.rawEventRef || '',
    metadata: payment.metadata || {},
  };
}

function sanitizeEntitlement(entitlement = {}) {
  return {
    entitlementId: entitlement.entitlementId,
    userId: entitlement.userId,
    type: entitlement.type,
    productId: entitlement.productId,
    planTier: entitlement.planTier || null,
    status: entitlement.status,
    startsAt: entitlement.startsAt,
    expiresAt: entitlement.expiresAt || null,
    source: entitlement.source,
    createdAt: entitlement.createdAt,
    updatedAt: entitlement.updatedAt,
    metadata: entitlement.metadata || {},
  };
}

function sanitizeBillingEvent(event = {}) {
  return {
    eventId: event.eventId,
    type: event.type,
    userId: event.userId || '',
    paymentId: event.paymentId || '',
    orderId: event.orderId || '',
    productId: event.productId || '',
    status: event.status,
    source: event.source,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    metadata: event.metadata || {},
  };
}

function safeWebhookMetadata(event = {}) {
  const payment = event.payload?.payment?.entity;
  const order = event.payload?.order?.entity;

  return {
    eventName: event.event || 'unknown',
    razorpayPaymentId: payment?.id || '',
    razorpayOrderId: payment?.order_id || order?.id || '',
    status: payment?.status || order?.status || '',
  };
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}
