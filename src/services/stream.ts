const PROVIDERS = [
  'https://vidsrc.me/embed/',
  'https://vidlink.pro/embed/',
  'https://autoembed.cc/movie/',
  'https://embed.su/',
  'https://vidsrc.cc/embed/',
  'https://vidsrc.icu/embed/',
  'https://vidsrc.to/embed/'
];

export async function getStreamingLinks(type: string, id: string) {
  // For demonstration, just return embed URLs for each provider
  // In a real implementation, you may need to adjust the URL format per provider
  return PROVIDERS.map((base) => {
    let url = base;
    if (base.includes('autoembed.cc')) {
      url += `${type === 'movie' ? 'movie' : 'tv'}/${id}`;
    } else {
      url += `${type}/${id}`;
    }
    return { provider: base, embedUrl: url };
  });
} 