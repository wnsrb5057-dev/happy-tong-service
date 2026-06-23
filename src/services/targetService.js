export function getAssignedTargets(targets, checkerId) {
  return targets.filter((target) => target.assignedCheckerId === checkerId);
}

export function findTargetById(targets, targetId) {
  return targets.find((target) => target.id === targetId) ?? null;
}
