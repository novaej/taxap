'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function LogoutButton({ label }: { label: string }) {
  return (
    <Button variant="outline" onClick={() => signOut({ callbackUrl: '/login' })}>
      {label}
    </Button>
  );
}
