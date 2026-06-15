import { useMemo, useState } from 'react';

import {
  STATIC_TOPIC_PROMPTS,
  detectCodingSecretRisk,
  getCategoryConfig,
  getSafeHubLinks,
  getToolConfig,
  isToolEnabledForCategory,
} from '../../shared/categoryConfig.js';
import CategoryBadge from './CategoryBadge.jsx';
import Icon from './Icon.jsx';
import { cn, tw } from './ui/premium.js';

const BUG_TEMPLATE = `What I expected:

What happened:

Error message:

What I tried:

Code snippet:
`;

export default function CategoryToolsPanel({
  room,
  tools = [],
  canModerate = false,
  currentSessionId = '',
  codeMode = false,
  onToggleCodeMode,
  onInsertComposerText,
  onToolAction,
  onSendCardMessage,
  onToast,
}) {
  const category = getCategoryConfig(room?.categorySlug || room?.category);
  const [drafts, setDrafts] = useState({});
  const activeTools = useMemo(() => tools.filter((tool) => !['closed', 'dismissed'].includes(tool.status)), [tools]);

  function updateDraft(key, value) {
    setDrafts((current) => ({ ...current, [key]: value }));
  }

  function createTool(toolType, payload = {}, success = 'Tool added', onSuccess) {
    onToolAction?.('categoryTool:create', { toolType, ...payload }, { success, onSuccess });
  }

  function updateTool(toolId, payload = {}, success = 'Tool updated') {
    onToolAction?.('categoryTool:update', { toolId, ...payload }, { success });
  }

  function toolByType(toolType) {
    return activeTools.find((tool) => tool.toolType === toolType);
  }

  if (!room) {
    return null;
  }

  return (
    <section className={cn(`panel drawer-card category-tools-panel ${category.accentClass}`, tw.glassSoft, 'mb-4 p-5')}>
      <div className="category-tools-panel__head">
        <div>
          <p className={cn('eyebrow', tw.eyebrow)}>Category tools</p>
          <h2>{category.label} toolkit</h2>
          <span>{category.adminSafetyNotes || category.safetyReminder}</span>
        </div>
        <CategoryBadge category={category.slug} />
      </div>

      <div className="category-tools-grid grid gap-4">
        {isToolEnabledForCategory('focus_timer', category.slug) && (
          <FocusTimerTool
            tool={toolByType('focus_timer')}
            canModerate={canModerate}
            onStart={(minutes) => onToolAction?.('categoryTool:startTimer', { minutes }, { success: 'Focus timer started' })}
            onPause={(toolId) => onToolAction?.('categoryTool:pauseTimer', { toolId }, { success: 'Focus timer paused' })}
            onComplete={(toolId) => onToolAction?.('categoryTool:completeTimer', { toolId }, { success: 'Focus timer completed' })}
          />
        )}

        {isToolEnabledForCategory('study_goal', category.slug) && (
          <SimpleToolCard
            icon="book"
            title="Study goal"
            description={toolByType('study_goal')?.body || 'Set one clear goal for this room.'}
            actionLabel={canModerate ? 'Set goal' : ''}
            inputValue={drafts.studyGoal || ''}
            placeholder="Complete Electrochemistry doubts"
            onInput={(value) => updateDraft('studyGoal', value)}
            onAction={() => {
              createTool('study_goal', { title: 'Study goal', body: drafts.studyGoal }, 'Study goal set');
              updateDraft('studyGoal', '');
            }}
          />
        )}

        {isToolEnabledForCategory('study_checklist', category.slug) && (
          <ChecklistTool
            items={activeTools.filter((tool) => tool.toolType === 'study_checklist')}
            canModerate={canModerate}
            draft={drafts.checklist || ''}
            onDraft={(value) => updateDraft('checklist', value)}
            onAdd={() => {
              createTool('study_checklist', { title: drafts.checklist || 'Study target' }, 'Checklist item added');
              updateDraft('checklist', '');
            }}
            onToggle={(tool) => updateTool(tool.toolId, { status: tool.status === 'completed' ? 'open' : 'completed' })}
          />
        )}

        {isToolEnabledForCategory('code_snippet_mode', category.slug) && (
          <article className={cn('category-tool-card', tw.cardCompact)}>
            <ToolTitle icon="code" title="Code mode" description="Send safe plain-text code blocks with copy support." />
            <button className={`button ${codeMode ? 'button--soft' : 'button--ghost'} button--wide`} type="button" onClick={onToggleCodeMode}>
              {codeMode ? 'Code mode on' : 'Use code snippet'}
            </button>
            <button className="button button--ghost button--wide" type="button" onClick={() => onInsertComposerText?.(BUG_TEMPLATE)}>
              Insert bug template
            </button>
            <p className="tool-safety-note">Never share API keys, tokens, private keys, service account JSON, or passwords.</p>
          </article>
        )}

        {isToolEnabledForCategory('match_lobby', category.slug) && (
          <MatchLobbyTool
            lobbies={activeTools.filter((tool) => tool.toolType === 'match_lobby')}
            canModerate={canModerate}
            drafts={drafts}
            updateDraft={updateDraft}
            onCreate={() =>
              createTool(
                'match_lobby',
                {
                  title: drafts.gameName || 'Match lobby',
                  metadata: {
                    gameName: drafts.gameName,
                    mode: drafts.matchMode,
                    playersNeeded: drafts.playersNeeded || 2,
                    roomLinkText: drafts.roomLinkText,
                  },
                },
                'Match lobby opened',
              )
            }
            onJoin={(toolId) => onToolAction?.('categoryTool:joinMatch', { toolId }, { success: "You're in" })}
            onInvite={() =>
              onSendCardMessage?.(
                'match_invite',
                drafts.matchInvite || 'Join this match lobby.',
                { gameName: drafts.gameName || '', roomLinkText: drafts.roomLinkText || '' },
                'match_invite',
              )
            }
            onScore={() =>
              onSendCardMessage?.(
                'score_card',
                drafts.scoreResult || 'Match result posted.',
                { teamA: drafts.teamA || 'Team A', teamB: drafts.teamB || 'Team B', result: drafts.scoreResult || '' },
                'score_post',
              )
            }
          />
        )}

        {isToolEnabledForCategory('idea_board', category.slug) && (
          <BoardTool
            title="Idea board"
            icon="palette"
            items={activeTools.filter((tool) => tool.toolType === 'idea_board')}
            draftTitle={drafts.ideaTitle || ''}
            draftBody={drafts.ideaBody || ''}
            onTitle={(value) => updateDraft('ideaTitle', value)}
            onBody={(value) => updateDraft('ideaBody', value)}
            onAdd={() => {
              createTool('idea_board', { title: drafts.ideaTitle, body: drafts.ideaBody }, 'Idea added');
              updateDraft('ideaTitle', '');
              updateDraft('ideaBody', '');
            }}
            onVote={(toolId) => onToolAction?.('categoryTool:vote', { toolId, value: 'up' }, { success: 'Vote added' })}
          />
        )}

        {isToolEnabledForCategory('prompt_card', category.slug) && (
          <SimpleToolCard
            icon="palette"
            title="Prompt card"
            description={toolByType('prompt_card')?.body || 'Post a writing/design prompt for everyone.'}
            actionLabel={canModerate ? 'Post prompt' : ''}
            inputValue={drafts.prompt || ''}
            placeholder="Write a dialogue where the hero hides the truth."
            onInput={(value) => updateDraft('prompt', value)}
            onAction={() => {
              createTool('prompt_card', { title: 'Creative prompt', body: drafts.prompt }, 'Prompt posted');
              updateDraft('prompt', '');
            }}
          />
        )}

        {isToolEnabledForCategory('help_queue', category.slug) && (
          <QueueTool
            items={activeTools.filter((tool) => tool.toolType === 'help_queue')}
            canModerate={canModerate}
            currentSessionId={currentSessionId}
            draft={drafts.helpQueue || ''}
            urgent={drafts.helpUrgent === 'true'}
            onDraft={(value) => updateDraft('helpQueue', value)}
            onUrgent={(value) => updateDraft('helpUrgent', String(value))}
            onAdd={() => {
              createTool(
                'help_queue',
                {
                  title: drafts.helpQueue || 'Help request',
                  metadata: { priority: drafts.helpUrgent === 'true' ? 'urgent' : 'normal' },
                },
                'Help request added',
              );
              updateDraft('helpQueue', '');
            }}
            onStatus={(toolId, status) => updateTool(toolId, { status }, 'Queue updated')}
          />
        )}

        {isToolEnabledForCategory('topic_spinner', category.slug) && (
          <TopicTool
            topics={STATIC_TOPIC_PROMPTS}
            onTopic={(topic) => {
              createTool('topic_spinner', { title: 'Topic card', body: topic, metadata: { topic } }, 'Topic posted');
              onSendCardMessage?.('topic_card', topic, { topic }, 'topic_spinner');
            }}
          />
        )}

        {isToolEnabledForCategory('hub_link_panel', category.slug) && (
          <HubPanel
            links={getSafeHubLinks(toolByType('hub_link_panel')?.metadata?.hubLinkIds || [])}
            canModerate={canModerate}
            onCreate={() => createTool('hub_link_panel', { title: 'MH Horizon hubs', metadata: { hubLinkIds: getSafeHubLinks().map((link) => link.id) } })}
          />
        )}

        {isToolEnabledForCategory('product_feedback', category.slug) && (
          <BoardTool
            title="Product feedback"
            icon="badge"
            items={activeTools.filter((tool) => tool.toolType === 'product_feedback')}
            draftTitle={drafts.productTitle || ''}
            draftBody={drafts.productBody || ''}
            onTitle={(value) => updateDraft('productTitle', value)}
            onBody={(value) => updateDraft('productBody', value)}
            onAdd={() => {
              createTool('product_feedback', { title: drafts.productTitle, body: drafts.productBody, status: 'received' }, 'Feedback item received');
              updateDraft('productTitle', '');
              updateDraft('productBody', '');
            }}
            onVote={(toolId) => onToolAction?.('categoryTool:vote', { toolId, value: 'useful' }, { success: 'Noted' })}
          />
        )}
      </div>
    </section>
  );
}

