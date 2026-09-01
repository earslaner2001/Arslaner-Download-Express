/**
 * Format selection + URL helpers for the MediaPull renderer.
 * Works both as a browser script and as a Node module (tests).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MediaPullFormat = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const KIND = Object.freeze({
    MP4: 'mp4',
    PRORES: 'prores',
    AUDIO: 'audio'
  });

  const RESOLUTION = Object.freeze({
    P1080: '1080',
    P4K: '4k'
  });

  const AUDIO = Object.freeze({
    MP3: 'mp3',
    WAV: 'wav'
  });

  const FORMAT_META = Object.freeze({
    'yt-1080-avc1': { id: 'yt-1080-avc1', label: '1080p MP4 H.264', pro: false, ext: 'mp4' },
    'yt-4k-avc1': { id: 'yt-4k-avc1', label: '4K MP4 H.264', pro: true, ext: 'mp4' },
    'yt-prores': { id: 'yt-prores', label: 'Apple ProRes 422 HQ', pro: true, ext: 'mov' },
    bestaudio: { id: 'bestaudio', label: 'MP3', pro: false, ext: 'mp3' },
    'yt-wav': { id: 'yt-wav', label: 'WAV / 320kbps', pro: true, ext: 'wav' }
  });

  const TWITTER_HOSTS = new Set([
    'twitter.com',
    'www.twitter.com',
    'mobile.twitter.com',
    'x.com',
    'www.x.com'
  ]);

  const YOUTUBE_HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtu.be'
  ]);

  function createFormatState(initial) {
    return {
      kind: initial?.kind || KIND.MP4,
      resolution: initial?.resolution || RESOLUTION.P1080,
      audio: initial?.audio || AUDIO.MP3
    };
  }

  function selectCard(state, cardId) {
    const next = {
      kind: state.kind,
      resolution: state.resolution,
      audio: state.audio
    };

    switch (cardId) {
      case 'prores':
        next.kind = KIND.PRORES;
        break;
      case 'mp4':
        next.kind = KIND.MP4;
        break;
      case '4k':
        next.resolution = RESOLUTION.P4K;
        if (next.kind === KIND.AUDIO) next.kind = KIND.MP4;
        break;
      case '1080p':
        next.resolution = RESOLUTION.P1080;
        if (next.kind === KIND.AUDIO) next.kind = KIND.MP4;
        break;
      case 'audio':
        next.kind = KIND.AUDIO;
        break;
      case 'mp3':
        next.kind = KIND.AUDIO;
        next.audio = AUDIO.MP3;
        break;
      case 'wav':
        next.kind = KIND.AUDIO;
        next.audio = AUDIO.WAV;
        break;
      default:
        break;
    }

    return next;
  }

  function resolveFormat(state) {
    if (state.kind === KIND.PRORES) return FORMAT_META['yt-prores'];
    if (state.kind === KIND.AUDIO) {
      return state.audio === AUDIO.WAV ? FORMAT_META['yt-wav'] : FORMAT_META.bestaudio;
    }
    if (state.resolution === RESOLUTION.P4K) return FORMAT_META['yt-4k-avc1'];
    return FORMAT_META['yt-1080-avc1'];
  }

  function isCardActive(state, cardId) {
    switch (cardId) {
      case 'prores':
        return state.kind === KIND.PRORES;
      case 'mp4':
        return state.kind === KIND.MP4;
      case '4k':
        return state.kind !== KIND.AUDIO && state.resolution === RESOLUTION.P4K;
      case '1080p':
        return state.kind !== KIND.AUDIO && state.resolution === RESOLUTION.P1080;
      case 'audio':
      case 'mp3':
      case 'wav':
        return state.kind === KIND.AUDIO;
      default:
        return false;
    }
  }

  function isCardLocked(state, cardId, isPro) {
    if (isPro) return false;
    if (cardId === 'prores' || cardId === '4k' || cardId === 'wav') return true;
    if (cardId === 'audio' && state.audio === AUDIO.WAV) return true;
    return false;
  }

  function hostnameOf(raw) {
    try {
      const u = new URL(String(raw || '').trim());
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  function isTwitterOrXUrl(raw) {
    return TWITTER_HOSTS.has(hostnameOf(raw));
  }

  function isYoutubeUrl(raw) {
    const host = hostnameOf(raw);
    return YOUTUBE_HOSTS.has(host) || host.endsWith('.youtube.com');
  }

  function isSupportedUrl(raw) {
    return isTwitterOrXUrl(raw) || isYoutubeUrl(raw);
  }

  function detectPlatform(raw) {
    if (isTwitterOrXUrl(raw)) return 'x';
    if (isYoutubeUrl(raw)) return 'youtube';
    return '';
  }

  function normalizeProgress(data) {
    if (typeof data === 'number' && Number.isFinite(data)) {
      return { percent: data, speed: null, size: null, eta: null };
    }
    if (!data || typeof data !== 'object') {
      return { percent: 0, speed: null, size: null, eta: null };
    }
    const percent = Number(data.percent);
    return {
      percent: Number.isFinite(percent) ? percent : 0,
      speed: data.speed || null,
      size: data.size || null,
      eta: data.eta || null
    };
  }

  function displaySpeed(speed) {
    if (!speed) return null;
    return String(speed).replace(/\s+/g, ' ').trim();
  }

  function displayEta(eta) {
    if (!eta) return null;
    return String(eta).trim();
  }

  function previewFilename(format) {
    const ext = format?.ext || 'mp4';
    const slug = String(format?.label || format?.id || 'MediaPull')
      .replace(/[^\w.-]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `${slug || 'MediaPull'}.${ext}`;
  }

  return {
    KIND,
    RESOLUTION,
    AUDIO,
    FORMAT_META,
    createFormatState,
    selectCard,
    resolveFormat,
    isCardActive,
    isCardLocked,
    isTwitterOrXUrl,
    isYoutubeUrl,
    isSupportedUrl,
    detectPlatform,
    normalizeProgress,
    displaySpeed,
    displayEta,
    previewFilename
  };
});
