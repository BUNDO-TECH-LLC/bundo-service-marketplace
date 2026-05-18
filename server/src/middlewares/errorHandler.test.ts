import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';

describe('AppError classes', () => {
  it('ValidationError uses 400 and VALIDATION_ERROR', () => {
    const error = new ValidationError('offeringId is required');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('offeringId is required');
  });

  it('NotFoundError uses 404 and NOT_FOUND', () => {
    const error = new NotFoundError('Booking');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Booking not found');
  });

  it('ConflictError preserves custom code', () => {
    const error = new ConflictError('Only completed bookings can be reviewed', 'BOOKING_NOT_COMPLETED');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe('BOOKING_NOT_COMPLETED');
  });
});