export function CategoryQuickTools({
  room,
  canModerate = false,
  codeMode,
  draft,
  onToggleCodeMode,
  onInsertComposerText,
  onSendTopic,
  onOpenPoll,
  onOpenEvent,
}) {
  const category = getCategoryConfig(room?.categorySlug || room?.category);
  const risk = category.slug === 'coding' ? detectCodingSecretRisk(draft || '') : { risky: false };

  return (
    <div className="category-quick-tools flex flex-wrap gap-2 pb-2">
      {isToolEnabledForCategory('code_snippet_mode', category.slug) && (
        <>
          <button className={cn(`tool-chip ${codeMode ? 'is-active' : ''}`, 'inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-inset)] px-3 py-2 text-xs font-black transition-all hover:-translate-y-0.5', codeMode ? 'ring-4 ring-[color-mix(in_srgb,var(--blue),transparent_78%)]' : '')} type="button" onClick={onToggleCodeMode}>
            <Icon name="code" size={15} /> Code
          </button>
          <button className="tool-chip inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-inset)] px-3 py-2 text-xs font-black transition-all hover:-translate-y-0.5" type="button" onClick={() => onInsertComposerText?.(BUG_TEMPLATE)}>
            Bug template
          </button>
          {risk.risky && <span className="tool-chip tool-chip--warning">Secret warning</span>}
        </>
      )}
      {isToolEnabledForCategory('topic_spinner', category.slug) && (
        <button className="tool-chip inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-inset)] px-3 py-2 text-xs font-black transition-all hover:-translate-y-0.5" type="button" onClick={onSendTopic}>
          <Icon name="shuffle" size={15} /> Topic
        </button>
      )}
      {canModerate && isToolEnabledForCategory('quick_poll', category.slug) && (
        <button className="tool-chip inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-inset)] px-3 py-2 text-xs font-black transition-all hover:-translate-y-0.5" type="button" onClick={onOpenPoll}>
          <Icon name="shuffle" size={15} /> Poll
        </button>
      )}
      {isToolEnabledForCategory('room_event', category.slug) && (
        <button className="tool-chip inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface-inset)] px-3 py-2 text-xs font-black transition-all hover:-translate-y-0.5" type="button" onClick={onOpenEvent}>
          <Icon name="calendar" size={15} /> Event
        </button>
      )}
      {isToolEnabledForCategory('match_invite', category.slug) && (
        <span className="tool-chip tool-chip--ghost"><Icon name="gamepad" size={15} /> Match tools in drawer</span>
      )}
      {isToolEnabledForCategory('help_queue', category.slug) && (
        <span className="tool-chip tool-chip--ghost"><Icon name="help" size={15} /> Help queue in drawer</span>
      )}
    </div>
  );
}

