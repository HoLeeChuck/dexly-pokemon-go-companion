import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { storedAccessToken } from '../lib/api/request';

export function OwnerAccessDialog({
  open,
  message,
  onClose,
  onSubmit,
}: {
  open: boolean;
  message?: string;
  onClose?: () => void;
  onSubmit: (token: string) => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [token, setToken] = useState(storedAccessToken());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(token.trim());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That access key did not work.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={ref}
      className="access-dialog"
      onCancel={(event) => {
        if (!onClose) event.preventDefault();
      }}
    >
      <form onSubmit={submit}>
        <span className="access-dialog__mark">
          <Icon name="lock" />
        </span>
        <span className="eyebrow">Cody Cloud</span>
        <h2>Sign in to Cody Cloud</h2>
        <p>
          {message ??
            'Enter your private cloud access key. Public browser collections never require this key.'}
        </p>
        <label>
          <span className="visually-hidden">Username</span>
          <input
            className="visually-hidden"
            type="text"
            name="username"
            autoComplete="username"
            value="cody-cloud-owner"
            readOnly
            tabIndex={-1}
          />
          Cloud access key
          <input
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste access key"
            autoFocus
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button--primary button--full"
          disabled={!token.trim() || submitting}
        >
          <Icon name="lock" />
          {submitting ? 'Checking…' : 'Connect Cody Cloud'}
        </button>
        {onClose && (
          <button type="button" className="button button--ghost button--full" onClick={onClose}>
            Cancel
          </button>
        )}
      </form>
    </dialog>
  );
}
