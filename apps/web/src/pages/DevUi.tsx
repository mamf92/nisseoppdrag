import { useState } from 'react';
import type { ReactNode } from 'react';
import { useT } from '../i18n/I18nProvider';
import type { Theme } from '../themes/theme';
import {
  AppNav,
  Badge,
  Button,
  CATEGORIES,
  CategoryTile,
  Chip,
  Hatches,
  Icon,
  Lantern,
  LanguageSwitch,
  LeaderboardRow,
  MissionCard,
  NisseAvatar,
  RosemalingDivider,
  Sheet,
  StatTile,
  ThemeSwitch,
  TextField,
  TokenChip,
  TulipCorners,
  useToast,
} from '../ui';
import type { HatchState } from '../ui';

const WEEK: HatchState[] = ['done', 'done', 'open', 'closed', 'skipped'];

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h3 className="text-sm font-bold uppercase tracking-widest text-ink-muted">{title}</h3>
      {children}
    </section>
  );
}

function ThemeFrame({ theme }: { theme: Theme }) {
  const t = useT();
  const toast = useToast();
  const [shake, setShake] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');

  return (
    <div
      data-nisse-theme={theme}
      data-testid={`frame-${theme}`}
      className="grid gap-8 rounded-2xl bg-bg p-5 font-body text-ink"
    >
      <header className="grid gap-1">
        <p className="n-eyebrow">
          {theme === 'laaven' ? 'Låven · Grøt til nissen!' : 'Gården · Full låve!'}
        </p>
        <h2 className="font-display text-4xl font-bold leading-none">{t('app.name')}</h2>
        <p className="text-ink-muted">Ukens oppdrag · 4 dager igjen</p>
      </header>

      <RosemalingDivider />

      <Block title="Categories">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {CATEGORIES.map((c) => (
            <div
              key={c}
              className="grid justify-items-center gap-1 text-center text-sm font-semibold"
            >
              <CategoryTile category={c} />
              {t(`category.${c}`)}
            </div>
          ))}
        </div>
      </Block>

      <Block title="Buttons and chips">
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t('mission.complete')}</Button>
          <Button variant="dark">{t('nav.leaderboard')}</Button>
          <Button variant="ghost">{t('common.cancel')}</Button>
          <Button disabled>{t('token.skip.spent')}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <TokenChip kind="skip" left={1} />
          <TokenChip kind="reroll" left={1} />
          <TokenChip kind="skip" left={0} />
          <Chip icon="star">312 p</Chip>
        </div>
      </Block>

      <Block title="Lantern and hatches">
        <Lantern done={2} />
        <Hatches states={WEEK} theme={theme} />
        <Hatches states={WEEK} theme={theme} mini />
      </Block>

      <Block title="Mission cards">
        <MissionCard
          category="learning"
          title="Lær en julehilsen på et nytt språk"
          body="Finn ut hvordan man sier «god jul» på et språk du ikke kan, og bruk det i dag."
          points={10}
          difficulty={1}
          status="open"
          shake={shake}
          gift={
            <>
              <Icon name={theme === 'laaven' ? 'cinnamon' : 'owl'} className="n-icon--sm" />
              {theme === 'laaven' ? 'Gir kanel' : 'Henter Nissefar hjem'}
            </>
          }
          onComplete={() => {
            toast.show('+10 poeng');
          }}
          onSkip={() => {
            toast.show('Brukt opp denne uka', 'error');
          }}
          onReroll={() => {
            setShake(true);
            window.setTimeout(() => {
              setShake(false);
            }, 600);
          }}
        />
        <MissionCard
          category="kindness"
          title="Si takk og fortell hva du setter pris på"
          points={10}
          difficulty={1}
          status="done"
        />
        <MissionCard
          category="holiday_fun"
          title="Arranger 15 minutters julesangstund"
          points={30}
          difficulty={3}
          status="skipped"
        />
      </Block>

      <Block title="Leaderboard">
        <ul className="n-lb">
          <LeaderboardRow
            rank={1}
            name="Fjøsnissen"
            points={312}
            look={{ cap: '#4F6A3A', beard: '#D9D2C4', skin: '#F0C9A8' }}
          />
          <LeaderboardRow rank={2} name="Lyktenissen" points={298} me />
          <LeaderboardRow
            rank={3}
            name="Grøtsleiva"
            points={276}
            look={{ cap: '#2F5C8F', beard: '#FFFFFF', skin: '#8D5B3E' }}
          />
        </ul>
        <div className="flex gap-3">
          <NisseAvatar size={56} />
          <NisseAvatar size={56} look={{ cap: '#D9862B', beard: '#E9E2D2', skin: '#E9B996' }} />
        </div>
      </Block>

      <Block title="Badges">
        <div className="flex flex-wrap gap-4">
          <Badge file="L-20-first_spoon" name="Første grøtskje" />
          <Badge file="L-21-full_barn" name="Full låve" isNew />
          <Badge file="L-2B-chief_nisse" name="Overnissen" state="locked" />
          <Badge file="L-2C-shaken_sack" name="Ristet sekk" state="secret" />
        </div>
      </Block>

      <Block title="Stats">
        <div className="grid grid-cols-3 gap-2">
          <StatTile value={42} label="nisser" />
          <StatTile value={31} label="aktive denne uka" />
          <StatTile value={118} label="fullført" />
        </div>
      </Block>

      <Block title="Form, sheet and toast">
        <TextField
          label="Nissenavn"
          hint="Finn på et navn, ikke bruk ditt eget."
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        <TextField
          label="Nissenavn"
          defaultValue="Lyktenissen"
          error="Navnet er tatt. Prøv et annet."
        />
        <div className="flex flex-wrap gap-3">
          <Button
            variant="dark"
            onClick={() => {
              setSheetOpen(true);
            }}
          >
            Åpne ark
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              toast.show('Oppdraget er lagret');
            }}
          >
            Vis melding
          </Button>
        </div>
        <Sheet
          open={sheetOpen}
          title="Nytt oppdrag"
          onClose={() => {
            setSheetOpen(false);
          }}
        >
          <TextField label="Tittel" />
          <Button
            onClick={() => {
              setSheetOpen(false);
            }}
          >
            Lagre
          </Button>
        </Sheet>
      </Block>

      <Block title="Ornaments">
        <div className="relative grid min-h-24 place-items-center rounded-card bg-surface p-6 shadow-[inset_0_0_0_1px_var(--line)]">
          <TulipCorners />
          <p className="font-display text-xl font-bold">Takk for i år!</p>
        </div>
      </Block>

      <Block title="Navigation">
        <AppNav />
      </Block>
    </div>
  );
}

export function DevUi() {
  return (
    <main className="mx-auto grid max-w-[1280px] gap-6 p-4 sm:p-6">
      <h1 className="text-2xl font-bold">UI kit</h1>
      <div className="flex flex-wrap gap-4">
        <ThemeSwitch />
        <LanguageSwitch />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ThemeFrame theme="gaarden" />
        <ThemeFrame theme="laaven" />
      </div>
    </main>
  );
}
