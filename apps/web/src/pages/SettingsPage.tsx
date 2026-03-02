import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { userApi, authApi } from '../services/api';
import { Settings, User, Shield, HardDrive, Key, Loader2, Copy, Download, QrCode, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
    const { user, updateUser } = useAuthStore();
    const [name, setName] = useState(user?.name || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // MFA state
    const [mfaSetup, setMfaSetup] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
    const [totpCode, setTotpCode] = useState('');
    const [mfaLoading, setMfaLoading] = useState(false);
    const [mfaError, setMfaError] = useState('');

    // Recovery Codes State
    const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

    // Manage MFA State
    const [manageAction, setManageAction] = useState<'none' | 'regenerate' | 'disable'>('none');
    const [passwordConfirm, setPasswordConfirm] = useState('');

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
            setMfaError('');
        } catch (err: any) {
            setMfaError(err.message || 'Failed to start MFA setup');
        } finally {
            setMfaLoading(false);
        }
    };

    const handleEnableMfa = async () => {
        if (!totpCode) return;
        setMfaLoading(true);
        setMfaError('');
        try {
            const res: any = await authApi.enableMfa(totpCode);
            setRecoveryCodes(res.data.recoveryCodes);
            updateUser({ mfaEnabled: true } as any);
            setMfaSetup(null);
            setTotpCode('');
        } catch (err: any) {
            setMfaError(err.message || 'Invalid code');
        } finally {
            setMfaLoading(false);
        }
    };

    const handleManageAction = async () => {
        if (!passwordConfirm || !totpCode) return;
        setMfaLoading(true);
        setMfaError('');
        try {
            if (manageAction === 'regenerate') {
                const res: any = await authApi.regenerateMfa(passwordConfirm, totpCode);
                setRecoveryCodes(res.data.recoveryCodes);
                setManageAction('none');
                setPasswordConfirm('');
                setTotpCode('');
            } else if (manageAction === 'disable') {
                await authApi.disableMfa(passwordConfirm, totpCode);
                updateUser({ mfaEnabled: false } as any);
                setManageAction('none');
                setPasswordConfirm('');
                setTotpCode('');
            }
        } catch (err: any) {
            setMfaError(err.message || 'Action failed');
        } finally {
            setMfaLoading(false);
        }
    };

    const downloadRecoveryCodes = () => {
        if (!recoveryCodes) return;
        const text = `OpenVault Recovery Codes\nSave these in a secure location.\n\n${recoveryCodes.join('\n')}\n`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'openvault-recovery-codes.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const copyRecoveryCodes = () => {
        if (recoveryCodes) {
            navigator.clipboard.writeText(recoveryCodes.join('\n'));
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
                        <div className="flex items-center gap-3">
                            <span className="badge-success">Enabled</span>
                            <button
                                onClick={() => { setManageAction('regenerate'); setTotpCode(''); setPasswordConfirm(''); setMfaError(''); }}
                                className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 px-2 transition-colors"
                            >
                                Regenerate Codes
                            </button>
                            <button
                                onClick={() => { setManageAction('disable'); setTotpCode(''); setPasswordConfirm(''); setMfaError(''); }}
                                className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded-md border border-red-200 dark:border-red-500/20"
                            >
                                Disable
                            </button>
                        </div>
                    ) : (
                        <button onClick={handleSetupMfa} disabled={mfaLoading} className="btn-secondary text-sm">
                            {mfaLoading && !mfaSetup ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enable 2FA'}
                        </button>
                    )}
                </div>

                {mfaError && (
                    <div className="mt-4 rounded-md bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400 flex items-start gap-2 border border-red-200 dark:border-red-500/20">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div>{mfaError}</div>
                    </div>
                )}

                {/* MFA Setup Step */}
                {mfaSetup && !user?.mfaEnabled && (
                    <div className="mt-6 animate-slide-down rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-brand-50 dark:bg-brand-500/10 rounded-lg text-brand-600 dark:text-brand-400">
                                <QrCode className="h-5 w-5" />
                            </div>
                            <h3 className="font-medium text-surface-900 dark:text-white">Scan QR Code</h3>
                        </div>
                        <p className="mb-4 text-sm text-surface-600 dark:text-surface-300">
                            Scan this code with Google Authenticator, Authy, or your preferred TOTP app.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-6 items-start">
                            <div className="bg-white p-2 rounded-lg flex-shrink-0">
                                <img src={mfaSetup.qrCodeUrl} alt="MFA QR Code" className="w-32 h-32" />
                            </div>
                            <div className="flex-1 w-full space-y-4">
                                <div>
                                    <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Manual Entry Secret</p>
                                    <code className="block rounded bg-surface-200 dark:bg-surface-900 px-3 py-2 text-xs text-brand-600 dark:text-brand-400 select-all font-mono">
                                        {mfaSetup.secret}
                                    </code>
                                </div>
                                <div>
                                    <p className="text-xs text-surface-500 dark:text-surface-400 mb-1">Verify Setup</p>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={totpCode}
                                            onChange={(e) => setTotpCode(e.target.value)}
                                            placeholder="000000"
                                            className="input-field flex-1 text-sm tracking-widest text-center font-mono"
                                            maxLength={6}
                                        />
                                        <button onClick={handleEnableMfa} disabled={mfaLoading || totpCode.length < 6} className="btn-primary text-sm whitespace-nowrap">
                                            {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 border-t border-surface-200 dark:border-surface-700 pt-4 flex justify-end">
                            <button onClick={() => setMfaSetup(null)} className="text-sm text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors">Cancel Setup</button>
                        </div>
                    </div>
                )}

                {/* Recovery Codes Display (Shown only once after setup or regeneration) */}
                {recoveryCodes && (
                    <div className="mt-6 animate-slide-down rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                            <h3 className="font-semibold text-amber-500">Save Your Recovery Codes</h3>
                        </div>
                        <p className="mb-4 text-sm text-amber-400/80">
                            These codes are your only way to access your account if you lose your authenticator.
                            <strong> They will not be shown again.</strong>
                        </p>

                        <div className="grid grid-cols-2 gap-3 mb-4 font-mono">
                            {recoveryCodes.map((code, idx) => (
                                <div key={idx} className="bg-surface-100 dark:bg-background rounded min-h-[40px] border border-surface-200 dark:border-surface-700 p-2 flex items-center justify-center text-sm font-semibold text-surface-900 dark:text-white tracking-widest">
                                    {code}
                                </div>
                            ))}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={copyRecoveryCodes} className="btn-secondary flex-1 text-sm flex items-center justify-center gap-2">
                                <Copy className="h-4 w-4" /> Copy to Clipboard
                            </button>
                            <button onClick={downloadRecoveryCodes} className="btn-secondary flex-1 text-sm flex items-center justify-center gap-2">
                                <Download className="h-4 w-4" /> Download .txt
                            </button>
                            <button onClick={() => setRecoveryCodes(null)} className="btn-primary flex-1 text-sm">
                                I have saved them
                            </button>
                        </div>
                    </div>
                )}

                {/* Manage MFA Modal/Section */}
                {manageAction !== 'none' && !recoveryCodes && (
                    <div className="mt-6 animate-slide-down rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-6">
                        <h3 className="font-medium text-surface-900 dark:text-white mb-1">
                            {manageAction === 'regenerate' ? 'Regenerate Recovery Codes' : 'Disable Two-Factor Authentication'}
                        </h3>
                        <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                            Please confirm your password and enter an authenticator code to proceed.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-surface-600 dark:text-surface-300">Current Password</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500" />
                                    <input
                                        type="password"
                                        value={passwordConfirm}
                                        onChange={(e) => setPasswordConfirm(e.target.value)}
                                        className="input-field pl-9 text-sm"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-surface-600 dark:text-surface-300">Authenticator Code</label>
                                <input
                                    type="text"
                                    value={totpCode}
                                    onChange={(e) => setTotpCode(e.target.value)}
                                    placeholder="000000"
                                    className="input-field text-sm tracking-widest font-mono"
                                    maxLength={6}
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => { setManageAction('none'); setPasswordConfirm(''); setTotpCode(''); setMfaError(''); }}
                                    className="btn-secondary flex-1 text-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleManageAction}
                                    disabled={mfaLoading || !passwordConfirm || totpCode.length < 6}
                                    className={`btn-primary flex-1 text-sm text-white ${manageAction === 'disable' ? 'bg-red-600 hover:bg-red-700 border-red-600' : ''}`}
                                >
                                    {mfaLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
