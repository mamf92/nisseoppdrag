import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useI18n, useT } from '../i18n/I18nProvider';
import { useTheme } from '../themes/ThemeProvider';
import { useCurrentSeason, useLeaderboard, useBadges, badgeFile } from '../game/queries';
import { UNDO_MS, useWeekActions, useWeekQuery } from '../game/useWeek';
import { countdown, hatchStates, isFullWeek, slotAt } from '../game/week';
import type { Slot, Week } from '../game/week';
import { Moment, StoryPainting } from '../home/Moment';
import { useNow } from '../home/useNow';
import { Badge, Button, CATEGORIES, Hatches, MissionCard, StatTile, TokenChip } from '../ui';
import { Sheet } from '../ui';
import { hatchArt } from '../ui/hatchArt';

type OpenWeek = Extract<Week, { state: 'open' }>;

function Closing({ week }: { week: OpenWeek }) {
  const t = useT();
  const now = useNow();
  const left = countdown(week.closesAt, now);
  if (left.over) return <p className="n-closing">{t('home.closing.over')}</p>;
  const key = left.days > 0 ? 'home.closing.days' : 'home.closing.hours';
  return <p className="n-closing">{t(key, { d: left.days, h: left.hours, m: left.minutes })}</p>;
}

function SeasonNote({ week, admin }: { week: Week | undefined; admin: boolean }) {
  const t = useT();
  const { theme } = useTheme();
  const season = useCurrentSeason(week?.state === 'no_active_week');
  if (season.isPending) return <p role="status">{t('app.loading')}</p>;
  const finished = season.data?.status === 'finished';
  return (
    <section className="n-note" aria-labelledby="no-week">
      <h2 id="no-week">{t(finished ? 'home.over.title' : 'home.none.title')}</h2>
      <p>{t(finished ? 'home.over.lead' : 'home.none.lead')}</p>
      {admin && !finished ? (
        <>
          <p>{t('home.none.admin')}</p>
          <Link
            to="/kontor/sesong"
            className="n-btn n-btn--dark"
            style={{ textDecoration: 'none' }}
          >
            {t('home.none.admin.link')}
          </Link>
        </>
      ) : null}
      <div className="n-note__art">
        <StoryPainting file={theme === 'laaven' ? 'R-10-keeping-watch' : 'L-12-hayloft-feast'} />
      </div>
    </section>
  );
}

