import { getCategoryOptions } from '../../shared/categoryConfig.js';
import nexusLogoUrl from '../../logo.png';
import CategoryBadge from './CategoryBadge.jsx';
import { cn, tw } from './ui/premium.js';

const features = [
  {
    title: 'Real-time messages',
    copy: 'Fast Socket.io rooms with replies, reactions, typing, and clean plain-text rendering.',
  },
  {
    title: 'Private invite links',
    copy: 'Create link-based rooms for focused conversations without forcing full account setup.',
  },
  {
    title: 'Room roles',
    copy: 'Owner and moderator surfaces stay tucked away until they are actually needed.',
  },
  {
    title: 'Safety tools',
    copy: 'Reporting, blocking, mutes, kicks, room rules, and admin review are built into the flow.',
  },
  {
    title: 'Premium themes',
    copy: 'Hosts can give rooms a distinctive MH Horizon look without hurting readability.',
  },
];

const useCases = getCategoryOptions();

export default function LandingPage({ onStart, onExplore, onCreatePrivate, onNavigate, onFeedback }) {
  return (
    <main className={cn('landing premium-page page-flow', tw.pageWide, 'space-y-8 sm:space-y-10')}>
      <section className={cn('hero hero--cinematic', tw.hero)}>
        <div className="hero__content relative z-10 max-w-3xl space-y-5">
          <div className={cn('premium-badge', tw.pill, 'w-fit')}>MH Horizon Social Layer</div>
          <h1 className={tw.title}>Nexus Chat</h1>
          <p className={cn('hero__subtitle', 'text-2xl font-extrabold leading-tight text-[var(--text)] sm:text-3xl')}>
            Instant rooms for real people, real topics, and quick conversations.
          </p>
          <p className={cn('hero__statement', tw.subcopy)}>
            Public rooms, private links, study and gaming conversations, and calm safety controls in one premium real-time workspace.
          </p>
          <div className="hero__actions flex flex-wrap gap-3 pt-2">
            <button className={cn('button button--primary glow-button', tw.buttonPrimary)} type="button" onClick={onStart}>
              Start Chatting
            </button>
            <button className={cn('button button--ghost ghost-button', tw.buttonGhost)} type="button" onClick={onExplore}>
              Explore Rooms
            </button>
            <button className={cn('button button--soft', tw.buttonSoft)} type="button" onClick={onCreatePrivate}>
              Create Private Room
            </button>
          </div>
          <div className="hero__metrics flex flex-wrap gap-2 pt-3" aria-label="Nexus Chat highlights">
            <span>Public rooms</span>
            <span>Private links</span>
            <span>Safe chat</span>
          </div>
        </div>

        <div className="hero__visual hero-console" aria-hidden="true">
          <div className="hero-console__top">
            <span><i className="live-dot" /> Live room</span>
            <strong>Nexus Lounge</strong>
          </div>

          <div className="hero-console__chat">
            <div className="hero-console__message">
              <span>Study</span>
              <p>Night Study Sprint is live with a focus timer and clear room rules.</p>
            </div>
            <div className="hero-console__message is-mine">
              <span>Gaming</span>
              <p>GameHub match chat opened from a private invite.</p>
            </div>
            <div className="hero-console__message">
              <span>Coding</span>
              <p>Bug-fix room keeps code snippets readable and safe.</p>
            </div>
          </div>

          <div className="hero-console__stats">
            <div>
              <strong>3</strong>
              <span>room styles</span>
            </div>
            <div>
              <strong>5</strong>
              <span>people online</span>
            </div>
            <div>
              <strong>Safe</strong>
              <span>moderation ready</span>
            </div>
          </div>

          <div className="hero-console__bar">
            <span />
            <strong>Send</strong>
          </div>
        </div>
      </section>

      <section className={cn('premium-section why-nexus', tw.section, 'space-y-6')}>
        <div className="section-header max-w-3xl">
          <p className={cn('eyebrow', tw.eyebrow)}>Why Nexus Chat</p>
          <h2 className={tw.heading}>Rooms that start fast and stay readable.</h2>
          <p className={tw.subcopy}>Designed for quick conversations across MH Horizon without burying people under complex community tooling.</p>
        </div>
        <div className="value-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {['Fast rooms', 'Temporary, public, or private access', 'Moderation and safety by default', 'Profiles and room memory'].map((item) => (
            <article className={cn('value-card premium-card', tw.card)} key={item}>
              <span className="value-card__line" />
              <h3>{item}</h3>
              <p>{getValueCopy(item)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={cn('premium-section use-case-strip', tw.section, 'flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between')}>
        <div>
          <p className={cn('eyebrow', tw.eyebrow)}>Use cases</p>
          <h2 className="text-3xl font-black text-[var(--text)]">Built for every quick gathering.</h2>
        </div>
        <div className="use-case-grid flex flex-wrap gap-2" aria-label="Nexus Chat use cases">
          {useCases.map((item) => (
            <CategoryBadge category={item.slug} className="category-chip" key={item.slug} />
          ))}
        </div>
      </section>

      <section className={cn('premium-section', tw.section, 'space-y-6')}>
        <div className="section-header">
          <p className={cn('eyebrow', tw.eyebrow)}>Product surface</p>
          <h2 className={tw.heading}>Premium, practical, and safe.</h2>
        </div>
        <section className="feature-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Nexus Chat features">
          {features.map((feature) => (
            <article className={cn('feature-card premium-card', tw.cardCompact, 'min-h-[210px]')} key={feature.title}>
              <span className="feature-card__mark" />
              <h2>{feature.title}</h2>
              <p>{feature.copy}</p>
            </article>
          ))}
        </section>
      </section>

      <section className={cn('ecosystem-panel glass-panel', tw.glass, 'grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8')}>
        <div>
          <p className="eyebrow">MH Horizon ecosystem</p>
          <h2>A social layer for the people already moving through MH Horizon.</h2>
          <p>Nexus Chat gives study groups, creators, players, and project teams a calm place to talk without turning every conversation into a large community server.</p>
        </div>
        <div className="ecosystem-panel__rail" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className={cn('final-cta premium-card', tw.glass, 'flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between md:p-8')}>
        <div>
          <p className="eyebrow">Start in seconds</p>
          <h2>Create a room, copy a link, and talk.</h2>
        </div>
        <button className={cn('button button--primary glow-button', tw.buttonPrimary)} type="button" onClick={onStart}>
          Start a Room
        </button>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer__brand">
          <span className="brand__mark brand__mark--image">
            <img src={nexusLogoUrl} alt="" />
          </span>
          <div>
            <strong>Nexus Chat</strong>
            <p>Nexus Chat is a focused people-to-people social workspace for rooms, communities, quick talks, and safe MH Horizon conversations.</p>
          </div>
        </div>
        <div className="footer-links" aria-label="MH Horizon launch links">
          <div className="footer-links__column">
            <h3>Chat</h3>
            <button type="button" onClick={onStart}>Start Chatting</button>
            <button type="button" onClick={onExplore}>Explore Rooms</button>
            <button type="button" onClick={onCreatePrivate}>Private Room</button>
          </div>
          <div className="footer-links__column">
            <h3>Product</h3>
            <button type="button" onClick={() => onNavigate?.('updates')}>Updates</button>
            <button type="button" onClick={onFeedback}>Feedback</button>
          </div>
          <div className="footer-links__column">
            <h3>Legal</h3>
            <button type="button" onClick={() => onNavigate?.('privacy')}>Privacy</button>
            <button type="button" onClick={() => onNavigate?.('terms')}>Terms</button>
            <button type="button" onClick={() => onNavigate?.('refund-policy')}>Refund</button>
          </div>
          <div className="footer-links__column">
            <h3>Support</h3>
            <button type="button" onClick={() => onNavigate?.('safety')}>Safety</button>
            <button type="button" onClick={() => onNavigate?.('contact')}>Contact</button>
          </div>
        </div>
      </footer>
    </main>
  );
}

function getValueCopy(value) {
  const copy = {
    'Fast rooms': 'Create or join a room with a guest profile or optional Google login.',
    'Temporary, public, or private access': 'Choose the access model that fits the conversation without changing the chat flow.',
    'Moderation and safety by default': 'Reports, blocks, owner controls, and admin review stay available without cluttering normal chat.',
    'Profiles and room memory': 'Logged-in users can keep profile polish, favorites, and room history benefits.',
  };

  return copy[value];
}
