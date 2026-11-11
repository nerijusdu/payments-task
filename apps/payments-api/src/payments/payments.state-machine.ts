import type { PaymentStatus } from '@payments/contracts';
import { AppError } from '@payments/http';

const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
	pending: ['requires_action', 'succeeded', 'failed', 'canceled'],
	requires_action: ['pending', 'succeeded', 'failed', 'canceled'],
	succeeded: ['refunded'],
	failed: [],
	canceled: [],
	refunded: [],
};

export const canTransition = (from: PaymentStatus, to: PaymentStatus) =>
	TRANSITIONS[from].includes(to);

export function assertTransition(from: PaymentStatus, to: PaymentStatus): void {
	if (!canTransition(from, to)) {
		throw new AppError(
			'INVALID_STATE_TRANSITION',
			409,
			`Cannot move payment from ${from} to ${to}`,
		);
	}
}
