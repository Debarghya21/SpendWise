const { validateSupplier, toSupplierDto } = require('../src/models/supplier');

describe('validateSupplier', () => {
  const valid = {
    name: 'ABC Technologies', email: 'vendor@abc.com', gstNumber: '29ABCDE1234F1Z5', category: 'IT Equipment',
  };

  test('accepts a valid supplier', () => {
    expect(validateSupplier(valid)).toEqual([]);
  });

  test('rejects invalid GST and email', () => {
    const errors = validateSupplier({ ...valid, email: 'bad', gstNumber: '123' });
    expect(errors).toHaveLength(2);
  });

  test('partial validation only checks provided fields', () => {
    expect(validateSupplier({ phone: '999' }, { partial: true })).toEqual([]);
    expect(validateSupplier({ email: 'x' }, { partial: true })).toHaveLength(1);
  });

  test('rejects unknown status', () => {
    expect(validateSupplier({ ...valid, status: 'FOO' })).toHaveLength(1);
  });
});

describe('toSupplierDto', () => {
  test('maps database row to API shape', () => {
    const dto = toSupplierDto({
      id: 'SUP-101', name: 'ABC', email: 'a@b.com', gst_number: '29ABCDE1234F1Z5',
      category_name: 'IT Equipment', status: 'ACTIVE', rating: '4.50', review_count: 3,
    });
    expect(dto).toMatchObject({ id: 'SUP-101', gstNumber: '29ABCDE1234F1Z5', rating: 4.5, reviewCount: 3 });
  });
});
