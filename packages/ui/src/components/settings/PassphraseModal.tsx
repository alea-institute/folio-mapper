import { useState, useCallback } from 'react';

interface PassphraseModalProps {
  mode: 'unlock' | 'create';
  error?: string | null;
  onSubmit: (passphrase: string) => Promise<boolean>;
  onCancel: () => void;
}

export function PassphraseModal({ mode, error, onSubmit, onCancel }: PassphraseModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async () => {
    setLocalError(null);
    if (!passphrase) {
      setLocalError('Passphrase is required');
      return;
    }
    if (mode === 'create' && passphrase !== confirm) {
      setLocalError('Passphrases do not match');
      return;
    }
    if (mode === 'create' && passphrase.length < 8) {
      setLocalError('Passphrase must be at least 8 characters');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(passphrase);
    } finally {
      setIsSubmitting(false);
    }
  }, [passphrase, confirm, mode, onSubmit]);

  const displayError = error || localError;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-gray-900">
          {mode === 'unlock' ? 'Unlock Saved Keys' : 'Set Vault Passphrase'}
        </h3>
        <p className="mt-1.5 text-sm text-gray-500">
          {mode === 'unlock'
            ? 'Enter your passphrase to decrypt saved API keys. If you skip, you\u2019ll need to re-enter them manually.'
            : 'Choose a passphrase to encrypt your API keys in this browser. You\u2019ll enter this once per session to unlock your keys.'}
        </p>

        {displayError && (
          <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {displayError}
          </div>
        )}

        <div className="mt-4 space-y-3">
          <input
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Passphrase"
            autoFocus
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
          />
          {mode === 'create' && (
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Confirm passphrase"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
            />
          )}
        </div>

        {mode === 'create' && (
          <p className="mt-2 text-xs text-gray-400">
            Keys are encrypted with AES-256-GCM. If you forget this passphrase, saved keys cannot be recovered.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800"
            title={mode === 'unlock' ? 'Skip — you will need to re-enter your API keys manually' : undefined}
          >
            {mode === 'unlock' ? 'Skip' : 'Cancel'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Decrypting...' : mode === 'unlock' ? 'Unlock' : 'Encrypt & Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
