import { JOB_TYPE_WEIGHTS, STATUS_WEIGHT_FACTOR } from '@/types'
import type { Project } from '@/types'

/**
 * Workload capacity for a solo worker. Each job type carries a difficulty
 * weight; the sum across his active projects is his "current load", shown
 * against a personal ceiling. Difficulty is a proxy for bandwidth, not exact
 * hours — see the dashboard plan for the known trade-offs.
 */

// Sensible starting ceiling (~three hard jobs in progress at once). Tunable in
// Settings; this is only the fallback when the owner hasn't set their own.
export const DEFAULT_MAX_WORKLOAD = 30

type LoadInput = Pick<Project, 'job_type' | 'status'>

// A single project's contribution to current load. Unknown/retired/null job
// types fall back to the easiest weight ("Other"); completed projects are
// zeroed via the status factor, so they drop off automatically.
export function projectLoad(p: LoadInput): number {
	const base = JOB_TYPE_WEIGHTS[p.job_type ?? ''] ?? JOB_TYPE_WEIGHTS['Other']
	return base * (STATUS_WEIGHT_FACTOR[p.status] ?? 0)
}

export function currentLoad(projects: LoadInput[]): number {
	return projects.reduce((sum, p) => sum + projectLoad(p), 0)
}

export type CapacityZone = 'ok' | 'near' | 'over'

// pct is capped at 100 for the bar width; zone uses the true ratio so "over"
// triggers past the ceiling. Thresholds mirror BudgetTracker (near >= 80%).
export function capacityView(load: number, max: number): { pct: number; zone: CapacityZone } {
	const ratio = max > 0 ? load / max : 0
	const zone: CapacityZone = ratio > 1 ? 'over' : ratio >= 0.8 ? 'near' : 'ok'
	return { pct: Math.min(ratio * 100, 100), zone }
}
