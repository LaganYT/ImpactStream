import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/TVGarden/tv-garden-channel-list/refs/heads/main/channels/raw/categories/all-channels.json'
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch channels');
    }

    const channels = await response.json();
    
    // Filter channels that have either IPTV URLs or YouTube URLs
    const validChannels = channels.filter((channel: any) => 
      (channel.iptv_urls && channel.iptv_urls.length > 0) || 
      (channel.youtube_urls && channel.youtube_urls.length > 0)
    );

    res.status(200).json(validChannels);
  } catch (error) {
    console.error('Error fetching live TV channels:', error);
    res.status(500).json({ message: 'Failed to fetch channels' });
  }
}
