/**
 * The value of the input, select or textarea an event came from. The type
 * follows what it is assigned to: `reason.set(inputValue($event))`.
 */
export function inputValue<T extends string = string>(event: Event): T {
  return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value as T;
}
