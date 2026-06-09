export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  numberOfElements: number;
  first: boolean;
  last: boolean;
  empty: boolean;
  page?: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}
