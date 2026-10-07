import { FieldTree, LogicFn, SchemaPath, validate } from '@angular/forms/signals';

/** Red once the user has left the field (or tried to submit) and it is wrong. */
export function showsError(field: FieldTree<unknown>): boolean {
  const state = field();
  return state.touched() && state.invalid();
}

/** Like required(), but spaces alone do not count as a value. */
export function requiredText(path: SchemaPath<string>, message: LogicFn<string, string>): void {
  validate(path, (context) =>
    context.value().trim() === '' ? { kind: 'required', message: message(context) } : undefined
  );
}
