'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Pencil, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createFormVersionDraft, deleteFormVersion, updateFormVersion } from '../actions';

interface VersionRow {
  id: string;
  formCode: string;
  label: string;
  validFrom: string;
  status: string;
  fieldCount: number;
}

export function FormulariosClient({ initialVersions }: { initialVersions: VersionRow[] }) {
  const t = useTranslations('Admin');
  const common = useTranslations('Common');
  const router = useRouter();

  const [versions, setVersions] = useState(initialVersions);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formCode, setFormCode] = useState('104');
  const [label, setLabel] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  async function handleCreate() {
    if (!file) return;
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    const result = await createFormVersionDraft({ formCode, label, validFrom, formData });
    setIsSubmitting(false);

    if (!result.success || !result.formVersionId) {
      setError(result.error === 'ALREADY_EXISTS' ? t('alreadyExistsError') : t('unknownError'));
      return;
    }

    setDialogOpen(false);
    router.push(`/admin/formularios/${result.formVersionId}`);
  }

  const [editing, setEditing] = useState<VersionRow | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editValidFrom, setEditValidFrom] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  function openEdit(v: VersionRow) {
    setEditing(v);
    setEditLabel(v.label);
    setEditValidFrom(v.validFrom.slice(0, 10));
    setEditError(null);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setIsSubmitting(true);
    const result = await updateFormVersion(editing.id, { label: editLabel, validFrom: editValidFrom });
    setIsSubmitting(false);
    if (!result.success) {
      setEditError(
        result.error === 'DUPLICATE'
          ? t('alreadyExistsError')
          : result.error === 'PUBLISHED'
            ? t('versionPublishedError')
            : t('unknownError')
      );
      return;
    }
    const id = editing.id;
    setVersions((prev) =>
      prev.map((v) =>
        v.id === id ? { ...v, label: editLabel, validFrom: `${editValidFrom}T00:00:00.000Z` } : v
      )
    );
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('deleteVersionConfirm'))) return;
    setListError(null);
    const result = await deleteFormVersion(id);
    if (!result.success) {
      setListError(result.error === 'IN_USE' ? t('versionInUseError') : t('unknownError'));
      return;
    }
    setVersions((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>{t('newVersionButton')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('newVersionTitle')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('formCode')}</Label>
                <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('label')}</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('validFrom')}</Label>
                <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('uploadPdfLabel')}</Label>
                <Input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreate}
                disabled={isSubmitting || !file || !label || !validFrom}
              >
                {t('createDraftButton')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {listError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{listError}</AlertDescription>
        </Alert>
      )}

      {versions.length === 0 ? (
        <p className="text-muted-foreground">{t('formulariosEmpty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('formCode')}</TableHead>
              <TableHead>{t('label')}</TableHead>
              <TableHead>{t('validFrom')}</TableHead>
              <TableHead>{t('fieldsCount')}</TableHead>
              <TableHead>{t('colStatus')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {versions.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  <Link href={`/admin/formularios/${v.id}`} className="font-medium hover:underline">
                    {v.formCode}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/formularios/${v.id}`} className="hover:underline">
                    {v.label}
                  </Link>
                </TableCell>
                <TableCell>
                  {new Date(v.validFrom).toLocaleDateString('es-EC', { timeZone: 'UTC' })}
                </TableCell>
                <TableCell>{v.fieldCount}</TableCell>
                <TableCell>
                  <Badge variant={v.status === 'PUBLISHED' ? 'default' : 'outline'}>
                    {v.status === 'PUBLISHED' ? t('statusPublished') : t('statusDraft')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {v.status !== 'PUBLISHED' && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={t('editButton')}
                      aria-label={t('editButton')}
                      onClick={() => openEdit(v)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title={common('delete')}
                    aria-label={common('delete')}
                    onClick={() => handleDelete(v.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editVersionTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('label')}</Label>
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('validFrom')}</Label>
              <Input
                type="date"
                value={editValidFrom}
                onChange={(e) => setEditValidFrom(e.target.value)}
              />
            </div>
            {editError && (
              <Alert variant="destructive">
                <AlertDescription>{editError}</AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleSaveEdit} disabled={isSubmitting || !editLabel || !editValidFrom}>
              {common('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
