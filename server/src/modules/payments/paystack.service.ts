import crypto from 'crypto';
import { env } from '../../config/env';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export const isPaystackConfigured = () => Boolean(env.PAYSTACK_SECRET_KEY);

const paystackRequest = async <T>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error('PAYSTACK_NOT_CONFIGURED');
  }

  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${env.PAYSTACK_SECRET_KEY}`);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const data = (await response.json()) as { status?: boolean; message?: string };

  if (!response.ok || data.status === false) {
    throw new Error(data.message || 'Paystack request failed');
  }

  return data as T;
};

export const computePaystackSignatureHex = (rawBody: string, secret: string) =>
  crypto.createHmac('sha512', secret).update(rawBody).digest('hex');

export const verifyPaystackSignature = (rawBody: string, signature?: string) => {
  if (!env.PAYSTACK_SECRET_KEY || !signature) {
    return false;
  }

  const hash = computePaystackSignatureHex(rawBody, env.PAYSTACK_SECRET_KEY);

  const expected = Buffer.from(hash, 'hex');
  const received = Buffer.from(signature, 'hex');

  return (
    expected.length === received.length &&
    crypto.timingSafeEqual(expected, received)
  );
};

export const initializePaystackTransaction = async (input: {
  email: string;
  amountKobo: number;
  reference: string;
  metadata: Record<string, string>;
}) => {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      authorization_url: string;
      access_code: string;
      reference: string;
    };
  }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      callback_url: env.PAYSTACK_CALLBACK_URL,
      metadata: input.metadata,
    }),
  });
};

export const listPaystackBanks = async () => {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: Array<{
      name: string;
      code: string;
      active: boolean;
      currency: string;
      country: string;
      supports_transfer: boolean;
    }>;
  }>('/bank?country=nigeria');
};

export const verifyPaystackTransaction = async (reference: string) => {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      status: string;
      reference: string;
      amount: number;
      paid_at?: string;
    };
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
};

export const resolvePaystackAccount = async (input: {
  accountNumber: string;
  bankCode: string;
}) => {
  const query = new URLSearchParams({
    account_number: input.accountNumber,
    bank_code: input.bankCode,
  });

  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      account_number: string;
      account_name: string;
    };
  }>(`/bank/resolve?${query.toString()}`);
};

export const createPaystackTransferRecipient = async (input: {
  name: string;
  accountNumber: string;
  bankCode: string;
}) => {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      recipient_code: string;
      details?: {
        account_name?: string;
        bank_name?: string;
      };
    };
  }>('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: 'nuban',
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: 'NGN',
    }),
  });
};

export const initiatePaystackTransfer = async (input: {
  amountKobo: number;
  recipientCode: string;
  reason: string;
  reference: string;
}) => {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      transfer_code: string;
      reference: string;
      status: string;
    };
  }>('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount: input.amountKobo,
      recipient: input.recipientCode,
      reason: input.reason,
      reference: input.reference,
    }),
  });
};

export const finalizePaystackTransfer = async (input: {
  transferCode: string;
  otp: string;
}) => {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      transfer_code: string;
      reference: string;
      status: string;
    };
  }>('/transfer/finalize_transfer', {
    method: 'POST',
    body: JSON.stringify({
      transfer_code: input.transferCode,
      otp: input.otp,
    }),
  });
};

export const createPaystackRefund = async (input: {
  transactionReference: string;
  amountKobo?: number;
  customerNote?: string;
}) => {
  return paystackRequest<{
    status: boolean;
    message: string;
    data: {
      id: number;
      transaction_reference: string;
      amount: number;
      status: string;
    };
  }>('/refund', {
    method: 'POST',
    body: JSON.stringify({
      transaction: input.transactionReference,
      amount: input.amountKobo,
      customer_note: input.customerNote,
    }),
  });
};
