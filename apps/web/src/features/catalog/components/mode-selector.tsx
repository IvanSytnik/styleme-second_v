'use client';

import styles from './mode-selector.module.css';

export type CatalogMode = 'gallery' | 'custom' | 'reference';

interface ModeConfig {
  readonly id: CatalogMode;
  readonly label: string;
  readonly description: string;
  readonly icon: string;
}

const MODES: readonly ModeConfig[] = [
  {
    id: 'gallery',
    label: 'Gallery',
    description: 'Choose from curated styles',
    icon: '🎨',
  },
  {
    id: 'custom',
    label: 'Describe',
    description: 'Write your own description',
    icon: '✍️',
  },
  {
    id: 'reference',
    label: 'Reference',
    description: 'Upload a photo to copy from',
    icon: '📸',
  },
];

interface Props {
  value: CatalogMode;
  onChange: (mode: CatalogMode) => void;
}

export function ModeSelector({ value, onChange }: Props): React.ReactElement {
  return (
    <div
      className={styles.root}
      role="radiogroup"
      aria-label="How would you like to choose a hairstyle?"
    >
      {MODES.map((mode) => {
        const selected = mode.id === value;
        return (
          <button
            key={mode.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`${styles.mode} ${selected ? styles.selected : ''}`}
            onClick={() => onChange(mode.id)}
          >
            <span className={styles.icon} aria-hidden="true">
              {mode.icon}
            </span>
            <span className={styles.label}>{mode.label}</span>
            <span className={styles.description}>{mode.description}</span>
          </button>
        );
      })}
    </div>
  );
}
