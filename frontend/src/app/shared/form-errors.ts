import {
  FieldTree, LogicFn, SchemaPath, max, min, pattern, provideSignalFormsConfig, validate,
} from '@angular/forms/signals';

/** Red once the user has left the field (or tried to submit) and it is wrong. */
export function showsError(field: FieldTree<unknown>): boolean {
  const state = field();
  return state.touched() && state.invalid();
}

/**
 * Every [formField] turns red with showsError(). DaisyUI's input-error only
 * sets the border color, which selects and textareas read too.
 */
export function provideFormErrorClasses() {
  return provideSignalFormsConfig({
    classes: { 'input-error': ({ state }) => state().touched() && state().invalid() },
  });
}

/** Like required(), but spaces alone do not count as a value. */
export function requiredText(path: SchemaPath<string>, message: LogicFn<string, string>): void {
  validate(path, (context) =>
    context.value().trim() === '' ? { kind: 'required', message: message(context) } : undefined
  );
}

/** From 0 to 100; empty is left to required(). */
export function percent(path: SchemaPath<number | null>, message: LogicFn<number | null, string>): void {
  min(path, 0, { message });
  max(path, 100, { message });
}

/** A whole number; empty is left to required(). */
export function integer(path: SchemaPath<number | null>, message?: LogicFn<number | null, string>): void {
  validate(path, (context) => {
    const value = context.value();
    return value == null || Number.isInteger(value) ? undefined : { kind: 'integer', message: message?.(context) };
  });
}

/** Two letters (CH, LI); empty is left to required(). */
export function countryCode(path: SchemaPath<string>, message: LogicFn<string, string>): void {
  pattern(path, /^\s*[A-Za-z]{2}\s*$/, { message });
}
