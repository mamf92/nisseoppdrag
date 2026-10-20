import { useI18n } from '../i18n/I18nProvider';
import { LANGUAGES } from '../i18n/messages';
import { useTheme } from '../themes/ThemeProvider';
import { THEMES } from '../themes/theme';

export function ThemeSwitch() {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  return (
    <div className="n-segmented" role="group" aria-label={t('theme.label')}>
      {THEMES.map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => {
            setTheme(value);
          }}
        >
          {t(`theme.${value}`)}
        </button>
      ))}
    </div>
  );
}

export function LanguageSwitch() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="n-segmented" role="group" aria-label={t('language.label')}>
      {LANGUAGES.map((value) => (
        <button
          key={value}
          type="button"
          lang={value}
          aria-pressed={lang === value}
          onClick={() => {
            setLang(value);
          }}
        >
          {t(`language.${value}`)}
        </button>
      ))}
    </div>
  );
}
