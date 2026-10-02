import createMiddleware from 'next-intl/middleware';
import { auth } from './lib/auth';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Rutas que requieren sesión: todo lo que cuelga de /periodos/ (las cuatro
// pantallas del período). La portada y /login quedan públicas.
const PROTECTED_SEGMENT = '/periodos/';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.includes(PROTECTED_SEGMENT) && !req.auth) {
    const locale = routing.locales.find((l) => pathname.startsWith(`/${l}/`)) ?? routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return Response.redirect(loginUrl);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
