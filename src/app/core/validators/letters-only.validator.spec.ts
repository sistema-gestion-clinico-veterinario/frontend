import { FormControl } from '@angular/forms';
import { lettersOnlyValidator } from './letters-only.validator';

describe('lettersOnlyValidator', () => {
  const validator = lettersOnlyValidator();

  it('returns null for valid letters including Spanish accents', () => {
    expect(validator(new FormControl('José María'))).toBeNull();
  });

  it('returns error when value contains digits', () => {
    expect(validator(new FormControl('abc123'))).toEqual({ lettersOnly: true });
  });

  it('returns null for empty string', () => {
    expect(validator(new FormControl(''))).toBeNull();
  });
});
