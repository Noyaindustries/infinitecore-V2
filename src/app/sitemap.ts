import type { MetadataRoute } from 'next';
import { allSitemapPaths } from '@/lib/seo';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.infinitecore.net').replace(/\/$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return allSitemapPaths().map((path) => ({
    url: `${SITE}${path === '/' ? '' : path}`,
    lastModified: now,
    changeFrequency: path.startsWith('/applications/') ? 'weekly' : 'monthly',
    priority: path === '/' ? 1 : path.startsWith('/applications/') ? 0.9 : 0.6,
  }));
}
