'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil, Trash2 } from 'lucide-react';
import { addFormField, removeFormField, publishFormVersion, updateFormField } from '../../actions';

type ColumnKind = 'GROSS' | 'NET' | 'TAX' | 'SINGLE';

interface FieldRow {
  id: string;
  code: string;
  label: string;
  section: string | null;
  columnKind: ColumnKind;
  displayOrder: number;
}

export function FormFieldsClient({
  formVersionId,
  isPublished,
  initialFields,
}: {
  formVersionId: string;
  isPublished: boolean;
  initialFields: FieldRow[];
}) {
  const t = useTranslations('Admin');
  const common = useTranslations('Common');

  const [fields, setFields] = useState(initialFields);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [section, setSection] = useState('');
  const [columnKind, setColumnKind] = useState<ColumnKind>('SINGLE');
  const [error, setError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function openAdd() {
    setEditingId(null);
    setCode('');
    setLabel('');
    setSection('');
    setColumnKind('SINGLE');
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(f: FieldRow) {
    setEditingId(f.id);
    setCode(f.code);
    setLabel(f.label);
    setSection(f.section ?? '');
    setColumnKind(f.columnKind);
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!editingId) return handleAddField();
    setIsSubmitting(true);
    setError(null);
    const result = await updateFormField(formVersionId, editingId, {
      code,
      label,
      section: section || undefined,
      columnKind,
    });
    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error === 'DUPLICATE' ? t('duplicateCodesError') : t('unknownError'));
      return;
    }
    setFields((prev) =>
      prev.map((f) =>
        f.id === editingId ? { ...f, code, label, section: section || null, columnKind } : f
      )
    );
    setDialogOpen(false);
  }

  async function handleAddField() {
    setIsSubmitting(true);
    setError(null);

    const result = await addFormField({
      formVersionId,
      code,
      label,
      section: section || undefined,
      columnKind,
      displayOrder: fields.length,
    });

    if (!result.success || !result.field) {
      setError(result.error === 'DUPLICATE_CODE' ? t('duplicateCodesError') : t('unknownError'));
      setIsSubmitting(false);
      return;
    }

    setFields((prev) => [
      ...prev,
      {
        id: result.field!.id,
        code: result.field!.code,
        label: result.field!.label,
        section: result.field!.section,
        columnKind: result.field!.columnKind,
        displayOrder: result.field!.displayOrder,
      },
    ]);
    setCode('');
    setLabel('');
    setSection('');
    setColumnKind('SINGLE');
    setIsSubmitting(false);
    setDialogOpen(false);
  }

  async function handleRemove(fieldId: string) {
    await removeFormField(formVersionId, fieldId);
    setFields((prev) => prev.filter((f) => f.id !== fieldId));
  }

  async function handlePublish() {
    setPublishError(null);
    const result = await publishFormVersion(formVersionId);
    if (!result.success) {
      setPublishError(result.error === 'NO_FIELDS' ? t('noFieldsError') : t('unknownError'));
      return;
    }
    window.location.reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{t('fieldsHeading')}</h3>
        {!isPublished && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <Button variant="outline" size="sm" onClick={openAdd}>
              {t('addFieldButton')}
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? t('editFieldTitle') : t('addFieldTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('fieldCode')}</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('fieldLabel')}</Label>
                  <Input value={label} onChange={(e) => setLabel(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>
                    {t('fieldSection')}{' '}
                    <span className="text-muted-foreground">{t('fieldSectionOptional')}</span>
                  </Label>
                  <Input value={section} onChange={(e) => setSection(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('columnKind')}</Label>
                  <Select value={columnKind} onValueChange={(v) => setColumnKind(v as ColumnKind)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GROSS">{t('columnKindOptions.GROSS')}</SelectItem>
                      <SelectItem value="NET">{t('columnKindOptions.NET')}</SelectItem>
                      <SelectItem value="TAX">{t('columnKindOptions.TAX')}</SelectItem>
                      <SelectItem value="SINGLE">{t('columnKindOptions.SINGLE')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
              <DialogFooter>
                <Button onClick={handleSave} disabled={isSubmitting || !code || !label}>
                  {editingId ? common('save') : t('addFieldButton')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {fields.length === 0 ? (
        <p className="text-muted-foreground">{t('fieldsEmpty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fieldCode')}</TableHead>
              <TableHead>{t('fieldLabel')}</TableHead>
              <TableHead>{t('fieldSection')}</TableHead>
              <TableHead>{t('columnKind')}</TableHead>
              {!isPublished && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((f) => (
              <TableRow key={f.id}>
                <TableCell>{f.code}</TableCell>
                <TableCell>{f.label}</TableCell>
                <TableCell>{f.section ?? '—'}</TableCell>
                <TableCell>{t(`columnKindOptions.${f.columnKind}`)}</TableCell>
                {!isPublished && (
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={t('editButton')}
                      aria-label={t('editButton')}
                      onClick={() => openEdit(f)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title={common('delete')}
                      aria-label={common('delete')}
                      onClick={() => handleRemove(f.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!isPublished && (
        <>
          {publishError && (
            <Alert variant="destructive">
              <AlertDescription>{publishError}</AlertDescription>
            </Alert>
          )}
          <Button onClick={handlePublish}>{t('publishButton')}</Button>
        </>
      )}
    </div>
  );
}
