'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { removeSourceFile } from './actions';

export function RemoveFileButton({
  sourceFileId,
  taxpayerId,
  periodId,
  importedCount,
}: {
  sourceFileId: string;
  taxpayerId: string;
  periodId: string;
  importedCount: number;
}) {
  const t = useTranslations('Ingesta');
  const common = useTranslations('Common');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(t('removeConfirm', { count: importedCount }))) return;
    setError(null);
    startTransition(async () => {
      const result = await removeSourceFile(sourceFileId, taxpayerId, periodId);
      if (!result.success) {
        setError(result.error === 'PERIOD_FILED' ? t('removeFiledError') : t('removeError'));
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        variant="ghost"
        size="icon-sm"
        title={common('delete')}
        aria-label={common('delete')}
        disabled={isPending}
        onClick={handleClick}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
