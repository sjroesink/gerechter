import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { themeInitScript, watchTheme } from '~/lib/theme'
import appCss from '~/styles/app.css?url'
import { PwaControls } from '~/components/pwa-controls'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Gerechter' },
      { name: 'apple-mobile-web-app-title', content: 'Gerechter' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    ],
    links: [
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'icon', type: 'image/png', href: '/pwa/icon-192.png' },
      { rel: 'apple-touch-icon', sizes: '180x180', href: '/pwa/apple-touch-icon.png' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700&family=Figtree:wght@400;500;600;700&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  useEffect(() => {
    // Markering voor e2e-tests: React is gehydrateerd en formulieren werken.
    document.documentElement.dataset.hydrated = 'true'
    return watchTheme()
  }, [])
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* This existing before-paint script owns theme-color, including PWA browser chrome. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <PwaControls />
        <Scripts />
      </body>
    </html>
  )
}
