export const min = Math.min;
export const max = Math.max;

export const debounce = <T extends (...args: any[]) => void>(
  fn: T,
  ms: number
) => {
  let id: NodeJS.Timeout | null = null;
  const cancel = () => {
    if (id != null) {
      clearTimeout(id);
    }
  };
  const debouncedFn = (...args: Parameters<T>) => {
    cancel();
    id = setTimeout(() => {
      id = null;
      fn(...args);
    }, ms);
  };
  debouncedFn._cancel = cancel;
  return debouncedFn;
};
