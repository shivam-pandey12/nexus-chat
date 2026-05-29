import { cn, tw } from './ui/premium.js';

export default function BillingPage({
  billingStatus,
  billingSummary,
  isLoggedIn,
  loading,
  busyProductId,
  onRefresh,
  onBuy,
  onLogin,
  onBack,
}) {
  const planTier = billingSummary?.planTier || 'free';
  const activeEntitlements = billingSummary?.activeEntitlements || [];
  const oneTimePurchases = activeEntitlements.filter((item) => item.type === 'cosmetic');
  const payments = billingSummary?.payments || [];

  return (
    <main className={cn('billing-page premium-page', tw.pageWide, 'space-y-6')}>
      <section className={cn('rooms-header section-header section-header--row', tw.glass, 'flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between')}>
        <div>
          <p className={cn('eyebrow', tw.eyebrow)}>Billing</p>
          <h1 className="text-4xl font-black tracking-normal text-[var(--text)] sm:text-5xl">Your Nexus access</h1>
          <p className={tw.subcopy}>Review active entitlements, checkout history, and premium access status.</p>
        </div>
        <div className="rooms-header__actions flex flex-wrap gap-3">
          <button className={cn('button button--ghost', tw.buttonGhost)} type="button" onClick={onBack}>Back</button>
          <button className={cn('button button--soft', tw.buttonSoft)} type="button" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </section>

      {!isLoggedIn ? (
        <section className={cn('panel billing-hero', tw.glassSoft, 'mx-auto max-w-2xl p-7 text-center')}>
          <p className="eyebrow">Login required</p>
          <h2>Login to manage billing</h2>
          <p>Guests can keep chatting for free. Purchases and billing history require account login.</p>
          <button className={cn('button button--primary', tw.buttonPrimary)} type="button" onClick={onLogin}>Login to buy</button>
        </section>
      ) : (
        <>
          {!billingStatus?.enabled && (
            <div className="notice">Billing is disabled or missing Razorpay env. Existing free chat remains available.</div>
          )}
          <section className="billing-grid billing-dashboard grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <article className={cn('panel billing-plan-card', tw.glassSoft, 'p-5')}>
              <p className="eyebrow">Current plan</p>
              <h2>{formatPlan(planTier)}</h2>
              <p>{billingStatus?.testMode ? 'Razorpay test mode is active.' : 'Premium access is resolved from Firestore entitlements.'}</p>
              <div className="billing-plan-meter">
                <span>Plan status</span>
                <strong>{activeEntitlements.some((item) => item.planTier === planTier) ? 'Active entitlement' : 'Free access'}</strong>
              </div>
              <div className="billing-actions">
                {['nexus_plus_monthly', 'nexus_pro_monthly', 'nexus_community_monthly'].map((productId) => (
                  <button
                    className={cn('button button--soft', tw.buttonSoft)}
                    key={productId}
                    type="button"
                    disabled={!billingStatus?.enabled || busyProductId === productId}
                    onClick={() => onBuy(productId)}
                  >
                    {busyProductId === productId ? 'Opening...' : labelForProduct(productId)}
                  </button>
                ))}
              </div>
            </article>

            <article className={cn('panel billing-list-card', tw.glassSoft, 'p-5')}>
              <p className="eyebrow">Active entitlements</p>
              {activeEntitlements.length === 0 ? (
                <p className="muted">No premium entitlements yet.</p>
              ) : (
                <div className="billing-list">
                  {activeEntitlements.map((item) => (
                    <div className="billing-row" key={item.entitlementId}>
                      <strong>{item.productId}</strong>
                      <span>{item.status} · {item.expiresAt ? `expires ${formatDate(item.expiresAt)}` : 'owned'}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className={cn('panel billing-list-card', tw.glassSoft, 'p-5')}>
              <p className="eyebrow">One-time purchases</p>
              {oneTimePurchases.length === 0 ? (
                <p className="muted">No cosmetics or supporter packs yet.</p>
              ) : (
                <div className="billing-list">
                  {oneTimePurchases.map((item) => (
                    <div className="billing-row" key={`one_${item.entitlementId}`}>
                      <strong>{item.productId}</strong>
                      <span>{item.status} · owned</span>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className={cn('panel billing-list-card billing-list-card--wide', tw.glassSoft, 'p-5 lg:col-span-2 xl:col-span-3')}>
              <p className="eyebrow">Payment history</p>
              {payments.length === 0 ? (
                <p className="muted">No payment records yet.</p>
              ) : (
                <div className="billing-list">
                  {payments.map((payment) => (
                    <div className="billing-row" key={payment.paymentId}>
                      <strong>{payment.productId}</strong>
                      <span>{payment.status} · {payment.currency} {Number(payment.amount || 0) / 100}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </main>
  );
}

function labelForProduct(productId) {
  if (productId.includes('community')) return 'Community';
  if (productId.includes('pro')) return 'Pro';
  return 'Plus';
}

function formatPlan(planTier) {
  return `Nexus ${planTier.charAt(0).toUpperCase()}${planTier.slice(1)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat([], { dateStyle: 'medium' }).format(new Date(value));
}
