import { targets as initialTargets } from "../data/mockData.js";
import { LEGACY_STORAGE_KEYS, STORAGE_KEYS, mergeById, readWithMigration, writeStorage } from "../utils/storage.js";

export function normalizeTarget(target) {
  return {
    lifecycleStatus: target.lifecycleStatus || "active",
    ...target,
  };
}

export function readTargets() {
  const savedTargets = readWithMigration(STORAGE_KEYS.targets, [], LEGACY_STORAGE_KEYS.targets);
  const normalizedInitialTargets = initialTargets.map(normalizeTarget);
  const normalizedSavedTargets = Array.isArray(savedTargets) ? savedTargets.map(normalizeTarget) : [];
  return mergeById(normalizedInitialTargets, normalizedSavedTargets);
}

export function writeTargets(targets) {
  writeStorage(
    STORAGE_KEYS.targets,
    Array.isArray(targets) ? targets.map(normalizeTarget) : []
  );
}

export function isTargetActive(target) {
  return (target?.lifecycleStatus || "active") !== "ended";
}

export function getActiveTargets(targets) {
  return targets.filter(isTargetActive);
}

export function getAssignedTargets(targets, checkerId) {
  return getActiveTargets(targets).filter((target) => target.assignedCheckerId === checkerId);
}

export function findTargetById(targets, targetId) {
  return targets.find((target) => target.id === targetId) ?? null;
}
