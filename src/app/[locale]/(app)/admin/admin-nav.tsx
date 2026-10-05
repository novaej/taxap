'use client';

import { cn } from 'cn';
import { Link, usePathname } from '@/i18n/navigation';

export function AdminNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex gap-4 border-b text-sm">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
          className={cn(
            '-mb-px border-b-2 px-1 py-2',
            pathname.startsWith(item.href)
              ? 'border-primary font-medium text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
