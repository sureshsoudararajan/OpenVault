import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { userApi, authApi } from '../services/api';
import { Settings, User, Shield, HardDrive, Key, Loader2 } from 'lucide-react';

export default function SettingsPage() {
    const { user, updateUser } = useAuthStore();
    const [name, setName] = useState(user?.name || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // MFA state
    const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
    const [totpCode, setTotpCode] = useState('');
    const [mfaLoading, setMfaLoading] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await userApi.updateMe({ name });
            updateUser({ name });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleSetupMfa = async () => {
        setMfaLoading(true);
        try {
            const res: any = await authApi.getMfaSetup();
            setMfaSetup(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setMfaLoading(false);
        }
    };

    const handleEnableMfa = async () => {
        if (!totpCode) return;
        setMfaLoading(true);
        try {
            await authApi.enableMfa(totpCode);
            updateUser({ mfaEnabled: true } as any);
            setMfaSetup(null);
            setTotpCode('');
        } catch (err) {
            console.error(err);
        } finally {
            setMfaLoading(false);
        }
    };

    const storagePercent = user ? Math.round((user.storageUsed / user.storageQuota) * 100) : 0;
    const formatBytes = (b: number) => {
        const gb = b / (1024 ** 3);
        return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(b / (1024 ** 2)).toFixed(0)} MB`;
    };

    return (
        <div className="animate-fade-in max-w-2xl">
            <div className="mb-8 flex items-center gap-3">
                <Settings className="h-6 w-6 text-brand-400" />
                <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Settings</h1>
            </div>

            {/* Profile Section */}
            <section className="glass-card mb-6 p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-300">
                    <User className="h-4 w-4" /> Profile
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-1.5 block text-sm text-surface-400">Email</label>
                        <input type="email" value={user?.email || ''} disabled className="input-field opacity-60 cursor-not-allowed" />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm text-surface-400">Name</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="input-field"
                        />
                    </div>
                    <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2 text-sm">
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {saved ? '✓ Saved' : 'Save Changes'}
                    </button>
                </div>
            </section>

            {/* Storage Section */}
            <section className="glass-card mb-6 p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-300">
                    <HardDrive className="h-4 w-4" /> Storage
                </div>

                <div className="progress-bar mb-2" style={{ height: '8px' }}>
                    <div className="progress-bar-fill" style={{ width: `${storagePercent}%` }} />
                </div>
                <p className="text-sm text-surface-400">
                    {user ? `${formatBytes(user.storageUsed)} used of ${formatBytes(user.storageQuota)}` : '—'}
                </p>
                <p className="mt-1 text-xs text-surface-600">{storagePercent}% used</p>
            </section>

            {/* Security Section */}
            <section className="glass-card p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-300">
                    <Shield className="h-4 w-4" /> Security
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-surface-900 dark:text-white">Two-Factor Authentication</p>
                        <p className="text-xs text-surface-500">Add an extra layer of security with TOTP</p>
                    </div>
                    {user?.mfaEnabled ? (
                        <span className="badge-success">Enabled</span>
                    ) : (
                        <button onClick={handleSetupMfa} disabled={mfaLoading} className="btn-secondary text-sm">
                            {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enable'}
                        </button>
                    )}
                </div>

                {mfaSetup && (
                    <div className="mt-4 animate-slide-down rounded-lg border border-surface-700 bg-surface-800/50 p-4">
                        <p className="mb-2 text-sm text-surface-300">
                            Scan this key in your authenticator app:
                        </p>
                        <code className="block rounded bg-surface-900 px-3 py-2 text-xs text-brand-400 break-all">
                            {mfaSetup.secret}
                        </code>
                        <div className="mt-3 flex gap-2">
                            <input
                                type="text"
                                value={totpCode}
                                onChange={(e) => setTotpCode(e.target.value)}
                                placeholder="Enter 6-digit code"
                                className="input-field flex-1 text-sm"
                                maxLength={6}
                            />
                            <button onClick={handleEnableMfa} className="btn-primary text-sm">Verify</button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
