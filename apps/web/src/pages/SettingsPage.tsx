import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { userApi, authApi } from '../services/api';
import { Settings, User, Shield, HardDrive, Key, Loader2, Copy, Download, QrCode, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
    const { user, updateUser } = useAuthStore();
    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    // Avatar state
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Password State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [passwordSaved, setPasswordSaved] = useState(false);

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

    const handleSaveProfile = async () => {
        setSaving(true);
        setError('');
        try {
            const res: any = await userApi.updateMe({ name, email });
            updateUser(res.data);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res: any = await userApi.updateAvatar(formData);
            updateUser(res.data);
        } catch (err: any) {
            setError(err.message || 'Failed to upload avatar');
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        setPasswordSaving(true);
        setError('');
        try {
            const res: any = await userApi.updateMe({ currentPassword, newPassword });
            updateUser(res.data);
            setPasswordSaved(true);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordSaved(false), 2000);
        } catch (err: any) {
            setError(err.message || 'Password update failed');
        } finally {
            setPasswordSaving(false);
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
        if (manageAction === 'regenerate') {
            if (!passwordConfirm || !totpCode) return;
            setMfaLoading(true);
            setMfaError('');
            try {
                const res: any = await authApi.regenerateMfa(passwordConfirm, totpCode);
                setRecoveryCodes(res.data.recoveryCodes);
                setManageAction('none');
                setPasswordConfirm('');
                setTotpCode('');
            } catch (err: any) {
                setMfaError(err.message || 'Action failed');
            } finally {
                setMfaLoading(false);
            }
        } else if (manageAction === 'disable') {
            if (!window.confirm('Are you sure you want to disable Two-Factor Authentication? Your account will be less secure.')) {
                setManageAction('none');
                return;
            }
            setMfaLoading(true);
            setMfaError('');
            try {
                await authApi.disableMfa('', ''); // Credentials ignored by backend now
                updateUser({ mfaEnabled: false } as any);
                setManageAction('none');
            } catch (err: any) {
                setMfaError(err.message || 'Action failed');
            } finally {
                setMfaLoading(false);
            }
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
        <div className="animate-fade-in max-w-2xl pb-12">
            <div className="mb-8 flex items-center gap-3">
                <Settings className="h-6 w-6 text-brand-400" />
                <h1 className="text-xl font-semibold text-surface-900 dark:text-white">Settings</h1>
            </div>

            {/* Profile Section */}
            <section className="glass-card mb-6 overflow-hidden">
                <div className="border-b border-surface-200 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-800/50 px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
                        <User className="h-4 w-4 text-brand-500" /> Account Information
                    </div>
                </div>

                <div className="p-6">
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Avatar Column */}
                        <div className="flex flex-col items-center">
                            <div className="group relative h-24 w-24 overflow-hidden rounded-full border-2 border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-900">
                                {user?.avatarUrl ? (
                                    <img src={user.avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-surface-400">
                                        {user?.name?.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <label className="absolute inset-0 flex cursor-pointer flex-col items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                    <QrCode className="h-5 w-5 text-white mb-1" />
                                    <span className="text-[10px] font-medium text-white">Change</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                                </label>
                                {uploadingAvatar && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                                    </div>
                                )}
                            </div>
                            <p className="mt-2 text-xs text-surface-500 text-center">SVG, PNG, JPG up to 2MB</p>
                        </div>

                        {/* Details Column */}
                        <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-surface-500 dark:text-surface-400">Full Name</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="input-field"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1.5 block text-xs font-medium text-surface-500 dark:text-surface-400">Email Address</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="input-field"
                                        placeholder="john@example.com"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button onClick={handleSaveProfile} disabled={saving} className="btn-primary min-w-[120px] text-sm flex items-center justify-center gap-2">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? '✓ Saved' : 'Update Profile'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Storage Section */}
            <section className="glass-card mb-6 p-6">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
                    <HardDrive className="h-4 w-4 text-brand-500" /> Storage Usage
                </div>

                <div className="progress-bar mb-3 bg-surface-100 dark:bg-surface-800" style={{ height: '10px' }}>
                    <div className="progress-bar-fill shadow-[0_0_10px_rgba(99,102,241,0.3)]" style={{ width: `${storagePercent}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-surface-500">
                    <span>{user ? `${formatBytes(user.storageUsed)} used` : '—'}</span>
                    <span>{storagePercent}% of {user ? formatBytes(user.storageQuota) : '—'}</span>
                </div>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Security Section (Change Password) */}
                <section className="glass-card p-6">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
                        <Key className="h-4 w-4 text-brand-500" /> Change Password
                    </div>

                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-surface-500 dark:text-surface-400">Current Password</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="input-field"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-surface-500 dark:text-surface-400">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="input-field"
                                placeholder="Min. 8 characters"
                                required
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-xs font-medium text-surface-500 dark:text-surface-400">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="input-field"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                        <button type="submit" disabled={passwordSaving} className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
                            {passwordSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : passwordSaved ? '✓ Changed' : 'Update Password'}
                        </button>
                    </form>
                </section>

                {/* 2FA Status Section */}
                <section className="glass-card p-6">
                    <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-surface-900 dark:text-white">
                        <Shield className="h-4 w-4 text-brand-500" /> Multi-Factor Auth
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-surface-600 dark:text-surface-400">Status</span>
                            {user?.mfaEnabled ? (
                                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Enabled</span>
                            ) : (
                                <span className="inline-flex items-center rounded-full bg-surface-500/10 px-2 py-1 text-[10px] font-bold text-surface-500 uppercase tracking-wider">Disabled</span>
                            )}
                        </div>

                        {user?.mfaEnabled ? (
                            <div className="space-y-2">
                                <button
                                    onClick={() => { setManageAction('regenerate'); setTotpCode(''); setPasswordConfirm(''); setMfaError(''); }}
                                    className="btn-secondary w-full text-xs font-medium"
                                >
                                    Regenerate Backup Codes
                                </button>
                                <button
                                    onClick={() => { setManageAction('disable'); setTotpCode(''); setPasswordConfirm(''); setMfaError(''); }}
                                    className="btn-secondary w-full text-xs font-medium text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                                >
                                    Disable 2FA
                                </button>
                            </div>
                        ) : (
                            <button onClick={handleSetupMfa} disabled={mfaLoading} className="btn-primary w-full text-sm">
                                {mfaLoading && !mfaSetup ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Set up 2FA'}
                            </button>
                        )}

                        <p className="text-[10px] text-surface-500 leading-relaxed italic">
                            {user?.mfaEnabled
                                ? 'Your account is secured with TOTP. Keep your recovery codes safe.'
                                : 'Protect your account with an extra layer of security using a TOTP authenticator app.'}
                        </p>
                    </div>
                </section>
            </div>

            {/* Global Errors */}
            {(error || mfaError) && (
                <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400 flex items-start gap-3 border border-red-200 dark:border-red-500/20 shadow-sm animate-shake">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                    <div>{error || mfaError}</div>
                </div>
            )}

            {/* MFA Setup Block */}
            {mfaSetup && !user?.mfaEnabled && (
                <div className="animate-slide-down rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-6 shadow-xl mb-6">
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
                        <div className="bg-white p-2 rounded-lg flex-shrink-0 shadow-sm">
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

            {/* Recovery Codes Display */}
            {recoveryCodes && (
                <div className="animate-slide-down rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 shadow-xl mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        <h3 className="font-semibold text-amber-500">Save Your Recovery Codes</h3>
                    </div>
                    <p className="mb-4 text-sm text-amber-400/80">
                        These codes are your only way to access your account if you lose your authenticator. <strong>They will not be shown again.</strong>
                    </p>

                    <div className="grid grid-cols-2 gap-3 mb-6 font-mono">
                        {recoveryCodes.map((code, idx) => (
                            <div key={idx} className="bg-surface-100 dark:bg-background rounded min-h-[40px] border border-surface-200 dark:border-surface-700 p-2 flex items-center justify-center text-sm font-semibold text-surface-900 dark:text-white tracking-widest shadow-inner">
                                {code}
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={copyRecoveryCodes} className="btn-secondary flex-1 text-sm flex items-center justify-center gap-2">
                            <Copy className="h-4 w-4" /> Copy
                        </button>
                        <button onClick={downloadRecoveryCodes} className="btn-secondary flex-1 text-sm flex items-center justify-center gap-2">
                            <Download className="h-4 w-4" /> Download
                        </button>
                        <button onClick={() => setRecoveryCodes(null)} className="btn-primary flex-1 text-sm">
                            I have saved them
                        </button>
                    </div>
                </div>
            )}

            {/* Manage Action Block */}
            {manageAction !== 'none' && !recoveryCodes && (
                <div className="animate-slide-down rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-6 shadow-xl">
                    <h3 className="font-medium text-surface-900 dark:text-white mb-1">
                        {manageAction === 'regenerate' ? 'Regenerate Recovery Codes' : 'Disable Two-Factor Authentication'}
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                        Please confirm your password and enter an authenticator code.
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
        </div>
    );
}