export function HomePage() {
  const t = useT();
  const { lang } = useI18n();
  const { theme } = useTheme();
  const { state } = useAuth();
  const week = useWeekQuery();
  const board = useLeaderboard('season');
  const badges = useBadges();

  const [skipSlot, setSkipSlot] = useState<Slot | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [fullWeekShown, setFullWeekShown] = useState(false);
  const [showFullWeek, setShowFullWeek] = useState(false);
  const wasFull = useRef<boolean | null>(null);

  const actions = useWeekActions((result) => {
    if (result.newAchievements.length > 0) setNewBadges(result.newAchievements);
  });

  // The slots as the player sees them: a completion inside the undo window already looks done.
  const slots = useMemo<Slot[]>(() => {
    if (week.data?.state !== 'open') return [];
    return week.data.slots.map((slot) =>
      actions.pending.has(slot.assignmentId) && slot.status === 'open'
        ? { ...slot, status: 'completed' as const, pointsAwarded: slot.points }
        : slot,
    );
  }, [week.data, actions.pending]);

  // The barn-door scene plays once, when the fifth mission has just been sealed by the server.
  const full = week.data?.state === 'open' && isFullWeek(week.data.slots);
  useEffect(() => {
    if (week.data?.state !== 'open') return;
    if (wasFull.current === false && full && !fullWeekShown) {
      setFullWeekShown(true);
      setShowFullWeek(true);
    }
    wasFull.current = full;
  }, [full, week.data, fullWeekShown]);

  if (state.status !== 'member') return null;
  const { me } = state;

  const mine = board.data?.find((row) => row.memberId === me.memberId);
  const openWeek = week.data?.state === 'open' ? week.data : null;
  const unlockedNow = (badges.data ?? []).filter((b) => newBadges.includes(b.code));

  return (
    <main className="n-home">
      <header className="n-home__head">
        <h1>{t('home.welcome', { name: me.name })}</h1>
      </header>

      {week.isPending ? <p role="status">{t('app.loading')}</p> : null}
      {week.isError ? (
        <div role="alert" className="n-note">
          <p>{t('error.load')}</p>
          <Button
            variant="ghost"
            onClick={() => {
              void week.refetch();
            }}
          >
            {t('error.retry')}
          </Button>
        </div>
      ) : null}
      {week.data?.state === 'no_active_week' ? (
        <SeasonNote week={week.data} admin={me.role === 'admin'} />
      ) : null}

      {openWeek ? (
        <div className="n-home__grid">
          <section className="n-home__main" aria-labelledby="week-title">
            <h2 id="week-title">{t('home.week')}</h2>
            <Hatches states={hatchStates(slots)} />
            <ol className="n-missions">
              {CATEGORIES.map((category, index) => {
                const slot = slotAt(slots, index);
                const gift = t(
                  theme === 'laaven' ? 'mission.gift.laaven' : 'mission.gift.gaarden',
                  { item: t(hatchArt(theme, category).nameKey) },
                );
                if (!slot) {
                  return (
                    <li key={category} className="n-missions__empty">
                      <p>
                        <b>{t(`category.${category}`)}</b> · {t('home.empty')}
                      </p>
                    </li>
                  );
                }
                const undoable = actions.undoable.has(slot.assignmentId);
                return (
                  <li key={slot.assignmentId}>
                    <MissionCard
                      category={category}
                      title={lang === 'en' ? slot.titleEn : slot.titleNb}
                      body={lang === 'en' ? slot.bodyEn : slot.bodyNb}
                      points={slot.points}
                      difficulty={slot.difficulty}
                      status={
                        slot.status === 'completed'
                          ? 'done'
                          : slot.status === 'skipped'
                            ? 'skipped'
                            : 'open'
                      }
                      gift={gift}
                      shake={actions.shaken === slot.slot}
                      skipDisabled={!openWeek.skipLeft}
                      rerollDisabled={!openWeek.rerollLeft}
                      busy={actions.busy}
                      onComplete={() => {
                        actions.startComplete(slot.assignmentId);
                      }}
                      onSkip={() => {
                        setSkipSlot(slot);
                      }}
                      onReroll={() => {
                        actions.reroll(slot.assignmentId, slot.slot);
                      }}
                      onUndo={
                        undoable
                          ? () => {
                              actions.undoComplete(slot.assignmentId);
                            }
                          : slot.status === 'skipped'
                            ? () => {
                                actions.unskip(slot.assignmentId);
                              }
                            : undefined
                      }
                      undoNote={undoable ? t('home.undo.text', { n: UNDO_MS / 1000 }) : undefined}
                    />
                  </li>
                );
              })}
            </ol>
          </section>

          <aside className="n-home__side" aria-label={t('home.side')}>
            <Closing week={openWeek} />
            <div className="n-home__tokens">
              <TokenChip kind="skip" left={openWeek.skipLeft ? 1 : 0} />
              <TokenChip kind="reroll" left={openWeek.rerollLeft ? 1 : 0} />
            </div>
            <div className="n-home__stats">
              <StatTile value={mine?.points ?? 0} label={t('home.stat.points')} />
              <StatTile value={mine ? `#${String(mine.rank)}` : '–'} label={t('home.stat.rank')} />
            </div>
          </aside>
        </div>
      ) : null}

      <Sheet
        open={skipSlot !== null}
        onClose={() => {
          setSkipSlot(null);
        }}
        title={t('home.skip.title')}
      >
        <p>{t('home.skip.body')}</p>
        <div className="n-actions">
          <Button
            variant="dark"
            onClick={() => {
              if (skipSlot) actions.skip(skipSlot.assignmentId);
              setSkipSlot(null);
            }}
          >
            {t('home.skip.confirm')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSkipSlot(null);
            }}
          >
            {t('common.cancel')}
          </Button>
        </div>
      </Sheet>

      <Moment
        open={showFullWeek}
        title={t(theme === 'laaven' ? 'moment.full.title.laaven' : 'moment.full.title.gaarden')}
        onClose={() => {
          setShowFullWeek(false);
        }}
        art={
          <StoryPainting file={theme === 'laaven' ? 'R-10-keeping-watch' : 'L-12-hayloft-feast'} />
        }
      >
        <p>{t(theme === 'laaven' ? 'moment.full.body.laaven' : 'moment.full.body.gaarden')}</p>
      </Moment>

      <Moment
        open={unlockedNow.length > 0}
        title={t('moment.badge.title')}
        onClose={() => {
          setNewBadges([]);
        }}
        art={
          <div className="n-moment__badges">
            {unlockedNow.map((b) => (
              <Badge
                key={b.code}
                file={badgeFile(b.code)}
                name={lang === 'en' ? b.nameEn : b.nameNb}
                isNew
              />
            ))}
          </div>
        }
      >
        {unlockedNow.map((b) => (
          <p key={b.code}>{lang === 'en' ? b.descriptionEn : b.descriptionNb}</p>
        ))}
      </Moment>
    </main>
  );
}
