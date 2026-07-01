'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ACCEPTED_MIME_TYPES, LIMITS } from '@styleme/shared';

import { useAppStore } from '@/lib/app-store';

import styles from './reference-photo-view.module.css';

/**
 * Reference photo view (Day 4).
 *
 * User uploads a second image showing the desired hairstyle. We client-side
 * resize it via Canvas (self-contained — same algorithm as the upload
 * screen but inline to avoid tight coupling). Then set the reference blob
 * in store + mode + navigate to processing.
 *
 * Content validation (face detection, NSFW) is OUT OF SCOPE for Day 4 —
 * backlogged for Day 9 alongside NSFW moderation on the primary photo.
 */
export function ReferencePhotoView(): React.ReactElement {
  const referenceImage = useAppStore((s) => s.referenceImage);
  const setReferenceImage = useAppStore((s) => s.setReferenceImage);
  const setMode = useAppStore((s) => s.setMode);
  const setScreen = useAppStore((s) => s.setScreen);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFile = useCallback(
    async (file: File): Promise<void> => {
      // MIME allowlist
      if (
        !(ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type)
      ) {
        toast.error('Unsupported format. Please use JPEG, PNG, or WebP.');
        return;
      }
      if (file.size > LIMITS.MAX_FILE_SIZE_BYTES * 5) {
        // The client resize will make it small enough to upload — but if
        // the source is enormous (>10 MB), the ImageBitmap step will
        // burn memory. Reject early with a friendly message.
        toast.error('Image is too large. Try a smaller photo.');
        return;
      }

      setIsProcessing(true);
      try {
        const bitmap = await createImageBitmap(file, {
          imageOrientation: 'from-image',
        });
        const { width: srcW, height: srcH } = bitmap;
        const maxEdge = LIMITS.MAX_IMAGE_DIMENSION;
        const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
        const dstW = Math.round(srcW * scale);
        const dstH = Math.round(srcH * scale);

        const canvas = document.createElement('canvas');
        canvas.width = dstW;
        canvas.height = dstH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D not available');
        ctx.drawImage(bitmap, 0, 0, dstW, dstH);
        bitmap.close();

        const blob: Blob | null = await new Promise((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', LIMITS.JPEG_QUALITY / 100),
        );
        if (!blob) throw new Error('Failed to encode JPEG');

        const previewUrl = URL.createObjectURL(blob);
        setReferenceImage({ previewUrl, blob });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[reference-photo] resize failed', err);
        toast.error('Could not process this image. Try another one.');
      } finally {
        setIsProcessing(false);
      }
    },
    [setReferenceImage],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>): void => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((): void => setIsDragging(false), []);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const file = e.target.files?.[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const onSubmit = useCallback((): void => {
    if (!referenceImage) return;
    setMode('reference');
    setScreen('processing');
  }, [referenceImage, setMode, setScreen]);

  const canSubmit = !!referenceImage && !isProcessing;

  return (
    <div className={styles.root}>
      <p className={styles.intro}>
        Upload a photo of someone with the hairstyle you want. The AI will copy
        the cut, length, colour, and texture onto your selfie.
      </p>

      <div
        className={`${styles.dropzone} ${isDragging ? styles.dragging : ''} ${referenceImage ? styles.hasPreview : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        aria-label="Upload reference photo"
      >
        <input
          ref={inputRef}
          type="file"
          accept={(ACCEPTED_MIME_TYPES as readonly string[]).join(',')}
          onChange={onFileChange}
          className={styles.fileInput}
          aria-hidden="true"
          tabIndex={-1}
        />

        {referenceImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={referenceImage.previewUrl}
            alt="Reference hairstyle preview"
            className={styles.preview}
          />
        ) : isProcessing ? (
          <span className={styles.placeholder}>Processing image…</span>
        ) : (
          <>
            <span className={styles.icon} aria-hidden="true">
              📸
            </span>
            <span className={styles.placeholder}>
              Drop a photo here, or click to choose
            </span>
            <span className={styles.hint}>JPEG, PNG, WebP — up to 2 MB (after resize)</span>
          </>
        )}
      </div>

      <button
        type="button"
        className={styles.submit}
        disabled={!canSubmit}
        onClick={onSubmit}
      >
        Try this hairstyle ✨
      </button>
    </div>
  );
}
