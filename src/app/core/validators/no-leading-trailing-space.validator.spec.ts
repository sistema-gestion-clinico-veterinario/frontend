import { FormControl } from '@angular/forms';
import { noLeadingTrailingSpaceValidator } from './no-leading-trailing-space.validator';

describe('noLeadingTrailingSpaceValidator', () => {
  const validator = noLeadingTrailingSpaceValidator();

  it('returns error when value has leading space', () => {
    expect(validator(new FormControl(' abc'))).toEqual({ leadingTrailingSpace: true });
  });

  it('returns error when value has trailing space', () => {
    expect(validator(new FormControl('abc '))).toEqual({ leadingTrailingSpace: true });
  });

  it('returns null when value has no leading or trailing spaces', () => {
    expect(validator(new FormControl('abc def'))).toBeNull();
  });
});
