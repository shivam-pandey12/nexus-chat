import './side-panel-triggers.css';

export const SIDE_PANEL_TRIGGER_VARIANTS = ['infinity', 'rail', 'compass', 'ribbon', 'magnetic', 'capsule'];

export default function SidePanelTrigger({
  variant = 'infinity',
  open = false,
  onClick,
  labelOpen = 'Open navigation panel',
  labelClose = 'Close navigation panel',
  className = '',
}) {
  const safeVariant = SIDE_PANEL_TRIGGER_VARIANTS.includes(variant) ? variant : 'infinity';
  const label = open ? labelClose : labelOpen;

  return (
    <button
      className={`side-trigger side-trigger--${safeVariant} ${open ? 'is-open' : ''} ${className}`.trim()}
      type="button"
      aria-label={label}
      aria-expanded={open}
      data-label={open ? 'Close' : 'Menu'}
      onClick={onClick}
    >
      {safeVariant === 'infinity' ? (
        <span className="side-trigger__infinity-shell" aria-hidden="true">
          <svg className="side-trigger__infinity" viewBox="0 0 104 58" focusable="false">
            <path
              className="side-trigger__infinity-base"
              d="M27 29c0-13.5 14.5-18.5 25-1.5C62.5 10.5 77 15.5 77 29S62.5 47.5 52 30.5C41.5 47.5 27 42.5 27 29Z"
            />
            <path
              className="side-trigger__infinity-runner"
              d="M27 29c0-13.5 14.5-18.5 25-1.5C62.5 10.5 77 15.5 77 29S62.5 47.5 52 30.5C41.5 47.5 27 42.5 27 29Z"
            />
            <path
              className="side-trigger__infinity-arrowhead side-trigger__infinity-arrowhead--right"
              d="M75 22l8 7-8 7"
            />
            <path
              className="side-trigger__infinity-arrowhead side-trigger__infinity-arrowhead--left"
              d="M29 22l-8 7 8 7"
            />
          </svg>
        </span>
      ) : (
        <>
          <span className="side-trigger__rail" aria-hidden="true" />
          <span className="side-trigger__orb" aria-hidden="true">
            <span className="side-trigger__icon">{open ? '‹' : '›'}</span>
          </span>
          <span className="side-trigger__copy" aria-hidden="true">{open ? 'Close' : 'Menu'}</span>
        </>
      )}
    </button>
  );
}
