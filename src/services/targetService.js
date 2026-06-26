import { targets as initialTargets } from "../data/mockData.js";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS, mergeById, readWithMigration, writeStorage } from "../utils/storage.js";

export function readTargets() {
  const savedTargets = readWithMigration(STORAGE_KEYS.targets, [], LEGACY_STORAGE_KEYS.targets);
  return mergeById(initialTargets, Array.isArray(savedTargets) ? savedTargets : []);
}

export function writeTargets(targets) {
  writeStorage(STORAGE_KEYS.targets, targets);
}

export function getAssignedTargets(targets, checkerId) {
  return targets.filter((target) => target.assignedCheckerId === checkerId);
}

export function findTargetById(targets, targetId) {
  return targets.find((target) => target.id === targetId) ?? null;
}
