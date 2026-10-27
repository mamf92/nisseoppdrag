import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { useCreateInvite, useInvites, useMembers, useRemoveMember, useSetRole } from './api';
import type { AdminMember } from './api';
import { Query, formatDate, useErrorText } from './shared';
import { useI18n } from '../i18n/I18nProvider';
import { Button, Sheet, useToast } from '../ui';

function CreatedInvite({ code, onClose }: { code: string; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const link = `${window.location.origin}/bli-med/${code}`;
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.show(t('admin.invite.copied'));
    } catch {
      toast.show(t('admin.invite.copy_failed'), 'error');
    }
  }
  return (
    <div className="n-form">
      <p>{t('admin.invite.once')}</p>
      <p className="n-code" data-testid="invite-code">
        {code}
      </p>
      <div className="n-row">
        <Button
          onClick={() => {
            void copy(code);
          }}
        >
          {t('admin.invite.copy_code')}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            void copy(link);
          }}
        >
          {t('admin.invite.copy_link')}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {t('admin.invite.done')}
        </Button>
      </div>
    </div>
  );
}

export function MembersPage() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const errorText = useErrorText();
  const { state, retry } = useAuth();
  const myId = state.status === 'member' ? state.me.memberId : '';
  const members = useMembers();
  const invites = useInvites();
  const createInvite = useCreateInvite();
  const setRole = useSetRole();
  const remove = useRemoveMember();
  const [role, setInviteRole] = useState<'player' | 'admin'>('player');
  const [days, setDays] = useState(30);
  const [code, setCode] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AdminMember | null>(null);

  return (
    <div className="grid gap-6">
      <section aria-labelledby="invite-h" className="grid gap-3">
        <h2 id="invite-h">{t('admin.invite.title')}</h2>
        <div className="n-row">
          <div className="n-field">
            <label htmlFor="invite-role">{t('admin.invite.role')}</label>
            <select
              id="invite-role"
              className="n-select"
              value={role}
              onChange={(e) => {
                setInviteRole(e.target.value === 'admin' ? 'admin' : 'player');
              }}
            >
              <option value="player">{t('profile.role.player')}</option>
              <option value="admin">{t('profile.role.admin')}</option>
            </select>
          </div>
          <div className="n-field">
            <label htmlFor="invite-days">{t('admin.invite.days')}</label>
            <select
              id="invite-days"
              className="n-select"
              value={days}
              onChange={(e) => {
                setDays(Number(e.target.value));
              }}
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d}>
                  {t('admin.invite.days.n', { n: d })}
                </option>
              ))}
            </select>
          </div>
          <Button
            disabled={createInvite.isPending}
            onClick={() => {
              createInvite.mutate(
                { role, days },
                {
                  onSuccess: setCode,
                  onError: (e) => {
                    toast.show(errorText(e), 'error');
                  },
                },
              );
            }}
          >
            {t('admin.invite.create')}
          </Button>
        </div>
        <Query query={invites}>
          {(list) =>
            list.length === 0 ? null : (
              <ul className="n-lb-list">
                {list.map((i) => (
                  <li key={i.id}>
                    {t(i.role === 'admin' ? 'profile.role.admin' : 'profile.role.player')} ·{' '}
                    {t('admin.invite.until', { date: formatDate(i.expiresAt, lang) })} ·{' '}
                    {t('admin.invite.used', { n: i.uses, max: i.maxUses })}
                  </li>
                ))}
              </ul>
            )
          }
        </Query>
      </section>

      <section aria-labelledby="members-h" className="grid gap-3">
        <h2 id="members-h">{t('admin.tab.members')}</h2>
        <Query query={members}>
          {(list) => (
            <div className="n-table-wrap">
              <table className="n-table">
                <thead>
                  <tr>
                    <th scope="col">{t('admin.members.name')}</th>
                    <th scope="col">{t('admin.members.role')}</th>
                    <th scope="col">
                      <span className="sr-only">{t('admin.members.actions')}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((m) => (
                    <tr key={m.id}>
                      <td>
                        {m.name}
                        {m.id === myId ? ` ${t('admin.members.you')}` : ''}
                      </td>
                      <td>
                        <select
                          className="n-select"
                          aria-label={t('admin.members.role_of', { name: m.name })}
                          value={m.role}
                          disabled={setRole.isPending}
                          onChange={(e) => {
                            setRole.mutate(
                              {
                                member: m.id,
                                role: e.target.value === 'admin' ? 'admin' : 'player',
                              },
                              {
                                // Changing one's own role changes what this page may show.
                                onSuccess: () => {
                                  if (m.id === myId) void retry();
                                },
                                onError: (err) => {
                                  toast.show(errorText(err), 'error');
                                },
                              },
                            );
                          }}
                        >
                          <option value="player">{t('profile.role.player')}</option>
                          <option value="admin">{t('profile.role.admin')}</option>
                        </select>
                      </td>
                      <td>
                        {m.id === myId ? null : (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setRemoving(m);
                            }}
                          >
                            {t('admin.members.remove')}
                            <span className="sr-only"> {m.name}</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Query>
      </section>

      <Sheet
        open={code !== null}
        onClose={() => {
          setCode(null);
        }}
        title={t('admin.invite.created')}
      >
        {code ? (
          <CreatedInvite
            code={code}
            onClose={() => {
              setCode(null);
            }}
          />
        ) : null}
      </Sheet>

      <Sheet
        open={removing !== null}
        onClose={() => {
          setRemoving(null);
        }}
        title={t('admin.members.remove')}
      >
        {removing ? (
          <div className="n-form">
            <p>{t('admin.members.remove.body', { name: removing.name })}</p>
            <div className="n-row">
              <Button
                variant="dark"
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(removing.id, {
                    onSuccess: () => {
                      toast.show(t('admin.members.removed'));
                      setRemoving(null);
                    },
                    onError: (e) => {
                      toast.show(errorText(e), 'error');
                      setRemoving(null);
                    },
                  });
                }}
              >
                {t('admin.members.remove.confirm')}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRemoving(null);
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
