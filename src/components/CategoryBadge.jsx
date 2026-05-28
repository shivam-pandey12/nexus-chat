import { getCategoryConfig } from '../../shared/categoryConfig.js';
import Icon from './Icon.jsx';

export default function CategoryBadge({ category, className = '', compact = false, title = '' }) {
  const config = getCategoryConfig(category);

  return (
    <span
      className={`category-badge ${config.accentClass} ${compact ? 'category-badge--compact' : ''} ${className}`.trim()}
      title={title || config.description}
    >
      <span className="category-badge__icon" aria-hidden="true">
        <Icon name={config.iconType} size={compact ? 14 : 16} />
      </span>
      {config.label}
    </span>
  );
}
