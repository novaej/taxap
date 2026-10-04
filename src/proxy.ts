import createMiddleware from 'next-intl/middleware';
import { auth } from './lib/auth';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

// Public paths: login, register, and the homepage (which only redirects).
// Everything else requires a session -- by exclusion, so a new screen is
// protected by default instead of requiring someone to list it by hand.
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
