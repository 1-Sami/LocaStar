import cloudflare from '@astrojs/cloudflare';
import { defineConfig } from 'astro/config';

export default defineConfig({
  /*
   * Fixed, not derived from the request.
   *
   * Canonical URLs and sitemap entries must name the real site whatever host
   * served the response — a canonical pointing at a workers.dev preview or at
   * localhost tells Google to index that instead.
   */
  site: 'https://locastar.se',
  output: 'server',
  adapter: cloudflare(),
});
