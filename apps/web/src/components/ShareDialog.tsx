import { useState, useEffect } from 'react';
import { sharingApi } from '../services/api';
import {
    X, Link2, Copy, Check, Lock, Clock, Download as DownloadIcon,
    Loader2, Key, CalendarClock, Shield, Mail, UserPlus, Trash2,
    ExternalLink, Crown, Eye
} from 'lucide-react';

interface ShareDialogProps {
    resourceId: string;
    resourceType: 'file' | 'folder';
    resourceName: string;
    onClose: () => void;
}

// Convert a datetime-local value (local time) to a proper ISO string with timezone offset
function localToIso(localDatetime: string): string {
    if (!localDatetime) return '';
    return new Date(localDatetime).toISOString();
}

// ─── DateTimePicker ──────────────────────────────────────────────────────────
// Converts between a 'datetime-local' string (YYYY-MM-DDTHH:mm) used internally
// and user-facing date + hour + minute + AM/PM inputs.
function DateTimePicker({ value, onChange, label, icon }: {
    value: string;
    onChange: (v: string) => void;
    label: string;
    icon?: React.ReactNode;
}) {
    // Parse value
    const date = value ? value.split('T')[0] : '';
    const timePart = value ? value.split('T')[1] || '00:00' : '00:00';
    const [h24, m] = timePart.split(':').map(Number);
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    const mins = m || 0;

    const update = (newDate: string, newH12: number, newMins: number, newAmpm: string) => {
        if (!newDate) { onChange(''); return; }
        let h = newH12 % 12;
        if (newAmpm === 'PM') h += 12;
        const padded = `${String(h).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
        onChange(`${newDate}T${padded}`);
    };

    return (
        <div>
            <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-500 dark:text-surface-400">
                {icon} {label}
            </label>
            <div className="flex gap-2 items-center">
                {/* Date */}
                <input
                    type="date"
                    value={date}
                    onChange={(e) => update(e.target.value, h12, mins, ampm)}
                    className="input-field text-sm flex-1"
                />
                {/* Time row */}
                <div className="flex items-center gap-1 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 px-2 py-1.5">
                    {/* Hour */}
                    <select
                        value={h12}
                        onChange={(e) => update(date, Number(e.target.value), mins, ampm)}
                        className="bg-transparent text-sm text-surface-900 dark:text-white focus:outline-none"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                            <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
                        ))}
                    </select>
                    <span className="text-surface-400 font-bold text-sm">:</span>
                    {/* Minute */}
                    <select
                        value={mins}
                        onChange={(e) => update(date, h12, Number(e.target.value), ampm)}
                        className="bg-transparent text-sm text-surface-900 dark:text-white focus:outline-none"
                    >
                        {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((min) => (
                            <option key={min} value={min}>{String(min).padStart(2, '0')}</option>
                        ))}
                    </select>
                    {/* AM/PM */}
                    <select
                        value={ampm}
                        onChange={(e) => update(date, h12, mins, e.target.value)}
                        className="bg-transparent text-sm font-semibold text-brand-600 dark:text-brand-400 focus:outline-none"
                    >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                    </select>
                </div>
                {/* Clear */}
                {value && (
                    <button
                        onClick={() => onChange('')}
                        type="button"
                        className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 text-lg leading-none px-1"
                        title="Clear"
                    >×</button>
                )}
            </div>
        </div>
    );
}
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'link' | 'email' | 'manage';

export default function ShareDialog({ resourceId, resourceType, resourceName, onClose }: ShareDialogProps) {
    const [tab, setTab] = useState<Tab>('link');

    // Link state
    const [shareUrl, setShareUrl] = useState('');
    const [otpCode, setOtpCode] = useState('');
    const [linkLoading, setLinkLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copiedOtp, setCopiedOtp] = useState(false);
    const [linkError, setLinkError] = useState('');
    const [password, setPassword] = useState('');
    const [usePassword, setUsePassword] = useState(false);
    const [opensAt, setOpensAt] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [maxDownloads, setMaxDownloads] = useState('');
    const [permission, setPermission] = useState<'viewer' | 'editor'>('viewer');
    const [otpEnabled, setOtpEnabled] = useState(false);

    // Email invite state
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteError, setInviteError] = useState('');
    const [inviteSuccess, setInviteSuccess] = useState('');

    // Manage state — existing permissions and links
    const [permissions, setPermissions] = useState<any[]>([]);
    const [links, setLinks] = useState<any[]>([]);
    const [manageLoading, setManageLoading] = useState(false);

    useEffect(() => {
        if (tab === 'manage') {
            loadManage();
        }
    }, [tab]);

    const loadManage = async () => {
        setManageLoading(true);
        try {
            const [permsRes, linksRes]: [any, any] = await Promise.all([
                sharingApi.listPermissions(resourceId),
                sharingApi.listLinks(resourceId),
            ]);
            setPermissions(permsRes.data || []);
            setLinks(linksRes.data || []);
        } catch {
            // ignore
        } finally {
            setManageLoading(false);
        }
    };

    const handleCreateLink = async () => {
        setLinkLoading(true);
        setLinkError('');
        try {
            const payload: any = { permission, otpEnabled };
            if (resourceType === 'file') payload.fileId = resourceId;
            else payload.folderId = resourceId;
            if (usePassword && password) payload.password = password;
            if (opensAt) payload.opensAt = localToIso(opensAt);
            if (expiresAt) payload.expiresAt = localToIso(expiresAt);
            if (maxDownloads) {
                const max = parseInt(maxDownloads);
                if (max > 0) payload.maxDownloads = max;
            }

            const res: any = await sharingApi.createLink(payload);
            if (res.data?.token) {
                setShareUrl(`${window.location.origin}/share/${res.data.token}`);
            }
            if (res.data?.otpCode) setOtpCode(res.data.otpCode);
        } catch (err: any) {
            setLinkError(err.message || 'Failed to create share link');
        } finally {
            setLinkLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteLoading(true);
        setInviteError('');
        setInviteSuccess('');
        try {
            const payload: any = { email: inviteEmail, role: inviteRole };
            if (resourceType === 'file') payload.fileId = resourceId;
            else payload.folderId = resourceId;
            const res: any = await sharingApi.invite(payload);
            const name = res.data?.grantedTo?.name || inviteEmail;
            setInviteSuccess(`${name} now has ${inviteRole} access.`);
            setInviteEmail('');
        } catch (err: any) {
            setInviteError(err.message || 'Failed to share');
        } finally {
            setInviteLoading(false);
        }
    };

    const handleRevokePermission = async (id: string) => {
        try {
            await sharingApi.revokePermission(id);
            setPermissions((prev) => prev.filter((p) => p.id !== id));
        } catch {
            // ignore
        }
    };

    const handleDeleteLink = async (id: string) => {
        try {
            await sharingApi.deleteLink(id);
            setLinks((prev) => prev.filter((l) => l.id !== id));
        } catch {
            // ignore
        }
    };

    const handleCopy = async (text: string, setter: (v: boolean) => void) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            const input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
        }
        setter(true);
        setTimeout(() => setter(false), 2000);
    };

    const tabCls = (t: Tab) =>
        `flex-1 pb-2.5 pt-1 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 ${tab === t
            ? 'border-brand-500 text-brand-600 dark:text-brand-400'
            : 'border-transparent text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
        }`;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 shadow-2xl animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-surface-200 dark:border-surface-700 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10">
                            <Link2 className="h-5 w-5 text-brand-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-surface-900 dark:text-white">Share {resourceType}</h3>
                            <p className="text-xs text-surface-500 dark:text-surface-400 truncate max-w-[250px]">{resourceName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-900 dark:hover:text-white">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-surface-200 dark:border-surface-700 px-5">
                    <button className={tabCls('link')} onClick={() => setTab('link')}>
                        <Link2 className="inline h-3 w-3 mr-1" /> Public Link
                    </button>
                    <button className={tabCls('email')} onClick={() => setTab('email')}>
                        <Mail className="inline h-3 w-3 mr-1" /> Invite
                    </button>
                    <button className={tabCls('manage')} onClick={() => setTab('manage')}>
                        <Shield className="inline h-3 w-3 mr-1" /> Access
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 max-h-[65vh] overflow-y-auto">

                    {/* ── TAB: Public Link ── */}
                    {tab === 'link' && (
                        <>
                            {shareUrl ? (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-surface-500 dark:text-surface-400">Share Link</label>
                                        <div className="flex items-center gap-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 p-3">
                                            <Link2 className="h-4 w-4 flex-shrink-0 text-brand-400" />
                                            <span className="flex-1 truncate text-sm text-surface-700 dark:text-surface-200">{shareUrl}</span>
                                            <button onClick={() => handleCopy(shareUrl, setCopied)} className="flex-shrink-0 rounded-md bg-brand-500/20 px-3 py-1 text-xs font-medium text-brand-600 dark:text-brand-400 transition-colors hover:bg-brand-500/30">
                                                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                        {copied && <p className="text-center text-xs text-emerald-500 animate-fade-in">Link copied!</p>}
                                    </div>
                                    {otpCode && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-surface-500 dark:text-surface-400 flex items-center gap-1.5">
                                                <Key className="h-3.5 w-3.5 text-amber-500" /> OTP Access Code
                                            </label>
                                            <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
                                                <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">Share this code with the recipient.</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="flex-1 text-center text-2xl font-bold tracking-[0.5em] text-amber-600 dark:text-amber-400 font-mono">{otpCode}</span>
                                                    <button onClick={() => handleCopy(otpCode, setCopiedOtp)} className="flex-shrink-0 rounded-md bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 transition-colors hover:bg-amber-500/30">
                                                        {copiedOtp ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <button onClick={() => { setShareUrl(''); setOtpCode(''); }} className="text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors">
                                        + Create another link
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Permission */}
                                    <div>
                                        <label className="mb-1.5 block text-xs font-medium text-surface-500 dark:text-surface-400">Permission</label>
                                        <div className="flex gap-2">
                                            {(['viewer', 'editor'] as const).map((p) => (
                                                <button
                                                    key={p}
                                                    onClick={() => setPermission(p)}
                                                    className={`flex-1 rounded-lg py-2 text-xs font-medium transition-all ${permission === p
                                                        ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/30'
                                                        : 'bg-surface-50 dark:bg-surface-800 text-surface-500 dark:text-surface-400 border border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                                        }`}
                                                >
                                                    {p === 'viewer' ? 'View only' : 'Can edit'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Opens At */}
                                    <DateTimePicker
                                        label="Opens at (optional)"
                                        icon={<CalendarClock className="h-3.5 w-3.5" />}
                                        value={opensAt}
                                        onChange={setOpensAt}
                                    />

                                    {/* Expires At */}
                                    <DateTimePicker
                                        label="Expires at (optional)"
                                        icon={<Clock className="h-3.5 w-3.5" />}
                                        value={expiresAt}
                                        onChange={setExpiresAt}
                                    />

                                    {/* Max Downloads */}
                                    <div>
                                        <label className="mb-1.5 flex items-center gap-2 text-xs font-medium text-surface-500 dark:text-surface-400">
                                            <DownloadIcon className="h-3.5 w-3.5" /> Max downloads
                                        </label>
                                        <input
                                            type="number"
                                            value={maxDownloads}
                                            onChange={(e) => setMaxDownloads(e.target.value)}
                                            placeholder="Unlimited"
                                            min={1}
                                            className="input-field text-sm"
                                        />
                                    </div>

                                    {/* Password */}
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-medium text-surface-500 dark:text-surface-400 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={usePassword}
                                                onChange={() => setUsePassword(!usePassword)}
                                                className="rounded border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-brand-500 focus:ring-brand-500"
                                            />
                                            <Lock className="h-3.5 w-3.5" /> Password protection
                                        </label>
                                        {usePassword && (
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Enter password"
                                                className="input-field mt-2 text-sm"
                                            />
                                        )}
                                    </div>

                                    {/* OTP */}
                                    <div>
                                        <label className="flex items-center gap-2 text-xs font-medium text-surface-500 dark:text-surface-400 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={otpEnabled}
                                                onChange={() => setOtpEnabled(!otpEnabled)}
                                                className="rounded border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-brand-500 focus:ring-brand-500"
                                            />
                                            <Shield className="h-3.5 w-3.5" /> OTP verification required
                                        </label>
                                        {otpEnabled && (
                                            <p className="mt-1.5 ml-6 text-[11px] text-surface-400 dark:text-surface-500">
                                                A 6-digit code will be generated. Share it with the recipient separately.
                                            </p>
                                        )}
                                    </div>

                                    {linkError && <p className="text-xs text-red-500 dark:text-red-400">{linkError}</p>}

                                    <button
                                        onClick={handleCreateLink}
                                        disabled={linkLoading}
                                        className="btn-primary flex w-full items-center justify-center gap-2 text-sm"
                                    >
                                        {linkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                                        {linkLoading ? 'Creating...' : 'Create Share Link'}
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* ── TAB: Invite by Email ── */}
                    {tab === 'email' && (
                        <form onSubmit={handleInvite} className="space-y-4">
                            <p className="text-xs text-surface-500 dark:text-surface-400">
                                Share directly with a specific user by their registered email address.
                            </p>

                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-surface-500 dark:text-surface-400">Email address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                                    <input
                                        type="email"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        placeholder="user@example.com"
                                        className="input-field pl-9 text-sm"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-surface-500 dark:text-surface-400">Access level</label>
                                <div className="flex gap-2">
                                    {(['viewer', 'editor'] as const).map((r) => (
                                        <button
                                            type="button"
                                            key={r}
                                            onClick={() => setInviteRole(r)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all ${inviteRole === r
                                                ? 'bg-brand-500/20 text-brand-600 dark:text-brand-400 border border-brand-500/30'
                                                : 'bg-surface-50 dark:bg-surface-800 text-surface-500 dark:text-surface-400 border border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600'
                                                }`}
                                        >
                                            {r === 'viewer' ? <Eye className="h-3 w-3" /> : <Crown className="h-3 w-3" />}
                                            {r === 'viewer' ? 'Viewer' : 'Editor'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {inviteError && (
                                <p className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                                    {inviteError}
                                </p>
                            )}
                            {inviteSuccess && (
                                <p className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                                    <Check className="h-3.5 w-3.5" /> {inviteSuccess}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={inviteLoading || !inviteEmail}
                                className="btn-primary flex w-full items-center justify-center gap-2 text-sm"
                            >
                                {inviteLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                {inviteLoading ? 'Sharing...' : 'Share with this person'}
                            </button>
                        </form>
                    )}

                    {/* ── TAB: Manage Access ── */}
                    {tab === 'manage' && (
                        <div className="space-y-5">
                            {manageLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-brand-400" />
                                </div>
                            ) : (
                                <>
                                    {/* People with access */}
                                    <div>
                                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400 flex items-center gap-1.5">
                                            <UserPlus className="h-3.5 w-3.5" /> People with access ({permissions.length})
                                        </h4>
                                        {permissions.length === 0 ? (
                                            <p className="text-xs text-surface-400 dark:text-surface-500 py-3 text-center">No one has direct access yet.</p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {permissions.map((p: any) => (
                                                    <li key={p.id} className="flex items-center gap-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 px-3 py-2">
                                                        <div className="h-7 w-7 flex-shrink-0 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-600 dark:text-brand-400">
                                                            {p.grantedTo?.name?.charAt(0)?.toUpperCase() || '?'}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-medium text-surface-900 dark:text-white truncate">{p.grantedTo?.name || 'Unknown'}</p>
                                                            <p className="text-[10px] text-surface-500 truncate">{p.grantedTo?.email}</p>
                                                        </div>
                                                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${p.role === 'editor' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-surface-200 dark:bg-surface-700 text-surface-600 dark:text-surface-300'}`}>
                                                            {p.role}
                                                        </span>
                                                        <button
                                                            onClick={() => handleRevokePermission(p.id)}
                                                            className="text-surface-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                                            title="Revoke access"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>

                                    {/* Share links */}
                                    <div>
                                        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400 flex items-center gap-1.5">
                                            <Link2 className="h-3.5 w-3.5" /> Share links ({links.length})
                                        </h4>
                                        {links.length === 0 ? (
                                            <p className="text-xs text-surface-400 dark:text-surface-500 py-3 text-center">No share links created yet.</p>
                                        ) : (
                                            <ul className="space-y-2">
                                                {links.map((l: any) => (
                                                    <li key={l.id} className="flex items-center gap-3 rounded-lg bg-surface-50 dark:bg-surface-800/50 px-3 py-2">
                                                        <Link2 className="h-4 w-4 flex-shrink-0 text-brand-400" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[10px] font-mono text-surface-500 truncate">{l.token}</p>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className={`text-[10px] font-semibold uppercase ${l.isActive ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                    {l.isActive ? 'Active' : 'Disabled'}
                                                                </span>
                                                                {l.expiresAt && (
                                                                    <span className="text-[10px] text-surface-400">
                                                                        · Exp {new Date(l.expiresAt).toLocaleDateString()}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <a
                                                            href={l.shareUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-surface-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
                                                            title="Open link"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </a>
                                                        <button
                                                            onClick={() => handleDeleteLink(l.id)}
                                                            className="text-surface-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                                            title="Delete link"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
