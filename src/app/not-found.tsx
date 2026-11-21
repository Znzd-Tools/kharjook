import Link from 'next/link';
import { Button, EmptyState } from '@/design-system';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <EmptyState
        title="۴۰۴"
        description="صفحه‌ای که دنبالش بودی پیدا نشد."
        action={
          <Button render={<Link href="/" />} nativeButton={false}>
            بازگشت به خانه
          </Button>
        }
      />
    </div>
  );
}
