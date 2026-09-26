 'use client';

import { Check, X } from 'lucide-react';
import { InstructorSummary } from '@/lib/types';

interface InstructorLoginModalProps {
	isOpen: boolean;
	onClose: () => void;
	currentInstructor: string;
	onSelectInstructor: (name: string) => void;
	instructorSummaries: InstructorSummary[];
}

export function InstructorLoginModal({
	isOpen,
	onClose,
	currentInstructor,
	onSelectInstructor,
	instructorSummaries
}: InstructorLoginModalProps) {
	if (!isOpen) return null;

	const instructors = instructorSummaries.some((summary) => summary.name === 'Admin')
		? instructorSummaries
		: [
				{
					name: 'Admin',
					assignedCount: instructorSummaries.reduce((total, summary) => total + summary.assignedCount, 0),
					completedCount: instructorSummaries.reduce((total, summary) => total + summary.completedCount, 0),
					revisitCount: instructorSummaries.reduce((total, summary) => total + summary.revisitCount, 0),
					clearedCount: instructorSummaries.reduce((total, summary) => total + summary.clearedCount, 0),
					primaryHall: 'All halls',
					levels: Array.from(new Set(instructorSummaries.flatMap((summary) => summary.levels)))
				},
				...instructorSummaries
			];

	const handleSelect = (name: string) => {
		onSelectInstructor(name);
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
			<div
				role="dialog"
				aria-modal="true"
				aria-labelledby="instructor-modal-title"
				className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/[0.08] bg-slate-900 shadow-2xl"
			>
				<div className="flex items-start justify-between border-b border-white/[0.08] bg-slate-950/80 p-6">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Access profile</p>
						<h2 id="instructor-modal-title" className="mt-2 text-xl font-bold tracking-tight text-white">
							Switch instructor
						</h2>
						<p className="mt-1 text-sm text-slate-400">Choose the evaluation roster you want to manage.</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close instructor selector"
						className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
					>
						<X className="h-5 w-5" />
					</button>
				</div>

				<div className="grid gap-3 p-6 sm:grid-cols-2">
					{instructors.map((summary) => {
						const isSelected = summary.name === currentInstructor;

						return (
							<button
								key={summary.name}
								type="button"
								onClick={() => handleSelect(summary.name)}
								className={`flex items-start justify-between rounded-2xl border p-4 text-left transition-colors ${
									isSelected
										? 'border-cyan-400/60 bg-cyan-400/10'
										: 'border-white/[0.08] bg-slate-950/60 hover:border-cyan-400/40 hover:bg-slate-950'
								}`}
							>
								<span>
									<span className="block font-semibold text-white">{summary.name}</span>
									<span className="mt-1 block text-xs text-slate-400">
										{summary.assignedCount} assigned · {summary.completedCount} completed
									</span>
									<span className="mt-3 block text-[11px] text-slate-500">
										{summary.primaryHall} · {summary.levels.join(', ') || 'All levels'}
									</span>
								</span>
								{isSelected && <Check className="h-5 w-5 shrink-0 text-cyan-300" />}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
