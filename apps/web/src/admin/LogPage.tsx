import { useAuditLog, useMembers } from './api';
import { Query, formatDateTime } from './shared';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';

const KNOWN = new Set([
  'invite.create',
  'member.role',
  'member.remove',
  'season.upsert',
  'points.adjust',
  'workplace.create',
]);

export function LogPage() {
  const { t, lang } = useI18n();
  const log = useAuditLog();
  const members = useMembers();
  const names = new Map((members.data ?? []).map((m) => [m.id, m.name]));

  // A target is "<member id>" or "<member id>:<value>"; ids of removed members stay as they are.
  function target(value: string | null): string {
    if (!value) return '';
    const [id, rest] = value.split(':');
    const name = id ? names.get(id) : undefined;
    return name ? (rest ? `${name} (${rest})` : name) : value;
  }

  return (
    <Query query={log}>
      {(entries) =>
        entries.length === 0 ? (
          <p>{t('admin.log.empty')}</p>
        ) : (
          <div className="n-table-wrap">
            <table className="n-table">
              <caption className="sr-only">{t('admin.tab.log')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('admin.log.when')}</th>
                  <th scope="col">{t('admin.log.what')}</th>
                  <th scope="col">{t('admin.log.target')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.at, lang)}</td>
                    <td>
                      {KNOWN.has(entry.action)
                        ? t(`admin.log.action.${entry.action}` as MessageKey)
                        : entry.action}
                    </td>
                    <td>{target(entry.target)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </Query>
  );
}
