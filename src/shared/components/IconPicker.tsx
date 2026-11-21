'use client';

import { Button, IconButton, Spinner } from '@/design-system';
import { Trash2 } from '@/design-system/icons';
import { useRef, useState } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { compressImageToSquareWebp } from '@/shared/utils/compress-image';
import { useToast } from '@/shared/components/Toast';

const BUCKET = 'entity-icons';
const MAX_SOURCE_BYTES = 10 * 1024 * 1024; // 10 MB raw cap before compression

type Props = {
  value: string | null;
  onChange: (url: string | null) => void;
  userId: string;
  folder: 'assets' | 'wallets';
  fallback: React.ReactNode;
  bgColor?: string;
  label?: string;
  disabled?: boolean;
};

/**
 * Controlled icon uploader. Picks a file, compresses to a square 256×256 WebP,
 * uploads to the `entity-icons` Supabase Storage bucket, and hands the public
 * URL back to the parent. Never touches the owning row — the parent persists
 * `icon_url` when saving the form.
 *
 * Orphan files (re-uploads, removals before save, deleted entities) are left
 * in storage for now; a future cleanup job can sweep them using the
 * `user_id` folder prefix.
 */
export function IconPicker({
  value,
  onChange,
  userId,
  folder,
  fallback,
  bgColor,
  label,
  disabled,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const toast = useToast();

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Always reset so the same file can be re-selected after a failure.
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('لطفاً یک فایل تصویری انتخاب کن.');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error('حجم تصویر نباید بیشتر از ۱۰ مگابایت باشد.');
      return;
    }

    setIsUploading(true);
    try {
      const blob = await compressImageToSquareWebp(file);
      // Random path: decouples upload from entity id (works for create + edit)
      // and guarantees a unique URL → no CDN cache invalidation headaches.
      const path = `${userId}/${folder}/${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, {
          contentType: 'image/webp',
          cacheControl: '31536000',
          upsert: false,
        });
      if (error) throw error;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (err) {
      console.error(err);
      toast.error('بارگذاری آیکون ناموفق بود.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div
        className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-card bg-hover"
        style={bgColor ? { backgroundColor: bgColor } : undefined}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="size-full object-cover" draggable={false} />
        ) : (
          fallback
        )}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-scrim">
            <Spinner />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {label && <span className="text-caption text-fg-muted">{label}</span>}
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={disabled || isUploading}>
            {value ? 'تغییر آیکون' : 'بارگذاری آیکون'}
          </Button>
          {value && !isUploading && (
            <IconButton size="sm" aria-label="حذف آیکون" icon={<Trash2 />} disabled={disabled} onClick={() => onChange(null)} />
          )}
        </div>
        <span className="text-caption text-fg-subtle">PNG، JPG یا WebP؛ مربع ۲۵۶ پیکسلی فشرده می‌شود.</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePick}
      />
    </div>
  );
}
