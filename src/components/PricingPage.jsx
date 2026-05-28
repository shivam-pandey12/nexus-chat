import { PRODUCT_CATALOG, PLAN_LIMITS } from '../../shared/billingCatalog.js';
import { cn, tw } from './ui/premium.js';

const PLAN_ORDER = ['free', 'plus', 'pro', 'community'];

export default function PricingPage({ billingStatus, billingSummary, isLoggedIn, busyProductId, onBuy, onLogin, onBack }) {
  const currentPlan = billingSummary?.planTier || 'free';

  return (
    <main className={cn('pricing-page premium-page', tw.pageWide, 'space-y-6')}>
      <section className={cn('rooms-header section-header section-header--row', tw.glass, 'flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between')}>
        <div>
          <p className={cn('eyebrow', tw.eyebrow)}>Nexus Premium</p>
          <h1 className="text-4xl font-black tracking-normal text-[var(--text)] sm:text-5xl">Upgrade hosting, not basic conversation</h1>
          <p className={tw.subcopy}>Free chat stays free. Premium adds bigger rooms, durable hosting controls, themes, analytics, and profile polish.</p>
        </div>
        <button className={cn('button button--ghost', tw.buttonGhost)} type="button" onClick={onBack}>Back</button>
      </section>

      {!billingStatus?.enabled && (
        <div className="notice">Billing is disabled here. You can review plans, but checkout is safely unavailable.</div>
      )}

      <section className="pricing-grid grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_ORDER.map((tier) => {
          const product = productForTier(tier);
          const limits = PLAN_LIMITS[tier];
          const isCurrent = currentPlan === tier;
          const recommended = tier === 'pro';
          return (
            <article className={cn(`pricing-card pricing-card--${tier} ${isCurrent ? 'is-current' : ''} ${recommended ? 'is-recommended' : ''}`, tw.card, recommended ? 'ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_76%)]' : '')} key={tier}>
              {recommended && <span className="recommended-badge">Recommended</span>}
              <p className="eyebrow">{tier === 'free' ? 'Free' : product.title}</p>
              <h2>{tier === 'free' ? 'Nexus Free' : product.title}</h2>
              <strong className="price-line">{tier === 'free' ? 'INR 0' : `INR ${product.priceINR}/mo`}</strong>
              <p>{bestFor(tier)}</p>
              <ul>
                <li>{limits.activeRooms} active created rooms</li>
                <li>Up to {limits.roomMembers} room members</li>
                <li>{limits.favorites} favorite rooms</li>
                <li>{limits.maxModeratorsPerRoom} moderators per room</li>
                <li>{limits.roomAnalytics ? 'Room analytics lite' : 'Basic room controls'}</li>
                <li>{limits.customInviteSlug ? 'Custom invite slug ready' : 'Standard invite links'}</li>
              </ul>
              {isCurrent ? (
                <button className={cn('button button--soft button--wide', tw.buttonSoft, 'w-full')} type="button" disabled>Current plan</button>
              ) : tier === 'free' ? (
                <button className={cn('button button--ghost button--wide', tw.buttonGhost, 'w-full')} type="button" disabled>Always available</button>
              ) : !isLoggedIn ? (
                <button className={cn('button button--primary button--wide', tw.buttonPrimary, 'w-full')} type="button" onClick={onLogin}>Login to buy</button>
              ) : (
                <button
                  className={cn('button button--primary button--wide', tw.buttonPrimary, 'w-full')}
                  type="button"
                  disabled={!billingStatus?.enabled || busyProductId === product.productId}
                  onClick={() => onBuy(product.productId)}
                >
                  {busyProductId === product.productId ? 'Opening checkout...' : `Start ${product.title}`}
                </button>
              )}
            </article>
          );
        })}
      </section>

      <section className={cn('pricing-faq premium-card', tw.glassSoft, 'space-y-5 p-5 sm:p-7')}>
        <div className="section-header">
          <p className="eyebrow">Premium FAQ</p>
          <h2>Clear, calm monetization.</h2>
        </div>
        <div className="faq-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ['Is basic chat free?', 'Yes. Joining public rooms, basic messages, replies, reactions, reporting, blocking, and safety tools stay free.'],
            ['Do I need login?', 'Only purchases and saved billing access require Google login. Guest chat remains first-class.'],
            ['What do premium themes unlock?', 'Premium themes add owned visual room styles and profile cosmetics without changing message readability.'],
            ['Can I cancel?', 'This MVP stores period entitlements. Full subscription lifecycle and cancellation automation are a production hardening step.'],
            ['Is safety paid?', 'No. Reporting, blocking, and basic owner moderation are never paywalled.'],
          ].map(([question, answer]) => (
            <article className={cn('faq-card', tw.cardCompact)} key={question}>
              <h3>{question}</h3>
              <p>{answer}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function productForTier(tier) {
  return PRODUCT_CATALOG.find((product) => product.planTier === tier && product.durationDays === 30);
}

function bestFor(tier) {
  if (tier === 'free') return 'Best for casual rooms and quick conversations.';
  if (tier === 'plus') return 'Best for regular hosts and small groups.';
  if (tier === 'pro') return 'Best for focused creators, study rooms, and events.';
  return 'Best for community hosts and recurring large rooms.';
}
