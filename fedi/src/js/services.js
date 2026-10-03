/**
 * Music service definitions for embed detection.
 *
 * Each service has:
 *   id          - Unique identifier, also used as localStorage key
 *   displayName - Human-readable name shown in the UI
 *   match       - Regex to detect URLs from this service
 *   buildEmbed  - Function(url) -> { src, type } or null
 *                 type is 'video', 'audio', 'bandcamp', or 'funkwhale'
 *   label       - Fallback link text
 *   isFediverse - True if this is a Fediverse-native service (gets a ⭐ in UI)
 *
 * Services are sorted alphabetically by displayName at load time.
 */
const MUSIC_SERVICES = [
    {
        id: 'apple-music',
        displayName: 'Apple Music',
        match: /music\.apple\.com\/[\w-]+\/(album|playlist|song)\/[\w-]+\/?(\d+)?/i,
        buildEmbed: (url) => {
            return { src: url.replace('music.apple.com', 'embed.music.apple.com'), type: 'audio' };
        },
        label: 'Open on Apple Music',
        isFediverse: false
    },
    {
        id: 'bandcamp',
        displayName: 'Bandcamp',
        match: /bandcamp\.com\/(track|album)\/[\w-]+/i,
        buildEmbed: (url) => {
            const trackMatch = url.match(/bandcamp\.com\/track\/([\w-]+)/i);
            const albumMatch = url.match(/bandcamp\.com\/album\/([\w-]+)/i);
            if (trackMatch) {
                return { src: `https://bandcamp.com/EmbeddedPlayer/track=${trackMatch[1]}/size=large/bgcol=333333/linkcol=ffffff/transparent=true/`, type: 'bandcamp' };
            }
            if (albumMatch) {
                return { src: `https://bandcamp.com/EmbeddedPlayer/album=${albumMatch[1]}/size=large/bgcol=333333/linkcol=ffffff/transparent=true/`, type: 'bandcamp' };
            }
            return null;
        },
        label: 'Open on Bandcamp',
        isFediverse: false
    },
    {
        id: 'bandwagon',
        displayName: 'Bandwagon',
        match: /bandwagon\.fm\/(track|album|artist)\/[\w-]+/i,
        buildEmbed: (url) => {
            const trackMatch = url.match(/bandwagon\.fm\/track\/([\w-]+)/i);
            const albumMatch = url.match(/bandwagon\.fm\/album\/([\w-]+)/i);
            if (trackMatch) {
                return { src: `https://bandwagon.fm/EmbeddedPlayer/track=${trackMatch[1]}/`, type: 'bandcamp' };
            }
            if (albumMatch) {
                return { src: `https://bandwagon.fm/EmbeddedPlayer/album=${albumMatch[1]}/`, type: 'bandcamp' };
            }
            return null;
        },
        label: 'Open on Bandwagon',
        isFediverse: true
    },
    {
        id: 'castopod',
        displayName: 'Castopod',
        match: /castopod\.org|c\.pod\./i,
        buildEmbed: (url) => {
            return { src: url.replace('/episodes/', '/embed/episodes/'), type: 'audio' };
        },
        label: 'Open on Castopod',
        isFediverse: true
    },
    {
        id: 'deezer',
        displayName: 'Deezer',
        match: /deezer\.com/i,
        buildEmbed: (url) => {
            return { src: `https://widget.deezer.com/widget/dark${new URL(url).pathname}`, type: 'audio' };
        },
        label: 'Open on Deezer',
        isFediverse: false
    },
    {
        id: 'funkwhale',
        displayName: 'Funkwhale',
        match: /funkwhale\.audio|open\.audio/i,
        buildEmbed: (url) => {
            if (url.includes('/track/') || url.includes('/album/')) {
                return { src: url.replace('/library/', '/embed/'), type: 'funkwhale' };
            }
            return null;
        },
        label: 'Open on Funkwhale',
        isFediverse: true
    },
    {
        id: 'mirlo',
        displayName: 'Mirlo',
        match: /mirlo\.xyz/i,
        buildEmbed: (url) => {
            return { src: url, type: 'audio' };
        },
        label: 'Open on Mirlo',
        isFediverse: true
    },
    {
        id: 'mixcloud',
        displayName: 'Mixcloud',
        match: /mixcloud\.com\/[\w-]+\/[\w-]+/i,
        buildEmbed: (url) => {
            return { src: `https://www.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(url)}&hide_cover=1`, type: 'audio' };
        },
        label: 'Open on Mixcloud',
        isFediverse: false
    },
    {
        id: 'soundcloud',
        displayName: 'SoundCloud',
        match: /soundcloud\.com\/[\w-]+\/[\w-]+/i,
        buildEmbed: (url) => {
            return { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false`, type: 'audio' };
        },
        label: 'Open on SoundCloud',
        isFediverse: false
    },
    {
        id: 'spotify',
        displayName: 'Spotify',
        match: /open\.spotify\.com\/(track|album|playlist|episode|show)\/([\w]+)/i,
        buildEmbed: (url) => {
            const m = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([\w]+)/i);
            if (!m) return null;
            return { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}`, type: 'audio' };
        },
        label: 'Open on Spotify',
        isFediverse: false
    },
    {
        id: 'tidal',
        displayName: 'Tidal',
        match: /tidal\.com/i,
        buildEmbed: (url) => {
            return { src: `https://embed.tidal.com${new URL(url).pathname}`, type: 'audio' };
        },
        label: 'Open on Tidal',
        isFediverse: false
    },
    {
        id: 'youtube-music',
        displayName: 'YouTube Music',
        match: /music\.youtube\.com\/watch\?v=([\w-]+)/i,
        buildEmbed: (url) => {
            const m = url.match(/music\.youtube\.com\/watch\?v=([\w-]+)/i);
            if (!m) return null;
            return { src: `https://music.youtube.com/embed/${m[1]}`, type: 'video' };
        },
        label: 'Open on YouTube Music',
        isFediverse: false
    },
    {
        id: 'vimeo',
        displayName: 'Vimeo',
        match: /vimeo\.com\/(\d+)/i,
        buildEmbed: (url) => {
            const m = url.match(/vimeo\.com\/(\d+)/i);
            if (!m) return null;
            return { src: `https://player.vimeo.com/video/${m[1]}`, type: 'video' };
        },
        label: 'Open on Vimeo',
        isFediverse: false
    }
];

// Sort alphabetically by display name for the UI
MUSIC_SERVICES.sort((a, b) => a.displayName.localeCompare(b.displayName));