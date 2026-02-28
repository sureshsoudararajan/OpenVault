import { Share2 } from 'lucide-react';

export default function SharedPage() {
    return (
        <div className="animate-fade-in">
            <div className="mb-6 flex items-center gap-3">
                <Share2 className="h-6 w-6 text-brand-400" />
                <h1 className="text-xl font-semibold text-white">Shared with Me</h1>
            </div>

            <div className="flex flex-col items-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-800">
                    <Share2 className="h-8 w-8 text-surface-600" />
                </div>
                <h3 className="text-lg font-medium text-surface-300">No shared files</h3>
                <p className="mt-1 text-sm text-surface-500">
                    Files that others share with you will appear here
                </p>
            </div>
        </div>
    );
}
