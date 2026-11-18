const {
  computeAvailability, toBudgetDto, validateBudget, validateReservation,
} = require('../src/models/budget');

describe('computeAvailability', () => {
  test('Available = Allocated - Consumed - Reserved', () => {
    expect(computeAvailability({ allocated: 500000, consumed: 200000, reserved: 50000 }))
      .toEqual({ available: 250000, utilization: 50 });
  });

  test('zero allocation gives zero utilisation', () => {
    expect(computeAvailability({ allocated: 0, consumed: 0, reserved: 0 }).utilization).toBe(0);
  });
});

describe('toBudgetDto', () => {
  test('converts NUMERIC strings and computes availability', () => {
    const dto = toBudgetDto({
      id: 1, department: 'Engineering', fiscal_year: '2026-27',
      allocated_amount: '500000.00', consumed_amount: '200000.00', reserved_amount: '50000.00', alert_threshold: '80',
    });
    expect(dto).toMatchObject({ availableAmount: 250000, utilizationPercent: 50, alertThreshold: 80 });
  });
});

describe('validation', () => {
  test('budget requires department and amount', () => {
    expect(validateBudget({})).toHaveLength(2);
    expect(validateBudget({ department: 'Engineering', allocatedAmount: 1000 })).toEqual([]);
  });

  test('reservation requires poId and positive amount', () => {
    expect(validateReservation({ poId: 'PO-1001', amount: 0 })).toHaveLength(1);
    expect(validateReservation({ poId: 'PO-1001', amount: 10 })).toEqual([]);
  });
});
