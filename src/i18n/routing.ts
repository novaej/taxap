import { defineRouting } from 'next-intl/routing';

/**
 * `es` is the only locale for now (mvp-scope.md: "es primario").
 * English is out of MVP scope (NEXT_STEPS.md) but next-intl is wired in
 * from the start so adding `en` later is just a new messages file plus
 * this array, not a routing rewrite.
 */
export const routing = defineRouting({
  locales: ['es'],
  defaultLocale: 'es',
});
