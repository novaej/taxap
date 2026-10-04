import { redirect } from '@/i18n/navigation';
import { auth } from '@/lib/auth';

export default async function HomePage() {
  const session = await auth();
  redirect({ href: session ? '/taxpayers' : '/login', locale: 'es' });
}
