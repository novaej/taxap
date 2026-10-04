import createMiddleware from 'next-intl/middleware';
import { auth } from './lib/auth';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Rutas públicas: login, registro y la portada (que solo redirige). Todo lo
// demás exige sesión -- por exclusión, para que una pantalla nueva quede
// protegida por defecto en vez de requerir que alguien la liste a mano.
const PUBLIC_PATHS = ['/login', '/register'];

function isPublicPath(pathname: string): boolean {
  const withoutLocale = routing.locales.reduce(
    (path, locale) => (path.startsWith(`/${locale}/`) || path === `/${locale}` ? path.replace(`/${locale}`, '') : path),
    pathname
  );
  return withoutLocale === '' || withoutLocale === '/' || PUBLIC_PATHS.some((p) => withoutLocale.startsWith(p));
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (!isPublicPath(pathname) && !req.auth) {
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
