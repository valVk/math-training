export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/eslint', 'nuxt-auth-utils'],

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'bg' },
      title: 'Смятанка',
      meta: [{ name: 'description', content: 'Математика за 3. клас' }]
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
  }
})
