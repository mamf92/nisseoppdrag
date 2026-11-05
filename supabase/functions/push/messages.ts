// What a notification says. One message per (kind, story, language); the open-mission count is the
// only variable. The payload uses the Declarative Web Push format (WebKit, Safari 18.4+): Safari
// shows it without waking the service worker, and other browsers hand the same JSON to our
// service worker, which shows it itself.

export type Kind = 'new_week' | 'reminder' | 'test';
export type Story = 'gaarden' | 'laaven';
export type Lang = 'nb' | 'en';

export interface Target {
  endpoint: string;
  p256dh: string;
  auth: string;
  origin: string;
  lang: string;
  kind: string;
  story: string;
  open_count: number;
}

type Copy = Record<Kind, Record<Story, Record<Lang, [title: string, body: string]>>>;

const COPY: Copy = {
  new_week: {
    laaven: {
      nb: ['Nye oppdrag på låven', 'Nissen har lagt {n} oppdrag i sekken. Husk grøten!'],
      en: [
        'New missions in the barn',
        'The nisse left {n} missions in the sack. Mind the porridge!',
      ],
    },
    gaarden: {
      nb: ['Nye oppdrag på gården', '{n} nye oppdrag venter. Nissefamilien regner med deg!'],
      en: [
        'New missions on the farm',
        '{n} new missions are waiting. The nisse family counts on you!',
      ],
    },
  },
  reminder: {
    laaven: {
      nb: ['Nissen blir utålmodig', 'Du har {n} oppdrag igjen denne uka. Han venter på smøret …'],
      en: [
        'The nisse is getting restless',
        '{n} missions left this week. He is waiting for the butter …',
      ],
    },
    gaarden: {
      nb: ['Låven er ikke full ennå', '{n} oppdrag igjen denne uka. Får du hele familien hjem?'],
      en: [
        'The barn is not full yet',
        '{n} missions left this week. Can you bring the family home?',
      ],
    },
  },
  test: {
    laaven: {
      nb: ['Nissen sier hei', 'Varslene virker. Han sier fra når grøten trengs.'],
      en: ['The nisse says hi', 'Notifications work. He will tell you when the porridge is due.'],
    },
    gaarden: {
      nb: ['Nissefar sier hei', 'Varslene virker. Du hører fra oss når nye oppdrag ligger klare.'],
      en: [
        'Nissefar says hi',
        'Notifications work. You will hear from us when missions are ready.',
      ],
    },
  },
};

function pick<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function compose(target: Target) {
  const kind = pick<Kind>(target.kind, ['new_week', 'reminder', 'test'], 'test');
  const story = pick<Story>(target.story, ['gaarden', 'laaven'], 'gaarden');
  const lang = pick<Lang>(target.lang, ['nb', 'en'], 'nb');
  const [title, body] = COPY[kind][story][lang];
  const count = Math.max(0, Math.min(99, Math.trunc(target.open_count) || 0));
  const message = {
    web_push: 8030,
    notification: {
      title,
      body: body.replace('{n}', String(count)),
      navigate: `${target.origin}/`,
      lang,
      dir: 'ltr',
      tag: kind,
      silent: false,
    },
    // The home-screen icon shows how many missions are still open this week.
    app_badge: String(count),
  };
  return {
    message,
    options: {
      topic: kind.replace('_', '-'),
      urgency: kind === 'test' ? ('high' as const) : ('normal' as const),
      // a Monday or Thursday nudge is stale after a day; a test after ten minutes
      ttlSeconds: kind === 'test' ? 600 : 24 * 3600,
    },
  };
}
