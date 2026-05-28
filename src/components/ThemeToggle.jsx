import Icon from './Icon.jsx';

export default function ThemeToggle({ theme, onToggle }) {
  const isDark = theme === 'dark';

  return (
    <button
      className={`icon-button theme-toggle ${isDark ? 'theme-toggle--dark' : 'theme-toggle--light'}`}
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      aria-pressed={isDark}
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={20} />
    </button>
  );
}
