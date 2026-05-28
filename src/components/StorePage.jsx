import { PRODUCT_CATALOG, PROFILE_COSMETICS, ROOM_THEME_PRESETS } from '../../shared/billingCatalog.js';
import { getCategoryOptions } from '../../shared/categoryConfig.js';
import CategoryBadge from './CategoryBadge.jsx';
import { cn, tw } from './ui/premium.js';

export default function StorePage({
  billingStatus,
  billingSummary,
  profile,
  room,
  isRoomOwner,
  isLoggedIn = false,
  busyProductId,
  onBuy,
  onApplyRoomTheme,
  onApplyProfileCosmetic,
  onLogin,
  onBack,
}) {
  const ownedProductIds = billingSummary?.ownedProductIds || [];
  const ownedThemeIds = billingSummary?.ownedThemeIds || ['classic'];
  const ownedCosmeticIds = billingSummary?.ownedCosmeticIds || [];
  const ownedBadgeIds = billingSummary?.ownedBadgeIds || [];
  return (
    <main className={cn('store-page premium-page', tw.pageWide, 'space-y-6')}>
      <section className={cn('rooms-header section-header section-header--row', tw.glass, 'flex flex-col gap-5 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between')}>
        <div>
          <p className={cn('eyebrow', tw.eyebrow)}>Nexus Store</p>
          <h1 className="text-4xl font-black tracking-normal text-[var(--text)] sm:text-5xl">Cosmetics with real presence</h1>
          <p className={tw.subcopy}>Premium visual upgrades for hosts and profiles. Safety and basic chat stay free.</p>
        </div>
        <button className={cn('button button--ghost', tw.buttonGhost)} type="button" onClick={onBack}>Back</button>
      </section>

      {!billingStatus?.enabled && (
        <div className="notice">Store checkout is disabled here. Preview remains available.</div>
      )}

      <section className={cn('store-section', tw.glassSoft, 'space-y-5 p-5 sm:p-7')}>
        <div className="section-header">
          <p className="eyebrow">Room themes</p>
          <h2>Visible premium hosting</h2>
        </div>
        <div className="store-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {ROOM_THEME_PRESETS.filter((theme) => theme.themeId !== 'classic').map((theme) => {
            const product = PRODUCT_CATALOG.find((item) => item.productId === theme.productId);
            const owned = ownedThemeIds.includes(theme.themeId) || ownedProductIds.includes(theme.productId);
            const applied = room?.themeId === theme.themeId;
            return (
              <article className={cn(`store-card store-card--theme theme-preview--${theme.themeId}`, tw.card)} key={theme.themeId}>
                <ThemePreview theme={theme} />
                <h3>{theme.title}</h3>
                <p>{theme.description}</p>
                <div className="theme-category-fit" aria-label={`${theme.title} category fit`}>
                  {getThemeCategoryFit(theme.themeId).map((category) => <CategoryBadge category={category.slug} compact key={category.slug} />)}
                </div>
                <strong>{product ? `INR ${product.priceINR}` : 'Included'}</strong>
                <StoreAction
                  owned={owned}
                  enabled={billingStatus?.enabled}
                  loggedIn={isLoggedIn}
                  busy={busyProductId === theme.productId}
                  canApply={owned && Boolean(room?.roomId && isRoomOwner) && !applied}
                  applied={applied}
                  buyLabel="Buy theme"
                  applyLabel={applied ? 'Applied' : 'Apply to room'}
                  onBuy={() => onBuy(theme.productId)}
                  onApply={() => onApplyRoomTheme(theme.themeId)}
                  onLogin={onLogin}
                />
              </article>
            );
          })}
        </div>
      </section>

      <section className={cn('store-section', tw.glassSoft, 'space-y-5 p-5 sm:p-7')}>
        <div className="section-header">
          <p className="eyebrow">Profile cosmetics</p>
          <h2>Identity polish</h2>
        </div>
        <div className="store-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {PROFILE_COSMETICS.map((cosmetic) => {
            const product = PRODUCT_CATALOG.find((item) => item.productId === cosmetic.productId);
            const owned = ownedProductIds.includes(cosmetic.productId) || ownedCosmeticIds.includes(cosmetic.cosmeticId) || ownedBadgeIds.includes(cosmetic.cosmeticId);
            const applied =
              cosmetic.type === 'profileRing'
                ? profile?.profileRingId === cosmetic.cosmeticId
                : profile?.badgeIds?.includes?.(cosmetic.cosmeticId);
            return (
              <article className={cn('store-card store-card--cosmetic', tw.card)} key={cosmetic.cosmeticId}>
                <ProfilePreview cosmetic={cosmetic} />
                <h3>{cosmetic.title}</h3>
                <p>{product?.description}</p>
                <strong>INR {product?.priceINR}</strong>
                <StoreAction
                  owned={owned}
                  enabled={billingStatus?.enabled}
                  loggedIn={isLoggedIn}
                  busy={busyProductId === cosmetic.productId}
                  canApply={owned && !applied}
                  applied={applied}
                  buyLabel="Buy cosmetic"
                  applyLabel={applied ? 'Applied' : 'Apply'}
                  onBuy={() => onBuy(cosmetic.productId)}
                  onApply={() => onApplyProfileCosmetic(cosmetic)}
                  onLogin={onLogin}
                />
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function getThemeCategoryFit(themeId) {
  return getCategoryOptions()
    .filter((category) => category.premiumThemeSuggestions.includes(themeId))
    .slice(0, 3);
}

function StoreAction({ owned, enabled, loggedIn, busy, canApply, applied = false, buyLabel, applyLabel, onBuy, onApply, onLogin }) {
  if (!loggedIn) {
    return <button className={cn('button button--primary button--wide', tw.buttonPrimary, 'w-full')} type="button" onClick={onLogin}>Login to buy</button>;
  }

  if (owned) {
    return (
      <button className={cn('button button--soft button--wide', tw.buttonSoft, 'w-full')} type="button" disabled={!canApply} onClick={onApply}>
        {applied ? 'Applied' : canApply ? applyLabel : 'Owned'}
      </button>
    );
  }

  return (
    <button className={cn('button button--primary button--wide', tw.buttonPrimary, 'w-full')} type="button" disabled={!enabled || busy} onClick={onBuy}>
      {busy ? 'Opening checkout...' : buyLabel}
    </button>
  );
}

function ThemePreview({ theme }) {
  return (
    <div className="theme-preview">
      <span style={{ background: theme.swatches[0] }} />
      <span style={{ background: theme.swatches[1] }} />
      <span style={{ background: theme.swatches[2] }} />
      <div>
        <i />
        <strong>{theme.title}</strong>
        <em>Room preview</em>
      </div>
    </div>
  );
}

function ProfilePreview({ cosmetic }) {
  return (
    <div className={`cosmetic-preview cosmetic-preview--${cosmetic.cosmeticId}`}>
      <span>N</span>
      <strong>{cosmetic.type === 'badge' ? 'Supporter' : 'Orbit Ring'}</strong>
    </div>
  );
}
