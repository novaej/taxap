import { getTranslations } from 'next-intl/server';
import { getFormVersion } from '../../actions';
import { FormFieldsClient } from './form-fields-client';

export default async function FormVersionPage({
  params,
}: {
  params: Promise<{ formVersionId: string }>;
}) {
  const { formVersionId } = await params;
  const t = await getTranslations('Admin');
  const version = await getFormVersion(formVersionId);

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold">
        {version.formCode} — {version.label}
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        {version.status === 'PUBLISHED' ? t('publishedNotice') : t('manualEntryNotice')}
      </p>

      <FormFieldsClient
        formVersionId={formVersionId}
        isPublished={version.status === 'PUBLISHED'}
        initialFields={version.formFields.map((f) => ({
          id: f.id,
          code: f.code,
          label: f.label,
          section: f.section,
          columnKind: f.columnKind,
          displayOrder: f.displayOrder,
        }))}
      />
    </div>
  );
}
