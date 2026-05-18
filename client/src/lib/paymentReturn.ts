import type { PaymentSuccessState } from '../appTypes';
import type { Payment } from '../types';

export type VerifyPaymentResponse = {
  message: string;
  payment: Payment;
  booking?: {
    id: string;
    offering?: { title: string } | null;
    artisan?: { displayName: string } | null;
  } | null;
};

export function paymentSuccessFromVerify(response: VerifyPaymentResponse): PaymentSuccessState {
  return {
    bookingId: response.payment.bookingId,
    amount: response.payment.amount,
    serviceTitle: response.booking?.offering?.title || 'your booking',
    artisanName: response.booking?.artisan?.displayName || 'your artisan',
  };
}
