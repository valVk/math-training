import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Regenerate the PNG icons in public/ after changing public/icon.svg: npm run pwa-assets
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // The icon already has a full-bleed background, so keep it on every variant.
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#3a342f' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#3a342f' } }
  },
  images: ['public/icon.svg']
})
