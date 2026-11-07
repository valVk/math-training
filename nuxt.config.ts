export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', 'nuxt-auth-utils', '@vite-pwa/nuxt'],

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'bg' },
      title: 'Смятанка',
      meta: [
        { name: 'description', content: 'Математика за 3. клас' },
        { name: 'theme-color', content: '#3a342f' }
      ],
      // Icons are generated from public/icon.svg by `npm run pwa-assets`.
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  ui: {
    colorMode: false
  },

  runtimeConfig: {
    anthropicApiKey: '',
    anthropicModel: 'claude-sonnet-5-5',
    dbPath: './data/math.sqlite',
    // Comma-separated email:password pairs, set via NUXT_PARENTS
    parents: '',
    session: {
      // Set via NUXT_SESSION_PASSWORD, at least 32 characters
      password: '',
      // A parent signs in once per device and stays signed in for a year, until they log out.
      maxAge: 60 * 60 * 24 * 365,
      cookie: {
        sameSite: 'lax',
        // The Pi serves plain http on the LAN, where browsers drop secure cookies.
        // Set NUXT_SESSION_COOKIE_SECURE=true when the app is behind HTTPS.
        secure: false
      }
    }
  },

  // Docker on macOS does not forward file-change events into bind mounts; the dev container sets
  // WATCH_POLLING=1 so edits on the host still trigger hot reload.
  watchers: {
    chokidar: { usePolling: Boolean(process.env.WATCH_POLLING), interval: 300 }
  },

  compatibilityDate: '2026-11-01',

  vite: {
    server: {
      watch: process.env.WATCH_POLLING ? { usePolling: true, interval: 300 } : undefined
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  fonts: {
    defaults: {
      subsets: ['latin', 'cyrillic']
    }
  },

  // Installable app for the child's tablet. The app needs the server for every problem, so the
  // service worker only caches the built assets (faster start); pages and /api always go to the network.
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Смятанка',
      short_name: 'Смятанка',
      description: 'Математика за 3. клас',
      lang: 'bg',
      start_url: '/',
      display: 'standalone',
      theme_color: '#3a342f',
      background_color: '#f4eee3',
      icons: [
        { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
      ]
    },
    workbox: {
      // Pages are server-rendered per request, so there is no HTML to fall back to offline.
      navigateFallback: undefined,
      globPatterns: ['**/*.{js,css,png,svg,ico,woff2}']
    },
    client: { installPrompt: false }
  }
})
