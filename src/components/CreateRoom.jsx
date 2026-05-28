import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_TEMP_ROOM_EXPIRY_MS,
  TEMP_ROOM_EXPIRY_OPTIONS,
} from '../../shared/chatConfig.js';
import { ROOM_THEME_PRESETS } from '../../shared/billingCatalog.js';
import {
  getCategoryConfig,
  getCategoryDefaultRules,
  getCategoryOptions,
  getCategoryRoomTemplates,
  getCategorySlug,
} from '../../shared/categoryConfig.js';
import CategoryBadge from './CategoryBadge.jsx';
import { cn, tw } from './ui/premium.js';

export default function CreateRoom({ defaultType = 'public', billingSummary, onCreate, onBack }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(getCategorySlug('random'));
  const [type, setType] = useState(defaultType);
  const [expiresInMs, setExpiresInMs] = useState(DEFAULT_TEMP_ROOM_EXPIRY_MS);
  const [roomPurpose, setRoomPurpose] = useState('');
  const [rulesDraft, setRulesDraft] = useState('');
  const [templateId, setTemplateId] = useState('');
  const categoryOptions = useMemo(() => getCategoryOptions(), []);
  const selectedCategory = getCategoryConfig(category);
  const templates = useMemo(() => getCategoryRoomTemplates(category), [category]);
  const selectedTemplate = templates.find((template) => template.templateId === templateId) || null;

  useEffect(() => {
    setType(defaultType);
  }, [defaultType]);

  function handleSubmit(event) {
    event.preventDefault();
    onCreate({
      title,
      category,
      type,
      expiresInMs: type === 'temp' ? expiresInMs : undefined,
      roomPurpose,
      rules: rulesDraft,
      templateId,
    });
  }

  function chooseCategory(nextCategory) {
    const nextConfig = getCategoryConfig(nextCategory);
    setCategory(nextConfig.slug);

    if (templateId) {
      setTitle('');
      setRoomPurpose('');
      setRulesDraft('');
    }

    setTemplateId('');

    if (!nextConfig.allowedRoomTypes.includes(type)) {
      setType(nextConfig.defaultRoomTypeSuggestion);
    }
  }

  function chooseTemplate(template) {
    setTemplateId(template?.templateId || '');

    if (!template) {
      setTitle('');
      setRoomPurpose('');
      setRulesDraft('');
      return;
    }

    setTitle(template.title);
    setRoomPurpose(template.description);
    setRulesDraft((template.suggestedRules || []).join('\n'));

    if (selectedCategory.allowedRoomTypes.includes(template.suggestedRoomType)) {
      setType(template.suggestedRoomType);
    }
  }

  const limits = billingSummary?.limits;
  const allowedDurations = limits?.tempDurations || ['1h', '6h', '24h'];
  const ownedThemes = new Set([...(billingSummary?.ownedThemeIds || ['classic']), ...(limits?.roomThemes || ['classic'])]);
  const defaultRules = getCategoryDefaultRules(category);

  return (
    <main className={cn('form-page premium-page', tw.pageWide)}>
      <form className={cn('panel room-form entrance-card room-builder glass-panel', tw.glass, 'space-y-6 p-5 sm:p-7')} onSubmit={handleSubmit}>
        <div className="room-builder__intro max-w-3xl space-y-3">
          <p className={cn('eyebrow', tw.eyebrow)}>Create room</p>
          <h1 className="text-4xl font-black tracking-normal text-[var(--text)] sm:text-5xl">Build a conversation space</h1>
          <p className={cn('muted', tw.subcopy)}>Choose the identity, access model, and room limits. Nexus opens the room immediately after creation.</p>
        </div>

        <div className={cn('notice notice--compact plan-limit-card', tw.cardCompact, 'flex flex-wrap items-center gap-3')}>
          <span>Current plan</span>
          <strong>{billingSummary?.planTier || 'free'}</strong>
          <em>{limits?.roomMembers || 25} members · {limits?.activeRooms || 3} active rooms</em>
        </div>

        <section className={cn('form-group-card', tw.glassSoft, 'space-y-5 p-5')}>
          <div>
            <p className="eyebrow">1. Room identity</p>
            <h2>Name the space</h2>
          </div>
          <label className="field">
            <span>Room title</span>
            <input
              className={tw.input}
              maxLength={54}
              value={title}
              placeholder="Weekend plans"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
          <div className="room-suggestions" aria-label="Room title suggestions">
            {selectedCategory.roomTitleSuggestions.slice(0, 4).map((suggestion) => (
              <button className="suggestion-chip" key={suggestion} type="button" onClick={() => setTitle(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Purpose</span>
            <textarea
              className={tw.input}
              maxLength={90}
              value={roomPurpose}
              placeholder={selectedCategory.roomDescriptionSuggestions[0]}
              onChange={(event) => setRoomPurpose(event.target.value)}
            />
          </label>
          <div className="category-picker">
            <div className="category-picker__head">
              <span>Category preset</span>
              <CategoryBadge category={selectedCategory.slug} />
            </div>
            <div className="category-card-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Room category">
              {categoryOptions.map((item) => (
                <button
                  className={cn(`category-card ${item.accentClass} ${item.slug === selectedCategory.slug ? 'is-active' : ''}`, tw.cardCompact, 'text-left', item.slug === selectedCategory.slug ? 'ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_76%)]' : '')}
                  key={item.slug}
                  type="button"
                  role="radio"
                  aria-checked={item.slug === selectedCategory.slug}
                  onClick={() => chooseCategory(item.slug)}
                >
                  <CategoryBadge category={item.slug} compact />
                  <strong>{item.shortLabel}</strong>
                  <span>{item.description}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={cn(`category-guidance ${selectedCategory.accentClass}`, tw.cardCompact)}>
            <strong>{selectedCategory.createRoomMicrocopy}</strong>
            <p>{selectedCategory.safetyReminder}</p>
          </div>
        </section>

        <section className={cn('form-group-card', tw.glassSoft, 'space-y-5 p-5')}>
          <div>
            <p className="eyebrow">2. Access type</p>
            <h2>Choose how people join</h2>
          </div>
          <div className="segmented room-type-cards" role="radiogroup" aria-label="Room type">
            {['public', 'private', 'temp'].map((item) => (
              <button
                className={cn(type === item ? 'is-active ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_76%)]' : '', 'rounded-[1.4rem] border border-[var(--line)] bg-[var(--surface)] p-4 text-left transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45')}
                key={item}
                type="button"
                role="radio"
                aria-checked={type === item}
                disabled={!selectedCategory.allowedRoomTypes.includes(item)}
                onClick={() => setType(item)}
              >
                <strong>{item}</strong>
                <span>{getTypeCopy(item)}</span>
              </button>
            ))}
          </div>
          {type === 'temp' && (
          <label className="field">
            <span>Room expiry</span>
            <select className={tw.input} value={expiresInMs} onChange={(event) => setExpiresInMs(Number(event.target.value))}>
              {TEMP_ROOM_EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.ms} disabled={!allowedDurations.includes(option.value)}>
                  {option.label}{allowedDurations.includes(option.value) ? '' : ' - premium'}
                </option>
              ))}
            </select>
          </label>
          )}
          <p className="muted room-type-recommendation">
            Suggested for {selectedCategory.label}: <strong>{selectedCategory.defaultRoomTypeSuggestion}</strong>
          </p>
        </section>

        <section className={cn('form-group-card rules-preview-card', tw.glassSoft, 'space-y-5 p-5')}>
          <div>
            <p className="eyebrow">3. Style and rules</p>
            <h2>Choose a lightweight preset</h2>
            <p>Templates only prefill the room. You can still edit the title, rules, and access type.</p>
          </div>
          <div className="template-grid grid gap-3 md:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="Room template">
            <button
              className={cn(`template-card ${templateId ? '' : 'is-active'}`, tw.cardCompact, 'text-left', !templateId ? 'ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_76%)]' : '')}
              type="button"
              role="radio"
              aria-checked={!templateId}
              onClick={() => chooseTemplate(null)}
            >
              <strong>Start from blank</strong>
              <span>Use category defaults without extra rules.</span>
            </button>
            {templates.map((template) => (
              <button
                className={cn(`template-card ${selectedCategory.accentClass} ${template.templateId === templateId ? 'is-active' : ''}`, tw.cardCompact, 'text-left', template.templateId === templateId ? 'ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_76%)]' : '')}
                key={template.templateId}
                type="button"
                role="radio"
                aria-checked={template.templateId === templateId}
                onClick={() => chooseTemplate(template)}
              >
                <strong>{template.title}</strong>
                <span>{template.description}</span>
                <em>{template.suggestedRoomType}</em>
              </button>
            ))}
          </div>
          <div className="rules-grid grid gap-4 lg:grid-cols-2">
            <div className={cn('rules-preview', tw.cardCompact)}>
              <p className="eyebrow">Default rules</p>
              <ul>
                {defaultRules.map((rule) => <li key={rule}>{rule}</li>)}
              </ul>
            </div>
            <label className="field">
              <span>Custom rules</span>
              <textarea
                className={cn(tw.input, 'min-h-[190px] resize-y')}
                maxLength={600}
                value={rulesDraft}
                placeholder="Leave empty to use category and general safety rules."
                onChange={(event) => setRulesDraft(event.target.value)}
              />
            </label>
          </div>
          {selectedTemplate?.safetyNote && <p className="notice notice--compact">{selectedTemplate.safetyNote}</p>}
          <div className="category-hook-row">
            {selectedCategory.featureHooks.map((hook) => (
              <span className="status-pill category-hook" key={hook}>{formatHook(hook)}</span>
            ))}
          </div>
          <div className="theme-recommendations rounded-[1.5rem] border border-[var(--line)] bg-[var(--surface-inset)] p-4">
            <p className="eyebrow">Recommended room looks</p>
            <div>
              {selectedCategory.premiumThemeSuggestions.map((themeId) => {
                const theme = ROOM_THEME_PRESETS.find((item) => item.themeId === themeId);
                return (
                  <span className={`theme-recommendation ${ownedThemes.has(themeId) ? 'is-owned' : ''}`} key={themeId}>
                    <strong>{theme?.title || themeId}</strong>
                    <em>{ownedThemes.has(themeId) || themeId === 'classic' ? 'Ready' : 'Preview in Store'}</em>
                  </span>
                );
              })}
            </div>
          </div>
        </section>

        <div className="form-actions flex flex-wrap justify-end gap-3">
          <button className={cn('button button--ghost', tw.buttonGhost)} type="button" onClick={onBack}>
            Back
          </button>
          <button className={cn('button button--primary', tw.buttonPrimary)} type="submit">
            Create Room
          </button>
        </div>
      </form>
    </main>
  );
}

function formatHook(value) {
  return String(value || '').replaceAll('_', ' ');
}

function getTypeCopy(type) {
  if (type === 'private') {
    return 'Invite-code room for a focused group.';
  }

  if (type === 'temp') {
    return 'Time-limited room for quick sessions.';
  }

  return 'Discoverable room in Explore.';
}
