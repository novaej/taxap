import { getTranslations } from 'next-intl/server';
import { getFormVersions } from '../actions';
import { FormulariosClient } from './formularios-client';

export default async function FormulariosPage() {
  const t = await getTranslations('Admin');
  const versions = await getFormVersions();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('formulariosTitle')}</h2>
      </div>
      <FormulariosClient
        initialVersions={versions.map((v) => ({
          id: v.id,
          formCode: v.formCode,
          label: v.label,
          validFrom: v.validFrom.toISOString(),
          status: v.status,
          fieldCount: v._count.formFields,
        }))}
      />
    </div>
  );
}
