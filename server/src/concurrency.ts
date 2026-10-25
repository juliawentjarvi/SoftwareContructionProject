import type { Model } from 'mongoose';

/**
 * Field-level conflict detection. Every mutable document keeps a version number per field (`fieldVersions`, 0 when a field was
 * never changed). A client that sends the versions it last saw (`expectedVersions`) only succeeds for a field if nobody changed
 * that field since; the first update persists and a later stale update to the same field is rejected. Changes to different
 * fields never conflict, and a client that sends no versions behaves as before (last write wins).
 */

export type ExpectedVersions = Record<string, number>;

export interface FieldConflict {
  version: number;
  value: unknown;
}

export type VersionedUpdate<D> = { ok: true; doc: D } | { ok: false; notFound: true } | { ok: false; notFound: false; fields: Record<string, FieldConflict>; current: D };

const versionOf = (doc: { fieldVersions?: Map<string, number> | Record<string, number> | null }, field: string): number => {
  const versions = doc.fieldVersions;
  if (!versions) return 0;
  return (versions instanceof Map ? versions.get(field) : versions[field]) ?? 0;
};

/** Which of the fields being changed were already changed since the client's version (checked up front so a stale request is reported as a conflict rather than as an invalid value). */
export function staleFields(doc: { fieldVersions?: Map<string, number> | Record<string, number> | null }, changes: Record<string, unknown>, expected: ExpectedVersions | undefined): Record<string, FieldConflict> {
  const fields: Record<string, FieldConflict> = {};
  for (const [field, version] of Object.entries(expected ?? {})) {
    if (changes[field] === undefined) continue;
    const now = versionOf(doc, field);
    if (now !== version) fields[field] = { version: now, value: (doc as Record<string, unknown>)[field] ?? null };
  }
  return fields;
}

/** All-or-nothing: either every field is applied and its version raised, or nothing changes. */
export async function updateWithVersions<D extends { fieldVersions?: Map<string, number> | Record<string, number> | null }>(
  model: Model<any>,
  baseFilter: Record<string, unknown>,
  changes: Record<string, unknown>,
  expected: ExpectedVersions | undefined,
): Promise<VersionedUpdate<D>> {
  const sets: Record<string, unknown> = {};
  const unsets: Record<string, ''> = {};
  const incs: Record<string, number> = {};
  for (const [field, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (value === null && field === 'stepCount') unsets[field] = '';
    else sets[field] = value;
    incs[`fieldVersions.${field}`] = 1;
  }

  const guards: Record<string, unknown>[] = [];
  for (const [field, version] of Object.entries(expected ?? {})) {
    if (!(`fieldVersions.${field}` in incs)) continue; // only fields being changed can conflict
    const path = `fieldVersions.${field}`;
    guards.push(version === 0 ? { $or: [{ [path]: 0 }, { [path]: { $exists: false } }] } : { [path]: version });
  }

  const filter = guards.length ? { $and: [baseFilter, ...guards] } : baseFilter;
  const update: Record<string, unknown> = { $inc: incs };
  if (Object.keys(sets).length) update.$set = sets;
  if (Object.keys(unsets).length) update.$unset = unsets;

  const updated = await model.findOneAndUpdate(filter, update, { new: true, runValidators: true });
  if (updated) return { ok: true, doc: updated as D };

  const current = await model.findOne(baseFilter);
  if (!current) return { ok: false, notFound: true };
  const fields: Record<string, FieldConflict> = {};
  for (const [field, version] of Object.entries(expected ?? {})) {
    if (!(`fieldVersions.${field}` in incs)) continue;
    const now = versionOf(current as never, field);
    if (now !== version) fields[field] = { version: now, value: (current as never as Record<string, unknown>)[field] ?? null };
  }
  return { ok: false, notFound: false, fields, current: current as D };
}