function ToolTitle({ icon, title, description }) {
  return (
    <div className="tool-title">
      <span><Icon name={icon} size={18} /></span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

function FocusTimerTool({ tool, canModerate, onStart, onPause, onComplete }) {
  const remaining = formatTimer(tool);
  return (
    <article className={cn('category-tool-card category-tool-card--focus', tw.cardCompact)}>
      <ToolTitle icon="book" title="Focus timer" description="Shared room timer for quiet study sprints." />
      <div className="focus-timer-face">
        <strong>{remaining}</strong>
        <span>{tool?.status || 'idle'}</span>
      </div>
      {canModerate && (
        <div className="tool-button-row">
          {[25, 45, 60].map((minutes) => (
            <button key={minutes} className="button button--ghost button--small" type="button" onClick={() => onStart(minutes)}>
              {minutes}m
            </button>
          ))}
          {tool?.toolId && (
            <>
              <button className="button button--ghost button--small" type="button" onClick={() => onPause(tool.toolId)}>
                Pause
              </button>
              <button className="button button--soft button--small" type="button" onClick={() => onComplete(tool.toolId)}>
                Complete
              </button>
            </>
          )}
        </div>
      )}
    </article>
  );
}

function SimpleToolCard({ icon, title, description, actionLabel, inputValue, placeholder, onInput, onAction }) {
  return (
    <article className={cn('category-tool-card', tw.cardCompact)}>
      <ToolTitle icon={icon} title={title} description={description} />
      {actionLabel && (
        <div className="tool-inline-form">
          <input className={cn('premium-input', tw.input)} value={inputValue} placeholder={placeholder} onChange={(event) => onInput(event.target.value)} />
          <button className={cn('button button--soft', tw.buttonSoft)} type="button" onClick={onAction} disabled={!String(inputValue || '').trim()}>
            {actionLabel}
          </button>
        </div>
      )}
    </article>
  );
}

function ChecklistTool({ items, canModerate, draft, onDraft, onAdd, onToggle }) {
  return (
    <article className={cn('category-tool-card', tw.cardCompact)}>
      <ToolTitle icon="shield" title="Study checklist" description="Small target list for group progress." />
      <ToolList items={items} onAction={canModerate ? onToggle : null} actionLabel="Toggle" />
      {canModerate && (
        <div className="tool-inline-form">
          <input className={cn('premium-input', tw.input)} value={draft} placeholder="Add target" onChange={(event) => onDraft(event.target.value)} />
          <button className="button button--soft" type="button" onClick={onAdd} disabled={!draft.trim()}>
            Add
          </button>
        </div>
      )}
    </article>
  );
}

function MatchLobbyTool({ lobbies, canModerate, drafts, updateDraft, onCreate, onJoin, onInvite, onScore }) {
  return (
    <article className={cn('category-tool-card', tw.cardCompact)}>
      <ToolTitle icon="gamepad" title="Match lobby" description="Open a small GameHub-style match card." />
      <ToolList items={lobbies} onAction={(tool) => onJoin(tool.toolId)} actionLabel="I'm in" />
      {canModerate && (
        <div className="tool-form-grid">
          <input className={cn('premium-input', tw.input)} placeholder="Game" value={drafts.gameName || ''} onChange={(event) => updateDraft('gameName', event.target.value)} />
          <input className={cn('premium-input', tw.input)} placeholder="Mode" value={drafts.matchMode || ''} onChange={(event) => updateDraft('matchMode', event.target.value)} />
          <input className={cn('premium-input', tw.input)} placeholder="Players needed" value={drafts.playersNeeded || ''} onChange={(event) => updateDraft('playersNeeded', event.target.value)} />
          <input className={cn('premium-input', tw.input)} placeholder="Room code/link text" value={drafts.roomLinkText || ''} onChange={(event) => updateDraft('roomLinkText', event.target.value)} />
          <button className="button button--soft" type="button" onClick={onCreate}>Create lobby</button>
          <button className="button button--ghost" type="button" onClick={onInvite}>Send invite</button>
          <input className={cn('premium-input', tw.input)} placeholder="Score/result" value={drafts.scoreResult || ''} onChange={(event) => updateDraft('scoreResult', event.target.value)} />
          <button className="button button--ghost" type="button" onClick={onScore}>Post score</button>
        </div>
      )}
    </article>
  );
}

function BoardTool({ title, icon, items, draftTitle, draftBody, onTitle, onBody, onAdd, onVote }) {
  return (
    <article className={cn('category-tool-card', tw.cardCompact)}>
      <ToolTitle icon={icon} title={title} description="Add lightweight cards and let the room react." />
      <ToolList items={items} onAction={(tool) => onVote(tool.toolId)} actionLabel="Upvote" />
      <div className="tool-form-grid">
        <input className={cn('premium-input', tw.input)} placeholder={`${title} title`} value={draftTitle} onChange={(event) => onTitle(event.target.value)} />
        <textarea className={cn('premium-input', tw.input)} placeholder="Short note" value={draftBody} onChange={(event) => onBody(event.target.value)} />
        <button className="button button--soft" type="button" onClick={onAdd} disabled={!draftTitle.trim()}>
          Add card
        </button>
      </div>
    </article>
  );
}

function QueueTool({ items, canModerate, currentSessionId, draft, urgent, onDraft, onUrgent, onAdd, onStatus }) {
  return (
    <article className={cn('category-tool-card', tw.cardCompact)}>
      <ToolTitle icon="help" title="Help queue" description="Track open support/problem-solving requests." />
      <ToolList
        items={items}
        onAction={(tool) => onStatus(tool.toolId, tool.status === 'solved' ? 'open' : 'solved')}
        actionLabel={(tool) => (tool.status === 'solved' ? 'Reopen' : tool.createdBySessionId === currentSessionId || canModerate ? 'Solve' : '')}
      />
      <div className="tool-inline-form">
        <input className={cn('premium-input', tw.input)} value={draft} placeholder="What do you need help with?" onChange={(event) => onDraft(event.target.value)} />
        <label className="tool-toggle"><input type="checkbox" checked={urgent} onChange={(event) => onUrgent(event.target.checked)} /> Urgent</label>
        <button className="button button--soft" type="button" onClick={onAdd} disabled={!draft.trim()}>
          Add
        </button>
      </div>
      <p className="tool-safety-note">Never share OTPs, passwords, payment details, private account access, or documents.</p>
    </article>
  );
}

function TopicTool({ topics, onTopic }) {
  const topic = topics[Math.floor(Math.random() * topics.length)];
  return (
    <article className={cn('category-tool-card', tw.cardCompact)}>
      <ToolTitle icon="shuffle" title="Topic spinner" description="Post a safe casual prompt into chat." />
      <button className="button button--ghost button--wide" type="button" onClick={() => onTopic(topic)}>
        Spin topic
      </button>
      <p className="tool-safety-note">Polls now open from the chat composer so voting happens directly in the message stream.</p>
    </article>
  );
}

function HubPanel({ links, canModerate, onCreate }) {
  const displayLinks = links.length ? links : getSafeHubLinks();
  return (
    <article className={cn('category-tool-card category-tool-card--official', tw.cardCompact)}>
      <ToolTitle icon="badge" title="MH Horizon hubs" description="Official safe links only." />
      <div className="hub-link-grid">
        {displayLinks.map((link) => (
          <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
            {link.label}
          </a>
        ))}
      </div>
      {canModerate && (
        <button className="button button--soft button--wide" type="button" onClick={onCreate}>
          Pin official hubs
        </button>
      )}
    </article>
  );
}

function ToolList({ items, onAction, actionLabel }) {
  if (!items.length) {
    return <p className="muted">No active items yet.</p>;
  }

  return (
    <div className="tool-list">
      {items.slice(0, 8).map((item) => {
        const label = typeof actionLabel === 'function' ? actionLabel(item) : actionLabel;
        return (
          <div className="tool-list-row rounded-[1rem] border border-[var(--line)] bg-[var(--surface-inset)] p-3" key={item.toolId}>
            <div>
              <strong>{item.title || getToolConfig(item.toolType)?.title || 'Tool'}</strong>
              <span>{item.body || item.metadata?.topic || item.metadata?.gameName || item.status}</span>
              {Array.isArray(item.metadata?.results) && (
                <small>{item.metadata.results.map((count, index) => `Option ${index + 1}: ${count}`).join(' · ')}</small>
              )}
              {item.metadata?.currentJoinedCount !== undefined && (
                <small>{item.metadata.currentJoinedCount}/{item.metadata.playersNeeded || '?'} joined</small>
              )}
            </div>
            <em>{item.status}</em>
            {label && onAction && (
              <button className="button button--ghost button--small" type="button" onClick={() => onAction(item)}>
                {label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatTimer(tool) {
  if (!tool?.metadata?.endsAt || tool.status !== 'running') {
    const minutes = Number(tool?.metadata?.durationMinutes || 25);
    return `${minutes}:00`;
  }

  const remaining = Math.max(0, new Date(tool.metadata.endsAt).getTime() - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
