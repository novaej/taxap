'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function LogoutButton({ label, className }: { label: string; className?: string }) {
  return (
    <Button variant="outline" className={className} onClick={() => signOut({ callbackUrl: '/login' })}>
      {label}
    </Button>
  );
}
