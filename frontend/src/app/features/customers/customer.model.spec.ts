import { customerDisplayName } from './customer.model';

describe('customerDisplayName', () => {
  it('lists a person by last name first', () => {
    expect(customerDisplayName({ firstName: 'Jean', lastName: 'Dupont' })).toBe('Dupont, Jean');
  });

  it('shows a company, which has no first name, alone', () => {
    expect(customerDisplayName({ firstName: '', lastName: 'Garage du Lac SA' })).toBe('Garage du Lac SA');
  });
});
