/**
 * Music hashtag definitions.
 *
 * Each entry becomes a clickable chip in the hashtag bar when the Music
 * filter is active. The `tag` value is used to build the search query
 * (without the leading #). `label` is what the user sees.
 *
 * The special "freeform" option (Firehose) is always added by the app
 * as the first chip — it scans the public timeline for music service
 * embeds instead of searching a hashtag.
 */
const MUSIC_HASHTAGS = [
    { tag: 'music',       label: '#music' },
    { tag: 'bandcamp',    label: '#bandcamp' },
    { tag: 'newmusic',    label: '#newmusic' },
    { tag: 'electronic',  label: '#electronic' },
    { tag: 'jazz',        label: '#jazz' },
    { tag: 'hiphop',      label: '#hiphop' },
    { tag: 'rock',        label: '#rock' },
    { tag: 'indie',       label: '#indie' },
    { tag: 'classical',   label: '#classical' },
    { tag: 'ambient',     label: '#ambient' },
    { tag: 'folk',        label: '#folk' },
    { tag: 'metal',       label: '#metal' },
    { tag: 'punk',        label: '#punk' },
    { tag: 'soul',        label: '#soul' },
    { tag: 'funk',        label: '#funk' },
    { tag: 'livemusic',   label: '#livemusic' },
    { tag: 'nowplaying',  label: '#nowplaying' },
    { tag: 'song',        label: '#song' }
];