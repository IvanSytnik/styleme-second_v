'use client';

import { useRef, useState } from 'react';

import { resizeImage } from '@/lib/image-resize';
import { useAppStore } from '@/lib/app-store';

import styles from './upload-screen.module.css';

/**
 * Upload screen — entry point.
 * Accepts file via:
 *   - drag/drop onto the dropzone
 *   - click to open file picker
 *   - dedicated "Take photo" button (uses capture attribute on mobile, falls back to picker on desktop)
 *
 * On success, image is resized client-side and committed to the app store,
 * then we navigate to the catalog screen.
 */
export function UploadScreen(): React.ReactElement {
  const setImage = useAppStore((s) => s.setImage);
  const setScreen = useAppStore((s) => s.setScreen);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File): Promise<void> {
    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPEG, PNG, or WebP).');
      return;
    }

    setIsProcessing(true);
    try {
      const resized = await resizeImage(file);
      const previewUrl = URL.createObjectURL(resized.blob);
      setImage({
        file,
        previewUrl,
        blob: resized.blob,
        width: resized.width,
        height: resized.height,
      });
      setScreen('catalog');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process the image');
    } finally {
      setIsProcessing(false);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    // Reset input so re-selecting the same file fires onChange again.
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          Try a new <span className={styles.titleAccent}>hairstyle</span>
        </h1>
        <p className={styles.subtitle}>
          Upload a clear photo of your face and try on 40+ AI hairstyles.
        </p>
      </header>

      <div
        className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''} ${
          isProcessing ? styles.dropzoneBusy : ''
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
        aria-label="Upload photo"
        aria-busy={isProcessing}
      >
        <div className={styles.dropzoneIcon} aria-hidden="true">
          ⬆
        </div>
        <p className={styles.dropzoneTitle}>
          {isProcessing ? 'Preparing your photo…' : 'Drop a photo or click to choose'}
        </p>
        <p className={styles.dropzoneHint}>JPEG, PNG or WebP · up to 10 MB</p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => cameraInputRef.current?.click()}
          disabled={isProcessing}
        >
          <span aria-hidden="true">📷</span> Take a photo
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFileChange}
        className={styles.hiddenInput}
        aria-hidden="true"
        tabIndex={-1}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={onFileChange}
        className={styles.hiddenInput}
        aria-hidden="true"
        tabIndex={-1}
      />

      <p className={styles.privacy}>
        Your photo stays on your device until you start a generation. We don't store it after the
        result is delivered.
      </p>
    </div>
  );
}
