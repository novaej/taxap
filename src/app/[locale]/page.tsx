import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Inbox, Receipt, ListChecks, FileCheck } from 'lucide-react';

// No hay todavía pantalla de alta de contribuyente ni selector de período
// (NEXT_STEPS.md -> Por construir), así que estos enlaces usan un
// taxpayerId/periodId provisional hasta que esa pantalla exista.
const DEMO_PATH = '/demo/periodos/demo';

export default function HomePage() {
  const t = useTranslations('HomePage');

  const modules = [
    { key: 'ingesta', href: `${DEMO_PATH}/ingesta`, Icon: Inbox },
    { key: 'ventas', href: `${DEMO_PATH}/ventas`, Icon: Receipt },
    { key: 'conciliacion', href: `${DEMO_PATH}/conciliacion`, Icon: ListChecks },
    { key: 'predeclaracion', href: DEMO_PATH, Icon: FileCheck },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{t('subtitle')}</p>
      </header>

      <h2 className="mb-4 text-xl font-semibold">{t('modulesHeading')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {modules.map(({ key, href, Icon }) => (
          <Link key={key} href={href}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardHeader>
                <Icon className="mb-2 size-6 text-primary" />
                <CardTitle>{t(`${key}.title`)}</CardTitle>
                <CardDescription>{t(`${key}.description`)}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
